import { expect, test } from '@playwright/test';
import {
  FIXTURE_VIDEO,
  canvasStats,
  loadFixtureVideo,
  setRangeValue,
  waitAfterDebouncedWork,
} from './helpers';

test.describe('Visor XYT - interacciones adicionales', () => {
  test('el file input del overlay acepta el fixture', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('dropzone-overlay')).toBeVisible();
    await page.getByTestId('dropzone-overlay-input').setInputFiles(FIXTURE_VIDEO);
    await expect(page.getByTestId('load-overlay')).toBeHidden({ timeout: 60_000 });
    await expect(page.getByTestId('meta-filename')).toHaveText('moving-box.mp4');
  });

  test('footer permite cargar otro video después del primero', async ({ page }) => {
    await loadFixtureVideo(page);
    await expect(page.getByTestId('dropzone-footer')).toBeVisible();
    await page.getByTestId('dropzone-footer-input').setInputFiles(FIXTURE_VIDEO);
    await waitAfterDebouncedWork(page);
    await expect(page.getByTestId('meta-filename')).toHaveText('moving-box.mp4');
    await expect(page.getByTestId('canvas-xy')).toBeVisible();
    const xy = await canvasStats(page, 'canvas-xy');
    expect(xy.nonBlack).toBeGreaterThan(20);
  });

  test('cambiar muestras temporales regenera XT con nuevo alto', async ({ page }) => {
    await loadFixtureVideo(page);
    const before = await canvasStats(page, 'canvas-xt');
    await setRangeValue(page.getByTestId('slider-slice-samples'), 32);
    await waitAfterDebouncedWork(page);
    await expect(page.getByTestId('label-slice-samples')).toContainText('32');
    const after = await canvasStats(page, 'canvas-xt');
    expect(after.height).toBe(32);
    expect(after.width).toBe(before.width);
    expect(after.nonBlack).toBeGreaterThan(5);
  });

  test('layout muestra las cuatro superficies principales', async ({ page }) => {
    await loadFixtureVideo(page);
    await expect(page.getByTestId('panel-volume')).toBeVisible();
    await expect(page.getByTestId('panel-xy')).toBeVisible();
    await expect(page.getByTestId('panel-xt')).toBeVisible();
    await expect(page.getByTestId('panel-yt')).toBeVisible();
    await expect(page.getByTestId('volume-host').locator('canvas')).toHaveCount(1);
  });
});
