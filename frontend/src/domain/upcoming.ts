/**
 * Everything that will leave the accounts soon: open obligations plus the
 * next charges of subscriptions. Used for "Anstehende Zahlungen" and for
 * the "Frei verfügbar" figure.
 */
import { addDays } from './dates';
import { isOpen, sortByUrgency } from './obligations';
import { chargesUntil } from './subscriptions';
import type { Cents, ISODate, Obligation, Subscription } from './types';

/** Subscriptions are counted this many days ahead. */
export const UPCOMING_DAYS = 30;

export type UpcomingItem =
  | { type: 'obligation'; key: string; date: ISODate | null; amount: Cents; obligation: Obligation }
  | { type: 'subscription'; key: string; date: ISODate; amount: Cents; subscription: Subscription };

/**
 * Open obligations (all of them, as before) and the subscription charges up
 * to `today + days` (overdue manual ones included), soonest first.
 */
export function buildUpcoming(
  obligations: readonly Obligation[],
  subscriptions: readonly Subscription[],
  today: ISODate,
  days = UPCOMING_DAYS,
): UpcomingItem[] {
  const until = addDays(today, days);
  const items: UpcomingItem[] = sortByUrgency(obligations.filter(isOpen)).map((o) => ({
    type: 'obligation',
    key: `o:${o.id}`,
    date: o.dueDate,
    amount: o.amount,
    obligation: o,
  }));
  for (const sub of subscriptions) {
    for (const date of chargesUntil(sub, until)) {
      items.push({ type: 'subscription', key: `s:${sub.id}:${date}`, date, amount: sub.amount, subscription: sub });
    }
  }
  // Stable sort keeps the urgency order of the obligations; no date goes last.
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const da = a.item.date;
      const db = b.item.date;
      if (da !== db) {
        if (da === null) return 1;
        if (db === null) return -1;
        return da < db ? -1 : 1;
      }
      return a.index - b.index;
    })
    .map((entry) => entry.item);
}

export function sumUpcoming(items: readonly UpcomingItem[]): Cents {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

/** Items that are paid from / charged to the given account. */
export function upcomingForAccount(items: readonly UpcomingItem[], accountId: string): UpcomingItem[] {
  return items.filter((item) =>
    item.type === 'obligation' ? item.obligation.accountId === accountId : item.subscription.accountId === accountId,
  );
}
