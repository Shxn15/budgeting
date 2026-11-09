/**
 * Everything the UI can change. Each action runs a pure domain operation
 * (domain/operations.ts) on the current document; the new document is then
 * saved automatically (store/persistence.ts). Validation errors are thrown
 * as DomainError and shown by the calling dialog.
 */
import * as ops from '../domain/operations';
import type { AppData, Cents, ISODate, Settings, Transaction } from '../domain/types';
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

export const addBooking = (input: ops.BookingInput) => apply((d) => ops.addBooking(d, input));
export const updateBooking = (id: string, input: ops.BookingInput) => apply((d) => ops.updateBooking(d, id, input));

/** Creates a tag and returns its id. */
export function addTag(input: ops.TagInput): string {
  apply((d) => ops.addTag(d, input));
  return useDataStore.getState().data.tags.at(-1)!.id;
}
export const updateTag = (id: string, input: ops.TagInput) => apply((d) => ops.updateTag(d, id, input));
export const deleteTag = (id: string) => apply((d) => ops.deleteTag(d, id));

export const addSubscription = (input: ops.SubscriptionInput) => apply((d) => ops.addSubscription(d, input));
export const updateSubscription = (id: string, input: ops.SubscriptionInput) =>
  apply((d) => ops.updateSubscription(d, id, input));
export const deleteSubscription = (id: string) => apply((d) => ops.deleteSubscription(d, id));
export const paySubscription = (id: string, input: ops.PaySubscriptionInput) =>
  apply((d) => ops.paySubscription(d, id, input));
export const skipSubscriptionCharge = (id: string) => apply((d) => ops.skipSubscriptionCharge(d, id));
export const setSubscriptionPaused = (id: string, paused: boolean) =>
  apply((d) => ops.setSubscriptionPaused(d, id, paused));

/** Books all due automatic subscription charges; returns the new bookings. */
export function runAutoPay(today: ISODate): Transaction[] {
  const before = useDataStore.getState().data;
  apply((d) => ops.processDueSubscriptions(d, today));
  const after = useDataStore.getState().data;
  if (after === before) return [];
  const known = new Set(before.transactions.map((t) => t.id));
  return after.transactions.filter((t) => !known.has(t.id));
}

export const addReceivable = (input: ops.ReceivableInput) => apply((d) => ops.addReceivable(d, input));
export const updateReceivable = (id: string, input: ops.ReceivableInput) =>
  apply((d) => ops.updateReceivable(d, id, input));
export const deleteReceivable = (id: string) => apply((d) => ops.deleteReceivable(d, id));
export const markReceivableReceived = (id: string, input: ops.ReceiveInput) =>
  apply((d) => ops.markReceivableReceived(d, id, input));
export const reopenReceivable = (id: string) => apply((d) => ops.reopenReceivable(d, id));

/** Creates a savings goal and returns its id. */
export function addSavingsGoal(input: ops.NewSavingsGoalInput): string {
  apply((d) => ops.addSavingsGoal(d, input));
  return useDataStore.getState().data.savingsGoals.at(-1)!.id;
}
export const updateSavingsGoal = (id: string, input: ops.SavingsGoalInput) =>
  apply((d) => ops.updateSavingsGoal(d, id, input));
export const deleteSavingsGoal = (id: string) => apply((d) => ops.deleteSavingsGoal(d, id));
export const allocateToSavingsGoal = (id: string, delta: Cents) => apply((d) => ops.allocateToSavingsGoal(d, id, delta));

export const updateSettings = (patch: Partial<Settings>) => apply((d) => ops.updateSettings(d, patch));

/** Folds a section of the UI away or opens it again (remembered in the settings). */
export function toggleSection(key: string): void {
  const current = useDataStore.getState().data.settings.collapsedSections;
  updateSettings({
    collapsedSections: current.includes(key) ? current.filter((k) => k !== key) : [...current, key],
  });
}
