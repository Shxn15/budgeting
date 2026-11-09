import { describe, expect, it } from 'vitest';
import { nextAccountColor } from './colors';
import { buildPortfolio, computeBalances, sumBalances } from './ledger';
import { dueLabel, dueState, openObligations, sumAmounts } from './obligations';
import {
  addBooking,
  addObligation,
  addReceivable,
  addSavingsGoal,
  addSubscription,
  addTag,
  allocateToSavingsGoal,
  createAccount,
  deleteReceivable,
  deleteSavingsGoal,
  markReceivableReceived,
  reopenReceivable,
  updateReceivable,
  updateSavingsGoal,
  deleteAccount,
  deleteObligation,
  deleteSubscription,
  deleteTag,
  deleteTransaction,
  DomainError,
  markObligationPaid,
  moveAccount,
  paySubscription,
  processDueSubscriptions,
  reopenObligation,
  setAccountBalance,
  setSubscriptionPaused,
  skipSubscriptionCharge,
  transfer,
  updateAccount,
  updateBooking,
  updateObligation,
  updateSubscription,
  updateTag,
  type BookingInput,
  type NewSavingsGoalInput,
  type ObligationInput,
  type ReceivableInput,
  type SubscriptionInput,
} from './operations';
import { buildGoalTree, unassignedOnAccount } from './savings';
import { emptyData, testEnv } from './testing';
import type { AppData } from './types';

function balances(data: AppData) {
  return Object.fromEntries(
    [...computeBalances(data.accounts, data.transactions)].map(([id, value]) => [
      data.accounts.find((a) => a.id === id)!.name,
      value,
    ]),
  );
}

/** Bargeld 200 €, Sparkasse 499 €, Revolut 100 € – the example from the brief. */
function sample() {
  const env = testEnv();
  let data = emptyData();
  data = createAccount(data, { name: 'Bargeld', type: 'cash', color: 'blue', initialBalance: 20000 }, env);
  data = createAccount(data, { name: 'Sparkasse', type: 'bank', color: 'orange', initialBalance: 49900 }, env);
  data = createAccount(data, { name: 'Revolut', type: 'bank', color: 'aqua', initialBalance: 10000 }, env);
  const [cash, bank, revolut] = data.accounts as [AppData['accounts'][number], AppData['accounts'][number], AppData['accounts'][number]];
  return { env, data, cash, bank, revolut };
}

const bill: ObligationInput = {
  kind: 'bill',
  title: 'Handyrechnung',
  counterparty: '',
  amount: 2999,
  dueDate: '2026-11-13',
  accountId: null,
  tagId: null,
  note: '',
};

