import type { ISODate } from './types';

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day of a Date as "YYYY-MM-DD". */
export function toISODate(date: Date): ISODate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now);
}

export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

function toUTC(date: ISODate): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

/** Whole days from `from` to `to` (positive if `to` is later). DST-safe. */
export function diffDays(from: ISODate, to: ISODate): number {
  return Math.round((toUTC(to) - toUTC(from)) / DAY_MS);
}

export function addDays(date: ISODate, days: number): ISODate {
  const t = new Date(toUTC(date) + days * DAY_MS);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

const dateFormat = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const shortDateFormat = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** "8. Nov. 2026" */
export function formatDate(date: ISODate): string {
  return dateFormat.format(new Date(toUTC(date)));
}

/** "8. Nov." – omits the year if it is the current one. */
export function formatDateCompact(date: ISODate, today: ISODate = todayISO()): string {
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return (sameYear ? shortDateFormat : dateFormat).format(new Date(toUTC(date)));
}

/** "heute", "morgen", "gestern", "in 5 Tagen", "vor 3 Tagen". */
export function relativeDays(days: number): string {
  if (days === 0) return 'heute';
  if (days === 1) return 'morgen';
  if (days === -1) return 'gestern';
  return days > 0 ? `in ${days} Tagen` : `vor ${-days} Tagen`;
}
