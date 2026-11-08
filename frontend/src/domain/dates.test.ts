import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  addMonthsToKey,
  diffDays,
  formatDate,
  formatMonth,
  formatMonthRange,
  isISODate,
  isMonthKey,
  monthDiff,
  monthEnd,
  monthKey,
  monthsBetween,
  monthStart,
  relativeDays,
  toISODate,
} from './dates';

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

describe('months', () => {
  it('adds months and clamps to the end of shorter months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-01-31', 2)).toBe('2026-03-31');
    expect(addMonths('2026-11-15', 2)).toBe('2027-01-15');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2024-02-29', 12)).toBe('2025-02-28');
  });

  it('works with month keys and ranges', () => {
    expect(monthKey('2026-11-08')).toBe('2026-11');
    expect(addMonthsToKey('2026-11', 2)).toBe('2027-01');
    expect(addMonthsToKey('2026-01', -1)).toBe('2025-12');
    expect(monthDiff('2025-12', '2026-11')).toBe(11);
    expect(monthsBetween('2026-10', '2027-01')).toEqual(['2026-10', '2026-11', '2026-12', '2027-01']);
    expect(monthsBetween('2026-11', '2026-10')).toEqual([]);
    expect(monthStart('2026-02')).toBe('2026-02-01');
    expect(monthEnd('2026-02')).toBe('2026-02-28');
    expect(monthEnd('2028-02')).toBe('2028-02-29');
    expect(isMonthKey('2026-13')).toBe(false);
    expect(isMonthKey('2026-07')).toBe(true);
  });

  it('formats months in German', () => {
    expect(formatMonth('2026-11')).toBe('November 2026');
    expect(formatMonthRange('2026-07', '2026-11')).toBe('Juli – Nov. 2026');
    expect(formatMonthRange('2025-12', '2026-02')).toBe('Dez. 2025 – Feb. 2026');
    expect(formatMonthRange('2026-11', '2026-11')).toBe('November 2026');
  });
});