describe('accounts', () => {
  it('creates accounts with their starting balance', () => {
    const { data } = sample();
    expect(balances(data)).toEqual({ Bargeld: 20000, Sparkasse: 49900, Revolut: 10000 });
    expect(sumBalances(computeBalances(data.accounts, data.transactions))).toBe(79900);
    expect(data.transactions.every((t) => t.kind === 'opening')).toBe(true);
  });

  it('allows negative and zero starting balances', () => {
    const env = testEnv();
    let data = createAccount(emptyData(), { name: 'Kreditkarte', type: 'card', color: 'red', initialBalance: -15000 }, env);
    data = createAccount(data, { name: 'Leer', type: 'other', color: 'green', initialBalance: 0 }, env);
    expect(balances(data)).toEqual({ Kreditkarte: -15000, Leer: 0 });
    expect(data.transactions).toHaveLength(1);
  });

  it('validates the input', () => {
    const env = testEnv();
    expect(() =>
      createAccount(emptyData(), { name: '   ', type: 'cash', color: 'blue', initialBalance: 0 }, env),
    ).toThrow(DomainError);
    expect(() =>
      createAccount(emptyData(), { name: 'X', type: 'cash', color: 'not-a-color', initialBalance: 0 }, env),
    ).toThrow(DomainError);
    expect(() =>
      createAccount(emptyData(), { name: 'X', type: 'cash', color: 'blue', initialBalance: 1.5 }, env),
    ).toThrow(DomainError);
  });

  it('updates name, type and colour without touching the balance', () => {
    const { data, cash } = sample();
    const next = updateAccount(data, cash.id, { name: '  Portemonnaie ', type: 'cash', color: '#123456' });
    expect(next.accounts[0]).toMatchObject({ name: 'Portemonnaie', color: '#123456' });
    expect(balances(next).Portemonnaie).toBe(20000);
    expect(data.accounts[0]!.name).toBe('Bargeld'); // input not mutated
  });

  it('sets a new balance by booking the difference', () => {
    const { data, env, revolut } = sample();
    const lower = setAccountBalance(data, revolut.id, 7550, 'Kartenzahlungen', env);
    expect(balances(lower).Revolut).toBe(7550);
    const last = lower.transactions.at(-1)!;
    expect(last).toMatchObject({ kind: 'adjustment', amount: 2450, fromAccountId: revolut.id, toAccountId: null });

    const higher = setAccountBalance(lower, revolut.id, 30000, '', env);
    expect(balances(higher).Revolut).toBe(30000);
    expect(setAccountBalance(higher, revolut.id, 30000, '', env)).toBe(higher); // no-op
  });

  it('keeps the other balances when an account with transfers is deleted', () => {
    const { data, env, cash, bank, revolut } = sample();
    let next = transfer(data, { fromAccountId: bank.id, toAccountId: cash.id, amount: 5000, date: '2026-11-08', note: '' }, env);
    next = addObligation(next, { ...bill, accountId: bank.id }, env);
    const before = balances(next);

    next = deleteAccount(next, bank.id);
    expect(next.accounts.map((a) => a.name)).toEqual(['Bargeld', 'Revolut']);
    expect(balances(next)).toEqual({ Bargeld: before.Bargeld, Revolut: before.Revolut });
    // The opening booking of the deleted account is gone, the transfer is kept.
    const transferTx = next.transactions.find((t) => t.kind === 'transfer')!;
    expect(transferTx).toMatchObject({ fromAccountId: null, toAccountId: cash.id });
    expect(next.transactions.some((t) => t.kind === 'opening' && t.toAccountId === bank.id)).toBe(false);
    expect(next.obligations[0]!.accountId).toBeNull();
    expect(balances(next).Revolut).toBe(10000);
    expect(revolut.id).toBeTruthy();
  });

  it('reorders accounts', () => {
    const { data, revolut } = sample();
    expect(moveAccount(data, revolut.id, 0).accounts.map((a) => a.name)).toEqual(['Revolut', 'Bargeld', 'Sparkasse']);
  });

  it('suggests the next free colour in palette order', () => {
    expect(nextAccountColor([])).toBe('blue');
    expect(nextAccountColor([{ color: 'blue' }, { color: 'aqua' }])).toBe('orange');
  });
});

describe('transfers', () => {
  it('moves money between accounts and keeps the total', () => {
    const { data, env, cash, bank } = sample();
    const next = transfer(
      data,
      { fromAccountId: bank.id, toAccountId: cash.id, amount: 15000, date: '2026-11-08', note: ' Geld abgehoben ' },
      env,
    );
    expect(balances(next)).toEqual({ Bargeld: 35000, Sparkasse: 34900, Revolut: 10000 });
    expect(sumBalances(computeBalances(next.accounts, next.transactions))).toBe(79900);
    expect(next.transactions.at(-1)!.note).toBe('Geld abgehoben');
  });

  it('rejects invalid transfers', () => {
    const { data, env, cash, bank } = sample();
    const base = { fromAccountId: bank.id, toAccountId: cash.id, amount: 100, date: '2026-11-08', note: '' };
    expect(() => transfer(data, { ...base, toAccountId: bank.id }, env)).toThrow(DomainError);
    expect(() => transfer(data, { ...base, amount: 0 }, env)).toThrow(DomainError);
    expect(() => transfer(data, { ...base, amount: -5 }, env)).toThrow(DomainError);
    expect(() => transfer(data, { ...base, toAccountId: 'missing' }, env)).toThrow(DomainError);
    expect(() => transfer(data, { ...base, date: '08.11.2026' }, env)).toThrow(DomainError);
  });

  it('can be undone by deleting the booking', () => {
    const { data, env, cash, bank } = sample();
    const next = transfer(data, { fromAccountId: bank.id, toAccountId: cash.id, amount: 100, date: '2026-11-08', note: '' }, env);
    const undone = deleteTransaction(next, next.transactions.at(-1)!.id);
    expect(balances(undone)).toEqual(balances(data));
  });
});

