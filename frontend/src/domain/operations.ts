/**
 * All changes to the data document go through these pure functions.
 * Each one takes the current document and returns a new one (the input is
 * never mutated), which keeps undo, tests and persistence simple.
 */
import { isAccountColor } from './colors';
import { isISODate, todayISO } from './dates';
import { defaultEnv, type Env } from './env';
import { computeBalances } from './ledger';
import { MAX_CENTS } from './money';
import { isOpen, obligationTitle } from './obligations';
import type {
  Account,
  AccountType,
  AppData,
  Cents,
  ISODate,
  Obligation,
  ObligationKind,
  Settings,
  Transaction,
} from './types';

export const ACCOUNT_NAME_MAX = 40;
export const TEXT_MAX = 80;
export const NOTE_MAX = 500;

/** A user-facing validation error (message is shown in the UI). */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new DomainError(message);
}

function checkAmount(amount: Cents, { allowNegative = false, allowZero = false } = {}) {
  check(Number.isSafeInteger(amount), 'Bitte einen gültigen Betrag eingeben.');
  check(Math.abs(amount) <= MAX_CENTS, 'Der Betrag ist zu groß.');
  if (!allowNegative) check(amount >= 0, 'Der Betrag darf nicht negativ sein.');
  if (!allowZero) check(amount !== 0, 'Der Betrag muss größer als 0 sein.');
}

function findAccount(data: AppData, id: string): Account {
  const account = data.accounts.find((a) => a.id === id);
  check(account, 'Das Konto wurde nicht gefunden.');
  return account;
}

function findObligation(data: AppData, id: string): Obligation {
  const obligation = data.obligations.find((o) => o.id === id);
  check(obligation, 'Der Eintrag wurde nicht gefunden.');
  return obligation;
}

function cleanText(value: string, max: number): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function cleanNote(value: string): string {
  return value.trim().slice(0, NOTE_MAX);
}

function booking(
  env: Env,
  fields: Pick<Transaction, 'kind' | 'amount' | 'fromAccountId' | 'toAccountId' | 'date'> &
    Partial<Pick<Transaction, 'note' | 'obligationId'>>,
): Transaction {
  return {
    id: env.newId(),
    note: '',
    obligationId: null,
    ...fields,
    createdAt: env.now().toISOString(),
  };
}

/** Booking that changes one account's balance by `delta` (positive or negative). */
function balanceChange(
  env: Env,
  kind: 'opening' | 'adjustment',
  accountId: string,
  delta: Cents,
  date: ISODate,
  note = '',
): Transaction {
  return booking(env, {
    kind,
    amount: Math.abs(delta),
    fromAccountId: delta < 0 ? accountId : null,
    toAccountId: delta > 0 ? accountId : null,
    date,
    note,
  });
}

// ---------------------------------------------------------------- accounts

export interface AccountInput {
  name: string;
  type: AccountType;
  color: string;
}

export interface NewAccountInput extends AccountInput {
  /** Current balance of the account; may be negative (e.g. overdraft). */
  initialBalance: Cents;
}

function checkAccountInput(input: AccountInput): AccountInput {
  const name = cleanText(input.name, ACCOUNT_NAME_MAX);
  check(name.length > 0, 'Bitte gib dem Konto einen Namen.');
  check(isAccountColor(input.color), 'Ungültige Farbe.');
  return { name, type: input.type, color: input.color };
}

export function createAccount(data: AppData, input: NewAccountInput, env: Env = defaultEnv): AppData {
  const fields = checkAccountInput(input);
  checkAmount(input.initialBalance, { allowNegative: true, allowZero: true });

  const account: Account = { id: env.newId(), ...fields, createdAt: env.now().toISOString() };
  const transactions =
    input.initialBalance !== 0
      ? [
          ...data.transactions,
          balanceChange(env, 'opening', account.id, input.initialBalance, todayISO(env.now())),
        ]
      : data.transactions;

  return { ...data, accounts: [...data.accounts, account], transactions };
}

