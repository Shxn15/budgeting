/**
 * Geometry of the round picture cropper. The picture is shown in a square
 * viewport. Zoom 1 = the picture covers the viewport (shorter side fits);
 * below 1 down to "contain", so a wide logo fits completely (white around it).
 */

export interface CropState {
  zoom: number;
  /** Top-left corner of the scaled picture relative to the viewport. */
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export const MAX_ZOOM = 4;

export function baseScale(image: Size, viewport: number): number {
  return viewport / Math.min(image.width, image.height);
}

/** Smallest zoom: the whole picture is visible ("contain"). */
export function minZoom(image: Size): number {
  return Math.min(image.width, image.height) / Math.max(image.width, image.height);
}

/** Keeps the zoom in range; a covering side cannot leave a gap, a smaller side is centred. */
export function clampCrop(state: CropState, image: Size, viewport: number): CropState {
  const zoom = Math.min(MAX_ZOOM, Math.max(minZoom(image), state.zoom));
  const scale = baseScale(image, viewport) * zoom;
  const axis = (pos: number, size: number) =>
    size >= viewport ? Math.min(0, Math.max(viewport - size, pos)) : (viewport - size) / 2;
  return { zoom, x: axis(state.x, image.width * scale), y: axis(state.y, image.height * scale) };
}

/** Centred, covering the viewport. */
export function initialCrop(image: Size, viewport: number): CropState {
  const scale = baseScale(image, viewport);
  return { zoom: 1, x: (viewport - image.width * scale) / 2, y: (viewport - image.height * scale) / 2 };
}

/** Zooms while keeping the point (px, py) of the viewport in place. */
export function zoomAt(state: CropState, zoom: number, px: number, py: number, image: Size, viewport: number): CropState {
  const base = baseScale(image, viewport);
  const oldScale = base * state.zoom;
  const nextZoom = Math.min(MAX_ZOOM, Math.max(minZoom(image), zoom));
  const newScale = base * nextZoom;
  // The point of the picture under (px, py) stays under (px, py).
  const ix = (px - state.x) / oldScale;
  const iy = (py - state.y) / oldScale;
  return clampCrop({ zoom: nextZoom, x: px - ix * newScale, y: py - iy * newScale }, image, viewport);
}

/** Where the picture lands in an output square of `out` pixels (for drawImage). */
export function outputRect(state: CropState, image: Size, viewport: number, out: number) {
  const k = out / viewport;
  const scale = baseScale(image, viewport) * state.zoom;
  return { dx: state.x * k, dy: state.y * k, dw: image.width * scale * k, dh: image.height * scale * k };
}
