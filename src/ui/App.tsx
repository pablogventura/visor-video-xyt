import { useEffect, useRef } from 'react';
import { AppController } from '../core/AppController';
import { useViewerStore } from '../state/useViewerStore';
import { Controls } from './Controls';
import { DropZone } from './DropZone';
import { MetaPanel } from './MetaPanel';
import './layout.css';

export function App() {
  const state = useViewerStore();
  const controllerRef = useRef<AppController | null>(null);
  const xyRef = useRef<HTMLCanvasElement>(null);
  const xtRef = useRef<HTMLCanvasElement>(null);
  const ytRef = useRef<HTMLCanvasElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AppController();
    controllerRef.current = controller;
    if (xyRef.current && xtRef.current && ytRef.current && volumeRef.current) {
      controller.mountViewers({
        xyCanvas: xyRef.current,
        xtCanvas: xtRef.current,
        ytCanvas: ytRef.current,
        volumeHost: volumeRef.current,
      });
    }
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  const onFile = (file: File) => {
    void controllerRef.current?.loadFile(file);
  };

  return (
    <div className="app" data-testid="app">
      <header className="app__header">
        <div>
          <h1>Visor espacio-temporal XYT</h1>
          <p>Explorá I(x, y, t) como volumen: cortes XY, XT, YT y pila 3D.</p>
        </div>
        <MetaPanel
          meta={state.meta}
          cursor={state.cursor}
          statusMessage={state.statusMessage}
          loadWarning={state.loadWarning}
          isBuildingSlices={state.isBuildingSlices}
          isBuildingVolume={state.isBuildingVolume}
        />
      </header>

      {!state.meta && (
        <div className="app__overlay" data-testid="load-overlay">
          <DropZone onFile={onFile} testId="dropzone-overlay" />
        </div>
      )}

      <main className="app__main">
        <section className="panel panel--volume" data-testid="panel-volume">
          <div className="panel__title">Vista 3D (volumen x-y-t)</div>
          <div className="volume-host" ref={volumeRef} data-testid="volume-host" />
        </section>
        <section className="panel-stack">
          <div className="panel" data-testid="panel-xy">
            <div className="panel__title">XY - I(x, y, t0)</div>
            <canvas ref={xyRef} className="plane-canvas" data-testid="canvas-xy" />
          </div>
          <div className="panel" data-testid="panel-xt">
            <div className="panel__title">XT - I(x, y0, t)</div>
            <canvas ref={xtRef} className="plane-canvas" data-testid="canvas-xt" />
          </div>
          <div className="panel" data-testid="panel-yt">
            <div className="panel__title">YT - I(x0, y, t)</div>
            <canvas ref={ytRef} className="plane-canvas" data-testid="canvas-yt" />
          </div>
        </section>
      </main>

      <footer className="app__footer">
        {state.meta && (
          <div className="app__footer-load">
            <DropZone onFile={onFile} testId="dropzone-footer" />
          </div>
        )}
        <Controls
          state={state}
          onExportXy={() => controllerRef.current?.exportXy()}
          onExportXt={() => controllerRef.current?.exportXt()}
          onExportYt={() => controllerRef.current?.exportYt()}
          onExportVolume={() => controllerRef.current?.exportVolume()}
        />
      </footer>
    </div>
  );
}
