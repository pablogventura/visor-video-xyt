import type { CursorInfo, SliceImage } from '../core/types';
import { clamp } from '../core/SpaceTimeVolume';

export interface PlaneViewerCallbacks {
  onClick?: (nx: number, ny: number) => void;
  onHover?: (info: CursorInfo | null) => void;
}

function sampleRgb(data: Uint8ClampedArray, width: number, height: number, x: number, y: number) {
  const xi = clamp(Math.round(x), 0, width - 1);
  const yi = clamp(Math.round(y), 0, height - 1);
  const i = (yi * width + xi) * 4;
  return {
    r: data[i] ?? 0,
    g: data[i + 1] ?? 0,
    b: data[i + 2] ?? 0,
  };
}

export class CanvasPlaneViewer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private image: SliceImage | null = null;
  private crosshairX = 0.5;
  private crosshairY = 0.5;
  private labelX = 'x';
  private labelY = 'y';
  private readonly callbacks: PlaneViewerCallbacks;
  private readonly buildCursor: (
    px: number,
    py: number,
    rgb: { r: number; g: number; b: number },
  ) => CursorInfo | null;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: PlaneViewerCallbacks,
    buildCursor: (
      px: number,
      py: number,
      rgb: { r: number; g: number; b: number },
    ) => CursorInfo | null,
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('2D context unavailable');
    }
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.buildCursor = buildCursor;

    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
  }

  setImage(image: SliceImage | null): void {
    this.image = image;
    this.redraw();
  }

  setCrosshair(nx: number, ny: number): void {
    this.crosshairX = clamp(nx, 0, 1);
    this.crosshairY = clamp(ny, 0, 1);
    this.redraw();
  }

  setAxisLabels(labelX: string, labelY: string): void {
    this.labelX = labelX;
    this.labelY = labelY;
    this.redraw();
  }

  exportPng(filename: string): void {
    const url = this.canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
  }

  private eventToPixel(event: PointerEvent): { px: number; py: number } | null {
    if (!this.image) {
      return null;
    }
    const rect = this.canvas.getBoundingClientRect();
    const sx = ((event.clientX - rect.left) / rect.width) * this.image.width;
    const sy = ((event.clientY - rect.top) / rect.height) * this.image.height;
    return {
      px: clamp(sx, 0, this.image.width - 1),
      py: clamp(sy, 0, this.image.height - 1),
    };
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    const pos = this.eventToPixel(event);
    if (!pos || !this.image) {
      return;
    }
    this.callbacks.onClick?.(pos.px / this.image.width, pos.py / this.image.height);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const pos = this.eventToPixel(event);
    if (!pos || !this.image) {
      this.callbacks.onHover?.(null);
      return;
    }
    const rgb = sampleRgb(this.image.data, this.image.width, this.image.height, pos.px, pos.py);
    this.callbacks.onHover?.(this.buildCursor(pos.px, pos.py, rgb));
  };

  private readonly onPointerLeave = (): void => {
    this.callbacks.onHover?.(null);
  };

  private redraw(): void {
    const { canvas, ctx, image } = this;
    if (!image) {
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    if (canvas.width !== image.width || canvas.height !== image.height) {
      canvas.width = image.width;
      canvas.height = image.height;
    }

    const imageData = new ImageData(new Uint8ClampedArray(image.data), image.width, image.height);
    ctx.putImageData(imageData, 0, 0);

    const cx = this.crosshairX * image.width;
    const cy = this.crosshairY * image.height;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 220, 80, 0.95)';
    ctx.lineWidth = Math.max(1, Math.round(Math.min(image.width, image.height) / 256));
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, image.height);
    ctx.moveTo(0, cy);
    ctx.lineTo(image.width, cy);
    ctx.stroke();

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(4, 4, 72, 28);
    ctx.fillStyle = '#ddd';
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText(`${this.labelX} →`, 8, 16);
    ctx.fillText(`${this.labelY} ↑`, 8, 28);
    ctx.restore();
  }
}
