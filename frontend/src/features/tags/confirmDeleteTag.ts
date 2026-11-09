import type { Tag } from '../../domain/types';
import { deleteTag } from '../../store/actions';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';

export function confirmDeleteTag(tag: Tag) {
  const { data } = useDataStore.getState();
  const bookings = data.transactions.filter((t) => t.tagId === tag.id).length;
  const obligations = data.obligations.filter((o) => o.tagId === tag.id).length;
  const receivables = data.receivables.filter((r) => r.tagId === tag.id).length;
  const usage = [
    bookings > 0 ? (bookings === 1 ? '1 Buchung' : `${bookings} Buchungen`) : null,
    obligations > 0 ? (obligations === 1 ? '1 Zahlung' : `${obligations} Zahlungen`) : null,
    receivables > 0 ? (receivables === 1 ? '1 Eintrag unter „Bekomme ich noch“' : `${receivables} Einträgen unter „Bekomme ich noch“`) : null,
  ].filter((part): part is string => part !== null);
  const list = usage.length > 1 ? `${usage.slice(0, -1).join(', ')} und ${usage.at(-1)}` : usage[0];
  useUiStore.getState().openDialog({
    type: 'confirm',
    title: 'Tag löschen?',
    message:
      usage.length > 0
        ? `„${tag.name}“ wird von ${list} entfernt. Die Einträge selbst bleiben erhalten und zählen dann als „Ohne Tag“.`
        : `„${tag.name}“ wird gelöscht.`,
    confirmLabel: 'Tag löschen',
    danger: true,
    onConfirm: () => {
      deleteTag(tag.id);
      useUiStore.getState().notify(`Tag „${tag.name}“ gelöscht.`);
    },
  });
}
