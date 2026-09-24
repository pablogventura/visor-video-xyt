import type { CursorInfo, VideoMeta } from '../core/types';

interface MetaPanelProps {
  meta: VideoMeta | null;
  cursor: CursorInfo | null;
  statusMessage: string;
  loadWarning: string | null;
  isBuildingSlices: boolean;
  isBuildingVolume: boolean;
}

export function MetaPanel({
  meta,
  cursor,
  statusMessage,
  loadWarning,
  isBuildingSlices,
  isBuildingVolume,
}: MetaPanelProps) {
  return (
    <aside className="meta" data-testid="meta-panel">
      <div className="meta__status" data-testid="status-message">
        {statusMessage}
      </div>
      {(isBuildingSlices || isBuildingVolume) && (
        <div className="meta__busy" data-testid="busy-indicator">
          {isBuildingSlices ? 'XT/YT... ' : ''}
          {isBuildingVolume ? 'Volumen 3D...' : ''}
        </div>
      )}
      {loadWarning && (
        <div className="meta__warn" data-testid="load-warning">
          {loadWarning}
        </div>
      )}
      {meta && (
        <dl className="meta__grid" data-testid="meta-grid">
          <div>
            <dt>Archivo</dt>
            <dd data-testid="meta-filename">{meta.fileName}</dd>
          </div>
          <div>
            <dt>Resolución</dt>
            <dd data-testid="meta-resolution">
              {meta.width} x {meta.height}
            </dd>
          </div>
          <div>
            <dt>Duración</dt>
            <dd data-testid="meta-duration">{meta.durationSec.toFixed(2)} s</dd>
          </div>
          <div>
            <dt>FPS estimado</dt>
            <dd data-testid="meta-fps">{meta.fps.toFixed(2)}</dd>
          </div>
          <div>
            <dt>Frames estimados</dt>
            <dd data-testid="meta-frames">{meta.frameCount}</dd>
          </div>
          <div>
            <dt>Codec / MIME</dt>
            <dd data-testid="meta-codec">{meta.codecHint ?? meta.mimeType}</dd>
          </div>
        </dl>
      )}
      {cursor && (
        <dl className="meta__cursor" data-testid="cursor-info">
          <div>
            <dt>Vista</dt>
            <dd data-testid="cursor-view">{cursor.view.toUpperCase()}</dd>
          </div>
          <div>
            <dt>x</dt>
            <dd data-testid="cursor-x">{cursor.x}</dd>
          </div>
          <div>
            <dt>y</dt>
            <dd data-testid="cursor-y">{cursor.y}</dd>
          </div>
          <div>
            <dt>t</dt>
            <dd data-testid="cursor-t">{cursor.t.toFixed(3)} s</dd>
          </div>
          <div>
            <dt>frame</dt>
            <dd data-testid="cursor-frame">{cursor.frame}</dd>
          </div>
          <div>
            <dt>RGB</dt>
            <dd data-testid="cursor-rgb">
              {cursor.r}, {cursor.g}, {cursor.b}
            </dd>
          </div>
        </dl>
      )}
    </aside>
  );
}
