import { useState } from 'react';
import { computeBalances } from '../../domain/ledger';
import { centsToInput, formatMoney, parseMoney } from '../../domain/money';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { errorMessage } from '../../components/ui/errorMessage';
import { Field, TextInput } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { setAccountBalance } from '../../store/actions';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import '../../components/ui/Form.css';

export function BalanceDialog({ accountId, onClose }: { accountId: string; onClose(): void }) {
  const [{ account, current, currency }] = useState(() => {
    const { data } = useDataStore.getState();
    return {
      account: data.accounts.find((a) => a.id === accountId) ?? null,
      current: computeBalances(data.accounts, data.transactions).get(accountId) ?? 0,
      currency: data.settings.currency,
    };
  });
  const notify = useUiStore((s) => s.notify);
  const [text, setText] = useState(centsToInput(current));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!account) return null;

  const parsed = parseMoney(text);
  const diff = parsed === null ? null : parsed - current;

  const submit = () => {
    if (parsed === null) {
      setError('Bitte einen gültigen Betrag eingeben, z. B. 250,00');
      return;
    }
    try {
      if (diff !== 0) {
        setAccountBalance(account.id, parsed, note);
        notify(`Kontostand von „${account.name}“ aktualisiert.`);
      }
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <Modal
      title="Kontostand ändern"
      subtitle={`${account.name} · bisher ${formatMoney(current, currency)}`}
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="primary">
            Übernehmen
          </Button>
        </>
      }
    >
      <Field
        label="Neuer Kontostand"
        htmlFor="balance-value"
        error={error}
        aside={
          diff !== null && (
            <Badge tone={diff === 0 ? 'neutral' : diff > 0 ? 'success' : 'danger'}>
              {diff === 0 ? 'keine Änderung' : formatMoney(diff, currency, { sign: true })}
            </Badge>
          )
        }
      >
        <MoneyInput
          id="balance-value"
          value={text}
          large
          autoFocus
          invalid={Boolean(error)}
          onChange={(value) => {
            setText(value);
            setError(null);
          }}
        />
      </Field>
      <Field label="Notiz (optional)" htmlFor="balance-note" hint="Die Differenz wird als Korrektur-Buchung gespeichert.">
        <TextInput
          id="balance-note"
          value={note}
          maxLength={120}
          placeholder="z. B. Einkäufe, Zinsen, Kontoauszug"
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
    </Modal>
  );
}
