import { Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { Button, IconButton } from '../ui/Button';
import { clampCrop, initialCrop, MAX_ZOOM, minZoom, outputRect, zoomAt, type CropState } from './cropMath';
import { AVATAR_PIXELS, imageSize, renderAvatar } from './imageProcessing';
import './ImageCropper.css';

const VIEWPORT = 216;

interface ImageCropperProps {
  image: HTMLImageElement;
  onCancel(): void;
  onConfirm(dataUrl: string): void;
  onError(message: string): void;
}

/** Move and zoom a picture inside a circle – like choosing a messenger profile picture. */
export function ImageCropper({ image, onCancel, onConfirm, onError }: ImageCropperProps) {
  const size = imageSize(image);
  const [crop, setCrop] = useState<CropState>(() => initialCrop(size, VIEWPORT));
  const drag = useRef<{ pointerId: number; startX: number; startY: number; crop: CropState } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    viewportRef.current?.focus({ preventScroll: true });
  }, []);

  const scale = (VIEWPORT / Math.min(size.width, size.height)) * crop.zoom;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, crop };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    setCrop(
      clampCrop(
        { ...d.crop, x: d.crop.x + event.clientX - d.startX, y: d.crop.y + event.clientY - d.startY },
        size,
        VIEWPORT,
      ),
    );
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const factor = Math.exp(-event.deltaY * 0.0015);
    setCrop((c) => zoomAt(c, c.zoom * factor, event.clientX - rect.left, event.clientY - rect.top, size, VIEWPORT));
  };

  const zoomTo = (zoom: number) => setCrop((c) => zoomAt(c, zoom, VIEWPORT / 2, VIEWPORT / 2, size, VIEWPORT));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 40 : 10;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      setCrop((c) => clampCrop({ ...c, x: c.x + move[0], y: c.y + move[1] }, size, VIEWPORT));
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomTo(crop.zoom * 1.15);
    } else if (event.key === '-') {
      event.preventDefault();
      zoomTo(crop.zoom / 1.15);
    }
  };

  const lowest = minZoom(size);

  const confirm = () => {
    try {
      onConfirm(renderAvatar(image, outputRect(crop, size, VIEWPORT, AVATAR_PIXELS)));
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <div
      className="cropper"
      onKeyDown={(event) => {
        // Escape cancels the cropping, not the whole dialog; Enter applies it.
        if (event.key === 'Escape') {
          event.stopPropagation();
          event.preventDefault();
          onCancel();
        } else if (event.key === 'Enter' && (event.target as HTMLElement).tagName !== 'BUTTON') {
          event.preventDefault();
          confirm();
        }
      }}
    >
      <div
        ref={viewportRef}
        className="cropper__viewport"
        style={{ width: VIEWPORT, height: VIEWPORT }}
        tabIndex={0}
        role="group"
        aria-label="Bildausschnitt: ziehen oder Pfeiltasten zum Verschieben, Plus und Minus zum Zoomen"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
      >
        <img
          className="cropper__image"
          src={image.src}
          alt=""
          draggable={false}
          style={{
            width: size.width * scale,
            height: size.height * scale,
            transform: `translate(${crop.x}px, ${crop.y}px)`,
          }}
        />
        <span className="cropper__mask" aria-hidden />
      </div>

      <div className="cropper__side">
        <p className="cropper__title">Ausschnitt wählen</p>
        <p className="cropper__hint">
          Zum Verschieben ziehen, zum Zoomen den Regler oder das Mausrad nutzen. Ganz nach links passt ein Logo komplett
          hinein.
        </p>
        <div className="cropper__zoom">
          <IconButton label="Verkleinern" icon={<Minus />} size="sm" onClick={() => zoomTo(crop.zoom / 1.25)} disabled={crop.zoom <= lowest + 0.001} />
          <input
            type="range"
            aria-label="Zoom"
            min={lowest}
            max={MAX_ZOOM}
            step="any"
            value={crop.zoom}
            onChange={(event) => zoomTo(Number(event.target.value))}
          />
          <IconButton label="Vergrößern" icon={<Plus />} size="sm" onClick={() => zoomTo(crop.zoom * 1.25)} disabled={crop.zoom >= MAX_ZOOM} />
        </div>
        <div className="cropper__actions">
          <Button size="sm" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button size="sm" variant="primary" onClick={confirm}>
            Übernehmen
          </Button>
        </div>
      </div>
    </div>
  );
}
