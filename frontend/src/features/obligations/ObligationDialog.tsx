import { useState } from 'react';
import { addDays, diffDays, formatDate, isISODate, todayISO } from '../../domain/dates';
import { centsToInput, parseMoney } from '../../domain/money';
import type { ISODate, ObligationKind } from '../../domain/types';
import { Button } from '../../components/ui/Button';
import { cx } from '../../components/ui/cx';
import { errorMessage } from '../../components/ui/errorMessage';
import { Field, Select, TextInput } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { addObligation, updateObligation } from '../../store/actions';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { OBLIGATION_KINDS } from './obligationUi';
import '../../components/ui/Form.css';
import './ObligationDialog.css';

interface Props {
  obligationId?: string;
  kind?: ObligationKind;
  onClose(): void;
}

interface Errors {
  who?: string;
  amount?: string;
  due?: string;
  general?: string;
}

const QUICK_DAYS = [
  { days: 1, label: 'Morgen' },
  { days: 7, label: '1 Woche' },
  { days: 14, label: '2 Wochen' },
  { days: 30, label: '1 Monat' },
];

export function ObligationDialog({ obligationId, kind: initialKind, onClose }: Props) {
  const [{ existing, accounts }] = useState(() => {
    const { data } = useDataStore.getState();
    return { existing: data.obligations.find((o) => o.id === obligationId) ?? null, accounts: data.accounts };
  });
  const notify = useUiStore((s) => s.notify);
  const today = todayISO();

  const [kind, setKind] = useState<ObligationKind>(existing?.kind ?? initialKind ?? 'bill');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [counterparty, setCounterparty] = useState(existing?.counterparty ?? '');
  const [amountText, setAmountText] = useState(existing ? centsToInput(existing.amount) : '');
  const [hasDue, setHasDue] = useState(existing ? existing.dueDate !== null : true);
  const [dueDate, setDueDate] = useState<ISODate>(existing?.dueDate ?? addDays(today, 7));
  const [daysText, setDaysText] = useState(() => String(diffDays(today, existing?.dueDate ?? addDays(today, 7))));
  const [accountId, setAccountId] = useState(existing?.accountId ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [errors, setErrors] = useState<Errors>({});

  const setDue = (date: ISODate) => {
    setDueDate(date);
    setDaysText(String(diffDays(today, date)));
    setErrors((e) => ({ ...e, due: undefined }));
  };

  const onDaysChange = (value: string) => {
    setDaysText(value);
    const days = Number(value);
    if (value.trim() !== '' && Number.isInteger(days) && Math.abs(days) <= 3650) {
      setDueDate(addDays(today, days));
      setErrors((e) => ({ ...e, due: undefined }));
    }
  };

  const isDebt = kind === 'debt';
  const quickDays = hasDue && isISODate(dueDate) ? diffDays(today, dueDate) : null;

  const submit = () => {
    const next: Errors = {};
    if (!title.trim() && !counterparty.trim()) {
      next.who = isDebt ? 'Bitte angeben, wem du das Geld schuldest.' : 'Bitte angeben, wofür die Zahlung ist.';
    }
    const amount = parseMoney(amountText);
    if (amount === null || amount <= 0) next.amount = 'Bitte einen Betrag größer als 0 eingeben.';
    if (hasDue && !isISODate(dueDate)) next.due = 'Bitte ein gültiges Datum wählen.';
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    const input = {
      kind,
      title,
      counterparty,
      amount: amount!,
      dueDate: hasDue ? dueDate : null,
      accountId: accountId || null,
      note,
    };
    try {
      if (existing) {
        updateObligation(existing.id, input);
        notify('Eintrag gespeichert.');
      } else {
        addObligation(input);
        notify(isDebt ? 'Schulden eingetragen.' : 'Zahlung eingetragen.');
      }
      onClose();
    } catch (error) {
      setErrors({ general: errorMessage(error) });
    }
  };

  const whoField = (
    <Field label={isDebt ? 'Wem schuldest du Geld?' : 'An wen? (optional)'} htmlFor="obligation-who" error={isDebt ? errors.who : undefined}>
      <TextInput
        id="obligation-who"
        value={counterparty}
        maxLength={80}
        placeholder={isDebt ? 'z. B. Max' : 'z. B. Vermieter, Telekom'}
        invalid={isDebt && Boolean(errors.who)}
        data-autofocus={isDebt || undefined}
        onChange={(event) => {
          setCounterparty(event.target.value);
          setErrors((e) => ({ ...e, who: undefined }));
        }}
      />
    </Field>
  );

  const whatField = (
    <Field label={isDebt ? 'Wofür? (optional)' : 'Wofür?'} htmlFor="obligation-what" error={isDebt ? undefined : errors.who}>
      <TextInput
        id="obligation-what"
        value={title}
        maxLength={80}
        placeholder={isDebt ? 'z. B. Konzertkarten' : 'z. B. Miete, Handyrechnung'}
        invalid={!isDebt && Boolean(errors.who)}
        data-autofocus={!isDebt || undefined}
        onChange={(event) => {
          setTitle(event.target.value);
          setErrors((e) => ({ ...e, who: undefined }));
        }}
      />
    </Field>
  );

  return (
    <Modal
      title={existing ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}
      subtitle={existing ? undefined : 'Schulden oder eine Zahlung, die bald ansteht.'}
      onClose={onClose}
      onSubmit={submit}
      width={520}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="primary">
            {existing ? 'Speichern' : 'Eintragen'}
          </Button>
        </>
      }
    >
      <SegmentedControl
        label="Art"
        fullWidth
        value={kind}
        onChange={(value) => {
          setKind(value);
          setErrors({});
        }}
        options={(['bill', 'debt'] as const).map((value) => {
          const info = OBLIGATION_KINDS[value];
          const Icon = info.icon;
          return { value, label: info.label, icon: <Icon /> };
        })}
      />

      {isDebt ? whoField : whatField}
      {isDebt ? whatField : whoField}

      <Field label="Betrag" htmlFor="obligation-amount" error={errors.amount}>
        <MoneyInput
          id="obligation-amount"
          value={amountText}
          large
          invalid={Boolean(errors.amount)}
          onChange={(value) => {
            setAmountText(value);
            setErrors((e) => ({ ...e, amount: undefined }));
          }}
        />
      </Field>

      <Field
        label="Fällig"
        error={errors.due}
        aside={
          <label className="due-toggle">
            <input type="checkbox" checked={!hasDue} onChange={(event) => setHasDue(!event.target.checked)} />
            Kein Datum
          </label>
        }
      >
        <div className={cx('due-picker', !hasDue && 'is-disabled')}>
          <div className="due-picker__inputs">
            <TextInput
              aria-label="In wie vielen Tagen"
              className="due-picker__days"
              value={daysText}
              inputMode="numeric"
              disabled={!hasDue}
              suffix={Number(daysText) === 1 ? 'Tag' : 'Tagen'}
              onFocus={(event) => event.target.select()}
              onChange={(event) => onDaysChange(event.target.value.replace(/[^\d-]/g, ''))}
              leading="in"
            />
            <span className="due-picker__or">oder am</span>
            <TextInput
              aria-label="Fälligkeitsdatum"
              type="date"
              value={dueDate}
              disabled={!hasDue}
              onChange={(event) => setDue(event.target.value)}
            />
          </div>
          <div className="chips">
            {QUICK_DAYS.map((q) => (
              <button
                key={q.days}
                type="button"
                className={cx('chip', quickDays === q.days && 'is-active')}
                disabled={!hasDue}
                onClick={() => setDue(addDays(today, q.days))}
              >
                {q.label}
              </button>
            ))}
          </div>
          {hasDue && isISODate(dueDate) && <p className="due-picker__summary">Fällig am {formatDate(dueDate)}</p>}
        </div>
      </Field>

      <div className="field-row">
        <Field label="Bezahlen von (optional)" htmlFor="obligation-account">
          <Select id="obligation-account" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            <option value="">Noch offen</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notiz (optional)" htmlFor="obligation-note">
          <TextInput
            id="obligation-note"
            value={note}
            maxLength={200}
            placeholder="z. B. per PayPal"
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </div>

      {errors.general && <p className="form-error">{errors.general}</p>}
    </Modal>
  );
}
