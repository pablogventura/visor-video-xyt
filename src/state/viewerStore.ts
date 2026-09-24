import { DEFAULT_STATE, type CursorInfo, type VideoMeta, type ViewerState } from '../core/types';
import { clamp } from '../core/SpaceTimeVolume';

type Listener = () => void;

class ViewerStore {
  private state: ViewerState = { ...DEFAULT_STATE };
  private readonly listeners = new Set<Listener>();

  getState(): ViewerState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private set(partial: Partial<ViewerState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      listener();
    }
  }

  resetForVideo(meta: VideoMeta): void {
    this.set({
      meta,
      x0: Math.floor(meta.width / 2),
      y0: Math.floor(meta.height / 2),
      t0: 0,
      isPlaying: false,
      frameSampling: Math.min(200, meta.frameCount),
      sliceTimeSamples: Math.min(256, meta.frameCount),
      loadWarning: meta.isHeavy
        ? 'Video largo o de alta resolución: el muestreo puede ser lento.'
        : null,
      statusMessage: `Video cargado: ${meta.fileName}`,
      cursor: null,
    });
  }

  clearVideo(): void {
    this.set({ ...DEFAULT_STATE });
  }

  setX0(x0: number): void {
    const meta = this.state.meta;
    if (!meta) {
      return;
    }
    this.set({ x0: clamp(Math.round(x0), 0, meta.width - 1) });
  }

  setY0(y0: number): void {
    const meta = this.state.meta;
    if (!meta) {
      return;
    }
    this.set({ y0: clamp(Math.round(y0), 0, meta.height - 1) });
  }

  setT0(t0: number): void {
    const meta = this.state.meta;
    if (!meta) {
      return;
    }
    this.set({ t0: clamp(t0, 0, Math.max(0, meta.durationSec - 1e-4)) });
  }

  setPlaying(isPlaying: boolean): void {
    this.set({ isPlaying });
  }

  togglePlaying(): void {
    this.set({ isPlaying: !this.state.isPlaying });
  }

  setTemporalScale(temporalScale: number): void {
    this.set({ temporalScale: clamp(temporalScale, 0.1, 8) });
  }

  setFrameSampling(frameSampling: number): void {
    this.set({ frameSampling: clamp(Math.round(frameSampling), 32, 512) });
  }

  setSliceThickness(sliceThickness: number): void {
    this.set({ sliceThickness: clamp(Math.round(sliceThickness), 1, 21) });
  }

  setEnhanceTemporal(enhanceTemporal: boolean): void {
    this.set({ enhanceTemporal });
  }

  setSwapXtOrientation(swapXtOrientation: boolean): void {
    this.set({ swapXtOrientation });
  }

  setSliceTimeSamples(sliceTimeSamples: number): void {
    this.set({ sliceTimeSamples: clamp(Math.round(sliceTimeSamples), 32, 512) });
  }

  setCursor(cursor: CursorInfo | null): void {
    this.set({ cursor });
  }

  setStatusMessage(statusMessage: string): void {
    this.set({ statusMessage });
  }

  setBuildingSlices(isBuildingSlices: boolean): void {
    this.set({ isBuildingSlices });
  }

  setBuildingVolume(isBuildingVolume: boolean): void {
    this.set({ isBuildingVolume });
  }
}

export const viewerStore = new ViewerStore();
