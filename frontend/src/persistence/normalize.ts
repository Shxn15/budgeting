/**
 * Turns a (migrated) raw document into a well-formed AppData.
 *
 * The file is normally written by this app, but it may have been edited by
 * hand or damaged. Missing fields get safe defaults; entries that cannot be
 * used at all (e.g. without an id) are skipped. Valid data is never dropped.
 */
import { isAccountColor, nextAccountColor } from '../domain/colors';
import { isISODate, toISODate } from '../domain/dates';
import { MAX_CENTS } from '../domain/money';
import type {
  Account,
  AccountType,
  AppData,
  Obligation,
  ObligationKind,
  Settings,
  ThemePreference,
  Transaction,
  TransactionKind,
} from '../domain/types';
import { isRawDocument, type RawDocument } from './migrations';
import { CURRENT_SCHEMA_VERSION, DEFAULT_CURRENCY } from './schema';

const ACCOUNT_TYPES: readonly AccountType[] = ['cash', 'bank', 'savings', 'card', 'investment', 'other'];
const TRANSACTION_KINDS: readonly TransactionKind[] = ['opening', 'adjustment', 'transfer', 'payment'];
const OBLIGATION_KINDS: readonly ObligationKind[] = ['debt', 'bill'];
const THEMES: readonly ThemePreference[] = ['system', 'light', 'dark'];

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function nullableStr(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function id(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function cents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return Math.abs(rounded) <= MAX_CENTS ? rounded : null;
}

function timestamp(value: unknown, fallback: string): string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : fallback;
}

function list(value: unknown): RawDocument[] {
  return Array.isArray(value) ? value.filter(isRawDocument) : [];
}

function normalizeAccounts(raw: unknown, now: string): Account[] {
  const accounts: Account[] = [];
  const seen = new Set<string>();
  for (const item of list(raw)) {
    const accountId = id(item.id);
    if (accountId === null || seen.has(accountId)) continue;
    seen.add(accountId);
    accounts.push({
      id: accountId,
      name: str(item.name).trim() || 'Konto',
      type: oneOf(item.type, ACCOUNT_TYPES, 'other'),
      color: isAccountColor(item.color) ? item.color : nextAccountColor(accounts),
      createdAt: timestamp(item.createdAt, now),
    });
  }
  return accounts;
}

function normalizeTransactions(raw: unknown, now: string): Transaction[] {
  const transactions: Transaction[] = [];
  const seen = new Set<string>();
  for (const item of list(raw)) {
    const txId = id(item.id);
    const amount = cents(item.amount);
    if (txId === null || amount === null || seen.has(txId)) continue;
    seen.add(txId);

    let from = nullableStr(item.fromAccountId);
    let to = nullableStr(item.toAccountId);
    if (amount < 0) [from, to] = [to, from]; // a negative amount is the reverse direction
    const createdAt = timestamp(item.createdAt, now);

    transactions.push({
      id: txId,
      kind: oneOf(item.kind, TRANSACTION_KINDS, 'adjustment'),
      amount: Math.abs(amount),
      fromAccountId: from,
      toAccountId: to,
      date: isISODate(item.date) ? item.date : toISODate(new Date(createdAt)),
      note: str(item.note),
      obligationId: nullableStr(item.obligationId),
      createdAt,
    });
  }
  return transactions;
}

function normalizeObligations(raw: unknown, now: string): Obligation[] {
  const obligations: Obligation[] = [];
  const seen = new Set<string>();
  for (const item of list(raw)) {
    const obligationId = id(item.id);
    const amount = cents(item.amount);
    if (obligationId === null || amount === null || seen.has(obligationId)) continue;
    seen.add(obligationId);
    obligations.push({
      id: obligationId,
      kind: oneOf(item.kind, OBLIGATION_KINDS, 'bill'),
      title: str(item.title),
      counterparty: str(item.counterparty),
      amount: Math.abs(amount),
      dueDate: isISODate(item.dueDate) ? item.dueDate : null,
      accountId: nullableStr(item.accountId),
      note: str(item.note),
      createdAt: timestamp(item.createdAt, now),
      paidAt: typeof item.paidAt === 'string' && item.paidAt !== '' ? timestamp(item.paidAt, now) : null,
      paymentTransactionId: nullableStr(item.paymentTransactionId),
    });
  }
  return obligations;
}

function normalizeSettings(raw: unknown): Settings {
  const item = isRawDocument(raw) ? raw : {};
  const currency = str(item.currency).toUpperCase();
  return {
    theme: oneOf(item.theme, THEMES, 'system'),
    currency: /^[A-Z]{3}$/.test(currency) ? currency : DEFAULT_CURRENCY,
  };
}

export function normalizeData(doc: RawDocument, appVersion: string, now: Date = new Date()): AppData {
  const nowIso = now.toISOString();
  const meta = isRawDocument(doc.meta) ? doc.meta : {};
  const accounts = normalizeAccounts(doc.accounts, nowIso);
  const accountIds = new Set(accounts.map((a) => a.id));
  const transactions = normalizeTransactions(doc.transactions, nowIso);
  const transactionIds = new Set(transactions.map((t) => t.id));

  const obligations = normalizeObligations(doc.obligations, nowIso).map((o) => ({
    ...o,
    // Drop references to things that no longer exist.
    accountId: o.accountId !== null && accountIds.has(o.accountId) ? o.accountId : null,
    paymentTransactionId:
      o.paymentTransactionId !== null && transactionIds.has(o.paymentTransactionId)
        ? o.paymentTransactionId
        : null,
  }));

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    accounts,
    transactions,
    obligations,
    settings: normalizeSettings(doc.settings),
    meta: {
      createdAt: timestamp(meta.createdAt, nowIso),
      updatedAt: timestamp(meta.updatedAt, nowIso),
      appVersion: str(meta.appVersion, appVersion),
    },
  };
}