describe('obligations', () => {
  it('tracks open obligations and the urgency', () => {
    const { data, env } = sample();
    let next = addObligation(data, bill, env);
    next = addObligation(next, { ...bill, kind: 'debt', title: '', counterparty: 'Max', amount: 2000, dueDate: null }, env);
    next = addObligation(next, { ...bill, title: 'Miete', amount: 65000, dueDate: '2026-11-01' }, env);

    const open = openObligations(next.obligations);
    expect(open.map((o) => o.title || o.counterparty)).toEqual(['Miete', 'Handyrechnung', 'Max']);
    expect(sumAmounts(open)).toBe(65000 + 2999 + 2000);

    const today = '2026-11-08';
    expect(open.map((o) => dueState(o, today))).toEqual(['overdue', 'soon', 'none']);
    expect(open.map((o) => dueLabel(o, today))).toEqual([
      'seit 7 Tagen überfällig',
      'fällig in 5 Tagen',
      'ohne Fälligkeit',
    ]);
    // Far away: the date, with the year only if it is not the current one.
    expect(dueLabel({ ...open[0]!, dueDate: '2026-12-15' }, today)).toBe('fällig am 15. Dez.');
    expect(dueLabel({ ...open[0]!, dueDate: '2027-01-20' }, today)).toBe('fällig am 20. Jan. 2027');
  });

  it('requires a title or a person', () => {
    const { data, env } = sample();
    expect(() => addObligation(data, { ...bill, title: ' ', counterparty: '' }, env)).toThrow(DomainError);
    expect(() => addObligation(data, { ...bill, amount: 0 }, env)).toThrow(DomainError);
    expect(() => addObligation(data, { ...bill, accountId: 'missing' }, env)).toThrow(DomainError);
  });

  it('pays from an account and can be reopened', () => {
    const { data, env, bank } = sample();
    let next = addObligation(data, bill, env);
    const id = next.obligations[0]!.id;

    next = markObligationPaid(next, id, { accountId: bank.id, date: '2026-11-08' }, env);
    expect(balances(next).Sparkasse).toBe(49900 - 2999);
    expect(next.obligations[0]!.paidAt).not.toBeNull();
    const payment = next.transactions.at(-1)!;
    expect(payment).toMatchObject({ kind: 'payment', obligationId: id, note: 'Handyrechnung' });
    expect(() => markObligationPaid(next, id, { accountId: bank.id, date: '2026-11-08' }, env)).toThrow(DomainError);

    const reopened = reopenObligation(next, id);
    expect(balances(reopened).Sparkasse).toBe(49900);
    expect(reopened.obligations[0]).toMatchObject({ paidAt: null, paymentTransactionId: null });
  });

  it('can be marked as done without a booking', () => {
    const { data, env } = sample();
    let next = addObligation(data, bill, env);
    next = markObligationPaid(next, next.obligations[0]!.id, { accountId: null, date: '2026-11-08' }, env);
    expect(next.transactions).toHaveLength(data.transactions.length);
    expect(openObligations(next.obligations)).toHaveLength(0);
  });

  it('reopens the obligation when its payment booking is deleted', () => {
    const { data, env, cash } = sample();
    let next = addObligation(data, bill, env);
    const id = next.obligations[0]!.id;
    next = markObligationPaid(next, id, { accountId: cash.id, date: '2026-11-08' }, env);
    next = deleteTransaction(next, next.obligations[0]!.paymentTransactionId!);
    expect(next.obligations[0]!.paidAt).toBeNull();
    expect(balances(next).Bargeld).toBe(20000);
  });

  it('keeps the payment booking when a paid obligation is deleted', () => {
    const { data, env, cash } = sample();
    let next = addObligation(data, bill, env);
    const id = next.obligations[0]!.id;
    next = markObligationPaid(next, id, { accountId: cash.id, date: '2026-11-08' }, env);
    next = deleteObligation(next, id);
    expect(next.obligations).toHaveLength(0);
    expect(next.transactions.at(-1)).toMatchObject({ kind: 'payment', obligationId: null });
    expect(balances(next).Bargeld).toBe(20000 - 2999);
  });
});

describe('portfolio (pie chart data)', () => {
  it('splits positive balances into shares and lists negative accounts separately', () => {
    const { data, env, revolut } = sample();
    const next = setAccountBalance(data, revolut.id, -5000, '', env);
    const portfolio = buildPortfolio(next.accounts, computeBalances(next.accounts, next.transactions));
    expect(portfolio.positiveTotal).toBe(69900);
    expect(portfolio.slices.map((s) => [s.account.name, Math.round(s.share * 1000) / 10])).toEqual([
      ['Bargeld', 28.6],
      ['Sparkasse', 71.4],
    ]);
    expect(portfolio.negative.map((n) => n.account.name)).toEqual(['Revolut']);
  });
});

/** A valid (1×1 px) picture as the UI would store it. */
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function withTags() {
  const base = sample();
  let data = addTag(base.data, { name: 'Rewe', color: 'red', image: null }, base.env);
  data = addTag(data, { name: 'PayPal', color: 'blue', image: PIXEL }, base.env);
  const [rewe, paypal] = data.tags as [AppData['tags'][number], AppData['tags'][number]];
  return { ...base, data, rewe, paypal };
}

