/**
 * Everything the UI can change. Each action runs a pure domain operation
 * (domain/operations.ts) on the current document; the new document is then
 * saved automatically (store/persistence.ts). Validation errors are thrown
 * as DomainError and shown by the calling dialog.
 */
import * as ops from '../domain/operations';
import type { AppData, Cents, Settings } from '../domain/types';
import { useDataStore } from './dataStore';

function apply(change: (data: AppData) => AppData): void {
  const state = useDataStore.getState();
  if (state.load.status !== 'ready') throw new Error('Die Daten sind noch nicht geladen.');
  const next = change(state.data);
  if (next === state.data) return;
  useDataStore.setState({
    data: {
      ...next,
      meta: {
        ...next.meta,
        updatedAt: new Date().toISOString(),
        appVersion: state.appInfo?.version ?? next.meta.appVersion,
      },
    },
  });
}

export const createAccount = (input: ops.NewAccountInput) => apply((d) => ops.createAccount(d, input));
export const updateAccount = (id: string, input: ops.AccountInput) => apply((d) => ops.updateAccount(d, id, input));
export const deleteAccount = (id: string) => apply((d) => ops.deleteAccount(d, id));
export const moveAccount = (id: string, toIndex: number) => apply((d) => ops.moveAccount(d, id, toIndex));
export const setAccountBalance = (id: string, balance: Cents, note = '') =>
  apply((d) => ops.setAccountBalance(d, id, balance, note));

export const transfer = (input: ops.TransferInput) => apply((d) => ops.transfer(d, input));
export const deleteTransaction = (id: string) => apply((d) => ops.deleteTransaction(d, id));

export const addObligation = (input: ops.ObligationInput) => apply((d) => ops.addObligation(d, input));
export const updateObligation = (id: string, input: ops.ObligationInput) =>
  apply((d) => ops.updateObligation(d, id, input));
export const deleteObligation = (id: string) => apply((d) => ops.deleteObligation(d, id));
export const markObligationPaid = (id: string, input: ops.PayObligationInput) =>
  apply((d) => ops.markObligationPaid(d, id, input));
export const reopenObligation = (id: string) => apply((d) => ops.reopenObligation(d, id));

export const updateSettings = (patch: Partial<Settings>) => apply((d) => ops.updateSettings(d, patch));
