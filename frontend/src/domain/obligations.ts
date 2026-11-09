import { diffDays, formatDateCompact, relativeDays } from './dates';
import type { Cents, ISODate, Obligation } from './types';

/** Obligations due within this many days count as "due soon". */
export const DUE_SOON_DAYS = 7;

export type DueState = 'overdue' | 'today' | 'soon' | 'upcoming' | 'none';

export function isOpen(o: Obligation): boolean {
  return o.paidAt === null;
}

export function daysUntilDue(o: Obligation, today: ISODate): number | null {
  return o.dueDate === null ? null : diffDays(today, o.dueDate);
}

/** Urgency of anything that is due on `date` (null = no date). */
export function dueStateForDate(date: ISODate | null, today: ISODate): DueState {
  if (date === null) return 'none';
  const days = diffDays(today, date);
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= DUE_SOON_DAYS) return 'soon';
  return 'upcoming';
}

export function dueState(o: Obligation, today: ISODate): DueState {
  return dueStateForDate(o.dueDate, today);
}

/** "seit 2 Tagen überfällig", "heute fällig", "fällig in 5 Tagen", ... */
export function dueLabelForDate(date: ISODate | null, today: ISODate): string {
  if (date === null) return 'ohne Fälligkeit';
  const days = diffDays(today, date);
  if (days === 0) return 'heute fällig';
  if (days === 1) return 'morgen fällig';
  if (days === -1) return 'seit gestern überfällig';
  if (days < 0) return `seit ${-days} Tagen überfällig`;
  if (days <= 31) return `fällig ${relativeDays(days)}`;
  return `fällig am ${formatDateCompact(date, today)}`;
}

export function dueLabel(o: Obligation, today: ISODate): string {
  return dueLabelForDate(o.dueDate, today);
}

/** For automatic charges: "wird heute abgebucht", "Abbuchung in 5 Tagen", ... */
export function chargeLabel(date: ISODate, today: ISODate): string {
  const days = diffDays(today, date);
  if (days <= 0) return 'wird heute abgebucht';
  if (days === 1) return 'wird morgen abgebucht';
  if (days <= 31) return `Abbuchung ${relativeDays(days)}`;
  return `Abbuchung am ${formatDateCompact(date, today)}`;
}

/** Headline of an obligation, e.g. "Miete" or "Schulden bei Max". */
export function obligationTitle(o: Obligation): string {
  if (o.title.trim()) return o.title.trim();
  if (o.counterparty.trim()) {
    return o.kind === 'debt' ? `Schulden bei ${o.counterparty.trim()}` : `Zahlung an ${o.counterparty.trim()}`;
  }
  return o.kind === 'debt' ? 'Schulden' : 'Zahlung';
}

/** Open obligations sorted by urgency: earliest due date first, no date last. */
export function sortByUrgency(list: readonly Obligation[]): Obligation[] {
  return [...list].sort((a, b) => {
    if (a.dueDate !== b.dueDate) {
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate < b.dueDate ? -1 : 1;
    }
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  });
}

export function openObligations(list: readonly Obligation[]): Obligation[] {
  return sortByUrgency(list.filter(isOpen));
}

export function sumAmounts(list: readonly { amount: Cents }[]): Cents {
  return list.reduce((sum, o) => sum + o.amount, 0);
}
