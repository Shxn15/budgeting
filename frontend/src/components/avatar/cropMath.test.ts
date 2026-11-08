import { describe, expect, it } from 'vitest';
import { clampCrop, initialCrop, minZoom, outputRect, zoomAt } from './cropMath';

const landscape = { width: 400, height: 200 };
const V = 200;

describe('picture cropper', () => {
  it('starts centred and covers the viewport', () => {
    expect(initialCrop(landscape, V)).toEqual({ zoom: 1, x: -100, y: 0 });
    expect(outputRect(initialCrop(landscape, V), landscape, V, 100)).toEqual({ dx: -50, dy: 0, dw: 200, dh: 100 });
  });

  it('never leaves a gap while the picture covers the viewport', () => {
    expect(clampCrop({ zoom: 1, x: 50, y: 30 }, landscape, V)).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(clampCrop({ zoom: 1, x: -500, y: -30 }, landscape, V)).toEqual({ zoom: 1, x: -200, y: 0 });
    expect(clampCrop({ zoom: 9, x: 0, y: 0 }, landscape, V).zoom).toBe(4);
  });

  it('can zoom out until a wide logo fits completely', () => {
    expect(minZoom(landscape)).toBe(0.5);
    const contained = clampCrop({ zoom: 0.1, x: 0, y: 0 }, landscape, V);
    // Width fills the viewport, the height is centred.
    expect(contained).toEqual({ zoom: 0.5, x: 0, y: 50 });
    expect(outputRect(contained, landscape, V, 200)).toEqual({ dx: 0, dy: 50, dw: 200, dh: 100 });
  });

  it('zooms around a point', () => {
    const zoomed = zoomAt(initialCrop(landscape, V), 2, 100, 100, landscape, V);
    expect(zoomed).toEqual({ zoom: 2, x: -300, y: -100 });
    expect(outputRect(zoomed, landscape, V, 200)).toEqual({ dx: -300, dy: -100, dw: 800, dh: 400 });
  });
});
