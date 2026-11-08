import { ArrowDownUp, ArrowRight, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { todayISO } from '../../domain/dates';
import { computeBalances } from '../../domain/ledger';
import { formatMoney, parseMoney } from '../../domain/money';
import { Button, IconButton } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { errorMessage } from '../../components/ui/errorMessage';
import { Field, Select, TextInput } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { transfer } from '../../store/actions';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import '../../components/ui/Form.css';
import './TransferDialog.css';

interface Props {
  fromAccountId?: string;
  toAccountId?: string;
  onClose(): void;
}

interface Errors {
  accounts?: string;
  amount?: string;
  date?: string;
  general?: string;
}

export function TransferDialog({ fromAccountId, toAccountId, onClose }: Props) {
  const [{ accounts, balances, currency }] = useState(() => {
    const { data } = useDataStore.getState();
    return {
      accounts: data.accounts,
      balances: computeBalances(data.accounts, data.transactions),
      currency: data.settings.currency,
    };
  });
  const openDialog = useUiStore((s) => s.openDialog);
  const notify = useUiStore((s) => s.notify);

  const initialFrom = fromAccountId ?? accounts[0]?.id ?? '';
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(toAccountId ?? accounts.find((a) => a.id !== initialFrom)?.id ?? '');
  const [amountText, setAmountText] = useState('');
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const amount = parseMoney(amountText);
  const preview = useMemo(() => {
    if (!from || !to || from === to || amount === null || amount <= 0) return null;
    const fromAccount = accounts.find((a) => a.id === from);
    const toAccount = accounts.find((a) => a.id === to);
    if (!fromAccount || !toAccount) return null;
    const fromBefore = balances.get(from) ?? 0;
    const toBefore = balances.get(to) ?? 0;
    return [
      { account: fromAccount, before: fromBefore, after: fromBefore - amount },
      { account: toAccount, before: toBefore, after: toBefore + amount },
    ];
  }, [accounts, balances, from, to, amount]);

  if (accounts.length < 2) {
    return (
      <Modal title="Geld umbuchen" onClose={onClose}>
        <EmptyState
          compact
          icon={<ArrowDownUp />}
          title="Mindestens zwei Konten nötig"
          action={
            <Button variant="primary" onClick={() => openDialog({ type: 'account' })}>
              Konto anlegen
            </Button>
          }
        >
          Lege zuerst ein weiteres Konto an, dann kannst du Geld zwischen deinen Konten verschieben.
        </EmptyState>
      </Modal>
    );
  }

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const submit = () => {
    const next: Errors = {};
    if (!from || !to || from === to) next.accounts = 'Bitte zwei verschiedene Konten wählen.';
    if (amount === null || amount <= 0) next.amount = 'Bitte einen Betrag größer als 0 eingeben.';
    if (!date) next.date = 'Bitte ein Datum wählen.';
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    try {
      transfer({ fromAccountId: from, toAccountId: to, amount: amount!, date, note });
      const fromName = accounts.find((a) => a.id === from)?.name;
      const toName = accounts.find((a) => a.id === to)?.name;
      notify(`${formatMoney(amount!, currency)} von „${fromName}“ nach „${toName}“ umgebucht.`);
      onClose();
    } catch (error) {
      setErrors({ general: errorMessage(error) });
    }
  };

  return (
    <Modal
      title="Geld umbuchen"
      subtitle="Verschiebe Geld zwischen deinen Konten."
      onClose={onClose}
      onSubmit={submit}
      width={500}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="primary">
            Umbuchen
          </Button>
        </>
      }
    >
      <div className="transfer-accounts">
        <Field label="Von" htmlFor="transfer-from" error={errors.accounts}>
          <Select
            id="transfer-from"
            value={from}
            invalid={Boolean(errors.accounts)}
            onChange={(event) => {
              setFrom(event.target.value);
              setErrors((e) => ({ ...e, accounts: undefined }));
            }}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({formatMoney(balances.get(a.id) ?? 0, currency)})
              </option>
            ))}
          </Select>
        </Field>
        <IconButton label="Konten tauschen" icon={<ArrowDownUp />} className="transfer-accounts__swap" onClick={swap} />
        <Field label="Nach" htmlFor="transfer-to">
          <Select
            id="transfer-to"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setErrors((e) => ({ ...e, accounts: undefined }));
            }}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({formatMoney(balances.get(a.id) ?? 0, currency)})
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Betrag" htmlFor="transfer-amount" error={errors.amount}>
        <MoneyInput
          id="transfer-amount"
          value={amountText}
          large
          autoFocus
          invalid={Boolean(errors.amount)}
          onChange={(value) => {
            setAmountText(value);
            setErrors((e) => ({ ...e, amount: undefined }));
          }}
        />
      </Field>

      <div className="field-row">
        <Field label="Datum" htmlFor="transfer-date" error={errors.date}>
          <TextInput id="transfer-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <Field label="Notiz (optional)" htmlFor="transfer-note">
          <TextInput
            id="transfer-note"
            value={note}
            maxLength={120}
            placeholder="z. B. Geld abgehoben"
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </div>

      {preview && (
        <div className="preview" aria-live="polite">
          {preview.map(({ account, before, after }) => (
            <div key={account.id} className="preview__row">
              <span className="preview__name">{account.name}</span>
              <span className="preview__values">
                {formatMoney(before, currency)}
                <ArrowRight aria-hidden />
                <span className={after < 0 ? 'preview__new amount-negative' : 'preview__new'}>
                  {formatMoney(after, currency)}
                </span>
                {after < 0 && <TriangleAlert className="amount-negative" aria-label="Konto wird negativ" />}
              </span>
            </div>
          ))}
        </div>
      )}

      {errors.general && <p className="form-error">{errors.general}</p>}
    </Modal>
  );
}
