/**
 * Turns a picture the user picked into a small square profile picture
 * (data URL) that is stored in data.json.
 */
import { MAX_IMAGE_LENGTH } from '../../domain/images';
import type { Size } from './cropMath';

/** Edge length of stored pictures: sharp at the largest avatar size (88 px) on 2× screens. */
export const AVATAR_PIXELS = 192;
const MAX_FILE_BYTES = 30 * 1024 * 1024;
const EXTENSIONS = /\.(png|jpe?g|jfif|webp|gif|bmp|avif|ico|svg)$/i;

export class ImageError extends Error {}

export async function loadImageFile(file: File): Promise<HTMLImageElement> {
  if (!(file.type.startsWith('image/') || EXTENSIONS.test(file.name))) {
    throw new ImageError('Das ist kein Bild. Bitte wähle eine JPG-, PNG-, WebP- oder GIF-Datei.');
  }
  if (file.size > MAX_FILE_BYTES) throw new ImageError('Das Bild ist zu groß (höchstens 30 MB).');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    if (image.naturalWidth < 1 || image.naturalHeight < 1) throw new Error('empty');
    return image;
  } catch {
    URL.revokeObjectURL(url);
    throw new ImageError('Dieses Bild kann leider nicht geöffnet werden. Probier es mit JPG oder PNG.');
  }
}

/** Frees the memory of a picture loaded with loadImageFile. */
export function releaseImage(image: HTMLImageElement): void {
  if (image.src.startsWith('blob:')) URL.revokeObjectURL(image.src);
}

export function imageSize(image: HTMLImageElement): Size {
  return { width: image.naturalWidth, height: image.naturalHeight };
}

/**
 * Draws the picture at (dx, dy, dw, dh) into a small square canvas (see
 * cropMath.outputRect) and encodes it as a data URL.
 */
export function renderAvatar(image: CanvasImageSource, rect: { dx: number; dy: number; dw: number; dh: number }): string {
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_PIXELS;
  canvas.height = AVATAR_PIXELS;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImageError('Das Bild konnte nicht verarbeitet werden.');
  // Transparent logos (and the space around a zoomed-out logo) get a white background.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, AVATAR_PIXELS, AVATAR_PIXELS);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, rect.dx, rect.dy, rect.dw, rect.dh);

  let url: string;
  try {
    url = canvas.toDataURL('image/webp', 0.86);
    // Browsers without WebP encoding silently return PNG; JPEG is much smaller then.
    if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    throw new ImageError('Dieses Bild kann leider nicht verwendet werden.');
  }
  if (url.length > MAX_IMAGE_LENGTH) throw new ImageError('Das Bild konnte nicht klein genug gespeichert werden.');
  return url;
}
