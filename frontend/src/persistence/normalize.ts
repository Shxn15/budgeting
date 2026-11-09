/**
 * Turns a (migrated) raw document into a well-formed AppData.
 *
 * The file is normally written by this app, but it may have been edited by
 * hand or damaged. Missing fields get safe defaults; entries that cannot be
 * used at all (e.g. without an id) are skipped. Valid data is never dropped.
 */
import { isAccountColor, nextAccountColor } from '../domain/colors';
import { isISODate, toISODate } from '../domain/dates';
import { isImageDataUrl } from '../domain/images';
import { MAX_CENTS } from '../domain/money';
import { MAX_INTERVAL_COUNT } from '../domain/subscriptions';
import { DEFAULT_COLOR_THEME, isColorTheme } from '../domain/themes';
import type {
  Account,
  AccountType,
  AppData,
  IntervalUnit,
  Obligation,
  ObligationKind,
  Receivable,
  SavingsGoal,
  Settings,
  Subscription,
  Tag,
  ThemePreference,
  Transaction,
  TransactionKind,
} from '../domain/types';
import { isRawDocument, type RawDocument } from './migrations';
import { CURRENT_SCHEMA_VERSION, DEFAULT_CURRENCY } from './schema';

const ACCOUNT_TYPES: readonly AccountType[] = ['cash', 'bank', 'savings', 'card', 'investment', 'other'];
const TRANSACTION_KINDS: readonly TransactionKind[] = [
  'opening',
  'adjustment',
  'transfer',
  'payment',
  'income',
  'expense',
  'subscription',
];
const OBLIGATION_KINDS: readonly ObligationKind[] = ['debt', 'bill'];
const INTERVAL_UNITS: readonly IntervalUnit[] = ['week', 'month', 'year'];
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

function image(value: unknown): string | null {
  return isImageDataUrl(value) ? value : null;
}

/** Keeps a reference only if the referenced entry exists. */
function ref(value: string | null, existing: ReadonlySet<string>): string | null {
  return value !== null && existing.has(value) ? value : null;
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
      subscriptionId: nullableStr(item.subscriptionId),
      tagId: nullableStr(item.tagId),
      affectsBalance: item.affectsBalance !== false,
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
      tagId: nullableStr(item.tagId),
      note: str(item.note),
      createdAt: timestamp(item.createdAt, now),
      paidAt: typeof item.paidAt === 'string' && item.paidAt !== '' ? timestamp(item.paidAt, now) : null,
      paymentTransactionId: nullableStr(item.paymentTransactionId),
    });
  }
  return obligations;
}

function normalizeTags(raw: unknown, now: string): Tag[] {
  const tags: Tag[] = [];
  const seen = new Set<string>();
  for (const item of list(raw)) {
    const tagId = id(item.id);
    if (tagId === null || seen.has(tagId)) continue;
    seen.add(tagId);
    tags.push({
      id: tagId,
      name: str(item.name).trim() || 'Tag',
      color: isAccountColor(item.color) ? item.color : nextAccountColor(tags),
      image: image(item.image),
      createdAt: timestamp(item.createdAt, now),
    });
  }
  return tags;
}

function normalizeSubscriptions(raw: unknown, now: string): Subscription[] {
  const subscriptions: Subscription[] = [];
  const seen = new Set<string>();
  const today = toISODate(new Date(now));
  for (const item of list(raw)) {
    const subId = id(item.id);
    const amount = cents(item.amount);
    if (subId === null || amount === null || seen.has(subId)) continue;
    seen.add(subId);
    const unit = oneOf(item.intervalUnit, INTERVAL_UNITS, 'month');
    const count =
      typeof item.intervalCount === 'number' &&
      Number.isInteger(item.intervalCount) &&
      item.intervalCount >= 1 &&
      item.intervalCount <= MAX_INTERVAL_COUNT[unit]
        ? item.intervalCount
        : 1;
    const nextDueDate = isISODate(item.nextDueDate)
      ? item.nextDueDate
      : isISODate(item.anchorDate)
        ? item.anchorDate
        : today;
    const accountId = nullableStr(item.accountId);
    subscriptions.push({
      id: subId,
      name: str(item.name).trim() || 'Abo',
      amount: Math.abs(amount),
      intervalUnit: unit,
      intervalCount: count,
      anchorDate: isISODate(item.anchorDate) && item.anchorDate <= nextDueDate ? item.anchorDate : nextDueDate,
      nextDueDate,
      accountId,
      autoPay: item.autoPay === true && accountId !== null,
      color: isAccountColor(item.color) ? item.color : nextAccountColor(subscriptions),
      image: image(item.image),
      note: str(item.note),
      paused: item.paused === true,
      createdAt: timestamp(item.createdAt, now),
    });
  }
  return subscriptions;
}

function normalizeReceivables(raw: unknown, now: string): Receivable[] {
  const receivables: Receivable[] = [];
  const seen = new Set<string>();
  for (const item of list(raw)) {
    const receivableId = id(item.id);
    const amount = cents(item.amount);
    if (receivableId === null || amount === null || seen.has(receivableId)) continue;
    seen.add(receivableId);
    receivables.push({
      id: receivableId,
      counterparty: str(item.counterparty),
      title: str(item.title),
      amount: Math.abs(amount),
      expectedDate: isISODate(item.expectedDate) ? item.expectedDate : null,
      accountId: nullableStr(item.accountId),
      tagId: nullableStr(item.tagId),
      note: str(item.note),
      createdAt: timestamp(item.createdAt, now),
      receivedAt: typeof item.receivedAt === 'string' && item.receivedAt !== '' ? timestamp(item.receivedAt, now) : null,
      receiptTransactionId: nullableStr(item.receiptTransactionId),
    });
  }
  return receivables;
}

