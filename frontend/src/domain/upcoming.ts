/**
 * Everything that will leave the accounts: open obligations plus the next
 * charges of subscriptions, grouped by month. The current month (overdue
 * items included) is what "Anstehend" and "Frei verfügbar" count; later
 * months are shown folded ("Dezember (3)").
 */
import { addMonthsToKey, monthEnd, monthKey } from './dates';
import { isOpen, sortByUrgency } from './obligations';
import { chargesUntil } from './subscriptions';
import type { Account, Cents, ISODate, MonthKey, Obligation, Subscription } from './types';

/** Subscription charges are listed at least this many months after the current one … */
export const SUBSCRIPTION_MONTHS_AHEAD = 2;
/** … and at most this many (obligations further ahead are still listed in their month). */
export const MAX_MONTHS_AHEAD = 11;

export type UpcomingItem =
  | { type: 'obligation'; key: string; date: ISODate | null; amount: Cents; obligation: Obligation }
  | { type: 'subscription'; key: string; date: ISODate; amount: Cents; subscription: Subscription };

/**
 * All open obligations and the subscription charges up to and including
 * `until` (overdue manual ones included), soonest first; no date last.
 */
export function buildUpcoming(
  obligations: readonly Obligation[],
  subscriptions: readonly Subscription[],
  until: ISODate,
): UpcomingItem[] {
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

/** Account an item is paid from / charged to (null = not decided). */
export function accountOfItem(item: UpcomingItem): string | null {
  return item.type === 'obligation' ? item.obligation.accountId : item.subscription.accountId;
}

export interface UpcomingGroup {
  /** "YYYY-MM"; null for obligations without a due date. */
  month: MonthKey | null;
  items: UpcomingItem[];
  total: Cents;
}

export interface UpcomingPlan {
  /** The current month. */
  month: MonthKey;
  /** Due until the end of the current month, overdue items included. */
  current: UpcomingGroup;
  /** Following months with at least one item, soonest first. */
  later: UpcomingGroup[];
  /** Open obligations without a due date. */
  undated: UpcomingGroup;
  /** Subscription charges are listed up to this day. */
  until: ISODate;
}

function group(month: MonthKey | null, items: UpcomingItem[] = []): UpcomingGroup {
  return { month, items, total: sumUpcoming(items) };
}

/**
 * Upcoming payments month by month. Subscriptions are listed until the end
 * of the month with the last dated obligation, but at least two and at most
 * eleven months ahead.
 */
export function buildUpcomingPlan(
  obligations: readonly Obligation[],
  subscriptions: readonly Subscription[],
  today: ISODate,
): UpcomingPlan {
  const month = monthKey(today);
  let last = addMonthsToKey(month, SUBSCRIPTION_MONTHS_AHEAD);
  for (const o of obligations) {
    if (isOpen(o) && o.dueDate !== null && monthKey(o.dueDate) > last) last = monthKey(o.dueDate);
  }
  const cap = addMonthsToKey(month, MAX_MONTHS_AHEAD);
  const until = monthEnd(last > cap ? cap : last);

  const current: UpcomingItem[] = [];
  const undated: UpcomingItem[] = [];
  const later = new Map<MonthKey, UpcomingItem[]>();
  for (const item of buildUpcoming(obligations, subscriptions, until)) {
    if (item.date === null) {
      undated.push(item);
      continue;
    }
    const key = monthKey(item.date);
    if (key <= month) {
      current.push(item);
      continue;
    }
    const list = later.get(key);
    if (list) list.push(item);
    else later.set(key, [item]);
  }

  return {
    month,
    current: group(month, current),
    later: [...later.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, items]) => group(key, items)),
    undated: group(null, undated),
    until,
  };
}

/** The same plan with only the items that pass `keep` (empty later months are dropped). */
export function filterPlan(plan: UpcomingPlan, keep: (item: UpcomingItem) => boolean): UpcomingPlan {
  const filter = (g: UpcomingGroup) => group(g.month, g.items.filter(keep));
  return {
    ...plan,
    current: filter(plan.current),
    later: plan.later.map(filter).filter((g) => g.items.length > 0),
    undated: filter(plan.undated),
  };
}

/** Items that are paid from / charged to the given account. */
export function planForAccount(plan: UpcomingPlan, accountId: string): UpcomingPlan {
  return filterPlan(plan, (item) => accountOfItem(item) === accountId);
}

/** Number of items in the whole plan. */
export function planCount(plan: UpcomingPlan): number {
  return plan.current.items.length + plan.undated.items.length + plan.later.reduce((n, g) => n + g.items.length, 0);
}

export interface FreeMoney {
  /** Balances of all accounts except savings accounts. */
  available: Cents;
  /** Still due this month and not paid from a savings account. */
  due: Cents;
  /** What is left: available − due. */
  free: Cents;
}

/**
 * "Frei verfügbar": the money on the accounts right now – savings accounts
 * left out – minus what still has to be paid this month (overdue included).
 * Payments from a savings account do not reduce it, payments without an
 * account do.
 */
export function computeFreeMoney(
  accounts: readonly Account[],
  balances: ReadonlyMap<string, Cents>,
  plan: UpcomingPlan,
): FreeMoney {
  const savings = new Set(accounts.filter((a) => a.type === 'savings').map((a) => a.id));
  let available = 0;
  for (const account of accounts) {
    if (!savings.has(account.id)) available += balances.get(account.id) ?? 0;
  }
  const due = sumUpcoming(
    plan.current.items.filter((item) => {
      const accountId = accountOfItem(item);
      return accountId === null || !savings.has(accountId);
    }),
  );
  return { available, due, free: available - due };
}