describe('tags', () => {
  it('creates tags with a picture and rejects duplicates', () => {
    const { data, env, rewe, paypal } = withTags();
    expect(data.tags.map((t) => t.name)).toEqual(['Rewe', 'PayPal']);
    expect(paypal.image).toBe(PIXEL);
    expect(rewe.image).toBeNull();
    expect(() => addTag(data, { name: ' rewe ', color: 'red', image: null }, env)).toThrow(/gibt es schon/);
    expect(() => addTag(data, { name: '', color: 'red', image: null }, env)).toThrow(DomainError);
    expect(() => addTag(data, { name: 'X', color: 'red', image: 'https://example.com/a.png' }, env)).toThrow(DomainError);
    // Renaming a tag to its own name (other case) is fine.
    expect(updateTag(data, rewe.id, { name: 'REWE', color: 'red', image: PIXEL }).tags[0]).toMatchObject({
      name: 'REWE',
      image: PIXEL,
    });
  });

  it('removes a deleted tag from bookings and obligations but keeps them', () => {
    const { data, env, cash, rewe } = withTags();
    let next = addBooking(
      data,
      { kind: 'expense', accountId: cash.id, amount: 2350, date: '2026-11-07', tagId: rewe.id, note: '', affectsBalance: true },
      env,
    );
    next = addObligation(next, { ...bill, tagId: rewe.id }, env);
    next = deleteTag(next, rewe.id);
    expect(next.tags.map((t) => t.name)).toEqual(['PayPal']);
    expect(next.transactions.at(-1)).toMatchObject({ kind: 'expense', tagId: null, amount: 2350 });
    expect(next.obligations[0]!.tagId).toBeNull();
  });
});

describe('adding and removing money', () => {
  const expense = (accountId: string, fields: Partial<BookingInput> = {}): BookingInput => ({
    kind: 'expense',
    accountId,
    amount: 2350,
    date: '2026-11-07',
    tagId: null,
    note: '',
    affectsBalance: true,
    ...fields,
  });

  it('adds and removes money relative to the current balance', () => {
    const { data, env, bank, rewe } = withTags();
    let next = addBooking(data, expense(bank.id, { tagId: rewe.id, note: ' Wocheneinkauf ' }), env);
    expect(balances(next).Sparkasse).toBe(49900 - 2350);
    expect(next.transactions.at(-1)).toMatchObject({
      kind: 'expense',
      fromAccountId: bank.id,
      toAccountId: null,
      tagId: rewe.id,
      note: 'Wocheneinkauf',
      date: '2026-11-07',
    });
    next = addBooking(next, expense(bank.id, { kind: 'income', amount: 150000, date: '2026-11-08' }), env);
    expect(balances(next).Sparkasse).toBe(49900 - 2350 + 150000);
    expect(next.transactions.at(-1)).toMatchObject({ kind: 'income', fromAccountId: null, toAccountId: bank.id });
  });

  it('can record a payment for the statistics only', () => {
    const { data, env, bank } = withTags();
    const next = addBooking(data, expense(bank.id, { affectsBalance: false }), env);
    expect(balances(next).Sparkasse).toBe(49900);
    expect(next.transactions.at(-1)!.affectsBalance).toBe(false);
  });

  it('validates the booking', () => {
    const { data, env, bank } = withTags();
    expect(() => addBooking(data, expense(bank.id, { amount: 0 }), env)).toThrow(DomainError);
    expect(() => addBooking(data, expense(bank.id, { date: '2026-11-09' }), env)).toThrow(/Zukunft/);
    expect(() => addBooking(data, expense('missing'), env)).toThrow(DomainError);
    expect(() => addBooking(data, expense(bank.id, { tagId: 'missing' }), env)).toThrow(DomainError);
  });

  it('edits an income or expense booking', () => {
    const { data, env, bank, cash, paypal } = withTags();
    let next = addBooking(data, expense(bank.id), env);
    const id = next.transactions.at(-1)!.id;
    next = updateBooking(next, id, expense(cash.id, { amount: 1000, tagId: paypal.id }), env);
    expect(balances(next)).toMatchObject({ Sparkasse: 49900, Bargeld: 20000 - 1000 });
    expect(next.transactions.at(-1)).toMatchObject({ id, tagId: paypal.id, fromAccountId: cash.id });
    const transferId = data.transactions[0]!.id; // an opening booking
    expect(() => updateBooking(next, transferId, expense(cash.id), env)).toThrow(DomainError);
  });
});

