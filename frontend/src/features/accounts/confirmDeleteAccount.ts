import type { Account } from '../../domain/types';
import { deleteAccount } from '../../store/actions';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';

export function confirmDeleteAccount(account: Account) {
  const ui = useUiStore.getState();
  const autoSubs = useDataStore.getState().data.subscriptions.filter((s) => s.accountId === account.id && s.autoPay).length;
  const subsNote =
    autoSubs === 0
      ? ''
      : autoSubs === 1
        ? ' 1 Abo wird danach nicht mehr automatisch abgebucht.'
        : ` ${autoSubs} Abos werden danach nicht mehr automatisch abgebucht.`;
  ui.openDialog({
    type: 'confirm',
    title: 'Konto löschen?',
    message: `„${account.name}“ wird mit seinen Buchungen gelöscht – sie fehlen dann auch in der Ausgaben-Statistik. Umbuchungen zu anderen Konten bleiben dort erhalten, damit deren Kontostand gleich bleibt.${subsNote}`,
    confirmLabel: 'Konto löschen',
    danger: true,
    onConfirm: () => {
      deleteAccount(account.id);
      useUiStore.getState().notify(`„${account.name}“ wurde gelöscht.`);
    },
  });
}
