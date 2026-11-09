import { describe, expect, it } from 'vitest';
import type { Account, Obligation, Subscription } from './types';
import { buildUpcoming, buildUpcomingPlan, computeFreeMoney, planCount, planForAccount, sumUpcoming } from './upcoming';

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
    obligation('Alt', '2026-10-20', 1500), // overdue from last month
    obligation('Erledigt', '2026-11-09', 100, { paidAt: '2026-11-08T09:00:00.000Z' }),
  ];
  const subscriptions = [
    subscription('Netflix', '2026-11-15', 1299, { accountId: 'bank', autoPay: true }),
    subscription('Gym', '2026-11-01', 2990), // overdue, manual
    subscription('Zeitung', '2026-11-10', 500, { intervalUnit: 'week', anchorDate: '2026-11-10' }),
    subscription('Pausiert', '2026-11-09', 999, { paused: true }),
    subscription('Später', '2026-12-20', 4999),
  ];
  const label = (i: ReturnType<typeof buildUpcoming>[number]) =>
    `${i.type === 'obligation' ? i.obligation.title : i.subscription.name} ${i.date}`;

  it('mixes obligations and subscription charges up to a day, soonest first', () => {
    const items = buildUpcoming(obligations, subscriptions, '2026-12-08');
    expect(items.map(label)).toEqual([
      'Alt 2026-10-20',
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
    expect(sumUpcoming(items)).toBe(1500 + 2 * 2990 + 5 * 500 + 2999 + 1299 + 65000 + 2000);
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
  });

  it('groups by month: this month with overdue ones, later months, and without a date', () => {
    const plan = buildUpcomingPlan(obligations, subscriptions, today);
    expect(plan.month).toBe('2026-11');
    expect(plan.current.items.map(label)).toEqual([
      'Alt 2026-10-20',
      'Gym 2026-11-01',
      'Zeitung 2026-11-10',
      'Handy 2026-11-13',
      'Netflix 2026-11-15',
      'Zeitung 2026-11-17',
      'Zeitung 2026-11-24',
    ]);
    expect(plan.current.total).toBe(1500 + 2990 + 3 * 500 + 2999 + 1299);
    // Subscriptions are listed for two more months (December, January).
    expect(plan.until).toBe('2027-01-31');
    expect(plan.later.map((g) => [g.month, g.items.length])).toEqual([
      ['2026-12', 1 + 1 + 5 + 1 + 1], // Miete, Gym, 5× Zeitung, Netflix, Später
      ['2027-01', 1 + 4 + 1 + 1], // Gym, 4× Zeitung, Netflix, Später
    ]);
    expect(plan.later[0]!.total).toBe(65000 + 2990 + 5 * 500 + 1299 + 4999);
    expect(plan.undated.items.map(label)).toEqual(['Max null']);
    expect(planCount(plan)).toBe(7 + 9 + 7 + 1);
  });

  it('lists subscriptions up to the month of the last obligation, but at most 11 months ahead', () => {
    const far = [obligation('Urlaub', '2027-04-10', 80000)];
    const sub = [subscription('Spotify', '2026-11-20', 1199)];
    const plan = buildUpcomingPlan(far, sub, today);
    expect(plan.until).toBe('2027-04-30');
    expect(plan.later.map((g) => g.month)).toEqual(['2026-12', '2027-01', '2027-02', '2027-03', '2027-04']);

    const veryFar = buildUpcomingPlan([obligation('Weltreise', '2029-01-01', 500000)], sub, today);
    expect(veryFar.until).toBe('2027-10-31');
    // The obligation still shows up in its own month.
    expect(veryFar.later.at(-1)).toMatchObject({ month: '2029-01', total: 500000 });
  });

  it('starts a new month on the 1st', () => {
    const plan = buildUpcomingPlan(obligations, subscriptions, '2026-12-01');
    expect(plan.current.items.some((i) => i.type === 'obligation' && i.obligation.title === 'Miete')).toBe(true);
  });

  it('filters by account', () => {
    const plan = planForAccount(buildUpcomingPlan(obligations, subscriptions, today), 'bank');
    expect(plan.current.items.map((i) => i.key)).toEqual(['s:Netflix:2026-11-15']);
    expect(plan.later.map((g) => g.items.map((i) => i.key))).toEqual([
      ['o:Miete', 's:Netflix:2026-12-15'],
      ['s:Netflix:2027-01-15'],
    ]);
    expect(plan.undated.items).toEqual([]);
  });
});

describe('free money', () => {
  const account = (id: string, type: Account['type']): Account => ({
    id,
    name: id,
    type,
    color: 'blue',
    createdAt: '2026-11-01T10:00:00.000Z',
  });
  const accounts = [account('giro', 'bank'), account('bar', 'cash'), account('spar', 'savings')];
  const balances = new Map([
    ['giro', 120000],
    ['bar', 5000],
    ['spar', 300000],
  ]);

  it('is the money on all accounts except savings accounts minus what is due this month', () => {
    const plan = buildUpcomingPlan(
      [
        obligation('Handy', '2026-11-20', 3000, { accountId: 'giro' }),
        obligation('Miete', '2026-12-01', 65000, { accountId: 'giro' }), // next month: not counted
        obligation('Ohne Datum', null, 2000), // no date: not counted
        obligation('Überfällig', '2026-11-02', 1000), // no account: counted
        obligation('Flug', '2026-11-25', 40000, { accountId: 'spar' }), // paid from savings: not counted
      ],
      [subscription('Netflix', '2026-11-15', 1299, { accountId: 'giro', autoPay: true })],
      '2026-11-08',
    );
    expect(computeFreeMoney(accounts, balances, plan)).toEqual({
      available: 125000,
      due: 3000 + 1000 + 1299,
      free: 125000 - 5299,
    });
  });
});
