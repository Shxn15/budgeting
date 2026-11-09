/**
 * Money others still owe me ("Bekomme ich noch"): order, labels and sums.
 */
import { diffDays, formatDateCompact, relativeDays } from './dates';
import type { Cents, ISODate, Receivable } from './types';

export function isReceivableOpen(r: Receivable): boolean {
  return r.receivedAt === null;
}

/** Open ones: expected soonest first (overdue on top), without a date last. */
export function openReceivables(list: readonly Receivable[]): Receivable[] {
  return list.filter(isReceivableOpen).sort((a, b) => {
    if (a.expectedDate !== b.expectedDate) {
      if (a.expectedDate === null) return 1;
      if (b.expectedDate === null) return -1;
      return a.expectedDate < b.expectedDate ? -1 : 1;
    }
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  });
}

/** Received ones, most recent first. */
export function receivedReceivables(list: readonly Receivable[]): Receivable[] {
  return list
    .filter((r) => !isReceivableOpen(r))
    .sort((a, b) => (b.receivedAt ?? '').localeCompare(a.receivedAt ?? ''));
}

/** Headline in lists: the person first ("Max"), otherwise what it is for. */
export function receivableName(r: Pick<Receivable, 'counterparty' | 'title'>): string {
  return r.counterparty.trim() || r.title.trim() || 'Geld';
}

/** Note of the income booking when the money arrives: "Pizza von Max", "Von Max" or "Pizza". */
export function receivableNote(r: Pick<Receivable, 'counterparty' | 'title'>): string {
  const who = r.counterparty.trim();
  const what = r.title.trim();
  if (who && what) return `${what} von ${who}`;
  if (who) return `Von ${who}`;
  return what;
}

/** "heute erwartet", "erwartet in 5 Tagen", "seit 3 Tagen fällig", "ohne Datum" ... */
export function expectedLabel(date: ISODate | null, today: ISODate): string {
  if (date === null) return 'ohne Datum';
  const days = diffDays(today, date);
  if (days === 0) return 'heute erwartet';
  if (days === 1) return 'morgen erwartet';
  if (days === -1) return 'seit gestern fällig';
  if (days < 0) return `seit ${-days} Tagen fällig`;
  if (days <= 31) return `erwartet ${relativeDays(days)}`;
  return `erwartet am ${formatDateCompact(date, today)}`;
}

export function sumReceivables(list: readonly Pick<Receivable, 'amount'>[]): Cents {
  return list.reduce((sum, r) => sum + r.amount, 0);
}

/** Number of different people (by name) in the list. */
export function countPeople(list: readonly Pick<Receivable, 'counterparty' | 'id'>[]): number {
  return new Set(list.map((r) => r.counterparty.trim().toLocaleLowerCase('de') || r.id)).size;
}
