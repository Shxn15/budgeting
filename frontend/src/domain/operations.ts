/**
 * All changes to the data document go through these pure functions.
 * Each one takes the current document and returns a new one (the input is
 * never mutated), which keeps undo, tests and persistence simple.
 */
import { isAccountColor } from './colors';
import { isISODate, todayISO } from './dates';
import { defaultEnv, type Env } from './env';
import { isImageDataUrl } from './images';
import { computeBalances } from './ledger';
import { MAX_CENTS } from './money';
import { isOpen, obligationTitle } from './obligations';
import { followingDueDate, MAX_INTERVAL_COUNT, nextOccurrenceOnOrAfter } from './subscriptions';
import type {
  Account,
  AccountType,
  AppData,
  Cents,
  ISODate,
  IntervalUnit,
  Obligation,
  ObligationKind,
  Settings,
  Subscription,
  Tag,
  Transaction,
} from './types';

export const ACCOUNT_NAME_MAX = 40;
export const NAME_MAX = 40;
export const TEXT_MAX = 80;
export const NOTE_MAX = 500;

/** Safety limit: at most this many automatic charges per subscription in one go. */
const MAX_AUTO_CHARGES = 500;

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

function findTag(data: AppData, id: string): Tag {
  const tag = data.tags.find((t) => t.id === id);
  check(tag, 'Der Tag wurde nicht gefunden.');
  return tag;
}

function findSubscription(data: AppData, id: string): Subscription {
  const subscription = data.subscriptions.find((s) => s.id === id);
  check(subscription, 'Das Abo wurde nicht gefunden.');
  return subscription;
}

function checkTagRef(data: AppData, tagId: string | null): string | null {
  if (tagId !== null) findTag(data, tagId);
  return tagId;
}