describe('obligations with tags', () => {
  it('passes the tag on to the payment booking and keeps it in sync', () => {
    const { data, env, bank, paypal, rewe } = withTags();
    let next = addObligation(data, { ...bill, tagId: paypal.id }, env);
    const id = next.obligations[0]!.id;
    next = markObligationPaid(next, id, { accountId: bank.id, date: '2026-11-08' }, env);
    expect(next.transactions.at(-1)).toMatchObject({ kind: 'payment', tagId: paypal.id });
    next = updateObligation(next, id, { ...bill, tagId: rewe.id });
    expect(next.transactions.at(-1)!.tagId).toBe(rewe.id);
  });
});

describe('subscriptions', () => {
  const netflix = (fields: Partial<SubscriptionInput> = {}): SubscriptionInput => ({
    name: 'Netflix',
    amount: 1299,
    intervalUnit: 'month',
    intervalCount: 1,
    nextDueDate: '2026-11-15',
    accountId: null,
    autoPay: false,
    color: 'red',
    image: PIXEL,
    note: '',
    ...fields,
  });

  it('creates a subscription with its schedule', () => {
    const { data, env, bank } = sample();
    const next = addSubscription(data, netflix({ accountId: bank.id, autoPay: true }), env);
    expect(next.subscriptions[0]).toMatchObject({
      name: 'Netflix',
      anchorDate: '2026-11-15',
      nextDueDate: '2026-11-15',
      autoPay: true,
      paused: false,
      image: PIXEL,
    });
    // Without an account there is nothing to charge automatically.
    expect(addSubscription(data, netflix({ autoPay: true }), env).subscriptions[0]!.autoPay).toBe(false);
  });

  it('validates the input', () => {
    const { data, env, bank } = sample();
    expect(() => addSubscription(data, netflix({ name: ' ' }), env)).toThrow(DomainError);
    expect(() => addSubscription(data, netflix({ amount: 0 }), env)).toThrow(DomainError);
    expect(() => addSubscription(data, netflix({ intervalCount: 0 }), env)).toThrow(DomainError);
    expect(() => addSubscription(data, netflix({ intervalUnit: 'day' as never }), env)).toThrow(DomainError);
    expect(() => addSubscription(data, netflix({ nextDueDate: '2026-02-30' }), env)).toThrow(DomainError);
    // Automatic charges in the past would most likely be counted twice.
    expect(() => addSubscription(data, netflix({ accountId: bank.id, autoPay: true, nextDueDate: '2026-11-01' }), env)).toThrow(
      /heute oder später/,
    );
    // Manual subscriptions may be overdue.
    expect(addSubscription(data, netflix({ nextDueDate: '2026-11-01' }), env).subscriptions).toHaveLength(1);
  });

  it('books due charges automatically, also several missed ones', () => {
    const { data, env, bank } = sample();
    let next = addSubscription(data, netflix({ accountId: bank.id, autoPay: true, nextDueDate: '2026-11-15' }), env);
    expect(processDueSubscriptions(next, '2026-11-14', env)).toBe(next); // nothing due yet

    next = processDueSubscriptions(next, '2027-01-20', env);
    const charges = next.transactions.filter((t) => t.kind === 'subscription');
    expect(charges.map((t) => t.date)).toEqual(['2026-11-15', '2026-12-15', '2027-01-15']);
    expect(charges[0]).toMatchObject({ amount: 1299, fromAccountId: bank.id, note: 'Netflix', subscriptionId: next.subscriptions[0]!.id });
    expect(next.subscriptions[0]!.nextDueDate).toBe('2027-02-15');
    expect(balances(next).Sparkasse).toBe(49900 - 3 * 1299);
    // Running it again changes nothing.
    expect(processDueSubscriptions(next, '2027-01-20', env)).toBe(next);
  });

  it('does not charge manual or paused subscriptions automatically', () => {
    const { data, env, bank } = sample();
    let next = addSubscription(data, netflix({ accountId: bank.id, autoPay: false }), env);
    next = addSubscription(next, netflix({ name: 'Gym', accountId: bank.id, autoPay: true }), env);
    next = setSubscriptionPaused(next, next.subscriptions[1]!.id, true, env);
    expect(processDueSubscriptions(next, '2026-12-31', env)).toBe(next);
  });

  it('pays or skips a manual charge and moves to the next date', () => {
    const { data, env, cash } = sample();
    let next = addSubscription(data, netflix({ nextDueDate: '2026-01-31' }), env);
    const id = next.subscriptions[0]!.id;
    next = paySubscription(next, id, { accountId: cash.id, date: '2026-11-08' }, env);
    expect(next.transactions.at(-1)).toMatchObject({ kind: 'subscription', amount: 1299, date: '2026-11-08' });
    expect(next.subscriptions[0]!.nextDueDate).toBe('2026-02-28');
    next = skipSubscriptionCharge(next, id);
    expect(next.subscriptions[0]!.nextDueDate).toBe('2026-03-31'); // back on the 31st
    expect(balances(next).Bargeld).toBe(20000 - 1299);
  });

  it('skips the charges missed while paused when resuming', () => {
    const { data, env, bank } = sample();
    let next = addSubscription(data, netflix({ accountId: bank.id, autoPay: true, nextDueDate: '2026-11-15' }), env);
    const id = next.subscriptions[0]!.id;
    const paused = setSubscriptionPaused(next, id, true, env);
    env.advance(70 * 86_400_000); // 17 Jan 2027: 15 Nov, 15 Dec and 15 Jan were missed
    expect(setSubscriptionPaused(paused, id, false, env).subscriptions[0]).toMatchObject({
      paused: false,
      nextDueDate: '2027-02-15',
    });
    env.advance(-2 * 86_400_000); // resumed exactly on a charge day (15 Jan)
    expect(setSubscriptionPaused(paused, id, false, env).subscriptions[0]!.nextDueDate).toBe('2027-01-15');
  });

  it('restarts the schedule when the date or interval changes', () => {
    const { data, env } = sample();
    let next = addSubscription(data, netflix({ nextDueDate: '2026-11-30' }), env);
    const id = next.subscriptions[0]!.id;
    next = updateSubscription(next, id, netflix({ nextDueDate: '2026-11-30', amount: 1499 }), env);
    expect(next.subscriptions[0]).toMatchObject({ amount: 1499, anchorDate: '2026-11-30' });
    next = updateSubscription(next, id, netflix({ nextDueDate: '2026-12-03', intervalCount: 3 }), env);
    expect(next.subscriptions[0]).toMatchObject({ anchorDate: '2026-12-03', intervalCount: 3 });
  });

  it('keeps past charges when a subscription or its account is deleted', () => {
    const { data, env, bank, cash } = sample();
    let next = addSubscription(data, netflix({ accountId: bank.id, autoPay: true }), env);
    next = addSubscription(next, netflix({ name: 'Spotify', accountId: cash.id, autoPay: true }), env);
    next = processDueSubscriptions(next, '2026-11-15', env);
    const [netflixSub] = next.subscriptions;
    next = deleteSubscription(next, netflixSub!.id);
    expect(next.subscriptions.map((s) => s.name)).toEqual(['Spotify']);
    const kept = next.transactions.find((t) => t.kind === 'subscription' && t.note === 'Netflix');
    expect(kept).toMatchObject({ subscriptionId: null, fromAccountId: bank.id });

    next = deleteAccount(next, cash.id);
    expect(next.subscriptions[0]).toMatchObject({ accountId: null, autoPay: false });
  });
});

