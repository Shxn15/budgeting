import { Camera, ImagePlus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { cx } from '../ui/cx';
import { Avatar } from './Avatar';
import { ImageCropper } from './ImageCropper';
import { ImageError, loadImageFile, releaseImage } from './imageProcessing';
import './AvatarPicker.css';

interface AvatarPickerProps {
  name: string;
  color: string;
  image: string | null;
  onChange(image: string | null): void;
  size?: number;
  /** Only the round picture (click to choose) – for tight spaces. */
  compact?: boolean;
  /** Called when the cropper opens or closes (the surrounding layout may make room for it). */
  onCroppingChange?(cropping: boolean): void;
}

/** Profile picture field: pick a file, crop it round, or remove it. */
export function AvatarPicker({ name, color, image, onChange, size = 72, compact, onCroppingChange }: AvatarPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    onCroppingChange?.(picked !== null);
  }, [picked, onCroppingChange]);

  // Free the memory of a picked picture when it is no longer needed.
  useEffect(() => () => (picked ? releaseImage(picked) : undefined), [picked]);

  const choose = () => inputRef.current?.click();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      setPicked(await loadImageFile(file));
    } catch (e) {
      setError(e instanceof ImageError ? e.message : 'Das Bild konnte nicht geöffnet werden.');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(event) => void onFile(event.target.files?.[0])}
    />
  );

  if (picked) {
    return (
      <div className="avatar-picker">
        {fileInput}
        <ImageCropper
          image={picked}
          onCancel={() => setPicked(null)}
          onError={(message) => {
            setError(message);
            setPicked(null);
          }}
          onConfirm={(dataUrl) => {
            onChange(dataUrl);
            setPicked(null);
          }}
        />
      </div>
    );
  }

  const preview = (
    <button
      type="button"
      className="avatar-picker__preview"
      onClick={choose}
      aria-label={image ? 'Profilbild ändern' : 'Profilbild auswählen'}
      title={image ? 'Profilbild ändern' : 'Profilbild auswählen'}
      disabled={loading}
    >
      <Avatar name={name || '?'} image={image} color={color} size={size} />
      <span className={cx('avatar-picker__overlay', !image && compact && 'is-visible')} aria-hidden>
        <Camera />
      </span>
    </button>
  );

  if (compact) {
    return (
      <div className="avatar-picker avatar-picker--compact">
        {fileInput}
        {preview}
        {image ? (
          <button type="button" className="avatar-picker__link" onClick={() => onChange(null)}>
            Entfernen
          </button>
        ) : (
          <span className="avatar-picker__caption">Bild</span>
        )}
        {error && (
          <p className="avatar-picker__hint is-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="avatar-picker">
      {fileInput}
      <div className="avatar-picker__row">
        {preview}
        <div className="avatar-picker__controls">
          <div className="avatar-picker__buttons">
            <Button size="sm" icon={<ImagePlus />} onClick={choose} disabled={loading}>
              {image ? 'Bild ändern' : 'Bild auswählen'}
            </Button>
            {image && (
              <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => onChange(null)}>
                Entfernen
              </Button>
            )}
          </div>
          <p className={cx('avatar-picker__hint', error && 'is-error')} role={error ? 'alert' : undefined}>
            {error ?? (image ? 'Wird rund angezeigt – wie ein Profilbild.' : 'Optional – sonst werden die Anfangsbuchstaben angezeigt.')}
          </p>
        </div>
      </div>
    </div>
  );
}
