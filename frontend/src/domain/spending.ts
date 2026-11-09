/**
 * Statistics: how much money went where, grouped by tag and month.
 */
import { addMonths, addMonthsToKey, monthEnd, monthKey, monthsBetween, monthStart } from './dates';
import type { Cents, ISODate, MonthKey, Transaction } from './types';

/** Group of bookings without a tag (and not belonging to a subscription). */
export const NO_TAG = '__none__';
const SUBSCRIPTION_PREFIX = 'sub:';

/** Money that left the accounts to the outside world. */
export function isSpending(t: Transaction): boolean {
  return t.kind === 'expense' || t.kind === 'payment' || t.kind === 'subscription';
}

/**
 * The group a booking is counted in: its tag; subscription charges without
 * a tag are grouped by their subscription (so "Netflix" shows up on its own).
 */
export function spendingGroupKey(t: Pick<Transaction, 'tagId' | 'subscriptionId'>): string {
  if (t.tagId) return t.tagId;
  if (t.subscriptionId) return `${SUBSCRIPTION_PREFIX}${t.subscriptionId}`;
  return NO_TAG;
}

export function subscriptionIdOfGroup(key: string): string | null {
  return key.startsWith(SUBSCRIPTION_PREFIX) ? key.slice(SUBSCRIPTION_PREFIX.length) : null;
}

export interface MonthRange {
  /** First month (inclusive). */
  start: MonthKey;
  /** Last month (inclusive). */
  end: MonthKey;
}

/** The `months` months that end with `end`: lastMonths("2026-11", 5) = Jul–Nov 2026. */
export function lastMonths(end: MonthKey, months: number): MonthRange {
  return { start: addMonthsToKey(end, -(Math.max(1, months) - 1)), end };
}

/** The range of the same length right before `range`. */
export function previousRange(range: MonthRange): MonthRange {
  const length = monthsBetween(range.start, range.end).length;
  return { start: addMonthsToKey(range.start, -length), end: addMonthsToKey(range.start, -1) };
}

export function inRange(date: string, range: MonthRange): boolean {
  const key = monthKey(date);
  return key >= range.start && key <= range.end;
}

export interface SpendingGroup {
  key: string;
  total: Cents;
  count: number;
  byMonth: Map<MonthKey, Cents>;
  /** Newest first. */
  transactions: Transaction[];
}

export interface SpendingSummary {
  range: MonthRange;
  months: MonthKey[];
  total: Cents;
  count: number;
  /** Every month of the range, also those without spending (0). */
  byMonth: Map<MonthKey, Cents>;
  /** Largest first. */
  groups: SpendingGroup[];
}

function newestFirst(a: Transaction, b: Transaction): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
}

/** Spending per tag and per month within `range`. */
export function summarizeSpending(transactions: readonly Transaction[], range: MonthRange): SpendingSummary {
  const months = monthsBetween(range.start, range.end);
  const byMonth = new Map<MonthKey, Cents>(months.map((m) => [m, 0]));
  const groups = new Map<string, SpendingGroup>();
  let total = 0;
  let count = 0;

  for (const t of transactions) {
    if (!isSpending(t)) continue;
    const month = monthKey(t.date);
    if (!byMonth.has(month)) continue;
    total += t.amount;
    count += 1;
    byMonth.set(month, byMonth.get(month)! + t.amount);

    const key = spendingGroupKey(t);
    let group = groups.get(key);
    if (!group) {
      group = { key, total: 0, count: 0, byMonth: new Map(months.map((m) => [m, 0])), transactions: [] };
      groups.set(key, group);
    }
    group.total += t.amount;
    group.count += 1;
    group.byMonth.set(month, group.byMonth.get(month)! + t.amount);
    group.transactions.push(t);
  }

  for (const group of groups.values()) group.transactions.sort(newestFirst);
  const sorted = [...groups.values()].sort((a, b) => b.total - a.total || b.count - a.count);
  return { range, months, total, count, byMonth, groups: sorted };
}

/** Total spending in `range` (optionally only one group). */
export function totalSpending(transactions: readonly Transaction[], range: MonthRange, groupKey?: string): Cents {
  let total = 0;
  for (const t of transactions) {
    if (!isSpending(t) || !inRange(t.date, range)) continue;
    if (groupKey !== undefined && spendingGroupKey(t) !== groupKey) continue;
    total += t.amount;
  }
  return total;
}

export interface PreviousPeriod {
  range: MonthRange;
  /** Last day that was counted (cut off at the same day while `range` is still running). */
  until: ISODate;
  /** True if the period was cut off to stay comparable with a running range. */
  partial: boolean;
  total: Cents;
}

/**
 * Spending of the period right before `range`. While `range` is still
 * running (it ends with the current month), the previous period is cut off
 * at the same day – 1–8 Nov is compared with 1–8 Oct, not with all of October.
 */
export function previousPeriodSpending(
  transactions: readonly Transaction[],
  range: MonthRange,
  today: ISODate,
  groupKey?: string,
): PreviousPeriod {
  const prev = previousRange(range);
  const length = monthsBetween(range.start, range.end).length;
  const running = range.end === monthKey(today);
  const until = running ? addMonths(today, -length) : monthEnd(prev.end);
  const from = monthStart(prev.start);
  let total = 0;
  for (const t of transactions) {
    if (!isSpending(t) || t.date < from || t.date > until) continue;
    if (groupKey !== undefined && spendingGroupKey(t) !== groupKey) continue;
    total += t.amount;
  }
  return { range: prev, until, partial: running, total };
}

/** Money spent / received per account within `range` (for the account page). */
export function accountFlows(
  transactions: readonly Transaction[],
  accountId: string,
  range: MonthRange,
): { spent: Cents; received: Cents } {
  let spent = 0;
  let received = 0;
  for (const t of transactions) {
    if (!inRange(t.date, range)) continue;
    if (isSpending(t) && t.fromAccountId === accountId) spent += t.amount;
    if (t.kind === 'income' && t.toAccountId === accountId) received += t.amount;
  }
  return { spent, received };
}

/** How often each tag was used (bookings, obligations, receivables) – for "frequently used" suggestions. */
export function tagUsage(
  transactions: readonly Pick<Transaction, 'tagId'>[],
  obligations: readonly { tagId: string | null }[],
  receivables: readonly { tagId: string | null }[] = [],
): Map<string, number> {
  const usage = new Map<string, number>();
  for (const item of [...transactions, ...obligations, ...receivables]) {
    if (item.tagId) usage.set(item.tagId, (usage.get(item.tagId) ?? 0) + 1);
  }
  return usage;
}
