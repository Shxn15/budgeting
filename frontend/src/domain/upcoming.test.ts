import { describe, expect, it } from 'vitest';
import type { Obligation, Subscription } from './types';
import { buildUpcoming, sumUpcoming, upcomingForAccount } from './upcoming';

function obligation(id: string, dueDate: string | null, amount: number, fields: Partial<Obligation> = {}): Obligation {
  return {
    id,
    kind: 'bill',
    title: id,
    counterparty: '',
    amount,
    dueDate,
    accountId: null,
    tagId: null,
    note: '',
    createdAt: '2026-11-01T10:00:00.000Z',
    paidAt: null,
    paymentTransactionId: null,
    ...fields,
  };
}

function subscription(id: string, nextDueDate: string, amount: number, fields: Partial<Subscription> = {}): Subscription {
  return {
    id,
    name: id,
    amount,
    intervalUnit: 'month',
    intervalCount: 1,
    anchorDate: nextDueDate,
    nextDueDate,
    accountId: null,
    autoPay: false,
    color: 'blue',
    image: null,
    note: '',
    paused: false,
    createdAt: '2026-11-01T10:00:00.000Z',
    ...fields,
  };
}

describe('upcoming payments', () => {
  const today = '2026-11-08';
  const obligations = [
    obligation('Miete', '2026-12-01', 65000, { accountId: 'bank' }),
    obligation('Max', null, 2000),
    obligation('Handy', '2026-11-13', 2999),
    obligation('Erledigt', '2026-11-09', 100, { paidAt: '2026-11-08T09:00:00.000Z' }),
  ];
  const subscriptions = [
    subscription('Netflix', '2026-11-15', 1299, { accountId: 'bank', autoPay: true }),
    subscription('Gym', '2026-11-01', 2990), // overdue, manual
    subscription('Zeitung', '2026-11-10', 500, { intervalUnit: 'week', anchorDate: '2026-11-10' }),
    subscription('Pausiert', '2026-11-09', 999, { paused: true }),
    subscription('Später', '2026-12-20', 4999),
  ];

  it('mixes obligations and subscription charges of the next 30 days, soonest first', () => {
    const items = buildUpcoming(obligations, subscriptions, today);
    expect(items.map((i) => `${i.type === 'obligation' ? i.obligation.title : i.subscription.name} ${i.date}`)).toEqual([
      'Gym 2026-11-01',
      'Zeitung 2026-11-10',
      'Handy 2026-11-13',
      'Netflix 2026-11-15',
      'Zeitung 2026-11-17',
      'Zeitung 2026-11-24',
      'Miete 2026-12-01', // same day: one-off payments first
      'Gym 2026-12-01',
      'Zeitung 2026-12-01',
      'Zeitung 2026-12-08',
      'Max null',
    ]);
    expect(sumUpcoming(items)).toBe(2 * 2990 + 5 * 500 + 2999 + 1299 + 65000 + 2000);
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
  });

  it('filters by account', () => {
    const items = upcomingForAccount(buildUpcoming(obligations, subscriptions, today), 'bank');
    expect(items.map((i) => i.key)).toEqual(['s:Netflix:2026-11-15', 'o:Miete']);
  });
});
