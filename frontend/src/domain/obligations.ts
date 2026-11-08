import { diffDays, formatDate, relativeDays } from './dates';
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

export function dueState(o: Obligation, today: ISODate): DueState {
  const days = daysUntilDue(o, today);
  if (days === null) return 'none';
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= DUE_SOON_DAYS) return 'soon';
  return 'upcoming';
}

/** "seit 2 Tagen überfällig", "heute fällig", "fällig in 5 Tagen", ... */
export function dueLabel(o: Obligation, today: ISODate): string {
  const days = daysUntilDue(o, today);
  if (days === null) return 'ohne Fälligkeit';
  if (days === 0) return 'heute fällig';
  if (days === 1) return 'morgen fällig';
  if (days === -1) return 'seit gestern überfällig';
  if (days < 0) return `seit ${-days} Tagen überfällig`;
  if (days <= 31) return `fällig ${relativeDays(days)}`;
  return `fällig am ${formatDate(o.dueDate!)}`;
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

export function sumAmounts(list: readonly Obligation[]): Cents {
  return list.reduce((sum, o) => sum + o.amount, 0);
}
