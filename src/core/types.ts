export type SizeTier = 'full' | 'downscaled';

export type ViewId = 'xy' | 'xt' | 'yt' | 'volume';

export interface VideoMeta {
  width: number;
  height: number;
  durationSec: number;
  fps: number;
  frameCount: number;
  mimeType: string;
  fileName: string;
  codecHint: string | null;
  isHeavy: boolean;
}

export interface FramePixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  frameIndex: number;
  timestampSec: number;
}

export interface CursorInfo {
  x: number;
  y: number;
  t: number;
  frame: number;
  timestampSec: number;
  r: number;
  g: number;
  b: number;
  view: ViewId;
}

export interface SliceImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface ViewerState {
  meta: VideoMeta | null;
  x0: number;
  y0: number;
  t0: number;
  isPlaying: boolean;
  temporalScale: number;
  frameSampling: number;
  sliceThickness: number;
  enhanceTemporal: boolean;
  swapXtOrientation: boolean;
  downscaleMax: number;
  sliceTimeSamples: number;
  cursor: CursorInfo | null;
  statusMessage: string;
  loadWarning: string | null;
  isBuildingSlices: boolean;
  isBuildingVolume: boolean;
}

export const DEFAULT_STATE: ViewerState = {
  meta: null,
  x0: 0,
  y0: 0,
  t0: 0,
  isPlaying: false,
  temporalScale: 1,
  frameSampling: 120,
  sliceThickness: 1,
  enhanceTemporal: false,
  swapXtOrientation: false,
  downscaleMax: 384,
  sliceTimeSamples: 256,
  cursor: null,
  statusMessage: 'Cargá un video para comenzar.',
  loadWarning: null,
  isBuildingSlices: false,
  isBuildingVolume: false,
};