describe('receivables (money others owe me)', () => {
  const pizza: ReceivableInput = {
    counterparty: 'Max',
    title: 'Pizza',
    amount: 1500,
    expectedDate: null,
    accountId: null,
    tagId: null,
    note: '',
  };

  it('records money someone owes me, with or without a date', () => {
    const { data, env, bank } = sample();
    let next = addReceivable(data, pizza, env);
    next = addReceivable(next, { ...pizza, counterparty: '  Lisa ', title: '', expectedDate: '2026-11-20', accountId: bank.id }, env);
    expect(next.receivables.map((r) => [r.counterparty, r.title, r.expectedDate, r.receivedAt])).toEqual([
      ['Max', 'Pizza', null, null],
      ['Lisa', '', '2026-11-20', null],
    ]);
    // Nothing changes on the accounts until the money arrives.
    expect(balances(next)).toEqual(balances(data));
  });

  it('validates the input', () => {
    const { data, env } = sample();
    expect(() => addReceivable(data, { ...pizza, counterparty: ' ', title: '' }, env)).toThrow('wer dir das Geld schuldet');
    expect(() => addReceivable(data, { ...pizza, amount: 0 }, env)).toThrow(DomainError);
    expect(() => addReceivable(data, { ...pizza, expectedDate: '2026-02-30' }, env)).toThrow(DomainError);
    expect(() => addReceivable(data, { ...pizza, accountId: 'nope' }, env)).toThrow(DomainError);
  });

  it('books the money as income when it arrives and can be undone', () => {
    const { data, env, cash } = sample();
    let next = addReceivable(data, pizza, env);
    const id = next.receivables[0]!.id;
    next = markReceivableReceived(next, id, { accountId: cash.id, date: '2026-11-08' }, env);
    expect(balances(next).Bargeld).toBe(20000 + 1500);
    const receipt = next.transactions.at(-1)!;
    expect(receipt).toMatchObject({ kind: 'income', amount: 1500, toAccountId: cash.id, note: 'Pizza von Max' });
    expect(next.receivables[0]).toMatchObject({ receiptTransactionId: receipt.id });
    expect(next.receivables[0]!.receivedAt).not.toBeNull();
    expect(() => markReceivableReceived(next, id, { accountId: cash.id, date: '2026-11-08' }, env)).toThrow(DomainError);

    const reopened = reopenReceivable(next, id);
    expect(reopened.receivables[0]).toMatchObject({ receivedAt: null, receiptTransactionId: null });
    expect(balances(reopened).Bargeld).toBe(20000);

    // Deleting the booking opens the entry again, too.
    const deleted = deleteTransaction(next, receipt.id);
    expect(deleted.receivables[0]).toMatchObject({ receivedAt: null, receiptTransactionId: null });
  });

  it('can be closed without a booking, edited and deleted', () => {
    const { data, env } = sample();
    let next = addReceivable(data, pizza, env);
    const id = next.receivables[0]!.id;
    next = updateReceivable(next, id, { ...pizza, amount: 2000, expectedDate: '2026-12-01' });
    expect(next.receivables[0]).toMatchObject({ amount: 2000, expectedDate: '2026-12-01' });
    next = markReceivableReceived(next, id, { accountId: null, date: '2026-11-08' }, env);
    expect(next.transactions).toHaveLength(data.transactions.length);
    expect(next.receivables[0]!.receivedAt).not.toBeNull();
    expect(deleteReceivable(next, id).receivables).toEqual([]);
  });

  it('forgets a deleted account or tag but keeps the entry', () => {
    const { data, env, bank } = sample();
    let next = addTag(data, { name: 'Max', color: 'blue', image: null }, env);
    const tag = next.tags[0]!.id;
    next = addReceivable(next, { ...pizza, accountId: bank.id, tagId: tag }, env);
    next = deleteTag(next, tag);
    expect(next.receivables[0]!.tagId).toBeNull();
    next = deleteAccount(next, bank.id);
    expect(next.receivables[0]).toMatchObject({ accountId: null, amount: 1500 });
  });
});

