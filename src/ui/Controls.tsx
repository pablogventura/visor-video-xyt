import type { ViewerState } from '../core/types';
import { timeToFrameIndex } from '../core/SpaceTimeVolume';
import { viewerStore } from '../state/viewerStore';

interface ControlsProps {
  state: ViewerState;
  onExportXy: () => void;
  onExportXt: () => void;
  onExportYt: () => void;
  onExportVolume: () => void;
}

export function Controls({
  state,
  onExportXy,
  onExportXt,
  onExportYt,
  onExportVolume,
}: ControlsProps) {
  const meta = state.meta;
  if (!meta) {
    return null;
  }

  const frame = timeToFrameIndex(state.t0, meta.fps, meta.frameCount);

  return (
    <div className="controls" data-testid="controls">
      <div className="controls__row">
        <button
          type="button"
          className="button"
          data-testid="play-pause"
          onClick={() => viewerStore.togglePlaying()}
        >
          {state.isPlaying ? 'Pausa' : 'Reproducir'}
        </button>
        <label className="controls__check">
          <input
            type="checkbox"
            data-testid="enhance-temporal"
            checked={state.enhanceTemporal}
            onChange={(event) => viewerStore.setEnhanceTemporal(event.target.checked)}
          />
          Resaltar cambios temporales
        </label>
        <label className="controls__check">
          <input
            type="checkbox"
            data-testid="swap-xt"
            checked={state.swapXtOrientation}
            onChange={(event) => viewerStore.setSwapXtOrientation(event.target.checked)}
          />
          Intercambiar orientación XT
        </label>
        <div className="controls__exports">
          <button type="button" className="button" data-testid="export-xy" onClick={onExportXy}>
            Exportar XY
          </button>
          <button type="button" className="button" data-testid="export-xt" onClick={onExportXt}>
            Exportar XT
          </button>
          <button type="button" className="button" data-testid="export-yt" onClick={onExportYt}>
            Exportar YT
          </button>
          <button
            type="button"
            className="button"
            data-testid="export-volume"
            onClick={onExportVolume}
          >
            Exportar 3D
          </button>
        </div>
      </div>

      <label className="slider">
        <span data-testid="label-t">
          t = {state.t0.toFixed(3)} s (frame {frame}/{meta.frameCount - 1})
        </span>
        <input
          type="range"
          data-testid="slider-t"
          min={0}
          max={Math.max(0, meta.durationSec)}
          step={1 / meta.fps}
          value={state.t0}
          onChange={(event) => viewerStore.setT0(Number(event.target.value))}
        />
      </label>

      <div className="controls__grid">
        <label className="slider">
          <span data-testid="label-x">x0 = {state.x0}</span>
          <input
            type="range"
            data-testid="slider-x"
            min={0}
            max={Math.max(0, meta.width - 1)}
            step={1}
            value={state.x0}
            onChange={(event) => viewerStore.setX0(Number(event.target.value))}
          />
        </label>
        <label className="slider">
          <span data-testid="label-y">y0 = {state.y0}</span>
          <input
            type="range"
            data-testid="slider-y"
            min={0}
            max={Math.max(0, meta.height - 1)}
            step={1}
            value={state.y0}
            onChange={(event) => viewerStore.setY0(Number(event.target.value))}
          />
        </label>
        <label className="slider">
          <span data-testid="label-temporal-scale">
            Escala temporal = {state.temporalScale.toFixed(2)}
          </span>
          <input
            type="range"
            data-testid="slider-temporal-scale"
            min={0.1}
            max={8}
            step={0.05}
            value={state.temporalScale}
            onChange={(event) => viewerStore.setTemporalScale(Number(event.target.value))}
          />
        </label>
        <label className="slider">
          <span data-testid="label-frame-sampling">
            Muestreo de frames (3D) = {state.frameSampling}
          </span>
          <input
            type="range"
            data-testid="slider-frame-sampling"
            min={32}
            max={512}
            step={1}
            value={state.frameSampling}
            onChange={(event) => viewerStore.setFrameSampling(Number(event.target.value))}
          />
        </label>
        <label className="slider">
          <span data-testid="label-slice-samples">
            Muestras temporales (XT/YT) = {state.sliceTimeSamples}
          </span>
          <input
            type="range"
            data-testid="slider-slice-samples"
            min={32}
            max={512}
            step={1}
            value={state.sliceTimeSamples}
            onChange={(event) => viewerStore.setSliceTimeSamples(Number(event.target.value))}
          />
        </label>
        <label className="slider">
          <span data-testid="label-thickness">Grosor de corte = {state.sliceThickness}</span>
          <input
            type="range"
            data-testid="slider-thickness"
            min={1}
            max={21}
            step={2}
            value={state.sliceThickness}
            onChange={(event) => viewerStore.setSliceThickness(Number(event.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