export function updateAccount(data: AppData, id: string, input: AccountInput): AppData {
  findAccount(data, id);
  const fields = checkAccountInput(input);
  return {
    ...data,
    accounts: data.accounts.map((a) => (a.id === id ? { ...a, ...fields } : a)),
  };
}

/**
 * Deletes an account. Bookings that only concern this account are removed.
 * Transfers to/from other accounts are kept (with this side set to null) so
 * the balances of the other accounts do not change.
 */
export function deleteAccount(data: AppData, id: string): AppData {
  findAccount(data, id);

  const removedTransactionIds = new Set<string>();
  const transactions: Transaction[] = [];
  for (const t of data.transactions) {
    if (t.fromAccountId !== id && t.toAccountId !== id) {
      transactions.push(t);
      continue;
    }
    const from = t.fromAccountId === id ? null : t.fromAccountId;
    const to = t.toAccountId === id ? null : t.toAccountId;
    if (from === null && to === null) {
      removedTransactionIds.add(t.id);
    } else {
      transactions.push({ ...t, fromAccountId: from, toAccountId: to });
    }
  }

  const obligations = data.obligations.map((o) => {
    let next = o;
    if (o.accountId === id) next = { ...next, accountId: null };
    if (o.paymentTransactionId !== null && removedTransactionIds.has(o.paymentTransactionId)) {
      next = { ...next, paymentTransactionId: null };
    }
    return next;
  });

  return {
    ...data,
    accounts: data.accounts.filter((a) => a.id !== id),
    transactions,
    obligations,
  };
}

/** Moves an account to a new position in the list (for ordering later on). */
export function moveAccount(data: AppData, id: string, toIndex: number): AppData {
  const from = data.accounts.findIndex((a) => a.id === id);
  check(from >= 0, 'Das Konto wurde nicht gefunden.');
  const accounts = [...data.accounts];
  const [account] = accounts.splice(from, 1);
  accounts.splice(Math.max(0, Math.min(toIndex, accounts.length)), 0, account!);
  return { ...data, accounts };
}

/** Sets the balance of an account by booking the difference as a correction. */
export function setAccountBalance(
  data: AppData,
  id: string,
  newBalance: Cents,
  note = '',
  env: Env = defaultEnv,
): AppData {
  findAccount(data, id);
  checkAmount(newBalance, { allowNegative: true, allowZero: true });
  const current = computeBalances(data.accounts, data.transactions).get(id) ?? 0;
  const delta = newBalance - current;
  if (delta === 0) return data;
  return {
    ...data,
    transactions: [
      ...data.transactions,
      balanceChange(env, 'adjustment', id, delta, todayISO(env.now()), cleanNote(note)),
    ],
  };
}

// --------------------------------------------------------------- transfers

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: Cents;
  date: ISODate;
  note: string;
}

export function transfer(data: AppData, input: TransferInput, env: Env = defaultEnv): AppData {
  findAccount(data, input.fromAccountId);
  findAccount(data, input.toAccountId);
  check(input.fromAccountId !== input.toAccountId, 'Bitte zwei verschiedene Konten wählen.');
  checkAmount(input.amount);
  check(isISODate(input.date), 'Bitte ein gültiges Datum wählen.');

  return {
    ...data,
    transactions: [
      ...data.transactions,
      booking(env, {
        kind: 'transfer',
        amount: input.amount,
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        date: input.date,
        note: cleanNote(input.note),
      }),
    ],
  };
}

/** Deletes a booking. If it paid an obligation, that obligation is open again. */
export function deleteTransaction(data: AppData, id: string): AppData {
  const tx = data.transactions.find((t) => t.id === id);
  check(tx, 'Die Buchung wurde nicht gefunden.');
  return {
    ...data,
    transactions: data.transactions.filter((t) => t.id !== id),
    obligations: data.obligations.map((o) =>
      o.paymentTransactionId === id ? { ...o, paidAt: null, paymentTransactionId: null } : o,
    ),
  };
}

