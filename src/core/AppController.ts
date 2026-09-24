import { frameIndexToTime, timeToFrameIndex, uniformSampleIndices } from './SpaceTimeVolume';
import { SliceExtractor, sliceToImageData } from './SliceExtractor';
import { VideoFrameSource } from './VideoDecoder';
import type { SliceImage } from './types';
import { viewerStore } from '../state/viewerStore';
import { CanvasPlaneViewer } from '../viewers/CanvasPlaneViewer';
import { ThreeDViewer } from '../viewers/ThreeDViewer';

function debounce<T extends (...args: never[]) => void>(fn: T, waitMs: number): T & { cancel: () => void } {
  let timer: number | null = null;
  const wrapped = ((...args: never[]) => {
    if (timer !== null) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  }) as T & { cancel: () => void };
  wrapped.cancel = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };
  return wrapped;
}

/**
 * Orchestrates decoder, slice extraction and viewers outside of React render.
 */
export class AppController {
  readonly source = new VideoFrameSource();
  readonly extractor = new SliceExtractor(this.source);

  private xyViewer: CanvasPlaneViewer | null = null;
  private xtViewer: CanvasPlaneViewer | null = null;
  private ytViewer: CanvasPlaneViewer | null = null;
  private volumeViewer: ThreeDViewer | null = null;

  private xyImage: SliceImage | null = null;
  private xtImage: SliceImage | null = null;
  private ytImage: SliceImage | null = null;
  private sampleIndices: number[] = [];

  private sliceGeneration = 0;
  private volumeGeneration = 0;
  private playRaf = 0;
  private lastPlayTs = 0;
  private unsub: (() => void) | null = null;

  private readonly rebuildSlicesDebounced = debounce(() => {
    void this.rebuildSlices();
  }, 100);

  private readonly rebuildVolumeDebounced = debounce(() => {
    void this.rebuildVolume();
  }, 200);

  mountViewers(args: {
    xyCanvas: HTMLCanvasElement;
    xtCanvas: HTMLCanvasElement;
    ytCanvas: HTMLCanvasElement;
    volumeHost: HTMLElement;
  }): void {
    this.disposeViewers();

    this.xyViewer = new CanvasPlaneViewer(
      args.xyCanvas,
      {
        onClick: (nx, ny) => {
          const meta = viewerStore.getState().meta;
          if (!meta) {
            return;
          }
          viewerStore.setX0(nx * (meta.width - 1));
          viewerStore.setY0(ny * (meta.height - 1));
        },
        onHover: (info) => viewerStore.setCursor(info),
      },
      (px, py, rgb) => {
        const state = viewerStore.getState();
        const meta = state.meta;
        if (!meta || !this.xyImage) {
          return null;
        }
        const x = Math.round((px / this.xyImage.width) * (meta.width - 1));
        const y = Math.round((py / this.xyImage.height) * (meta.height - 1));
        const frame = timeToFrameIndex(state.t0, meta.fps, meta.frameCount);
        return {
          view: 'xy',
          x,
          y,
          t: state.t0,
          frame,
          timestampSec: state.t0,
          ...rgb,
        };
      },
    );
    this.xyViewer.setAxisLabels('x', 'y');

    this.xtViewer = new CanvasPlaneViewer(
      args.xtCanvas,
      {
        onClick: (nx, ny) => {
          const meta = viewerStore.getState().meta;
          if (!meta || !this.xtImage) {
            return;
          }
          const mapped = this.extractor.mapXtClick(
            nx * this.xtImage.width,
            ny * this.xtImage.height,
            this.xtImage,
            meta,
            this.sampleIndices,
            viewerStore.getState().swapXtOrientation,
          );
          viewerStore.setX0(mapped.x0);
          viewerStore.setT0(mapped.t0);
        },
        onHover: (info) => viewerStore.setCursor(info),
      },
      (px, py, rgb) => {
        const state = viewerStore.getState();
        const meta = state.meta;
        if (!meta || !this.xtImage) {
          return null;
        }
        const mapped = this.extractor.mapXtClick(
          px,
          py,
          this.xtImage,
          meta,
          this.sampleIndices,
          state.swapXtOrientation,
        );
        const frame = timeToFrameIndex(mapped.t0, meta.fps, meta.frameCount);
        return {
          view: 'xt',
          x: mapped.x0,
          y: state.y0,
          t: mapped.t0,
          frame,
          timestampSec: mapped.t0,
          ...rgb,
        };
      },
    );

    this.ytViewer = new CanvasPlaneViewer(
      args.ytCanvas,
      {
        onClick: (nx, ny) => {
          const meta = viewerStore.getState().meta;
          if (!meta || !this.ytImage) {
            return;
          }
          const mapped = this.extractor.mapYtClick(
            nx * this.ytImage.width,
            ny * this.ytImage.height,
            this.ytImage,
            meta,
            this.sampleIndices,
          );
          viewerStore.setY0(mapped.y0);
          viewerStore.setT0(mapped.t0);
        },
        onHover: (info) => viewerStore.setCursor(info),
      },
      (px, py, rgb) => {
        const state = viewerStore.getState();
        const meta = state.meta;
        if (!meta || !this.ytImage) {
          return null;
        }
        const mapped = this.extractor.mapYtClick(px, py, this.ytImage, meta, this.sampleIndices);
        const frame = timeToFrameIndex(mapped.t0, meta.fps, meta.frameCount);
        return {
          view: 'yt',
          x: state.x0,
          y: mapped.y0,
          t: mapped.t0,
          frame,
          timestampSec: mapped.t0,
          ...rgb,
        };
      },
    );
    this.ytViewer.setAxisLabels('t', 'y');

    this.volumeViewer = new ThreeDViewer(args.volumeHost);

    this.unsub = viewerStore.subscribe(() => {
      void this.onStoreChange();
    });
    void this.onStoreChange();
  }

