import type { Account, Cents, Transaction } from './types';

/**
 * Balance per account id. Balances are derived from bookings:
 * money arriving (toAccountId) adds, money leaving (fromAccountId) subtracts.
 */
export function computeBalances(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
): Map<string, Cents> {
  const balances = new Map<string, Cents>();
  for (const account of accounts) balances.set(account.id, 0);
  for (const t of transactions) {
    if (t.toAccountId !== null && balances.has(t.toAccountId)) {
      balances.set(t.toAccountId, balances.get(t.toAccountId)! + t.amount);
    }
    if (t.fromAccountId !== null && balances.has(t.fromAccountId)) {
      balances.set(t.fromAccountId, balances.get(t.fromAccountId)! - t.amount);
    }
  }
  return balances;
}

export function sumBalances(balances: ReadonlyMap<string, Cents>): Cents {
  let total = 0;
  for (const value of balances.values()) total += value;
  return total;
}

export interface PortfolioSlice {
  account: Account;
  balance: Cents;
  /** Share of all positive balances, 0..1. */
  share: number;
}

export interface Portfolio {
  /** Accounts with a positive balance, in account order. */
  slices: PortfolioSlice[];
  /** Sum of all positive balances (what the chart shows). */
  positiveTotal: Cents;
  /** Accounts with a negative balance – they cannot be shown in a pie chart. */
  negative: { account: Account; balance: Cents }[];
}

/** Data for the pie chart: how the money is distributed over the accounts. */
export function buildPortfolio(
  accounts: readonly Account[],
  balances: ReadonlyMap<string, Cents>,
): Portfolio {
  const positive = accounts
    .map((account) => ({ account, balance: balances.get(account.id) ?? 0 }))
    .filter((entry) => entry.balance > 0);
  const positiveTotal = positive.reduce((sum, entry) => sum + entry.balance, 0);
  const negative = accounts
    .map((account) => ({ account, balance: balances.get(account.id) ?? 0 }))
    .filter((entry) => entry.balance < 0);

  return {
    slices: positive.map((entry) => ({
      ...entry,
      share: positiveTotal > 0 ? entry.balance / positiveTotal : 0,
    })),
    positiveTotal,
    negative,
  };
}
