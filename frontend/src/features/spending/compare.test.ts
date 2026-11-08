import { describe, expect, it } from 'vitest';
import { comparisonPeriod, relativeChange } from './compare';

describe('comparison labels', () => {
  it('names the period that is compared with', () => {
    const base = { total: 0 };
    expect(comparisonPeriod({ ...base, range: { start: '2026-10', end: '2026-10' }, until: '2026-10-08', partial: true }, 1)).toBe('1.–8. Okt.');
    expect(comparisonPeriod({ ...base, range: { start: '2026-10', end: '2026-10' }, until: '2026-10-01', partial: true }, 1)).toBe('am 1. Okt.');
    expect(comparisonPeriod({ ...base, range: { start: '2026-10', end: '2026-10' }, until: '2026-10-31', partial: false }, 1)).toBe('im Oktober');
    expect(comparisonPeriod({ ...base, range: { start: '2026-02', end: '2026-06' }, until: '2026-06-08', partial: true }, 5)).toBe('Feb.–Juni');
  });

  it('computes the relative change', () => {
    expect(relativeChange(150, 100)).toBe(0.5);
    expect(relativeChange(50, 0)).toBeNull();
  });
});
