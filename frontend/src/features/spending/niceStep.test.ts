import { describe, expect, it } from 'vitest';
import { niceStep } from './MonthlyChart';

describe('chart axis steps', () => {
  it('uses whole, round euro steps', () => {
    expect(niceStep(523.4, 4)).toBe(200);
    expect(niceStep(8.99, 4)).toBe(5);
    expect(niceStep(2, 4)).toBe(1);
    expect(niceStep(95, 4)).toBe(25);
    expect(niceStep(1800, 4)).toBe(500);
    expect(niceStep(0, 4)).toBe(1);
  });
});
