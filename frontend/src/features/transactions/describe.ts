import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CirclePlus, PencilLine, Receipt, Repeat, type LucideIcon } from 'lucide-react';
import type { Account, Cents, Subscription, Tag, Transaction } from '../../domain/types';

export interface TransactionView {
  icon: LucideIcon;
  title: string;
  detail: string;
  /** +1 money came in, -1 money went out, 0 neutral (transfer between own accounts). */
  sign: 1 | -1 | 0;
  amount: Cents;
  /** Picture of the tag or subscription, if any. */
  avatar: { name: string; image: string | null; color: string } | null;
  /** Recorded for the statistics only – the balance did not change. */
  statsOnly: boolean;
}

export interface DescribeContext {
  accounts: ReadonlyMap<string, Account>;
  tags: ReadonlyMap<string, Tag>;
  subscriptions: ReadonlyMap<string, Subscription>;
}

/**
 * Human readable description of a booking. `perspective` is the account the
 * list is filtered by (transfers then show as + or -).
 */
export function describeTransaction(
  t: Transaction,
  { accounts, tags, subscriptions }: DescribeContext,
  perspective: string | null = null,
): TransactionView {
  const name = (id: string | null) => (id === null ? 'Gelöschtes Konto' : (accounts.get(id)?.name ?? 'Gelöschtes Konto'));
  const join = (...parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(' · ');
  const withNote = (text: string) => join(text, t.note);
  const incoming: 1 | -1 = t.toAccountId !== null ? 1 : -1;
  const tag = t.tagId ? tags.get(t.tagId) : undefined;
  const sub = t.subscriptionId ? subscriptions.get(t.subscriptionId) : undefined;
  const statsOnly = t.affectsBalance === false;
  const base = { amount: t.amount, statsOnly, avatar: tag ? { name: tag.name, image: tag.image, color: tag.color } : null };
  const statsNote = statsOnly ? 'nur Statistik' : null;

  switch (t.kind) {
    case 'opening':
      return { ...base, icon: CirclePlus, title: 'Startguthaben', detail: withNote(name(t.toAccountId ?? t.fromAccountId)), sign: incoming };
    case 'adjustment':
      return {
        ...base,
        icon: PencilLine,
        title: 'Kontostand korrigiert',
        detail: withNote(name(t.toAccountId ?? t.fromAccountId)),
        sign: incoming,
      };
    case 'transfer':
      return {
        ...base,
        icon: ArrowLeftRight,
        title: 'Umbuchung',
        detail: withNote(`${name(t.fromAccountId)} → ${name(t.toAccountId)}`),
        sign: perspective === null ? 0 : perspective === t.fromAccountId ? -1 : perspective === t.toAccountId ? 1 : 0,
      };
    case 'payment':
      return {
        ...base,
        icon: Receipt,
        title: t.note || tag?.name || 'Zahlung',
        detail: join(tag && t.note && tag.name !== t.note ? tag.name : null, `bezahlt von ${name(t.fromAccountId)}`),
        sign: -1,
      };
    case 'income':
      return {
        ...base,
        icon: ArrowDownLeft,
        title: tag?.name || t.note || 'Geld hinzugefügt',
        detail: join(name(t.toAccountId), tag ? t.note : null, statsNote),
        sign: 1,
      };
    case 'expense':
      return {
        ...base,
        icon: ArrowUpRight,
        title: tag?.name || t.note || 'Geld entfernt',
        detail: join(name(t.fromAccountId), tag ? t.note : null, statsNote),
        sign: -1,
      };
    case 'subscription':
      return {
        ...base,
        icon: Repeat,
        title: sub?.name || t.note || 'Abo',
        detail: join('Abo', name(t.fromAccountId)),
        sign: -1,
        avatar: sub ? { name: sub.name, image: sub.image, color: sub.color } : base.avatar,
      };
  }
}

/** Newest first: by booking date, then by creation time. */
export function sortNewestFirst(list: readonly Transaction[]): Transaction[] {
  return [...list].sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  );
}
