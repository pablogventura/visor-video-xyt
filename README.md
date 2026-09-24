# Space-time video volume viewer (XYT)

Browser-only tool to explore a video as a space-time volume \(I(x, y, t)\):

- **XY**: conventional frame at time \(t_0\)
- **XT**: horizontal scanline stack over time at fixed \(y_0\)
- **YT**: vertical column stack over time at fixed \(x_0\)
- **3D**: sampled stack of textured frames along the temporal axis, with linked cutting planes

All processing stays on the client. Videos are never uploaded.

## Run locally

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

## Usage

1. Drag and drop a video, or use **Elegir video**.
2. Move `x0`, `y0`, `t0` with the sliders or by clicking the 2D views.
3. Orbit / pan / zoom the 3D volume with the mouse.
4. Adjust **Escala temporal**, **Muestreo de frames**, and **Grosor de corte**.
5. Optionally enable **Resaltar cambios temporales** (`|I(t)-I(t-Δt)|`) on XT/YT.
6. Export PNG slices or a 3D screenshot.

## Architecture

```text
src/core/       VideoFrameSource, FrameCache, SliceExtractor, SpaceTimeVolume
src/viewers/    CanvasPlaneViewer, ThreeDViewer
src/state/      viewerStore
src/ui/         React layout and controls
```

Frame access uses `HTMLVideoElement` with serialized seeks and an LRU cache. XT/YT are built from real sampled scanlines/columns (not visual approximations). Volume textures and XT/YT use downscaled frames; XY keeps native resolution.

## Tests (Playwright)

A synthetic fixture video lives at `e2e/fixtures/moving-box.mp4` (ffmpeg `testsrc`, 320x240, 2s, 30fps). Regenerate with:

```bash
bash scripts/generate-fixture-video.sh
```

Run the browser suite:

```bash
npm install
npx playwright install chromium
npm test
```

The suite loads the fixture, asserts real XY/XT/YT pixel signal, linked navigation, playback, sliders, enhance/swap, WebGL volume canvas, and PNG exports.
