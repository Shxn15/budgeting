import { create } from 'zustand';
import type { ObligationKind } from '../domain/types';

/** Pages shown in the sidebar – see app/pages.tsx. */
export type PageId = 'overview' | 'obligations' | 'transactions' | 'settings';

/** Every dialog the app can show – rendered by app/DialogHost.tsx. */
export type DialogRequest =
  | { type: 'account'; accountId?: string }
  | { type: 'balance'; accountId: string }
  | { type: 'transfer'; fromAccountId?: string; toAccountId?: string }
  | { type: 'obligation'; obligationId?: string; kind?: ObligationKind }
  | { type: 'pay'; obligationId: string }
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
  dialog: DialogRequest | null;
  toasts: Toast[];
  /** Account highlighted across the UI (chart slice, legend row, card). */
  highlight: string | null;
  navigate(page: PageId): void;
  setHighlight(accountId: string | null): void;
  openDialog(dialog: DialogRequest): void;
  closeDialog(): void;
  notify(message: string, tone?: ToastTone): void;
  dismissToast(id: number): void;
}

let toastId = 0;

export const useUiStore = create<UiState>()((set, get) => ({
  page: 'overview',
  dialog: null,
  toasts: [],
  highlight: null,
  navigate: (page) => set({ page, highlight: null }),
  setHighlight: (highlight) => set({ highlight }),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
  notify(message, tone = 'success') {
    const id = ++toastId;
    set({ toasts: [...get().toasts.slice(-2), { id, message, tone }] });
    window.setTimeout(() => get().dismissToast(id), tone === 'error' ? 6000 : 3200);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