function checkImage(image: string | null): string | null {
  check(image === null || isImageDataUrl(image), 'Das Bild konnte nicht übernommen werden.');
  return image;
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
    Partial<Pick<Transaction, 'note' | 'obligationId' | 'subscriptionId' | 'tagId' | 'affectsBalance'>>,
): Transaction {
  return {
    id: env.newId(),
    note: '',
    obligationId: null,
    subscriptionId: null,
    tagId: null,
    affectsBalance: true,
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

  const subscriptions = data.subscriptions.map((sub) =>
    sub.accountId === id ? { ...sub, accountId: null, autoPay: false } : sub,
  );

  return {
    ...data,
    accounts: data.accounts.filter((a) => a.id !== id),
    transactions,
    obligations,
    subscriptions,
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
  /** Optional tag (e.g. "PayPal"); a payment booking inherits it. */
  tagId: string | null;
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
  checkTagRef(data, input.tagId);
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
  const existing = findObligation(data, id);
  const fields = checkObligationInput(data, input);
  const paymentId = existing.paymentTransactionId;
  return {
    ...data,
    obligations: data.obligations.map((o) => (o.id === id ? { ...o, ...fields } : o)),
    // The statistics follow a changed tag of an already paid obligation.
    transactions:
      paymentId !== null && existing.tagId !== fields.tagId
        ? data.transactions.map((t) => (t.id === paymentId ? { ...t, tagId: fields.tagId } : t))
        : data.transactions,
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
      tagId: obligation.tagId,
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

// ------------------------------------------------- income and expenses

export type BookingKind = 'income' | 'expense';

export interface BookingInput {
  /** income = "Geld hinzufügen", expense = "Geld entfernen" / "Zahlung eintragen". */
  kind: BookingKind;
  accountId: string;
  amount: Cents;
  /** Today or in the past. */
  date: ISODate;
  tagId: string | null;
  note: string;
  /** false = only for the statistics, the balance stays the same. */
  affectsBalance: boolean;
}

function checkBookingInput(data: AppData, input: BookingInput, env: Env) {
  check(input.kind === 'income' || input.kind === 'expense', 'Unbekannte Buchungsart.');
  findAccount(data, input.accountId);
  checkAmount(input.amount);
  check(isISODate(input.date), 'Bitte ein gültiges Datum wählen.');
  check(input.date <= todayISO(env.now()), 'Das Datum darf nicht in der Zukunft liegen.');
  checkTagRef(data, input.tagId);
  const income = input.kind === 'income';
  return {
    kind: input.kind,
    amount: input.amount,
    fromAccountId: income ? null : input.accountId,
    toAccountId: income ? input.accountId : null,
    date: input.date,
    tagId: input.tagId,
    note: cleanNote(input.note),
    affectsBalance: input.affectsBalance,
  } satisfies Partial<Transaction>;
}

/** Adds money to an account (income) or takes it away (expense). */
export function addBooking(data: AppData, input: BookingInput, env: Env = defaultEnv): AppData {
  const fields = checkBookingInput(data, input, env);
  return { ...data, transactions: [...data.transactions, booking(env, fields)] };
}

/** Changes an income or expense booking. */
export function updateBooking(data: AppData, id: string, input: BookingInput, env: Env = defaultEnv): AppData {
  const tx = data.transactions.find((t) => t.id === id);
  check(tx, 'Die Buchung wurde nicht gefunden.');
  check(tx.kind === 'income' || tx.kind === 'expense', 'Diese Buchung kann nicht bearbeitet werden.');
  const fields = checkBookingInput(data, input, env);
  return { ...data, transactions: data.transactions.map((t) => (t.id === id ? { ...t, ...fields } : t)) };
}

// -------------------------------------------------------------------- tags

export interface TagInput {
  name: string;
  color: string;
  image: string | null;
}

function checkTagInput(data: AppData, input: TagInput, ownId: string | null): TagInput {
  const name = cleanText(input.name, NAME_MAX);
  check(name.length > 0, 'Bitte gib dem Tag einen Namen.');
  const key = name.toLocaleLowerCase('de');
  check(
    !data.tags.some((t) => t.id !== ownId && t.name.toLocaleLowerCase('de') === key),
    `Den Tag „${name}“ gibt es schon.`,
  );
  check(isAccountColor(input.color), 'Ungültige Farbe.');
  return { name, color: input.color, image: checkImage(input.image) };
}

/** Adds a tag; it is appended, so the new tag is `data.tags.at(-1)`. */
export function addTag(data: AppData, input: TagInput, env: Env = defaultEnv): AppData {
  const fields = checkTagInput(data, input, null);
  const tag: Tag = { id: env.newId(), ...fields, createdAt: env.now().toISOString() };
  return { ...data, tags: [...data.tags, tag] };
}

export function updateTag(data: AppData, id: string, input: TagInput): AppData {
  findTag(data, id);
  const fields = checkTagInput(data, input, id);
  return { ...data, tags: data.tags.map((t) => (t.id === id ? { ...t, ...fields } : t)) };
}

/** Deletes a tag. Bookings and obligations keep existing, just without the tag. */
export function deleteTag(data: AppData, id: string): AppData {
  findTag(data, id);
  return {
    ...data,
    tags: data.tags.filter((t) => t.id !== id),
    transactions: data.transactions.map((t) => (t.tagId === id ? { ...t, tagId: null } : t)),
    obligations: data.obligations.map((o) => (o.tagId === id ? { ...o, tagId: null } : o)),
  };
}

// ----------------------------------------------------------- subscriptions

export interface SubscriptionInput {
  name: string;
  amount: Cents;
  intervalUnit: IntervalUnit;
  intervalCount: number;
  /** Date of the next charge. */
  nextDueDate: ISODate;
  accountId: string | null;
  autoPay: boolean;
  color: string;
  image: string | null;
  note: string;
}

function checkSubscriptionInput(data: AppData, input: SubscriptionInput, env: Env) {
  const name = cleanText(input.name, NAME_MAX);
  check(name.length > 0, 'Bitte gib dem Abo einen Namen.');
  checkAmount(input.amount);
  check(input.intervalUnit in MAX_INTERVAL_COUNT, 'Bitte ein gültiges Intervall wählen.');
  check(
    Number.isInteger(input.intervalCount) &&
      input.intervalCount >= 1 &&
      input.intervalCount <= MAX_INTERVAL_COUNT[input.intervalUnit],
    'Bitte ein gültiges Intervall wählen.',
  );
  check(isISODate(input.nextDueDate), 'Bitte ein gültiges Datum für die nächste Abbuchung wählen.');
  if (input.accountId !== null) findAccount(data, input.accountId);
  const autoPay = input.autoPay && input.accountId !== null;
  // A date in the past would book charges that are most likely already in the balance.
  check(
    !autoPay || input.nextDueDate >= todayISO(env.now()),
    'Bei automatischer Abbuchung muss die nächste Abbuchung heute oder später sein.',
  );
  check(isAccountColor(input.color), 'Ungültige Farbe.');
  return {
    name,
    amount: input.amount,
    intervalUnit: input.intervalUnit,
    intervalCount: input.intervalCount,
    nextDueDate: input.nextDueDate,
    accountId: input.accountId,
    autoPay,
    color: input.color,
    image: checkImage(input.image),
    note: cleanNote(input.note),
  };
}

/** Adds a subscription. With autoPay, charges are booked by processDueSubscriptions. */
export function addSubscription(data: AppData, input: SubscriptionInput, env: Env = defaultEnv): AppData {
  const fields = checkSubscriptionInput(data, input, env);
  const subscription: Subscription = {
    id: env.newId(),
    ...fields,
    anchorDate: fields.nextDueDate,
    paused: false,
    createdAt: env.now().toISOString(),
  };
  return { ...data, subscriptions: [...data.subscriptions, subscription] };
}

export function updateSubscription(
  data: AppData,
  id: string,
  input: SubscriptionInput,
  env: Env = defaultEnv,
): AppData {
  const existing = findSubscription(data, id);
  const fields = checkSubscriptionInput(data, input, env);
  // A new date or interval starts a new schedule from that date.
  const reschedule =
    fields.nextDueDate !== existing.nextDueDate ||
    fields.intervalUnit !== existing.intervalUnit ||
    fields.intervalCount !== existing.intervalCount;
  return {
    ...data,
    subscriptions: data.subscriptions.map((s) =>
      s.id === id ? { ...s, ...fields, anchorDate: reschedule ? fields.nextDueDate : s.anchorDate } : s,
    ),
  };
}

/** Deletes a subscription. Past charges stay in the bookings (the money was really paid). */
export function deleteSubscription(data: AppData, id: string): AppData {
  findSubscription(data, id);
  return {
    ...data,
    subscriptions: data.subscriptions.filter((s) => s.id !== id),
    transactions: data.transactions.map((t) => (t.subscriptionId === id ? { ...t, subscriptionId: null } : t)),
  };
}

function chargeBooking(env: Env, sub: Subscription, accountId: string, date: ISODate): Transaction {
  return booking(env, {
    kind: 'subscription',
    amount: sub.amount,
    fromAccountId: accountId,
    toAccountId: null,
    date,
    note: sub.name,
    subscriptionId: sub.id,
  });
}

export interface PaySubscriptionInput {
  accountId: string;
  date: ISODate;
}

/** Books the current charge of a subscription manually and moves on to the next date. */
export function paySubscription(
  data: AppData,
  id: string,
  input: PaySubscriptionInput,
  env: Env = defaultEnv,
): AppData {
  const sub = findSubscription(data, id);
  check(!sub.paused, 'Das Abo ist pausiert.');
  findAccount(data, input.accountId);
  check(isISODate(input.date), 'Bitte ein gültiges Datum wählen.');
  return {
    ...data,
    transactions: [...data.transactions, chargeBooking(env, sub, input.accountId, input.date)],
    subscriptions: data.subscriptions.map((s) => (s.id === id ? { ...s, nextDueDate: followingDueDate(s) } : s)),
  };
}

/** Skips the current charge without a booking (e.g. a free month). */
export function skipSubscriptionCharge(data: AppData, id: string): AppData {
  const sub = findSubscription(data, id);
  check(!sub.paused, 'Das Abo ist pausiert.');
  return {
    ...data,
    subscriptions: data.subscriptions.map((s) => (s.id === id ? { ...s, nextDueDate: followingDueDate(s) } : s)),
  };
}

/**
 * Pauses or resumes a subscription. Charges missed while it was paused are
 * not booked: the next charge is the first scheduled date from today on.
 */
export function setSubscriptionPaused(data: AppData, id: string, paused: boolean, env: Env = defaultEnv): AppData {
  const sub = findSubscription(data, id);
  if (sub.paused === paused) return data;
  const today = todayISO(env.now());
  const nextDueDate = !paused && sub.nextDueDate < today ? nextOccurrenceOnOrAfter(sub, today) : sub.nextDueDate;
  return {
    ...data,
    subscriptions: data.subscriptions.map((s) => (s.id === id ? { ...s, paused, nextDueDate } : s)),
  };
}

/**
 * Books every due charge of the subscriptions with automatic payment up to
 * and including `today` (also several, if the app was closed for a while).
 * Returns the same document if nothing is due.
 */
export function processDueSubscriptions(data: AppData, today: ISODate, env: Env = defaultEnv): AppData {
  const accountIds = new Set(data.accounts.map((a) => a.id));
  const charges: Transaction[] = [];
  let changed = false;

  const subscriptions = data.subscriptions.map((sub) => {
    if (sub.paused || !sub.autoPay || sub.accountId === null || !accountIds.has(sub.accountId)) return sub;
    if (sub.nextDueDate > today) return sub;
    let current = sub;
    for (let i = 0; current.nextDueDate <= today && i < MAX_AUTO_CHARGES; i++) {
      charges.push(chargeBooking(env, current, sub.accountId, current.nextDueDate));
      current = { ...current, nextDueDate: followingDueDate(current) };
    }
    changed = true;
    return current;
  });

  if (!changed) return data;
  return { ...data, subscriptions, transactions: [...data.transactions, ...charges] };
}

// ---------------------------------------------------------------- settings

export function updateSettings(data: AppData, patch: Partial<Settings>): AppData {
  return { ...data, settings: { ...data.settings, ...patch } };
}
