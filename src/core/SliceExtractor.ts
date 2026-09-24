import { clamp, frameIndexToTime, uniformSampleIndices } from './SpaceTimeVolume';
import type { FramePixels, SliceImage, VideoMeta } from './types';
import type { VideoFrameSource } from './VideoDecoder';

export interface ExtractOptions {
  x0: number;
  y0: number;
  thickness: number;
  timeSamples: number;
  enhanceTemporal: boolean;
  swapXtOrientation: boolean;
  maxSide: number;
  onProgress?: (done: number, total: number) => void;
}

function averageRow(
  frame: FramePixels,
  yCenter: number,
  thickness: number,
  out: Uint8ClampedArray,
  outOffset: number,
): void {
  const y0 = clamp(Math.round(yCenter), 0, frame.height - 1);
  const half = Math.floor(Math.max(1, thickness) / 2);
  const yStart = clamp(y0 - half, 0, frame.height - 1);
  const yEnd = clamp(y0 + half, 0, frame.height - 1);
  const rows = yEnd - yStart + 1;

  for (let x = 0; x < frame.width; x += 1) {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (let y = yStart; y <= yEnd; y += 1) {
      const i = (y * frame.width + x) * 4;
      r += frame.data[i]!;
      g += frame.data[i + 1]!;
      b += frame.data[i + 2]!;
      a += frame.data[i + 3]!;
    }
    const o = outOffset + x * 4;
    out[o] = Math.round(r / rows);
    out[o + 1] = Math.round(g / rows);
    out[o + 2] = Math.round(b / rows);
    out[o + 3] = Math.round(a / rows);
  }
}

function averageColumn(
  frame: FramePixels,
  xCenter: number,
  thickness: number,
  out: Uint8ClampedArray,
  outOffset: number,
): void {
  const x0 = clamp(Math.round(xCenter), 0, frame.width - 1);
  const half = Math.floor(Math.max(1, thickness) / 2);
  const xStart = clamp(x0 - half, 0, frame.width - 1);
  const xEnd = clamp(x0 + half, 0, frame.width - 1);
  const cols = xEnd - xStart + 1;

  for (let y = 0; y < frame.height; y += 1) {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (let x = xStart; x <= xEnd; x += 1) {
      const i = (y * frame.width + x) * 4;
      r += frame.data[i]!;
      g += frame.data[i + 1]!;
      b += frame.data[i + 2]!;
      a += frame.data[i + 3]!;
    }
    const o = outOffset + y * 4;
    out[o] = Math.round(r / rowsSafe(cols));
    out[o + 1] = Math.round(g / rowsSafe(cols));
    out[o + 2] = Math.round(b / rowsSafe(cols));
    out[o + 3] = Math.round(a / rowsSafe(cols));
  }
}

function rowsSafe(n: number): number {
  return Math.max(1, n);
}

function absDiffFrames(current: Uint8ClampedArray, previous: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(current.length);
  for (let i = 0; i < current.length; i += 4) {
    out[i] = Math.abs(current[i]! - previous[i]!);
    out[i + 1] = Math.abs(current[i + 1]! - previous[i + 1]!);
    out[i + 2] = Math.abs(current[i + 2]! - previous[i + 2]!);
    out[i + 3] = 255;
  }
  return out;
}

function writeRow(
  target: Uint8ClampedArray,
  width: number,
  row: number,
  rgba: Uint8ClampedArray,
): void {
  const offset = row * width * 4;
  target.set(rgba.subarray(0, width * 4), offset);
}

function writeColumn(
  target: Uint8ClampedArray,
  width: number,
  height: number,
  col: number,
  rgba: Uint8ClampedArray,
): void {
  for (let y = 0; y < height; y += 1) {
    const src = y * 4;
    const dst = (y * width + col) * 4;
    target[dst] = rgba[src]!;
    target[dst + 1] = rgba[src + 1]!;
    target[dst + 2] = rgba[src + 2]!;
    target[dst + 3] = rgba[src + 3]!;
  }
}

export class SliceExtractor {
  private readonly source: VideoFrameSource;

  constructor(source: VideoFrameSource) {
    this.source = source;
  }

  async extractXy(frameIndex: number, maxSide: number, fullResolution: boolean): Promise<FramePixels> {
    return this.source.getFrame(frameIndex, fullResolution ? 'full' : 'downscaled', maxSide);
  }

