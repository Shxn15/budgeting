import { useEffect, useMemo, useState } from 'react';
import { todayISO } from '../domain/dates';
import { computeBalances } from '../domain/ledger';
import { tagUsage } from '../domain/spending';
import type { Account, Cents, ISODate, Subscription, Tag } from '../domain/types';
import { buildUpcomingPlan, type UpcomingPlan } from '../domain/upcoming';
import { toggleSection } from './actions';
import { useDataStore } from './dataStore';

export const useAccounts = () => useDataStore((s) => s.data.accounts);
export const useTransactions = () => useDataStore((s) => s.data.transactions);
export const useObligations = () => useDataStore((s) => s.data.obligations);
export const useTags = () => useDataStore((s) => s.data.tags);
export const useSubscriptions = () => useDataStore((s) => s.data.subscriptions);
export const useReceivables = () => useDataStore((s) => s.data.receivables);
export const useSavingsGoals = () => useDataStore((s) => s.data.savingsGoals);
export const useSettings = () => useDataStore((s) => s.data.settings);
export const useCurrency = () => useDataStore((s) => s.data.settings.currency);

export function useBalances(): Map<string, Cents> {
  const accounts = useAccounts();
  const transactions = useTransactions();
  return useMemo(() => computeBalances(accounts, transactions), [accounts, transactions]);
}

export function useAccountMap(): Map<string, Account> {
  const accounts = useAccounts();
  return useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
}

export function useTagMap(): Map<string, Tag> {
  const tags = useTags();
  return useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
}

export function useSubscriptionMap(): Map<string, Subscription> {
  const subscriptions = useSubscriptions();
  return useMemo(() => new Map(subscriptions.map((s) => [s.id, s])), [subscriptions]);
}

/** How often each tag is used – for sorting suggestions. */
export function useTagUsage(): Map<string, number> {
  const transactions = useTransactions();
  const obligations = useObligations();
  const receivables = useReceivables();
  return useMemo(() => tagUsage(transactions, obligations, receivables), [transactions, obligations, receivables]);
}

/** Open obligations and subscription charges, month by month (see domain/upcoming.ts). */
export function useUpcomingPlan(today: ISODate): UpcomingPlan {
  const obligations = useObligations();
  const subscriptions = useSubscriptions();
  return useMemo(() => buildUpcomingPlan(obligations, subscriptions, today), [obligations, subscriptions, today]);
}

/** Keys of the sections that can be folded away (stored in settings.collapsedSections). */
export type SectionKey = 'overview.accounts' | 'overview.recent';

/** Whether a section is folded away, and a function to toggle it. */
export function useCollapsed(key: SectionKey): [boolean, () => void] {
  const collapsed = useDataStore((s) => s.data.settings.collapsedSections.includes(key));
  return [collapsed, () => toggleSection(key)];
}

/** Today's date; updates itself at midnight while the app stays open. */
export function useToday(): ISODate {
  const [today, setToday] = useState(() => todayISO());
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    const timer = window.setTimeout(() => setToday(todayISO()), midnight.getTime() - now.getTime());
    return () => window.clearTimeout(timer);
  }, [today]);
  return today;
}