describe('savings goals', () => {
  function withSavings() {
    const base = sample();
    const data = createAccount(base.data, { name: 'Tagesgeld', type: 'savings', color: 'green', initialBalance: 250000 }, base.env);
    const savings = data.accounts.at(-1)!;
    return { ...base, data, savings };
  }

  const goal = (accountId: string, fields: Partial<NewSavingsGoalInput> = {}): NewSavingsGoalInput => ({
    accountId,
    name: 'Japan-Reise',
    parentId: null,
    targetAmount: 300000,
    targetDate: '2027-08-01',
    color: 'red',
    image: null,
    note: '',
    allocate: 0,
    ...fields,
  });

  it('creates goals and sub-goals with money assigned right away', () => {
    const { data, env, savings } = withSavings();
    let next = addSavingsGoal(data, goal(savings.id, { allocate: 50000 }), env);
    const japan = next.savingsGoals[0]!;
    next = addSavingsGoal(next, goal(savings.id, { name: 'Flug', parentId: japan.id, targetAmount: 120000, allocate: 40000 }), env);
    expect(next.savingsGoals.map((g) => [g.name, g.parentId, g.allocated])).toEqual([
      ['Japan-Reise', null, 50000],
      ['Flug', japan.id, 40000],
    ]);
    const [tree] = buildGoalTree(next.savingsGoals, savings.id);
    expect(tree!.total).toBe(90000);
    expect(unassignedOnAccount(250000, next.savingsGoals, savings.id)).toBe(160000);
    // The balance itself does not change – the money stays on the account.
    expect(balances(next)).toEqual(balances(data));
  });

  it('only exists in savings accounts and validates the input', () => {
    const { data, env, savings, bank } = withSavings();
    expect(() => addSavingsGoal(data, goal(bank.id), env)).toThrow('nur bei Sparkonten');
    expect(() => addSavingsGoal(data, goal(savings.id, { name: '  ' }), env)).toThrow('Namen');
    expect(() => addSavingsGoal(data, goal(savings.id, { targetAmount: 0 }), env)).toThrow(DomainError);
    expect(() => addSavingsGoal(data, goal(savings.id, { targetDate: 'bald' }), env)).toThrow(DomainError);
    expect(() => addSavingsGoal(data, goal(savings.id, { allocate: 250001 }), env)).toThrow('nicht mehr so viel Geld frei');
    expect(() => addSavingsGoal(data, goal(savings.id, { parentId: 'weg' }), env)).toThrow(DomainError);
    // Without target and date is fine.
    const free = addSavingsGoal(data, goal(savings.id, { targetAmount: null, targetDate: null }), env);
    expect(free.savingsGoals[0]).toMatchObject({ targetAmount: null, targetDate: null });
  });

  it('assigns and takes back money, never more than is free', () => {
    const { data, env, savings } = withSavings();
    let next = addSavingsGoal(data, goal(savings.id), env);
    next = addSavingsGoal(next, goal(savings.id, { name: 'Auto', allocate: 200000 }), env);
    const [japan, auto] = next.savingsGoals as [AppData['savingsGoals'][number], AppData['savingsGoals'][number]];
    next = allocateToSavingsGoal(next, japan.id, 50000);
    expect(next.savingsGoals[0]!.allocated).toBe(50000);
    expect(() => allocateToSavingsGoal(next, japan.id, 1)).toThrow('nicht mehr so viel Geld frei');
    next = allocateToSavingsGoal(next, auto.id, -30000);
    next = allocateToSavingsGoal(next, japan.id, 30000);
    expect(next.savingsGoals.map((g) => g.allocated)).toEqual([80000, 170000]);
    expect(() => allocateToSavingsGoal(next, japan.id, -80001)).toThrow('nicht zugewiesen');
    expect(() => allocateToSavingsGoal(next, japan.id, 0)).toThrow(DomainError);
  });

  it('can be edited and moved, but not into itself or too deep', () => {
    const { data, env, savings } = withSavings();
    let next = addSavingsGoal(data, goal(savings.id), env);
    const japan = next.savingsGoals[0]!.id;
    next = addSavingsGoal(next, goal(savings.id, { name: 'Flug', parentId: japan }), env);
    const flug = next.savingsGoals[1]!.id;
    next = addSavingsGoal(next, goal(savings.id, { name: 'Hinflug', parentId: flug }), env);
    const hinflug = next.savingsGoals[2]!.id;
    next = addSavingsGoal(next, goal(savings.id, { name: 'Gepäck', parentId: hinflug }), env);
    const gepaeck = next.savingsGoals[3]!.id;
    // A fifth level is too deep.
    expect(() => addSavingsGoal(next, goal(savings.id, { name: 'Koffer', parentId: gepaeck }), env)).toThrow('Ebenen');

    const edit = { name: 'Japan 2027', parentId: null, targetAmount: 350000, targetDate: null, color: 'violet', image: null, note: 'Tokio' };
    next = updateSavingsGoal(next, japan, edit);
    expect(next.savingsGoals[0]).toMatchObject({ name: 'Japan 2027', targetAmount: 350000, targetDate: null, note: 'Tokio' });
    expect(() => updateSavingsGoal(next, japan, { ...edit, parentId: hinflug })).toThrow('in sich selbst');
    expect(() => updateSavingsGoal(next, japan, { ...edit, parentId: japan })).toThrow('in sich selbst');

    // Moving "Hinflug" (with "Gepäck") to the top level.
    next = updateSavingsGoal(next, hinflug, { ...edit, name: 'Hinflug', parentId: null });
    expect(next.savingsGoals[2]!.parentId).toBeNull();
  });

  it('deletes a goal with its sub-goals – the money is free again', () => {
    const { data, env, savings } = withSavings();
    let next = addSavingsGoal(data, goal(savings.id, { allocate: 10000 }), env);
    const japan = next.savingsGoals[0]!.id;
    next = addSavingsGoal(next, goal(savings.id, { name: 'Flug', parentId: japan, allocate: 20000 }), env);
    next = addSavingsGoal(next, goal(savings.id, { name: 'Auto', allocate: 5000 }), env);
    next = deleteSavingsGoal(next, japan);
    expect(next.savingsGoals.map((g) => g.name)).toEqual(['Auto']);
    expect(unassignedOnAccount(250000, next.savingsGoals, savings.id)).toBe(245000);
  });

  it('removes the goals together with their account', () => {
    const { data, env, savings } = withSavings();
    const next = addSavingsGoal(data, goal(savings.id, { allocate: 10000 }), env);
    expect(deleteAccount(next, savings.id).savingsGoals).toEqual([]);
  });
});
