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
    <aside className="meta">
      <div className="meta__status">{statusMessage}</div>
      {(isBuildingSlices || isBuildingVolume) && (
        <div className="meta__busy">
          {isBuildingSlices ? 'XT/YT... ' : ''}
          {isBuildingVolume ? 'Volumen 3D...' : ''}
        </div>
      )}
      {loadWarning && <div className="meta__warn">{loadWarning}</div>}
      {meta && (
        <dl className="meta__grid">
          <div>
            <dt>Archivo</dt>
            <dd>{meta.fileName}</dd>
          </div>
          <div>
            <dt>Resolución</dt>
            <dd>
              {meta.width} x {meta.height}
            </dd>
          </div>
          <div>
            <dt>Duración</dt>
            <dd>{meta.durationSec.toFixed(2)} s</dd>
          </div>
          <div>
            <dt>FPS estimado</dt>
            <dd>{meta.fps.toFixed(2)}</dd>
          </div>
          <div>
            <dt>Frames estimados</dt>
            <dd>{meta.frameCount}</dd>
          </div>
          <div>
            <dt>Codec / MIME</dt>
            <dd>{meta.codecHint ?? meta.mimeType}</dd>
          </div>
        </dl>
      )}
      {cursor && (
        <dl className="meta__cursor">
          <div>
            <dt>Vista</dt>
            <dd>{cursor.view.toUpperCase()}</dd>
          </div>
          <div>
            <dt>x</dt>
            <dd>{cursor.x}</dd>
          </div>
          <div>
            <dt>y</dt>
            <dd>{cursor.y}</dd>
          </div>
          <div>
            <dt>t</dt>
            <dd>{cursor.t.toFixed(3)} s</dd>
          </div>
          <div>
            <dt>frame</dt>
            <dd>{cursor.frame}</dd>
          </div>
          <div>
            <dt>RGB</dt>
            <dd>
              {cursor.r}, {cursor.g}, {cursor.b}
            </dd>
          </div>
        </dl>
      )}
    </aside>
  );
}
