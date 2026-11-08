import { ArrowRight, Minus, Plus, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { addDays, formatDate, isISODate, todayISO } from '../../domain/dates';
import { computeBalances } from '../../domain/ledger';
import { centsToInput, formatMoney, parseMoney } from '../../domain/money';
import type { BookingKind } from '../../domain/operations';
import type { Transaction } from '../../domain/types';
import { Button } from '../../components/ui/Button';
import { cx } from '../../components/ui/cx';
import { EmptyState } from '../../components/ui/EmptyState';
import { errorMessage } from '../../components/ui/errorMessage';
import { Field, Select, TextInput } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { addBooking, updateBooking } from '../../store/actions';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { TagPicker } from '../tags/TagPicker';
import '../../components/ui/Form.css';
import './BookingDialog.css';

interface Props {
  kind?: BookingKind;
  accountId?: string;
  /** Edit an existing income or expense booking. */
  transactionId?: string;
  tagId?: string;
  onClose(): void;
}

interface Errors {
  amount?: string;
  account?: string;
  date?: string;
  general?: string;
}

/** Effect of a booking on the balance of one account. */
function effect(t: Pick<Transaction, 'amount' | 'fromAccountId' | 'toAccountId' | 'affectsBalance'>, accountId: string): number {
  if (t.affectsBalance === false) return 0;
  return (t.toAccountId === accountId ? t.amount : 0) - (t.fromAccountId === accountId ? t.amount : 0);
}

/** "Geld hinzufügen" / "Geld entfernen" / "Zahlung eintragen" – also for past payments. */
export function BookingDialog({ kind: initialKind, accountId: initialAccount, transactionId, tagId: initialTag, onClose }: Props) {
  const [{ accounts, transactions, existing, currency }] = useState(() => {
    const { data } = useDataStore.getState();
    const tx = data.transactions.find((t) => t.id === transactionId) ?? null;
    return {
      accounts: data.accounts,
      transactions: data.transactions,
      existing: tx && (tx.kind === 'income' || tx.kind === 'expense') ? tx : null,
      currency: data.settings.currency,
    };
  });
  const notify = useUiStore((s) => s.notify);
  const openDialog = useUiStore((s) => s.openDialog);
  const today = todayISO();

  const existingAccount = existing ? (existing.kind === 'income' ? existing.toAccountId : existing.fromAccountId) : null;
  const [kind, setKind] = useState<BookingKind>((existing?.kind as BookingKind | undefined) ?? initialKind ?? 'expense');
  const [accountId, setAccountId] = useState(
    existingAccount ?? (initialAccount && accounts.some((a) => a.id === initialAccount) ? initialAccount : (accounts[0]?.id ?? '')),
  );
  const [amountText, setAmountText] = useState(existing ? centsToInput(existing.amount) : '');
  const [tagId, setTagId] = useState<string | null>(existing ? existing.tagId : (initialTag ?? null));
  const [date, setDate] = useState(existing?.date ?? today);
  const [note, setNote] = useState(existing?.note ?? '');
  const [affectsBalance, setAffectsBalance] = useState(existing ? existing.affectsBalance : true);
  const [errors, setErrors] = useState<Errors>({});

  const income = kind === 'income';
  const amount = parseMoney(amountText);
  const account = accounts.find((a) => a.id === accountId);

  const preview = useMemo(() => {
    if (!account) return null;
    const balances = computeBalances(accounts, transactions);
    const before = balances.get(account.id) ?? 0;
    const withoutOld = existing ? before - effect(existing, account.id) : before;
    const value = amount !== null && amount > 0 ? amount : 0;
    const after = withoutOld + (affectsBalance ? (income ? value : -value) : 0);
    return { before, after };
  }, [account, accounts, transactions, existing, amount, affectsBalance, income]);

  if (accounts.length === 0) {
    return (
      <Modal title={income ? 'Geld hinzufügen' : 'Zahlung eintragen'} onClose={onClose}>
        <EmptyState
          compact
          icon={income ? <Plus /> : <Minus />}
          title="Zuerst ein Konto anlegen"
          action={
            <Button variant="primary" onClick={() => openDialog({ type: 'account' })}>
              Konto anlegen
            </Button>
          }
        >
          Zahlungen und Einnahmen werden immer einem Konto zugeordnet.
        </EmptyState>
      </Modal>
    );
  }

  const fromAccountContext = Boolean(initialAccount) && !existing;
  const title = existing
    ? 'Buchung bearbeiten'
    : income
      ? fromAccountContext
        ? 'Geld hinzufügen'
        : 'Einnahme eintragen'
      : fromAccountContext
        ? 'Geld entfernen'
        : 'Zahlung eintragen';

  const submit = () => {
    const next: Errors = {};
    if (amount === null || amount <= 0) next.amount = 'Bitte einen Betrag größer als 0 eingeben.';
    if (!account) next.account = 'Bitte ein Konto wählen.';
    if (!isISODate(date)) next.date = 'Bitte ein gültiges Datum wählen.';
    else if (date > today) next.date = 'Das Datum darf nicht in der Zukunft liegen.';
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    const input = { kind, accountId, amount: amount!, date, tagId, note, affectsBalance };
    try {
      if (existing) {
        updateBooking(existing.id, input);
        notify('Buchung gespeichert.');
      } else {
        addBooking(input);
        const money = formatMoney(amount!, currency);
        notify(
          !affectsBalance
            ? `${money} für die Statistik eingetragen.`
            : income
              ? `${money} zu „${account!.name}“ hinzugefügt.`
              : `${money} von „${account!.name}“ abgezogen.`,
        );
      }
      onClose();
    } catch (error) {
      setErrors({ general: errorMessage(error) });
    }
  };

  const quickDates = [
    { label: 'Heute', date: today },
    { label: 'Gestern', date: addDays(today, -1) },
    { label: 'Vorgestern', date: addDays(today, -2) },
  ];

  return (
    <Modal
      title={title}
      subtitle={
        income
          ? 'Zum Beispiel Gehalt, Taschengeld oder eine Rückzahlung.'
          : 'Zum Beispiel ein Einkauf bei Rewe – auch nachträglich für vergangene Tage.'
      }
      onClose={onClose}
      onSubmit={submit}
      width={520}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="primary" icon={existing ? undefined : income ? <Plus /> : <Minus />}>
            {existing ? 'Speichern' : income ? 'Hinzufügen' : 'Eintragen'}
          </Button>
        </>
      }
    >
      <SegmentedControl<BookingKind>
        label="Art"
        fullWidth
        value={kind}
        onChange={(value) => {
          setKind(value);
          setErrors({});
        }}
        options={[
          { value: 'expense', label: 'Ausgabe', icon: <Minus /> },
          { value: 'income', label: 'Einnahme', icon: <Plus /> },
        ]}
      />

      <Field label="Betrag" htmlFor="booking-amount" error={errors.amount}>
        <MoneyInput
          id="booking-amount"
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

      <Field
        label={income ? 'Tag (optional)' : 'Wo oder wofür? (Tag, optional)'}
        htmlFor="booking-tag"
        hint={
          income
            ? 'z. B. Gehalt oder Taschengeld.'
            : 'z. B. Rewe, Rossmann oder PayPal – unter „Ausgaben“ siehst du dann, wie viel du dort ausgibst.'
        }
      >
        <TagPicker id="booking-tag" value={tagId} onChange={setTagId} />
      </Field>

      <div className="field-row">
        <Field label={income ? 'Auf Konto' : 'Von Konto'} htmlFor="booking-account" error={errors.account}>
          <Select
            id="booking-account"
            value={accountId}
            invalid={Boolean(errors.account)}
            onChange={(event) => {
              setAccountId(event.target.value);
              setErrors((e) => ({ ...e, account: undefined }));
            }}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Datum" htmlFor="booking-date" error={errors.date}>
          <TextInput
            id="booking-date"
            type="date"
            value={date}
            max={today}
            invalid={Boolean(errors.date)}
            onChange={(event) => {
              setDate(event.target.value);
              setErrors((e) => ({ ...e, date: undefined }));
            }}
          />
        </Field>
      </div>
      <div className="chips booking__dates">
        {quickDates.map((q) => (
          <button key={q.label} type="button" className={cx('chip', date === q.date && 'is-active')} onClick={() => setDate(q.date)}>
            {q.label}
          </button>
        ))}
        {isISODate(date) && date < addDays(today, -2) && <span className="booking__date-note">{formatDate(date)}</span>}
      </div>

      <Field label="Notiz (optional)" htmlFor="booking-note">
        <TextInput
          id="booking-note"
          value={note}
          maxLength={200}
          placeholder={income ? 'z. B. November' : 'z. B. Wocheneinkauf'}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>

      <div className="booking__balance">
        <label className="booking__toggle">
          <input type="checkbox" checked={affectsBalance} onChange={(event) => setAffectsBalance(event.target.checked)} />
          <span>
            <span className="booking__toggle-title">{income ? 'Zum Kontostand hinzufügen' : 'Vom Kontostand abziehen'}</span>
            <span className="booking__toggle-text">
              Ausschalten, wenn der Betrag schon im Kontostand enthalten ist – dann zählt er nur für die Statistik.
            </span>
          </span>
        </label>
        {account && preview && (
          <div className="preview">
            <div className="preview__row">
              <span className="preview__name">{account.name}</span>
              <span className="preview__values">
                {preview.after === preview.before ? (
                  <span className="preview__new">bleibt {formatMoney(preview.before, currency)}</span>
                ) : (
                  <>
                    {formatMoney(preview.before, currency)}
                    <ArrowRight aria-hidden />
                    <span className={cx('preview__new', preview.after < 0 && 'amount-negative')}>
                      {formatMoney(preview.after, currency)}
                    </span>
                    {preview.after < 0 && <TriangleAlert className="amount-negative" aria-label="Konto wird negativ" />}
                  </>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {errors.general && <p className="form-error">{errors.general}</p>}
    </Modal>
  );
}
