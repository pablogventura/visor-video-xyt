import type { FramePixels, SizeTier } from './types';

interface CacheEntry {
  key: string;
  pixels: FramePixels;
  bytes: number;
}

function cacheKey(frameIndex: number, tier: SizeTier, width: number, height: number): string {
  return `${frameIndex}|${tier}|${width}x${height}`;
}

export class FrameCache {
  private readonly maxEntries: number;
  private readonly map = new Map<string, CacheEntry>();

  constructor(maxEntries = 96) {
    this.maxEntries = maxEntries;
  }

  get(frameIndex: number, tier: SizeTier, width: number, height: number): FramePixels | null {
    const key = cacheKey(frameIndex, tier, width, height);
    const entry = this.map.get(key);
    if (!entry) {
      return null;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.pixels;
  }

  set(frameIndex: number, tier: SizeTier, pixels: FramePixels): void {
    const key = cacheKey(frameIndex, tier, pixels.width, pixels.height);
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    const bytes = pixels.data.byteLength;
    this.map.set(key, { key, pixels, bytes });
    this.evictIfNeeded();
  }

  clear(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }

  private evictIfNeeded(): void {
    while (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.map.delete(oldestKey);
    }
  }
}
