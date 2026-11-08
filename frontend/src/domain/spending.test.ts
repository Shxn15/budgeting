import { describe, expect, it } from 'vitest';
import {
  accountFlows,
  lastMonths,
  NO_TAG,
  previousPeriodSpending,
  previousRange,
  spendingGroupKey,
  subscriptionIdOfGroup,
  summarizeSpending,
  tagUsage,
  totalSpending,
} from './spending';
import type { Transaction, TransactionKind } from './types';

let counter = 0;
function tx(kind: TransactionKind, amount: number, date: string, fields: Partial<Transaction> = {}): Transaction {
  counter += 1;
  return {
    id: `t${counter}`,
    kind,
    amount,
    fromAccountId: kind === 'income' ? null : 'a1',
    toAccountId: kind === 'income' ? 'a1' : null,
    date,
    note: '',
    obligationId: null,
    subscriptionId: null,
    tagId: null,
    affectsBalance: true,
    createdAt: `${date}T10:00:00.000Z`,
    ...fields,
  };
}

const transactions: Transaction[] = [
  tx('expense', 2350, '2026-11-02', { tagId: 'rewe' }),
  tx('expense', 4120, '2026-11-06', { tagId: 'rewe' }),
  tx('expense', 899, '2026-10-21', { tagId: 'rossmann' }),
  tx('expense', 3000, '2026-07-01', { tagId: 'rewe' }),
  tx('expense', 500, '2026-06-30', { tagId: 'rewe' }), // outside Jul–Nov
  tx('subscription', 1299, '2026-11-15', { subscriptionId: 'netflix' }),
  tx('payment', 2999, '2026-11-01', { tagId: 'paypal' }),
  tx('payment', 1500, '2026-09-10'), // no tag
  tx('expense', 700, '2026-08-10', { tagId: 'rewe', affectsBalance: false }), // statistics only: counts
  tx('income', 150000, '2026-11-01', { tagId: 'gehalt' }), // not spending
  tx('transfer', 5000, '2026-11-03', { toAccountId: 'a2' }), // not spending
  tx('adjustment', 1000, '2026-11-04'), // corrections are not spending
];

describe('spending statistics', () => {
  it('builds month ranges', () => {
    expect(lastMonths('2026-11', 5)).toEqual({ start: '2026-07', end: '2026-11' });
    expect(lastMonths('2026-01', 3)).toEqual({ start: '2025-11', end: '2026-01' });
    expect(lastMonths('2026-11', 1)).toEqual({ start: '2026-11', end: '2026-11' });
    expect(previousRange({ start: '2026-07', end: '2026-11' })).toEqual({ start: '2026-02', end: '2026-06' });
  });

  it('groups spending by tag and subscription within the range', () => {
    const summary = summarizeSpending(transactions, lastMonths('2026-11', 5));
    expect(summary.months).toEqual(['2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    expect(summary.total).toBe(2350 + 4120 + 899 + 3000 + 1299 + 2999 + 1500 + 700);
    expect(summary.count).toBe(8);
    expect(summary.groups.map((g) => [g.key, g.total, g.count])).toEqual([
      ['rewe', 2350 + 4120 + 3000 + 700, 4],
      ['paypal', 2999, 1],
      [NO_TAG, 1500, 1],
      ['sub:netflix', 1299, 1],
      ['rossmann', 899, 1],
    ]);
    const rewe = summary.groups[0]!;
    expect([...rewe.byMonth]).toEqual([
      ['2026-07', 3000],
      ['2026-08', 700],
      ['2026-09', 0],
      ['2026-10', 0],
      ['2026-11', 6470],
    ]);
    expect(rewe.transactions.map((t) => t.date)).toEqual(['2026-11-06', '2026-11-02', '2026-08-10', '2026-07-01']);
    expect(summary.byMonth.get('2026-11')).toBe(2350 + 4120 + 1299 + 2999);
    expect(summary.byMonth.get('2026-09')).toBe(1500);
  });

  it('sums one month or one tag', () => {
    expect(totalSpending(transactions, lastMonths('2026-11', 1))).toBe(2350 + 4120 + 1299 + 2999);
    expect(totalSpending(transactions, lastMonths('2026-11', 12), 'rewe')).toBe(2350 + 4120 + 3000 + 500 + 700);
    expect(totalSpending(transactions, lastMonths('2025-11', 3))).toBe(0);
  });

  it('compares with the period before, cut off at the same day while the range is running', () => {
    const list = [
      tx('expense', 1000, '2026-10-05', { tagId: 'rewe' }),
      tx('expense', 2000, '2026-10-20', { tagId: 'rewe' }),
      tx('expense', 400, '2026-09-30', { tagId: 'dm' }),
    ];
    expect(previousPeriodSpending(list, lastMonths('2026-11', 1), '2026-11-08')).toEqual({
      range: { start: '2026-10', end: '2026-10' },
      until: '2026-10-08',
      partial: true,
      total: 1000,
    });
    expect(previousPeriodSpending(list, lastMonths('2026-11', 1), '2026-12-01')).toMatchObject({ until: '2026-10-31', partial: false, total: 3000 });
    expect(previousPeriodSpending(list, lastMonths('2026-11', 2), '2026-11-08')).toMatchObject({
      range: { start: '2026-08', end: '2026-09' },
      until: '2026-09-08',
      total: 0,
    });
    expect(previousPeriodSpending(list, lastMonths('2026-11', 2), '2026-11-30', 'dm')).toMatchObject({ until: '2026-09-30', total: 400 });
  });

  it('knows the group keys', () => {
    expect(spendingGroupKey({ tagId: 'x', subscriptionId: 's' })).toBe('x');
    expect(spendingGroupKey({ tagId: null, subscriptionId: 's' })).toBe('sub:s');
    expect(spendingGroupKey({ tagId: null, subscriptionId: null })).toBe(NO_TAG);
    expect(subscriptionIdOfGroup('sub:s')).toBe('s');
    expect(subscriptionIdOfGroup('rewe')).toBeNull();
  });

  it('computes money in and out of an account', () => {
    expect(accountFlows(transactions, 'a1', lastMonths('2026-11', 1))).toEqual({
      spent: 2350 + 4120 + 1299 + 2999,
      received: 150000,
    });
  });

  it('counts how often tags are used', () => {
    const usage = tagUsage(transactions, [{ tagId: 'paypal' }, { tagId: null }]);
    expect(usage.get('rewe')).toBe(5);
    expect(usage.get('paypal')).toBe(2);
    expect(usage.has('none')).toBe(false);
  });
});
