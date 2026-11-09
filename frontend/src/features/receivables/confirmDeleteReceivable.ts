import { isReceivableOpen, receivableName } from '../../domain/receivables';
import type { Receivable } from '../../domain/types';
import { deleteReceivable } from '../../store/actions';
import { useUiStore } from '../../store/uiStore';

export function confirmDeleteReceivable(r: Receivable) {
  const ui = useUiStore.getState();
  ui.openDialog({
    type: 'confirm',
    title: 'Eintrag löschen?',
    message: isReceivableOpen(r)
      ? `„${receivableName(r)}“ wird gelöscht.`
      : `„${receivableName(r)}“ wird gelöscht. Eine Buchung des erhaltenen Geldes bleibt in den Buchungen erhalten.`,
    confirmLabel: 'Löschen',
    danger: true,
    onConfirm: () => {
      deleteReceivable(r.id);
      useUiStore.getState().notify('Eintrag gelöscht.');
    },
  });
}
