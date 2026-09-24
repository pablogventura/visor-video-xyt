import { expect, type Locator, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURE_VIDEO = path.join(here, 'fixtures', 'moving-box.mp4');

export async function loadFixtureVideo(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByTestId('load-overlay')).toBeVisible();
  await page.getByTestId('dropzone-overlay-input').setInputFiles(FIXTURE_VIDEO);
  await expect(page.getByTestId('load-overlay')).toBeHidden({ timeout: 60_000 });
  await expect(page.getByTestId('meta-grid')).toBeVisible();
  await expect(page.getByTestId('controls')).toBeVisible();
  await waitForProcessingIdle(page);
}

export async function waitForProcessingIdle(page: Page): Promise<void> {
  await expect(page.getByTestId('busy-indicator')).toHaveCount(0, { timeout: 90_000 });
  await expect(page.getByTestId('status-message')).not.toContainText('Construyendo', {
    timeout: 90_000,
  });
  await expect(page.getByTestId('status-message')).not.toContainText('Muestreando', {
    timeout: 90_000,
  });
}

/** Wait past AppController debounce (100ms) then until slice/volume work finishes. */
export async function waitAfterDebouncedWork(page: Page): Promise<void> {
  await page.waitForTimeout(180);
  await waitForProcessingIdle(page);
}

export async function setRangeValue(locator: Locator, value: number): Promise<void> {
  await locator.evaluate((el, nextValue) => {
    const input = el as HTMLInputElement;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    descriptor?.set?.call(input, String(nextValue));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

/**
 * Click inside the letterboxed bitmap content of a canvas (object-fit: contain).
 */
export async function clickCanvasContent(
  page: Page,
  testId: string,
  nx: number,
  ny: number,
): Promise<void> {
  await page.getByTestId(testId).evaluate(
    (canvas, coords) => {
      const element = canvas as HTMLCanvasElement;
      const rect = element.getBoundingClientRect();
      const bitmapAspect = element.width / Math.max(1, element.height);
      const elementAspect = rect.width / Math.max(1, rect.height);
      let contentWidth = rect.width;
      let contentHeight = rect.height;
      let offsetX = 0;
      let offsetY = 0;
      if (elementAspect > bitmapAspect) {
        contentWidth = rect.height * bitmapAspect;
        offsetX = (rect.width - contentWidth) / 2;
      } else if (elementAspect < bitmapAspect) {
        contentHeight = rect.width / bitmapAspect;
        offsetY = (rect.height - contentHeight) / 2;
      }
      const clientX = rect.left + offsetX + coords.nx * contentWidth;
      const clientY = rect.top + offsetY + coords.ny * contentHeight;
      element.dispatchEvent(
        new PointerEvent('pointerdown', {
          clientX,
          clientY,
          bubbles: true,
          pointerId: 1,
          pointerType: 'mouse',
        }),
      );
    },
    { nx, ny },
  );
}

export async function hoverCanvasContent(
  page: Page,
  testId: string,
  nx: number,
  ny: number,
): Promise<void> {
  await page.getByTestId(testId).evaluate(
    (canvas, coords) => {
      const element = canvas as HTMLCanvasElement;
      const rect = element.getBoundingClientRect();
      const bitmapAspect = element.width / Math.max(1, element.height);
      const elementAspect = rect.width / Math.max(1, rect.height);
      let contentWidth = rect.width;
      let contentHeight = rect.height;
      let offsetX = 0;
      let offsetY = 0;
      if (elementAspect > bitmapAspect) {
        contentWidth = rect.height * bitmapAspect;
        offsetX = (rect.width - contentWidth) / 2;
      } else if (elementAspect < bitmapAspect) {
        contentHeight = rect.width / bitmapAspect;
        offsetY = (rect.height - contentHeight) / 2;
      }
      const clientX = rect.left + offsetX + coords.nx * contentWidth;
      const clientY = rect.top + offsetY + coords.ny * contentHeight;
      element.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX,
          clientY,
          bubbles: true,
          pointerId: 1,
          pointerType: 'mouse',
        }),
      );
    },
    { nx, ny },
  );
}

export async function canvasStats(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate((canvas) => {
    const element = canvas as HTMLCanvasElement;
    const width = element.width;
    const height = element.height;
    if (width < 2 || height < 2) {
      return { width, height, nonBlack: 0, meanLuma: 0, maxChannel: 0 };
    }
    const ctx = element.getContext('2d');
    if (!ctx) {
      return { width, height, nonBlack: 0, meanLuma: 0, maxChannel: 0 };
    }
    const { data } = ctx.getImageData(0, 0, width, height);
    let nonBlack = 0;
    let sum = 0;
    let maxChannel = 0;
    const step = 4 * 8;
    for (let i = 0; i < data.length; i += step) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      maxChannel = Math.max(maxChannel, r, g, b);
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sum += luma;
      if (r > 16 || g > 16 || b > 16) {
        nonBlack += 1;
      }
    }
    const samples = Math.ceil(data.length / step);
    return {
      width,
      height,
      nonBlack,
      meanLuma: sum / samples,
      maxChannel,
    };
  });
}

export async function volumeCanvasPresent(page: Page): Promise<boolean> {
  return page.getByTestId('volume-host').evaluate((host) => {
    const canvas = host.querySelector('canvas');
    if (!canvas) {
      return false;
    }
    return canvas.width > 8 && canvas.height > 8;
  });
}
