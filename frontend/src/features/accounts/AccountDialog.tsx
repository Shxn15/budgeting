import { useState } from 'react';
import { nextAccountColor } from '../../domain/colors';
import { parseMoney } from '../../domain/money';
import type { AccountType } from '../../domain/types';
import { Button } from '../../components/ui/Button';
import { ColorSwatches } from '../../components/ui/ColorSwatches';
import { errorMessage } from '../../components/ui/errorMessage';
import { Field, TextInput } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { createAccount, updateAccount } from '../../store/actions';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { AccountTypePicker } from './AccountTypePicker';
import { guessAccountType } from './accountTypes';
import '../../components/ui/Form.css';

interface Errors {
  name?: string;
  balance?: string;
  general?: string;
}

export function AccountDialog({ accountId, onClose }: { accountId?: string; onClose(): void }) {
  // Snapshot: the dialog keeps showing the same data while it animates out.
  const [{ existing, suggestedColor }] = useState(() => {
    const accounts = useDataStore.getState().data.accounts;
    return {
      existing: accounts.find((a) => a.id === accountId) ?? null,
      suggestedColor: nextAccountColor(accounts),
    };
  });
  const notify = useUiStore((s) => s.notify);

  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<AccountType>(existing?.type ?? 'bank');
  const [typeChosen, setTypeChosen] = useState(existing !== null);
  const [color, setColor] = useState(existing?.color ?? suggestedColor);
  const [balanceText, setBalanceText] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const onNameChange = (value: string) => {
    setName(value);
    if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
    if (!typeChosen) {
      const guess = guessAccountType(value);
      if (guess) setType(guess);
    }
  };

  const submit = () => {
    const next: Errors = {};
    if (!name.trim()) next.name = 'Bitte gib dem Konto einen Namen.';
    let initialBalance = 0;
    if (!existing && balanceText.trim() !== '') {
      const parsed = parseMoney(balanceText);
      if (parsed === null) next.balance = 'Bitte einen gültigen Betrag eingeben, z. B. 250,00';
      else initialBalance = parsed;
    }
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    try {
      if (existing) {
        updateAccount(existing.id, { name, type, color });
        notify('Konto gespeichert.');
      } else {
        createAccount({ name, type, color, initialBalance });
        notify(`„${name.trim()}“ wurde angelegt.`);
      }
      onClose();
    } catch (error) {
      setErrors({ general: errorMessage(error) });
    }
  };

  return (
    <Modal
      title={existing ? 'Konto bearbeiten' : 'Neues Konto'}
      subtitle={existing ? existing.name : 'Zum Beispiel Bargeld, Sparkasse oder Revolut.'}
      onClose={onClose}
      onSubmit={submit}
      width={480}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="primary">
            {existing ? 'Speichern' : 'Konto anlegen'}
          </Button>
        </>
      }
    >
      <Field label="Name" htmlFor="account-name" error={errors.name}>
        <TextInput
          id="account-name"
          value={name}
          maxLength={40}
          autoComplete="off"
          placeholder="z. B. Sparkasse"
          invalid={Boolean(errors.name)}
          data-autofocus
          onChange={(event) => onNameChange(event.target.value)}
        />
      </Field>

      {!existing && (
        <Field
          label="Aktueller Kontostand"
          htmlFor="account-balance"
          error={errors.balance}
          hint="Leer lassen für 0 €. Mit Minus davor, wenn das Konto im Minus ist."
        >
          <MoneyInput
            id="account-balance"
            value={balanceText}
            large
            invalid={Boolean(errors.balance)}
            onChange={(value) => {
              setBalanceText(value);
              if (errors.balance) setErrors((e) => ({ ...e, balance: undefined }));
            }}
          />
        </Field>
      )}

      <Field label="Kontoart">
        <AccountTypePicker
          value={type}
          onChange={(value) => {
            setType(value);
            setTypeChosen(true);
          }}
        />
      </Field>

      <Field label="Farbe im Diagramm">
        <ColorSwatches value={color} onChange={setColor} />
      </Field>

      {errors.general && <p className="form-error">{errors.general}</p>}
    </Modal>
  );
}
