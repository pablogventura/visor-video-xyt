import { expect, test } from '@playwright/test';
import {
  canvasStats,
  clickCanvasContent,
  hoverCanvasContent,
  loadFixtureVideo,
  setRangeValue,
  volumeCanvasPresent,
  waitAfterDebouncedWork,
} from './helpers';

test.describe('Visor XYT - carga y metadata', () => {
  test('muestra overlay inicial y carga el video de fixture', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Visor espacio-temporal XYT' })).toBeVisible();
    await expect(page.getByTestId('load-overlay')).toBeVisible();
    await expect(page.getByText('Arrastrá un video acá')).toBeVisible();

    await loadFixtureVideo(page);

    await expect(page.getByTestId('meta-filename')).toHaveText('moving-box.mp4');
    await expect(page.getByTestId('meta-resolution')).toHaveText('320 x 240');
    await expect(page.getByTestId('meta-duration')).toContainText('2.00');
    await expect(page.getByTestId('meta-fps')).toContainText('30');
    await expect(page.getByTestId('meta-frames')).toHaveText('60');
    await expect(page.getByTestId('status-message')).toContainText(/listos|Volumen 3D|Video cargado/i);
  });
});

test.describe('Visor XYT - vistas y volumen', () => {
  test.beforeEach(async ({ page }) => {
    await loadFixtureVideo(page);
  });

  test('pinta XY, XT, YT con señal real y crea canvas WebGL', async ({ page }) => {
    const xy = await canvasStats(page, 'canvas-xy');
    const xt = await canvasStats(page, 'canvas-xt');
    const yt = await canvasStats(page, 'canvas-yt');

    expect(xy.width).toBe(320);
    expect(xy.height).toBe(240);
    expect(xy.nonBlack).toBeGreaterThan(50);
    expect(xy.maxChannel).toBeGreaterThan(40);

    expect(xt.width).toBeGreaterThan(8);
    expect(xt.height).toBeGreaterThan(8);
    expect(xt.nonBlack).toBeGreaterThan(20);
    expect(xt.meanLuma).toBeGreaterThan(5);

    expect(yt.width).toBeGreaterThan(8);
    expect(yt.height).toBeGreaterThan(8);
    expect(yt.nonBlack).toBeGreaterThan(20);
    expect(yt.meanLuma).toBeGreaterThan(5);

    expect(await volumeCanvasPresent(page)).toBe(true);
  });

  test('sliders x/y/t actualizan labels y regeneran cortes', async ({ page }) => {
    await setRangeValue(page.getByTestId('slider-x'), 40);
    await setRangeValue(page.getByTestId('slider-y'), 30);
    await setRangeValue(page.getByTestId('slider-t'), 1);
    await waitAfterDebouncedWork(page);

    await expect(page.getByTestId('label-x')).toHaveText('x0 = 40');
    await expect(page.getByTestId('label-y')).toHaveText('y0 = 30');
    await expect(page.getByTestId('label-t')).toContainText('t = 1.000');

    const xt = await canvasStats(page, 'canvas-xt');
    const yt = await canvasStats(page, 'canvas-yt');
    expect(xt.nonBlack).toBeGreaterThan(10);
    expect(yt.nonBlack).toBeGreaterThan(10);
  });

  test('escala temporal, muestreo, grosor y enhance responden', async ({ page }) => {
    await setRangeValue(page.getByTestId('slider-temporal-scale'), 2.5);
    await expect(page.getByTestId('label-temporal-scale')).toContainText('2.50');

    await setRangeValue(page.getByTestId('slider-frame-sampling'), 40);
    await waitAfterDebouncedWork(page);
    await expect(page.getByTestId('label-frame-sampling')).toContainText('40');
    await expect(page.getByTestId('status-message')).toContainText('40 planos');

    await setRangeValue(page.getByTestId('slider-thickness'), 5);
    await waitAfterDebouncedWork(page);
    await expect(page.getByTestId('label-thickness')).toHaveText('Grosor de corte = 5');

    const before = await canvasStats(page, 'canvas-xt');
    await page.getByTestId('enhance-temporal').check();
    await waitAfterDebouncedWork(page);
    const afterEnhance = await canvasStats(page, 'canvas-xt');
    expect(afterEnhance.width).toBe(before.width);
    expect(afterEnhance.height).toBe(before.height);
    expect(afterEnhance.maxChannel).toBeGreaterThan(0);

    await page.getByTestId('swap-xt').check();
    await waitAfterDebouncedWork(page);
    await expect
      .poll(async () => {
        const swapped = await canvasStats(page, 'canvas-xt');
        return { w: swapped.width, h: swapped.height };
      })
      .toEqual({ w: before.height, h: before.width });
  });

  test('play/pausa avanza t0', async ({ page }) => {
    await page.getByTestId('play-pause').click();
    await expect(page.getByTestId('play-pause')).toHaveText('Pausa');
    await page.waitForTimeout(400);
    const mid = await page.getByTestId('label-t').innerText();
    expect(mid).not.toContain('t = 0.000');
    await page.getByTestId('play-pause').click();
    await expect(page.getByTestId('play-pause')).toHaveText('Reproducir');
  });

  test('click en XY actualiza x0/y0 y muestra cursor RGB', async ({ page }) => {
    await clickCanvasContent(page, 'canvas-xy', 0.25, 0.75);
    await waitAfterDebouncedWork(page);

    const xLabel = await page.getByTestId('label-x').innerText();
    const yLabel = await page.getByTestId('label-y').innerText();
    const x0 = Number(xLabel.replace('x0 = ', ''));
    const y0 = Number(yLabel.replace('y0 = ', ''));
    expect(x0).toBeLessThan(120);
    expect(y0).toBeGreaterThan(150);

    await hoverCanvasContent(page, 'canvas-xy', 0.5, 0.5);
    await expect(page.getByTestId('cursor-info')).toBeVisible();
    await expect(page.getByTestId('cursor-view')).toHaveText('XY');
    await expect(page.getByTestId('cursor-rgb')).toHaveText(/\d+, \d+, \d+/);
  });

  test('click en XT y YT vinculan t0 y el otro eje', async ({ page }) => {
    await clickCanvasContent(page, 'canvas-xt', 0.8, 0.8);
    await waitAfterDebouncedWork(page);
    const afterXt = await page.getByTestId('label-t').innerText();
    expect(afterXt).not.toContain('t = 0.000');

    const yBefore = await page.getByTestId('label-y').innerText();
    await clickCanvasContent(page, 'canvas-yt', 0.3, 0.8);
    await waitAfterDebouncedWork(page);
    await expect(page.getByTestId('label-y')).not.toHaveText(yBefore);
  });
});

test.describe('Visor XYT - exportacion PNG', () => {
  test.beforeEach(async ({ page }) => {
    await loadFixtureVideo(page);
  });

  test('exporta XY, XT, YT y captura 3D', async ({ page }) => {
    for (const [button, filename] of [
      ['export-xy', 'xy-slice.png'],
      ['export-xt', 'xt-slice.png'],
      ['export-yt', 'yt-slice.png'],
      ['export-volume', 'xyt-volume.png'],
    ] as const) {
      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId(button).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe(filename);
      const failure = await download.failure();
      expect(failure).toBeNull();
    }
  });
});
