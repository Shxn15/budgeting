import { addDays, addMonths, diffDays, monthDiff, monthEnd, monthKey } from './dates';
import type { Cents, ISODate, IntervalUnit, Subscription } from './types';

export type Schedule = Pick<Subscription, 'anchorDate' | 'intervalUnit' | 'intervalCount'>;

/** Highest allowed `intervalCount` per unit. */
export const MAX_INTERVAL_COUNT: Readonly<Record<IntervalUnit, number>> = { week: 52, month: 36, year: 10 };

/** Safety limit for loops over charge dates. */
const MAX_STEPS = 1000;

/** The n-th charge date of a schedule (n = 0 is the anchor). */
export function occurrence(schedule: Schedule, n: number): ISODate {
  const { anchorDate, intervalUnit, intervalCount } = schedule;
  switch (intervalUnit) {
    case 'week':
      return addDays(anchorDate, 7 * intervalCount * n);
    case 'month':
      return addMonths(anchorDate, intervalCount * n);
    case 'year':
      return addMonths(anchorDate, 12 * intervalCount * n);
  }
}

/** First charge date of the schedule that is strictly after `date`. */
export function nextOccurrenceAfter(schedule: Schedule, date: ISODate): ISODate {
  const { anchorDate, intervalUnit, intervalCount } = schedule;
  if (date < anchorDate) return anchorDate;
  // Jump close to the right occurrence, then step forward.
  const estimate =
    intervalUnit === 'week'
      ? Math.floor(diffDays(anchorDate, date) / (7 * intervalCount))
      : Math.floor(monthDiff(anchorDate, date) / (intervalUnit === 'year' ? 12 * intervalCount : intervalCount));
  let n = Math.max(0, estimate - 1);
  let candidate = occurrence(schedule, n);
  for (let i = 0; candidate <= date && i < MAX_STEPS; i++) candidate = occurrence(schedule, ++n);
  return candidate;
}

/** First charge date on or after `date`. */
export function nextOccurrenceOnOrAfter(schedule: Schedule, date: ISODate): ISODate {
  return nextOccurrenceAfter(schedule, addDays(date, -1));
}

/** The charge date after the current `nextDueDate`. */
export function followingDueDate(sub: Subscription): ISODate {
  return nextOccurrenceAfter(sub, sub.nextDueDate);
}

/**
 * Open charge dates from `nextDueDate` up to and including `until`
 * (overdue ones included). Empty for paused subscriptions.
 */
export function chargesUntil(sub: Subscription, until: ISODate, limit = 60): ISODate[] {
  if (sub.paused) return [];
  const dates: ISODate[] = [];
  let date = sub.nextDueDate;
  while (date <= until && dates.length < limit) {
    dates.push(date);
    date = nextOccurrenceAfter(sub, date);
  }
  return dates;
}

const DAYS_PER_YEAR = 365.25;

/** Average cost per month (fractional cents – round only for display). */
export function monthlyCost(sub: Pick<Subscription, 'amount' | 'intervalUnit' | 'intervalCount'>): number {
  switch (sub.intervalUnit) {
    case 'week':
      return (sub.amount * DAYS_PER_YEAR) / 7 / 12 / sub.intervalCount;
    case 'month':
      return sub.amount / sub.intervalCount;
    case 'year':
      return sub.amount / 12 / sub.intervalCount;
  }
}

export function yearlyCost(sub: Pick<Subscription, 'amount' | 'intervalUnit' | 'intervalCount'>): number {
  return monthlyCost(sub) * 12;
}

/** Sum of the monthly costs of all active subscriptions, in whole cents. */
export function totalMonthlyCost(list: readonly Subscription[]): Cents {
  return Math.round(list.filter((s) => !s.paused).reduce((sum, s) => sum + monthlyCost(s), 0));
}

/**
 * What the subscriptions still charge until the end of the month of `today`
 * – charges already booked do not count, overdue manual ones do.
 */
export function remainingThisMonth(list: readonly Subscription[], today: ISODate): { count: number; total: Cents } {
  const end = monthEnd(monthKey(today));
  let count = 0;
  let total = 0;
  for (const sub of list) {
    const charges = chargesUntil(sub, end).length;
    count += charges;
    total += charges * sub.amount;
  }
  return { count, total };
}

/** "monatlich", "alle 3 Monate", "vierteljährlich", "jährlich", "alle 2 Wochen" ... */
export function intervalLabel(unit: IntervalUnit, count: number): string {
  if (unit === 'week') return count === 1 ? 'wöchentlich' : `alle ${count} Wochen`;
  if (unit === 'year') return count === 1 ? 'jährlich' : `alle ${count} Jahre`;
  if (count === 1) return 'monatlich';
  if (count === 3) return 'vierteljährlich';
  if (count === 6) return 'halbjährlich';
  if (count === 12) return 'jährlich';
  return `alle ${count} Monate`;
}

/** Short unit for prices: "/ Monat", "/ Jahr", "/ 3 Monate" ... */
export function perIntervalLabel(unit: IntervalUnit, count: number): string {
  const names: Record<IntervalUnit, [string, string]> = {
    week: ['Woche', 'Wochen'],
    month: ['Monat', 'Monate'],
    year: ['Jahr', 'Jahre'],
  };
  const [one, many] = names[unit];
  return count === 1 ? `/ ${one}` : `/ ${count} ${many}`;
}

/** Interval presets offered in the dialog. */
export const INTERVAL_PRESETS: readonly { unit: IntervalUnit; count: number; label: string }[] = [
  { unit: 'week', count: 1, label: 'Jede Woche' },
  { unit: 'week', count: 2, label: 'Alle 2 Wochen' },
  { unit: 'week', count: 4, label: 'Alle 4 Wochen' },
  { unit: 'month', count: 1, label: 'Jeden Monat' },
  { unit: 'month', count: 2, label: 'Alle 2 Monate' },
  { unit: 'month', count: 3, label: 'Alle 3 Monate (vierteljährlich)' },
  { unit: 'month', count: 6, label: 'Alle 6 Monate (halbjährlich)' },
  { unit: 'year', count: 1, label: 'Jedes Jahr' },
  { unit: 'year', count: 2, label: 'Alle 2 Jahre' },
];

/** Active first (by next charge), then paused ones (by name). */
export function sortSubscriptions(list: readonly Subscription[]): Subscription[] {
  return [...list].sort((a, b) => {
    if (a.paused !== b.paused) return a.paused ? 1 : -1;
    if (!a.paused && a.nextDueDate !== b.nextDueDate) return a.nextDueDate < b.nextDueDate ? -1 : 1;
    return a.name.localeCompare(b.name, 'de');
  });
}