/**
 * Savings goals. A goal needs an existing account (its money lives there).
 * A parent in another account, a missing parent or a loop of parents makes
 * the goal a top-level goal instead of dropping it.
 */
function normalizeSavingsGoals(raw: unknown, now: string, accountIds: ReadonlySet<string>): SavingsGoal[] {
  const goals: SavingsGoal[] = [];
  const seen = new Set<string>();
  for (const item of list(raw)) {
    const goalId = id(item.id);
    const accountId = id(item.accountId);
    if (goalId === null || accountId === null || !accountIds.has(accountId) || seen.has(goalId)) continue;
    seen.add(goalId);
    const target = cents(item.targetAmount);
    const allocated = cents(item.allocated);
    goals.push({
      id: goalId,
      accountId,
      parentId: nullableStr(item.parentId),
      name: str(item.name).trim() || 'Sparziel',
      targetAmount: target !== null && target > 0 ? target : null,
      targetDate: isISODate(item.targetDate) ? item.targetDate : null,
      allocated: allocated !== null && allocated > 0 ? allocated : 0,
      color: isAccountColor(item.color) ? item.color : nextAccountColor(goals),
      image: image(item.image),
      note: str(item.note),
      createdAt: timestamp(item.createdAt, now),
    });
  }

  const byId = new Map(goals.map((g) => [g.id, g]));
  const parentOf = new Map<string, string | null>();
  for (const goal of goals) {
    const parent = goal.parentId === null ? undefined : byId.get(goal.parentId);
    parentOf.set(goal.id, parent && parent.id !== goal.id && parent.accountId === goal.accountId ? parent.id : null);
  }
  // Break loops (a -> b -> a): the goal where the walk returns becomes top level.
  for (const goal of goals) {
    const visited = new Set<string>([goal.id]);
    let current = goal.id;
    for (;;) {
      const parent = parentOf.get(current) ?? null;
      if (parent === null) break;
      if (visited.has(parent)) {
        parentOf.set(current, null);
        break;
      }
      visited.add(parent);
      current = parent;
    }
  }
  return goals.map((g) => ({ ...g, parentId: parentOf.get(g.id) ?? null }));
}

const MAX_COLLAPSED = 100;

function normalizeCollapsed(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const keys = value.filter((key): key is string => typeof key === 'string' && key.length > 0 && key.length <= 80);
  return [...new Set(keys)].slice(0, MAX_COLLAPSED);
}

function normalizeSettings(raw: unknown): Settings {
  const item = isRawDocument(raw) ? raw : {};
  const currency = str(item.currency).toUpperCase();
  return {
    theme: oneOf(item.theme, THEMES, 'system'),
    colorTheme: isColorTheme(item.colorTheme) ? item.colorTheme : DEFAULT_COLOR_THEME,
    collapsedSections: normalizeCollapsed(item.collapsedSections),
    currency: /^[A-Z]{3}$/.test(currency) ? currency : DEFAULT_CURRENCY,
  };
}

export function normalizeData(doc: RawDocument, appVersion: string, now: Date = new Date()): AppData {
  const nowIso = now.toISOString();
  const meta = isRawDocument(doc.meta) ? doc.meta : {};
  const accounts = normalizeAccounts(doc.accounts, nowIso);
  const accountIds = new Set(accounts.map((a) => a.id));
  const tags = normalizeTags(doc.tags, nowIso);
  const tagIds = new Set(tags.map((t) => t.id));
  const subscriptions = normalizeSubscriptions(doc.subscriptions, nowIso).map((sub) => {
    const accountId = ref(sub.accountId, accountIds);
    return { ...sub, accountId, autoPay: sub.autoPay && accountId !== null };
  });
  const subscriptionIds = new Set(subscriptions.map((s) => s.id));

  // Drop references to things that no longer exist.
  const transactions = normalizeTransactions(doc.transactions, nowIso).map((t) => ({
    ...t,
    tagId: ref(t.tagId, tagIds),
    subscriptionId: ref(t.subscriptionId, subscriptionIds),
  }));
  const transactionIds = new Set(transactions.map((t) => t.id));

  const obligations = normalizeObligations(doc.obligations, nowIso).map((o) => ({
    ...o,
    accountId: ref(o.accountId, accountIds),
    tagId: ref(o.tagId, tagIds),
    paymentTransactionId: ref(o.paymentTransactionId, transactionIds),
  }));

  const receivables = normalizeReceivables(doc.receivables, nowIso).map((r) => ({
    ...r,
    accountId: ref(r.accountId, accountIds),
    tagId: ref(r.tagId, tagIds),
    receiptTransactionId: ref(r.receiptTransactionId, transactionIds),
  }));

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    accounts,
    transactions,
    obligations,
    tags,
    subscriptions,
    receivables,
    savingsGoals: normalizeSavingsGoals(doc.savingsGoals, nowIso, accountIds),
    settings: normalizeSettings(doc.settings),
    meta: {
      createdAt: timestamp(meta.createdAt, nowIso),
      updatedAt: timestamp(meta.updatedAt, nowIso),
      appVersion: str(meta.appVersion, appVersion),
    },
  };
}
