import { ArrowLeftRight, CirclePlus, PencilLine, Receipt, type LucideIcon } from 'lucide-react';
import type { Account, Cents, Transaction } from '../../domain/types';

export interface TransactionView {
  icon: LucideIcon;
  title: string;
  detail: string;
  /** +1 money came in, -1 money went out, 0 neutral (transfer between own accounts). */
  sign: 1 | -1 | 0;
  amount: Cents;
}

/**
 * Human readable description of a booking. `perspective` is the account the
 * list is filtered by (transfers then show as + or -).
 */
export function describeTransaction(
  t: Transaction,
  accounts: ReadonlyMap<string, Account>,
  perspective: string | null = null,
): TransactionView {
  const name = (id: string | null) => (id === null ? 'Gelöschtes Konto' : (accounts.get(id)?.name ?? 'Gelöschtes Konto'));
  const withNote = (text: string) => (t.note ? `${text} · ${t.note}` : text);
  const incoming: 1 | -1 = t.toAccountId !== null ? 1 : -1;

  switch (t.kind) {
    case 'opening':
      return {
        icon: CirclePlus,
        title: 'Startguthaben',
        detail: withNote(name(t.toAccountId ?? t.fromAccountId)),
        sign: incoming,
        amount: t.amount,
      };
    case 'adjustment':
      return {
        icon: PencilLine,
        title: 'Kontostand angepasst',
        detail: withNote(name(t.toAccountId ?? t.fromAccountId)),
        sign: incoming,
        amount: t.amount,
      };
    case 'transfer':
      return {
        icon: ArrowLeftRight,
        title: 'Umbuchung',
        detail: withNote(`${name(t.fromAccountId)} → ${name(t.toAccountId)}`),
        sign: perspective === null ? 0 : perspective === t.fromAccountId ? -1 : perspective === t.toAccountId ? 1 : 0,
        amount: t.amount,
      };
    case 'payment':
      return {
        icon: Receipt,
        title: t.note || 'Zahlung',
        detail: `bezahlt von ${name(t.fromAccountId)}`,
        sign: -1,
        amount: t.amount,
      };
  }
}

/** Newest first: by booking date, then by creation time. */
export function sortNewestFirst(list: readonly Transaction[]): Transaction[] {
  return [...list].sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  );
}
