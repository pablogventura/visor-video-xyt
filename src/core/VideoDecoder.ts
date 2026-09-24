import { FrameCache } from './FrameCache';
import { buildVideoMeta, clamp, computeDownscaleSize, frameIndexToTime } from './SpaceTimeVolume';
import type { FramePixels, SizeTier, VideoMeta } from './types';

type SeekTask = {
  frameIndex: number;
  tier: SizeTier;
  maxSide: number;
  resolve: (pixels: FramePixels) => void;
  reject: (error: unknown) => void;
};

/**
 * Browser-local video frame access via HTMLVideoElement.
 * Seeks are serialized to avoid race conditions on currentTime.
 */
export class VideoFrameSource {
  private video: HTMLVideoElement | null = null;
  private objectUrl: string | null = null;
  private meta: VideoMeta | null = null;
  private readonly cache = new FrameCache(96);
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private queue: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor() {
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Unable to create 2D canvas context');
    }
    this.ctx = ctx;
  }

  getMeta(): VideoMeta | null {
    return this.meta;
  }

  getVideoElement(): HTMLVideoElement | null {
    return this.video;
  }

  getCacheSize(): number {
    return this.cache.size();
  }

  async loadFile(file: File): Promise<VideoMeta> {
    this.disposeMedia();
    this.disposed = false;
    this.cache.clear();

    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('No se pudo cargar el video en el navegador.'));
      };
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onLoaded);
        video.removeEventListener('error', onError);
      };
      video.addEventListener('loadedmetadata', onLoaded);
      video.addEventListener('error', onError);
    });

    this.objectUrl = objectUrl;
    this.video = video;
    this.meta = buildVideoMeta(file, video);
    return this.meta;
  }

  async getFrame(frameIndex: number, tier: SizeTier, maxSide: number): Promise<FramePixels> {
    if (!this.video || !this.meta) {
      throw new Error('No video loaded');
    }
    const size = computeDownscaleSize(this.meta.width, this.meta.height, maxSide, tier);
    const cached = this.cache.get(frameIndex, tier, size.width, size.height);
    if (cached) {
      return cached;
    }

    return new Promise<FramePixels>((resolve, reject) => {
      const task: SeekTask = { frameIndex, tier, maxSide, resolve, reject };
      this.queue = this.queue.then(() => this.runSeekTask(task)).catch(() => undefined);
    });
  }

  async seekDisplay(timeSec: number): Promise<void> {
    if (!this.video || !this.meta) {
      return;
    }
    const t = clamp(timeSec, 0, Math.max(0, this.meta.durationSec - 1e-3));
    await this.seekTo(t);
  }

  dispose(): void {
    this.disposed = true;
    this.disposeMedia();
    this.cache.clear();
  }

  private disposeMedia(): void {
    if (this.video) {
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
      this.video = null;
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.meta = null;
  }

  private async runSeekTask(task: SeekTask): Promise<void> {
    if (this.disposed || !this.video || !this.meta) {
      task.reject(new Error('Decoder disposed'));
      return;
    }

    try {
      const size = computeDownscaleSize(this.meta.width, this.meta.height, task.maxSide, task.tier);
      const cached = this.cache.get(task.frameIndex, task.tier, size.width, size.height);
      if (cached) {
        task.resolve(cached);
        return;
      }

      const timestampSec = frameIndexToTime(task.frameIndex, this.meta.fps, this.meta.durationSec);
      await this.seekTo(timestampSec);
      const pixels = this.capture(task.frameIndex, timestampSec, size.width, size.height);
      this.cache.set(task.frameIndex, task.tier, pixels);
      task.resolve(pixels);
    } catch (error) {
      task.reject(error);
    }
  }

  private seekTo(timeSec: number): Promise<void> {
    const video = this.video;
    if (!video) {
      return Promise.reject(new Error('No video'));
    }

    return new Promise((resolve, reject) => {
      const onSeeked = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('Seek failed'));
      };
      const cleanup = () => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
      };

      if (Math.abs(video.currentTime - timeSec) < 1e-4) {
        resolve();
        return;
      }

      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', onError);
      try {
        video.currentTime = timeSec;
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }

  private capture(
    frameIndex: number,
    timestampSec: number,
    width: number,
    height: number,
  ): FramePixels {
    if (!this.video) {
      throw new Error('No video');
    }
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.drawImage(this.video, 0, 0, width, height);
    const imageData = this.ctx.getImageData(0, 0, width, height);
    return {
      width,
      height,
      data: imageData.data,
      frameIndex,
      timestampSec,
    };
  }
}
