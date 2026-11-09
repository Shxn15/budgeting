import { create } from 'zustand';
import type { ObligationKind } from '../domain/types';

/** Pages of the app – see app/pages.tsx. */
export type PageId =
  | 'overview'
  | 'account'
  | 'obligations'
  | 'subscriptions'
  | 'spending'
  | 'tags'
  | 'transactions'
  | 'settings';

/** Every dialog the app can show – rendered by app/DialogHost.tsx. */
export type DialogRequest =
  | { type: 'account'; accountId?: string }
  | { type: 'balance'; accountId: string }
  | { type: 'transfer'; fromAccountId?: string; toAccountId?: string }
  /** income = "Geld hinzufügen", expense = "Geld entfernen" / "Zahlung eintragen". */
  | { type: 'booking'; kind?: 'income' | 'expense'; accountId?: string; transactionId?: string; tagId?: string }
  | { type: 'obligation'; obligationId?: string; kind?: ObligationKind }
  | { type: 'pay'; obligationId: string }
  | { type: 'subscription'; subscriptionId?: string }
  | { type: 'paySubscription'; subscriptionId: string }
  | { type: 'tag'; tagId?: string }
  /** Money someone owes me. */
  | { type: 'receivable'; receivableId?: string }
  /** The money of a receivable arrived. */
  | { type: 'receive'; receivableId: string }
  /** Create (with accountId, optionally inside parentId) or edit (goalId) a savings goal. */
  | { type: 'goal'; accountId: string; goalId?: string; parentId?: string }
  /** Assign money of the savings account to a goal, or take it back. */
  | { type: 'allocate'; goalId: string; mode?: 'add' | 'remove' }
  | {
      type: 'confirm';
      title: string;
      message: string;
      confirmLabel: string;
      danger?: boolean;
      onConfirm: () => void;
    };

export type ToastTone = 'success' | 'info' | 'error';

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface UiState {
  page: PageId;
  /** Account shown on the 'account' page. */
  accountId: string | null;
  dialog: DialogRequest | null;
  toasts: Toast[];
  /** Account highlighted across the UI (chart slice, legend row, card). */
  highlight: string | null;
  navigate(page: PageId): void;
  openAccount(accountId: string): void;
  setHighlight(accountId: string | null): void;
  openDialog(dialog: DialogRequest): void;
  closeDialog(): void;
  notify(message: string, tone?: ToastTone): void;
  dismissToast(id: number): void;
}

let toastId = 0;

export const useUiStore = create<UiState>()((set, get) => ({
  page: 'overview',
  accountId: null,
  dialog: null,
  toasts: [],
  highlight: null,
  navigate: (page) => set({ page, highlight: null }),
  openAccount: (accountId) => set({ page: 'account', accountId, highlight: null }),
  setHighlight: (highlight) => set({ highlight }),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
  notify(message, tone = 'success') {
    const id = ++toastId;
    set({ toasts: [...get().toasts.slice(-2), { id, message, tone }] });
    window.setTimeout(() => get().dismissToast(id), tone === 'error' ? 6000 : 3600);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
