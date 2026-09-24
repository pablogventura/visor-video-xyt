import type { SizeTier, VideoMeta } from './types';

export function estimateFps(durationSec: number, video: HTMLVideoElement): number {
  // HTMLVideoElement does not expose FPS reliably; use a conservative default.
  const candidate = Number((video as HTMLVideoElement & { getVideoPlaybackQuality?: () => { totalVideoFrames?: number } }).getVideoPlaybackQuality?.().totalVideoFrames);
  if (Number.isFinite(candidate) && candidate > 0 && durationSec > 0) {
    return Math.max(1, Math.min(120, candidate / durationSec));
  }
  return 30;
}

export function buildVideoMeta(file: File, video: HTMLVideoElement): VideoMeta {
  const width = video.videoWidth;
  const height = video.videoHeight;
  const durationSec = Number.isFinite(video.duration) ? video.duration : 0;
  const fps = estimateFps(durationSec, video);
  const frameCount = Math.max(1, Math.round(durationSec * fps));
  const mimeType = file.type || 'video/*';
  const codecHint = mimeType.includes('/') ? mimeType.split('/')[1] ?? null : null;
  const isHeavy = durationSec > 600 || width > 1920 || height > 1080;

  return {
    width,
    height,
    durationSec,
    fps,
    frameCount,
    mimeType,
    fileName: file.name,
    codecHint,
    isHeavy,
  };
}

export function frameIndexToTime(frameIndex: number, fps: number, durationSec: number): number {
  const t = frameIndex / fps;
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return Math.max(0, t);
  }
  return Math.min(Math.max(0, t), Math.max(0, durationSec - 1 / fps));
}

export function timeToFrameIndex(timeSec: number, fps: number, frameCount: number): number {
  return Math.min(frameCount - 1, Math.max(0, Math.round(timeSec * fps)));
}

export function uniformSampleIndices(frameCount: number, sampleCount: number): number[] {
  const count = Math.max(1, Math.min(frameCount, Math.floor(sampleCount)));
  if (count === 1) {
    return [0];
  }
  const indices: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const idx = Math.round((i * (frameCount - 1)) / (count - 1));
    indices.push(idx);
  }
  return Array.from(new Set(indices));
}

export function computeDownscaleSize(
  srcWidth: number,
  srcHeight: number,
  maxSide: number,
  tier: SizeTier,
): { width: number; height: number } {
  if (tier === 'full') {
    return { width: srcWidth, height: srcHeight };
  }
  const longest = Math.max(srcWidth, srcHeight);
  if (longest <= maxSide) {
    return { width: srcWidth, height: srcHeight };
  }
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(srcWidth * scale)),
    height: Math.max(1, Math.round(srcHeight * scale)),
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
