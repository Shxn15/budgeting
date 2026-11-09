import { useState } from 'react';
import { addDays, diffDays, formatDate, isISODate, todayISO } from '../../domain/dates';
import { centsToInput, parseMoney } from '../../domain/money';
import type { ISODate } from '../../domain/types';
import { Button } from '../../components/ui/Button';
import { cx } from '../../components/ui/cx';
import { errorMessage } from '../../components/ui/errorMessage';
import { Field, Select, TextInput } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { addReceivable, updateReceivable } from '../../store/actions';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { TagPicker } from '../tags/TagPicker';
import '../../components/ui/Form.css';
import '../obligations/ObligationDialog.css';

interface Errors {
  who?: string;
  amount?: string;
  date?: string;
  general?: string;
}

const QUICK_DAYS = [
  { days: 1, label: 'Morgen' },
  { days: 7, label: '1 Woche' },
  { days: 14, label: '2 Wochen' },
  { days: 30, label: '1 Monat' },
];

/** "Jemand schuldet mir Geld" – with or without a date when it comes back. */
export function ReceivableDialog({ receivableId, onClose }: { receivableId?: string; onClose(): void }) {
  const [{ existing, accounts }] = useState(() => {
    const { data } = useDataStore.getState();
    return { existing: data.receivables.find((r) => r.id === receivableId) ?? null, accounts: data.accounts };
  });
  const notify = useUiStore((s) => s.notify);
  const today = todayISO();

  const [counterparty, setCounterparty] = useState(existing?.counterparty ?? '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [amountText, setAmountText] = useState(existing ? centsToInput(existing.amount) : '');
  // Often nobody knows when the money comes back – so "no date" is the default.
  const [hasDate, setHasDate] = useState(existing ? existing.expectedDate !== null : false);
  const [date, setDateValue] = useState<ISODate>(existing?.expectedDate ?? addDays(today, 7));
  const [daysText, setDaysText] = useState(() => String(diffDays(today, existing?.expectedDate ?? addDays(today, 7))));
  const [accountId, setAccountId] = useState(existing?.accountId ?? '');
  const [tagId, setTagId] = useState<string | null>(existing?.tagId ?? null);
  const [note, setNote] = useState(existing?.note ?? '');
  const [errors, setErrors] = useState<Errors>({});

  const setDate = (value: ISODate) => {
    setDateValue(value);
    setDaysText(String(diffDays(today, value)));
    setErrors((e) => ({ ...e, date: undefined }));
  };

  const onDaysChange = (value: string) => {
    setDaysText(value);
    const days = Number(value);
    if (value.trim() !== '' && Number.isInteger(days) && Math.abs(days) <= 3650) {
      setDateValue(addDays(today, days));
      setErrors((e) => ({ ...e, date: undefined }));
    }
  };

  const quickDays = hasDate && isISODate(date) ? diffDays(today, date) : null;

  const submit = () => {
    const next: Errors = {};
    if (!counterparty.trim() && !title.trim()) next.who = 'Bitte angeben, wer dir das Geld schuldet.';
    const amount = parseMoney(amountText);
    if (amount === null || amount <= 0) next.amount = 'Bitte einen Betrag größer als 0 eingeben.';
    if (hasDate && !isISODate(date)) next.date = 'Bitte ein gültiges Datum wählen.';
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    const input = {
      counterparty,
      title,
      amount: amount!,
      expectedDate: hasDate ? date : null,
      accountId: accountId || null,
      tagId,
      note,
    };
    try {
      if (existing) {
        updateReceivable(existing.id, input);
        notify('Eintrag gespeichert.');
      } else {
        addReceivable(input);
        notify('Eingetragen – du siehst es unter „Bekomme ich noch“.');
      }
      onClose();
    } catch (error) {
      setErrors({ general: errorMessage(error) });
    }
  };

  return (
    <Modal
      title={existing ? 'Eintrag bearbeiten' : 'Ich bekomme noch Geld'}
      subtitle={existing ? undefined : 'Zum Beispiel, wenn du jemandem etwas ausgelegt hast.'}
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
      <div className="field-row">
        <Field label="Von wem?" htmlFor="receivable-who" error={errors.who}>
          <TextInput
            id="receivable-who"
            value={counterparty}
            maxLength={80}
            placeholder="z. B. Max"
            invalid={Boolean(errors.who)}
            data-autofocus
            onChange={(event) => {
              setCounterparty(event.target.value);
              setErrors((e) => ({ ...e, who: undefined }));
            }}
          />
        </Field>
        <Field label="Wofür? (optional)" htmlFor="receivable-what">
          <TextInput
            id="receivable-what"
            value={title}
            maxLength={80}
            placeholder="z. B. Pizza, Konzertkarten"
            onChange={(event) => {
              setTitle(event.target.value);
              setErrors((e) => ({ ...e, who: undefined }));
            }}
          />
        </Field>
      </div>

      <Field label="Betrag" htmlFor="receivable-amount" error={errors.amount}>
        <MoneyInput
          id="receivable-amount"
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
        label="Wann bekommst du es?"
        error={errors.date}
        aside={
          <label className="due-toggle">
            <input type="checkbox" checked={!hasDate} onChange={(event) => setHasDate(!event.target.checked)} />
            Weiß ich nicht
          </label>
        }
      >
        <div className={cx('due-picker', !hasDate && 'is-disabled')}>
          <div className="due-picker__inputs">
            <TextInput
              aria-label="In wie vielen Tagen"
              className="due-picker__days"
              value={daysText}
              inputMode="numeric"
              disabled={!hasDate}
              suffix={Number(daysText) === 1 ? 'Tag' : 'Tagen'}
              onFocus={(event) => event.target.select()}
              onChange={(event) => onDaysChange(event.target.value.replace(/[^\d-]/g, ''))}
              leading="in"
            />
            <span className="due-picker__or">oder am</span>
            <TextInput
              aria-label="Datum"
              type="date"
              value={date}
              disabled={!hasDate}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>
          <div className="chips">
            {QUICK_DAYS.map((q) => (
              <button
                key={q.days}
                type="button"
                className={cx('chip', quickDays === q.days && 'is-active')}
                onClick={() => {
                  setHasDate(true);
                  setDate(addDays(today, q.days));
                }}
              >
                {q.label}
              </button>
            ))}
          </div>
          {hasDate && isISODate(date) && <p className="due-picker__summary">Erwartet am {formatDate(date)}</p>}
        </div>
      </Field>

      <Field label="Tag (optional)" htmlFor="receivable-tag" hint="z. B. die Person mit ihrem Profilbild.">
        <TagPicker id="receivable-tag" value={tagId} onChange={setTagId} />
      </Field>

      <div className="field-row">
        <Field label="Kommt auf (optional)" htmlFor="receivable-account">
          <Select id="receivable-account" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            <option value="">Noch offen</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Notiz (optional)" htmlFor="receivable-note">
          <TextInput
            id="receivable-note"
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
