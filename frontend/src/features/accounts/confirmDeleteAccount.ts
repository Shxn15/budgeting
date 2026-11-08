import type { Account } from '../../domain/types';
import { deleteAccount } from '../../store/actions';
import { useUiStore } from '../../store/uiStore';

export function confirmDeleteAccount(account: Account) {
  const ui = useUiStore.getState();
  ui.openDialog({
    type: 'confirm',
    title: 'Konto löschen?',
    message: `„${account.name}“ wird mit seinen Buchungen gelöscht. Umbuchungen zu anderen Konten bleiben dort erhalten, damit deren Kontostand gleich bleibt.`,
    confirmLabel: 'Konto löschen',
    danger: true,
    onConfirm: () => {
      deleteAccount(account.id);
      useUiStore.getState().notify(`„${account.name}“ wurde gelöscht.`);
    },
  });
}
