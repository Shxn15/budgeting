import { ArrowLeftRight, Minus, Pencil, PencilLine, Plus, Trash2 } from 'lucide-react';
import type { Account } from '../../domain/types';
import type { MenuItem } from '../../components/ui/Menu';
import { useUiStore } from '../../store/uiStore';
import { confirmDeleteAccount } from './confirmDeleteAccount';

/** The actions of an account (card menu and account page). */
export function accountMenu(account: Account, { withMoney = true } = {}): (MenuItem | 'separator')[] {
  const { openDialog } = useUiStore.getState();
  return [
    ...(withMoney
      ? ([
          { label: 'Geld hinzufügen', icon: <Plus />, onSelect: () => openDialog({ type: 'booking', kind: 'income', accountId: account.id }) },
          { label: 'Geld entfernen', icon: <Minus />, onSelect: () => openDialog({ type: 'booking', kind: 'expense', accountId: account.id }) },
        ] satisfies MenuItem[])
      : []),
    { label: 'Geld umbuchen', icon: <ArrowLeftRight />, onSelect: () => openDialog({ type: 'transfer', fromAccountId: account.id }) },
    { label: 'Kontostand korrigieren', icon: <PencilLine />, onSelect: () => openDialog({ type: 'balance', accountId: account.id }) },
    { label: 'Bearbeiten', icon: <Pencil />, onSelect: () => openDialog({ type: 'account', accountId: account.id }) },
    'separator',
    { label: 'Löschen', icon: <Trash2 />, danger: true, onSelect: () => confirmDeleteAccount(account) },
  ];
}
