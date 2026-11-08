import { describe, expect, it } from 'vitest';
import { nextAccountColor } from './colors';
import { buildPortfolio, computeBalances, sumBalances } from './ledger';
import { dueLabel, dueState, openObligations, sumAmounts } from './obligations';
import {
  addObligation,
  createAccount,
  deleteAccount,
  deleteObligation,
  deleteTransaction,
  DomainError,
  markObligationPaid,
  moveAccount,
  reopenObligation,
  setAccountBalance,
  transfer,
  updateAccount,
  type ObligationInput,
} from './operations';
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
