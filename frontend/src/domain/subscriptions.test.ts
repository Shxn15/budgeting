import { describe, expect, it } from 'vitest';
import {
  chargesUntil,
  intervalLabel,
  monthlyCost,
  nextOccurrenceAfter,
  nextOccurrenceOnOrAfter,
  occurrence,
  totalMonthlyCost,
  yearlyCost,
  type Schedule,
} from './subscriptions';
import type { Subscription } from './types';

const monthly = (anchorDate: string, intervalCount = 1): Schedule => ({ anchorDate, intervalUnit: 'month', intervalCount });

function sub(fields: Partial<Subscription> = {}): Subscription {
  return {
    id: 's1',
    name: 'Netflix',
    amount: 1299,
    intervalUnit: 'month',
    intervalCount: 1,
    anchorDate: '2026-11-15',
    nextDueDate: '2026-11-15',
    accountId: null,
    autoPay: false,
    color: 'red',
    image: null,
    note: '',
    paused: false,
    createdAt: '2026-11-08T10:00:00.000Z',
    ...fields,
  };
}

describe('subscription schedule', () => {
  it('keeps the day of month across short months', () => {
    const schedule = monthly('2026-01-31');
    expect([0, 1, 2, 3].map((n) => occurrence(schedule, n))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
    expect(nextOccurrenceAfter(schedule, '2026-02-28')).toBe('2026-03-31');
    expect(nextOccurrenceAfter(schedule, '2026-03-30')).toBe('2026-03-31');
  });

  it('finds the next charge for weekly, quarterly and yearly schedules', () => {
    expect(nextOccurrenceAfter({ anchorDate: '2026-11-02', intervalUnit: 'week', intervalCount: 2 }, '2026-11-16')).toBe(
      '2026-11-30',
    );
    expect(nextOccurrenceAfter(monthly('2026-01-10', 3), '2026-11-08')).toBe('2027-01-10');
    expect(nextOccurrenceAfter({ anchorDate: '2024-02-29', intervalUnit: 'year', intervalCount: 1 }, '2025-01-01')).toBe(
      '2025-02-28',
    );
    expect(nextOccurrenceAfter({ anchorDate: '2024-02-29', intervalUnit: 'year', intervalCount: 1 }, '2027-03-01')).toBe(
      '2028-02-29',
    );
    // Before the anchor the anchor itself is next.
    expect(nextOccurrenceAfter(monthly('2026-12-01'), '2026-11-08')).toBe('2026-12-01');
    expect(nextOccurrenceOnOrAfter(monthly('2026-01-15'), '2026-11-15')).toBe('2026-11-15');
    expect(nextOccurrenceOnOrAfter(monthly('2026-01-15'), '2026-11-16')).toBe('2026-12-15');
  });

  it('jumps over many years quickly', () => {
    expect(nextOccurrenceAfter({ anchorDate: '2000-01-03', intervalUnit: 'week', intervalCount: 1 }, '2026-11-08')).toBe(
      '2026-11-09',
    );
  });

  it('lists the open charges until a date, overdue ones included', () => {
    expect(chargesUntil(sub({ nextDueDate: '2026-10-15', anchorDate: '2026-01-15' }), '2026-12-08')).toEqual([
      '2026-10-15',
      '2026-11-15',
    ]);
    expect(chargesUntil(sub({ paused: true }), '2027-12-31')).toEqual([]);
    expect(
      chargesUntil(sub({ intervalUnit: 'week', anchorDate: '2026-11-09', nextDueDate: '2026-11-09' }), '2026-12-08'),
    ).toEqual(['2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07']);
  });

  it('computes monthly and yearly costs', () => {
    expect(monthlyCost(sub())).toBe(1299);
    expect(monthlyCost(sub({ intervalUnit: 'year', amount: 12000 }))).toBe(1000);
    expect(monthlyCost(sub({ intervalCount: 3, amount: 3000 }))).toBe(1000);
    expect(Math.round(monthlyCost(sub({ intervalUnit: 'week', amount: 1000 })))).toBe(4348);
    expect(Math.round(yearlyCost(sub({ amount: 999 })))).toBe(11988);
    expect(totalMonthlyCost([sub(), sub({ id: 's2', amount: 1000, paused: true }), sub({ id: 's3', amount: 701 })])).toBe(
      2000,
    );
  });

  it('describes intervals in German', () => {
    expect(intervalLabel('month', 1)).toBe('monatlich');
    expect(intervalLabel('month', 3)).toBe('vierteljährlich');
    expect(intervalLabel('month', 2)).toBe('alle 2 Monate');
    expect(intervalLabel('week', 1)).toBe('wöchentlich');
    expect(intervalLabel('week', 2)).toBe('alle 2 Wochen');
    expect(intervalLabel('year', 1)).toBe('jährlich');
  });
});
