import type { ISODate, MonthKey } from './types';

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

function parts(date: ISODate): [number, number, number] {
  return date.split('-').map(Number) as [number, number, number];
}

/** Number of days of a month (month 1..12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Adds calendar months. The day is clamped to the end of shorter months:
 * 31 Jan + 1 month = 28 Feb (29 in leap years), 31 Jan + 2 months = 31 Mar.
 */
export function addMonths(date: ISODate, months: number): ISODate {
  const [y, m, d] = parts(date);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12 + 1;
  const day = Math.min(d, daysInMonth(year, month));
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Whole calendar months from `from` to `to`, ignoring the day ("2026-01-31" → "2026-02-01" = 1). */
export function monthDiff(from: ISODate | MonthKey, to: ISODate | MonthKey): number {
  const [y1, m1] = parts(from);
  const [y2, m2] = parts(to);
  return (y2 - y1) * 12 + (m2 - m1);
}

/** "2026-11-08" -> "2026-11" */
export function monthKey(date: ISODate): MonthKey {
  return date.slice(0, 7);
}

export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** "2026-11" + 2 -> "2027-01" */
export function addMonthsToKey(key: MonthKey, months: number): MonthKey {
  return addMonths(`${key}-01`, months).slice(0, 7);
}

export function monthStart(key: MonthKey): ISODate {
  return `${key}-01`;
}

export function monthEnd(key: MonthKey): ISODate {
  const [y, m] = parts(key);
  return `${key}-${pad(daysInMonth(y, m))}`;
}

/** All months from `start` to `end` (inclusive). */
export function monthsBetween(start: MonthKey, end: MonthKey): MonthKey[] {
  const count = monthDiff(start, end);
  return Array.from({ length: Math.max(0, count + 1) }, (_, i) => addMonthsToKey(start, i));
}

// Fixed German names: Intl abbreviations differ between ICU versions ("Jul" vs. "Juli").
const MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const;
const MONTH_SHORT = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'] as const;

function monthIndex(key: MonthKey): number {
  return Number(key.slice(5, 7)) - 1;
}

/** "November 2026" */
export function formatMonth(key: MonthKey): string {
  return `${MONTH_NAMES[monthIndex(key)]} ${key.slice(0, 4)}`;
}

/** "November" */
export function formatMonthName(key: MonthKey): string {
  return MONTH_NAMES[monthIndex(key)]!;
}

/** "Nov." – with `withYear`: "Nov. 2026" */
export function formatMonthShort(key: MonthKey, withYear = false): string {
  const name = MONTH_SHORT[monthIndex(key)]!;
  return withYear ? `${name} ${key.slice(0, 4)}` : name;
}

/** "Juli – Nov. 2026", "Dez. 2025 – Feb. 2026" or "November 2026" for a single month. */
export function formatMonthRange(start: MonthKey, end: MonthKey): string {
  if (start === end) return formatMonth(start);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${formatMonthShort(start, !sameYear)} – ${formatMonthShort(end, true)}`;
}

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
