import type { ChangeEvent, DragEvent } from 'react';

interface DropZoneProps {
  disabled?: boolean;
  onFile: (file: File) => void;
}

function pickVideoFile(fileList: FileList | null): File | null {
  if (!fileList || fileList.length === 0) {
    return null;
  }
  const file = fileList[0];
  if (!file) {
    return null;
  }
  if (file.type.startsWith('video/') || /\.(mp4|webm|ogg|mov|mkv)$/i.test(file.name)) {
    return file;
  }
  return null;
}

export function DropZone({ disabled, onFile }: DropZoneProps) {
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled) {
      return;
    }
    const file = pickVideoFile(event.dataTransfer.files);
    if (file) {
      onFile(file);
    }
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = pickVideoFile(event.target.files);
    if (file) {
      onFile(file);
    }
    event.target.value = '';
  };

  return (
    <div
      className={`dropzone ${disabled ? 'dropzone--disabled' : ''}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <div className="dropzone__title">Arrastrá un video acá</div>
      <div className="dropzone__hint">Procesamiento 100% local en el navegador</div>
      <label className="button button--primary">
        Elegir video
        <input type="file" accept="video/*" hidden disabled={disabled} onChange={onChange} />
      </label>
    </div>
  );
}