  async loadFile(file: File): Promise<void> {
    viewerStore.setStatusMessage('Cargando video...');
    viewerStore.setPlaying(false);
    this.lastXyT = Number.NaN;
    this.lastSliceKey = '';
    this.lastVolumeKey = '';
    this.lastTemporalScale = Number.NaN;
    const meta = await this.source.loadFile(file);
    viewerStore.resetForVideo(meta);
    this.volumeViewer?.setMeta(meta);
    await this.rebuildXy();
    await this.rebuildSlices();
    await this.rebuildVolume();
  }

  exportXy(): void {
    this.xyViewer?.exportPng('xy-slice.png');
  }

  exportXt(): void {
    this.xtViewer?.exportPng('xt-slice.png');
  }

  exportYt(): void {
    this.ytViewer?.exportPng('yt-slice.png');
  }

  exportVolume(): void {
    this.volumeViewer?.exportPng('xyt-volume.png');
  }

  dispose(): void {
    this.rebuildSlicesDebounced.cancel();
    this.rebuildVolumeDebounced.cancel();
    this.stopPlaybackLoop();
    this.unsub?.();
    this.unsub = null;
    this.disposeViewers();
    this.source.dispose();
  }

  private disposeViewers(): void {
    this.xyViewer?.dispose();
    this.xtViewer?.dispose();
    this.ytViewer?.dispose();
    this.volumeViewer?.dispose();
    this.xyViewer = null;
    this.xtViewer = null;
    this.ytViewer = null;
    this.volumeViewer = null;
  }

  private lastXyT = Number.NaN;
  private lastSliceKey = '';
  private lastVolumeKey = '';
  private lastTemporalScale = Number.NaN;

  private async onStoreChange(): Promise<void> {
    const state = viewerStore.getState();
    if (!state.meta) {
      return;
    }

    this.updateCrosshairs();
    if (state.temporalScale !== this.lastTemporalScale) {
      this.lastTemporalScale = state.temporalScale;
      this.volumeViewer?.setTemporalScale(state.temporalScale);
    }
    this.volumeViewer?.setCutPositions(state.x0, state.y0, state.t0);

    if (state.isPlaying) {
      this.startPlaybackLoop();
    } else {
      this.stopPlaybackLoop();
    }

    if (state.t0 !== this.lastXyT) {
      this.lastXyT = state.t0;
      if (!state.isPlaying) {
        void this.rebuildXy();
      }
    }

    const sliceKey = [
      state.x0,
      state.y0,
      state.sliceThickness,
      state.enhanceTemporal,
      state.swapXtOrientation,
      state.sliceTimeSamples,
      state.downscaleMax,
    ].join(':');
    if (sliceKey !== this.lastSliceKey) {
      this.lastSliceKey = sliceKey;
      this.rebuildSlicesDebounced();
    }

    const volumeKey = [state.frameSampling, state.downscaleMax].join(':');
    if (volumeKey !== this.lastVolumeKey) {
      this.lastVolumeKey = volumeKey;
      this.rebuildVolumeDebounced();
    }
  }

  private updateCrosshairs(): void {
    const state = viewerStore.getState();
    const meta = state.meta;
    if (!meta) {
      return;
    }
    const xN = meta.width > 1 ? state.x0 / (meta.width - 1) : 0.5;
    const yN = meta.height > 1 ? state.y0 / (meta.height - 1) : 0.5;
    const tN = meta.durationSec > 0 ? state.t0 / meta.durationSec : 0;

    this.xyViewer?.setCrosshair(xN, yN);

    if (state.swapXtOrientation) {
      this.xtViewer?.setAxisLabels('t', 'x');
      this.xtViewer?.setCrosshair(tN, xN);
    } else {
      this.xtViewer?.setAxisLabels('x', 't');
      this.xtViewer?.setCrosshair(xN, tN);
    }
    this.ytViewer?.setCrosshair(tN, yN);
  }

