import { useEffect, useMemo, useState } from 'react';
import { todayISO } from '../domain/dates';
import { computeBalances } from '../domain/ledger';
import type { Account, Cents, ISODate } from '../domain/types';
import { useDataStore } from './dataStore';

export const useAccounts = () => useDataStore((s) => s.data.accounts);
export const useTransactions = () => useDataStore((s) => s.data.transactions);
export const useObligations = () => useDataStore((s) => s.data.obligations);
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
