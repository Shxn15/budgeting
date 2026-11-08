import { describe, expect, it } from 'vitest';
import { anglesFromValues } from './useTweenedArcs';

const TAU = Math.PI * 2;

describe('anglesFromValues', () => {
  it('splits the full circle proportionally', () => {
    const arcs = anglesFromValues([
      { key: 'a', value: 300 },
      { key: 'b', value: 100 },
    ]);
    expect(arcs[0]).toEqual({ key: 'a', start: 0, end: TAU * 0.75 });
    expect(arcs[1]!.end).toBeCloseTo(TAU);
  });

  it('gives tiny slices a minimum size but still closes the circle', () => {
    const arcs = anglesFromValues(
      [
        { key: 'big', value: 100_000 },
        { key: 'tiny', value: 1 },
      ],
      0.05,
    );
    expect(arcs[1]!.end - arcs[1]!.start).toBeCloseTo(0.05);
    expect(arcs[1]!.end).toBeCloseTo(TAU);
  });

  it('returns nothing when there is no positive value', () => {
    expect(anglesFromValues([{ key: 'a', value: 0 }])).toEqual([]);
    expect(anglesFromValues([])).toEqual([]);
  });
});
