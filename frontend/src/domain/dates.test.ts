import { describe, expect, it } from 'vitest';
import { addDays, diffDays, formatDate, isISODate, relativeDays, toISODate } from './dates';

describe('dates', () => {
  it('validates ISO dates', () => {
    expect(isISODate('2026-11-08')).toBe(true);
    expect(isISODate('2026-02-30')).toBe(false);
    expect(isISODate('2026-1-8')).toBe(false);
    expect(isISODate(20261108)).toBe(false);
  });

  it('computes day differences across month, year and DST boundaries', () => {
    expect(diffDays('2026-11-08', '2026-11-13')).toBe(5);
    expect(diffDays('2026-11-08', '2026-11-01')).toBe(-7);
    expect(diffDays('2026-12-30', '2027-01-02')).toBe(3);
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
    expect(addDays('2026-10-24', 7)).toBe('2026-10-31');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('formats dates in German', () => {
    expect(formatDate('2026-11-08')).toBe('8. Nov. 2026');
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(relativeDays(0)).toBe('heute');
    expect(relativeDays(1)).toBe('morgen');
    expect(relativeDays(5)).toBe('in 5 Tagen');
    expect(relativeDays(-3)).toBe('vor 3 Tagen');
  });
});