  async extractXtYt(
    meta: VideoMeta,
    options: ExtractOptions,
  ): Promise<{ xt: SliceImage; yt: SliceImage; sampleIndices: number[] }> {
    const sampleIndices = uniformSampleIndices(meta.frameCount, options.timeSamples);
    const first = await this.source.getFrame(sampleIndices[0]!, 'downscaled', options.maxSide);

    // Map full-res x0/y0 into downscaled coordinates
    const scaleX = first.width / meta.width;
    const scaleY = first.height / meta.height;
    const xScaled = options.x0 * scaleX;
    const yScaled = options.y0 * scaleY;

    const tCount = sampleIndices.length;
    const xtWidth = options.swapXtOrientation ? tCount : first.width;
    const xtHeight = options.swapXtOrientation ? first.width : tCount;
    const ytWidth = tCount;
    const ytHeight = first.height;

    const xtData = new Uint8ClampedArray(xtWidth * xtHeight * 4);
    const ytData = new Uint8ClampedArray(ytWidth * ytHeight * 4);

    let prevRow: Uint8ClampedArray | null = null;
    let prevCol: Uint8ClampedArray | null = null;

    for (let i = 0; i < sampleIndices.length; i += 1) {
      const frameIndex = sampleIndices[i]!;
      const frame = await this.source.getFrame(frameIndex, 'downscaled', options.maxSide);

      const row = new Uint8ClampedArray(frame.width * 4);
      averageRow(frame, yScaled, options.thickness, row, 0);

      const col = new Uint8ClampedArray(frame.height * 4);
      averageColumn(frame, xScaled, options.thickness, col, 0);

      const rowOut = options.enhanceTemporal && prevRow ? absDiffFrames(row, prevRow) : row;
      const colOut = options.enhanceTemporal && prevCol ? absDiffFrames(col, prevCol) : col;

      if (options.swapXtOrientation) {
        writeColumn(xtData, xtWidth, xtHeight, i, rowOut);
      } else {
        writeRow(xtData, xtWidth, i, rowOut);
      }
      writeColumn(ytData, ytWidth, ytHeight, i, colOut);

      prevRow = row;
      prevCol = col;
      options.onProgress?.(i + 1, sampleIndices.length);
    }

    return {
      xt: { width: xtWidth, height: xtHeight, data: xtData },
      yt: { width: ytWidth, height: ytHeight, data: ytData },
      sampleIndices,
    };
  }

  mapXtClick(
    canvasX: number,
    canvasY: number,
    xt: SliceImage,
    meta: VideoMeta,
    sampleIndices: number[],
    swap: boolean,
  ): { x0: number; t0: number } {
    const nx = clamp(canvasX / xt.width, 0, 1);
    const ny = clamp(canvasY / xt.height, 0, 1);
    if (swap) {
      const tIndex = Math.round(nx * (sampleIndices.length - 1));
      const frame = sampleIndices[tIndex] ?? 0;
      const x = Math.round(ny * (meta.width - 1));
      return { x0: x, t0: frameIndexToTime(frame, meta.fps, meta.durationSec) };
    }
    const x = Math.round(nx * (meta.width - 1));
    const tIndex = Math.round(ny * (sampleIndices.length - 1));
    const frame = sampleIndices[tIndex] ?? 0;
    return { x0: x, t0: frameIndexToTime(frame, meta.fps, meta.durationSec) };
  }

  mapYtClick(
    canvasX: number,
    canvasY: number,
    yt: SliceImage,
    meta: VideoMeta,
    sampleIndices: number[],
  ): { y0: number; t0: number } {
    const nx = clamp(canvasX / yt.width, 0, 1);
    const ny = clamp(canvasY / yt.height, 0, 1);
    const tIndex = Math.round(nx * (sampleIndices.length - 1));
    const frame = sampleIndices[tIndex] ?? 0;
    const y = Math.round(ny * (meta.height - 1));
    return { y0: y, t0: frameIndexToTime(frame, meta.fps, meta.durationSec) };
  }
}

export function sliceToImageData(slice: SliceImage): ImageData {
  return new ImageData(new Uint8ClampedArray(slice.data), slice.width, slice.height);
}

export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string): void {
  const url = canvas.toDataURL('image/png');
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
}

export function downloadImageDataPng(image: ImageData, filename: string): void {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }
  ctx.putImageData(image, 0, 0);
  downloadCanvasPng(canvas, filename);
}
