import { useState } from 'react';
import { nextAccountColor } from '../../domain/colors';
import { ProfileFields } from '../../components/avatar/ProfileFields';
import { Button } from '../../components/ui/Button';
import { ColorSwatches } from '../../components/ui/ColorSwatches';
import { errorMessage } from '../../components/ui/errorMessage';
import { Field } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { addTag, updateTag } from '../../store/actions';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { confirmDeleteTag } from './confirmDeleteTag';
import '../../components/ui/Form.css';
import '../subscriptions/SubscriptionDialog.css';

/** Create or edit a tag such as "Rewe" or "PayPal", with its own profile picture. */
export function TagDialog({ tagId, onClose }: { tagId?: string; onClose(): void }) {
  const [{ existing, suggestedColor }] = useState(() => {
    const { tags } = useDataStore.getState().data;
    return { existing: tags.find((t) => t.id === tagId) ?? null, suggestedColor: nextAccountColor(tags) };
  });
  const notify = useUiStore((s) => s.notify);
  const [name, setName] = useState(existing?.name ?? '');
  const [image, setImage] = useState<string | null>(existing?.image ?? null);
  const [color, setColor] = useState(existing?.color ?? suggestedColor);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim()) {
      setError('Bitte gib dem Tag einen Namen.');
      return;
    }
    try {
      if (existing) {
        updateTag(existing.id, { name, color, image });
        notify('Tag gespeichert.');
      } else {
        addTag({ name, color, image });
        notify(`Tag „${name.trim()}“ erstellt.`);
      }
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Modal
      title={existing ? 'Tag bearbeiten' : 'Neuer Tag'}
      subtitle={existing ? existing.name : 'Zum Beispiel ein Geschäft wie Rewe, ein Dienst wie PayPal oder eine Person.'}
      onClose={onClose}
      onSubmit={submit}
      width={480}
      footer={
        <>
          {existing && (
            <>
              <Button
                variant="ghost"
                className="dialog-delete"
                onClick={() => {
                  onClose();
                  confirmDeleteTag(existing);
                }}
              >
                Löschen
              </Button>
              <span className="modal__footer-spacer" />
            </>
          )}
          <Button onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="primary">
            {existing ? 'Speichern' : 'Tag erstellen'}
          </Button>
        </>
      }
    >
      <ProfileFields
        id="tag-name"
        label="Name"
        name={name}
        onNameChange={(value) => {
          setName(value);
          setError(null);
        }}
        image={image}
        onImageChange={setImage}
        color={color}
        placeholder="z. B. Rewe"
        error={error}
        hint="Das Bild wird rund angezeigt – bei Zahlungen und in deinen Ausgaben."
        autoFocus
      />
      {!image && (
        <Field label="Farbe (ohne Bild)">
          <ColorSwatches value={color} onChange={setColor} size="sm" />
        </Field>
      )}
    </Modal>
  );
}