// ------------------------------------------------------------- obligations

export interface ObligationInput {
  kind: ObligationKind;
  title: string;
  counterparty: string;
  amount: Cents;
  dueDate: ISODate | null;
  accountId: string | null;
  note: string;
}

function checkObligationInput(data: AppData, input: ObligationInput): ObligationInput {
  const title = cleanText(input.title, TEXT_MAX);
  const counterparty = cleanText(input.counterparty, TEXT_MAX);
  check(
    title.length > 0 || counterparty.length > 0,
    input.kind === 'debt' ? 'Bitte angeben, wem du das Geld schuldest.' : 'Bitte angeben, wofür die Zahlung ist.',
  );
  checkAmount(input.amount);
  check(input.dueDate === null || isISODate(input.dueDate), 'Bitte ein gültiges Datum wählen.');
  if (input.accountId !== null) findAccount(data, input.accountId);
  return { ...input, title, counterparty, note: cleanNote(input.note) };
}

export function addObligation(data: AppData, input: ObligationInput, env: Env = defaultEnv): AppData {
  const fields = checkObligationInput(data, input);
  const obligation: Obligation = {
    id: env.newId(),
    ...fields,
    createdAt: env.now().toISOString(),
    paidAt: null,
    paymentTransactionId: null,
  };
  return { ...data, obligations: [...data.obligations, obligation] };
}

export function updateObligation(data: AppData, id: string, input: ObligationInput): AppData {
  findObligation(data, id);
  const fields = checkObligationInput(data, input);
  return {
    ...data,
    obligations: data.obligations.map((o) => (o.id === id ? { ...o, ...fields } : o)),
  };
}

/** Deletes an obligation. A payment booking stays (the money was really paid). */
export function deleteObligation(data: AppData, id: string): AppData {
  findObligation(data, id);
  return {
    ...data,
    obligations: data.obligations.filter((o) => o.id !== id),
    transactions: data.transactions.map((t) => (t.obligationId === id ? { ...t, obligationId: null } : t)),
  };
}

export interface PayObligationInput {
  /** Account to pay from; null = only mark as done without a booking. */
  accountId: string | null;
  date: ISODate;
}

export function markObligationPaid(
  data: AppData,
  id: string,
  input: PayObligationInput,
  env: Env = defaultEnv,
): AppData {
  const obligation = findObligation(data, id);
  check(isOpen(obligation), 'Dieser Eintrag ist bereits erledigt.');
  check(isISODate(input.date), 'Bitte ein gültiges Datum wählen.');

  let transactions = data.transactions;
  let paymentTransactionId: string | null = null;
  if (input.accountId !== null) {
    findAccount(data, input.accountId);
    const payment = booking(env, {
      kind: 'payment',
      amount: obligation.amount,
      fromAccountId: input.accountId,
      toAccountId: null,
      date: input.date,
      note: obligationTitle(obligation),
      obligationId: obligation.id,
    });
    transactions = [...transactions, payment];
    paymentTransactionId = payment.id;
  }

  return {
    ...data,
    transactions,
    obligations: data.obligations.map((o) =>
      o.id === id ? { ...o, paidAt: env.now().toISOString(), paymentTransactionId } : o,
    ),
  };
}

/** Marks a paid obligation as open again and removes its payment booking. */
export function reopenObligation(data: AppData, id: string): AppData {
  const obligation = findObligation(data, id);
  check(!isOpen(obligation), 'Dieser Eintrag ist noch offen.');
  return {
    ...data,
    transactions:
      obligation.paymentTransactionId === null
        ? data.transactions
        : data.transactions.filter((t) => t.id !== obligation.paymentTransactionId),
    obligations: data.obligations.map((o) =>
      o.id === id ? { ...o, paidAt: null, paymentTransactionId: null } : o,
    ),
  };
}

// ---------------------------------------------------------------- settings

export function updateSettings(data: AppData, patch: Partial<Settings>): AppData {
  return { ...data, settings: { ...data.settings, ...patch } };
}
