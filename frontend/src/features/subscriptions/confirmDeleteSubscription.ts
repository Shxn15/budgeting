import type { Subscription } from '../../domain/types';
import { deleteSubscription } from '../../store/actions';
import { useUiStore } from '../../store/uiStore';

export function confirmDeleteSubscription(subscription: Subscription) {
  useUiStore.getState().openDialog({
    type: 'confirm',
    title: 'Abo löschen?',
    message: `„${subscription.name}“ wird gelöscht. Bisherige Abbuchungen bleiben in den Buchungen erhalten. Tipp: Wenn du es nur gekündigt hast oder kurz aussetzt, kannst du es auch pausieren.`,
    confirmLabel: 'Abo löschen',
    danger: true,
    onConfirm: () => {
      deleteSubscription(subscription.id);
      useUiStore.getState().notify(`„${subscription.name}“ wurde gelöscht.`);
    },
  });
}