  private async rebuildXy(): Promise<void> {
    const state = viewerStore.getState();
    const meta = state.meta;
    if (!meta) {
      return;
    }
    const frame = timeToFrameIndex(state.t0, meta.fps, meta.frameCount);
    const pixels = await this.extractor.extractXy(frame, state.downscaleMax, true);
    this.xyImage = { width: pixels.width, height: pixels.height, data: pixels.data };
    this.xyViewer?.setImage(this.xyImage);
    this.volumeViewer?.setCuttingPlaneImages(this.xyImage, this.xtImage, this.ytImage);
    this.volumeViewer?.setCutPositions(state.x0, state.y0, state.t0);
  }

  private async rebuildSlices(): Promise<void> {
    const state = viewerStore.getState();
    const meta = state.meta;
    if (!meta) {
      return;
    }
    const generation = ++this.sliceGeneration;
    viewerStore.setBuildingSlices(true);
    viewerStore.setStatusMessage('Construyendo cortes XT/YT...');
    try {
      const result = await this.extractor.extractXtYt(meta, {
        x0: state.x0,
        y0: state.y0,
        thickness: state.sliceThickness,
        timeSamples: state.sliceTimeSamples,
        enhanceTemporal: state.enhanceTemporal,
        swapXtOrientation: state.swapXtOrientation,
        maxSide: state.downscaleMax,
      });
      if (generation !== this.sliceGeneration) {
        return;
      }
      this.xtImage = result.xt;
      this.ytImage = result.yt;
      this.sampleIndices = result.sampleIndices;
      this.xtViewer?.setImage(this.xtImage);
      this.ytViewer?.setImage(this.ytImage);
      this.volumeViewer?.setCuttingPlaneImages(this.xyImage, this.xtImage, this.ytImage);
      this.volumeViewer?.setCutPositions(state.x0, state.y0, state.t0);
      viewerStore.setStatusMessage('Cortes XT/YT listos.');
    } catch (error) {
      console.error(error);
      viewerStore.setStatusMessage('Error al construir cortes XT/YT.');
    } finally {
      if (generation === this.sliceGeneration) {
        viewerStore.setBuildingSlices(false);
      }
    }
  }

  private async rebuildVolume(): Promise<void> {
    const state = viewerStore.getState();
    const meta = state.meta;
    if (!meta || !this.volumeViewer) {
      return;
    }
    const generation = ++this.volumeGeneration;
    viewerStore.setBuildingVolume(true);
    viewerStore.setStatusMessage('Muestreando volumen 3D...');
    try {
      const indices = uniformSampleIndices(meta.frameCount, state.frameSampling);
      const planes = [];
      for (const frameIndex of indices) {
        if (generation !== this.volumeGeneration) {
          return;
        }
        const pixels = await this.source.getFrame(frameIndex, 'downscaled', state.downscaleMax);
        const tNorm = meta.frameCount > 1 ? frameIndex / (meta.frameCount - 1) : 0;
        planes.push({ frameIndex, tNorm, pixels });
      }
      if (generation !== this.volumeGeneration) {
        return;
      }
      this.volumeViewer.setVolumePlanes(planes);
      this.volumeViewer.setTemporalScale(state.temporalScale);
      viewerStore.setStatusMessage(`Volumen 3D: ${planes.length} planos.`);
    } catch (error) {
      console.error(error);
      viewerStore.setStatusMessage('Error al construir el volumen 3D.');
    } finally {
      if (generation === this.volumeGeneration) {
        viewerStore.setBuildingVolume(false);
      }
    }
  }

  private startPlaybackLoop(): void {
    if (this.playRaf) {
      return;
    }
    this.lastPlayTs = performance.now();
    const step = (now: number) => {
      const state = viewerStore.getState();
      if (!state.isPlaying || !state.meta) {
        this.playRaf = 0;
        return;
      }
      const dt = (now - this.lastPlayTs) / 1000;
      this.lastPlayTs = now;
      let next = state.t0 + dt;
      if (next >= state.meta.durationSec) {
        next = 0;
      }
      viewerStore.setT0(next);
      // Force XY refresh during playback
      void this.rebuildXy();
      this.playRaf = requestAnimationFrame(step);
    };
    this.playRaf = requestAnimationFrame(step);
  }

  private stopPlaybackLoop(): void {
    if (this.playRaf) {
      cancelAnimationFrame(this.playRaf);
      this.playRaf = 0;
    }
  }

  // Expose for potential debugging
  getSliceImageData(kind: 'xy' | 'xt' | 'yt'): ImageData | null {
    const image = kind === 'xy' ? this.xyImage : kind === 'xt' ? this.xtImage : this.ytImage;
    return image ? sliceToImageData(image) : null;
  }

  frameLabel(t0: number): string {
    const meta = viewerStore.getState().meta;
    if (!meta) {
      return '-';
    }
    const frame = timeToFrameIndex(t0, meta.fps, meta.frameCount);
    const ts = frameIndexToTime(frame, meta.fps, meta.durationSec);
    return `${frame} / ${ts.toFixed(3)}s`;
  }
}
