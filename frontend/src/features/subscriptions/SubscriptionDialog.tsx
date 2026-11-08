import { CalendarClock, Zap } from 'lucide-react';
import { useState } from 'react';
import { nextAccountColor } from '../../domain/colors';
import { addMonths, diffDays, formatDate, isISODate, relativeDays, todayISO } from '../../domain/dates';
import { centsToInput, formatMoney, parseMoney } from '../../domain/money';
import { INTERVAL_PRESETS, intervalLabel, monthlyCost, nextOccurrenceAfter } from '../../domain/subscriptions';
import type { IntervalUnit } from '../../domain/types';
import { ProfileFields } from '../../components/avatar/ProfileFields';
import { Button } from '../../components/ui/Button';
import { ColorSwatches } from '../../components/ui/ColorSwatches';
import { errorMessage } from '../../components/ui/errorMessage';
import { Field, Select, TextInput } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { addSubscription, updateSubscription } from '../../store/actions';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { confirmDeleteSubscription } from './confirmDeleteSubscription';
import '../../components/ui/Form.css';
import './SubscriptionDialog.css';

interface Errors {
  name?: string;
  amount?: string;
  date?: string;
  general?: string;
}

const intervalKey = (unit: IntervalUnit, count: number) => `${unit}:${count}`;

export function SubscriptionDialog({ subscriptionId, onClose }: { subscriptionId?: string; onClose(): void }) {
  const [{ existing, accounts, suggestedColor, currency }] = useState(() => {
    const { data } = useDataStore.getState();
    return {
      existing: data.subscriptions.find((s) => s.id === subscriptionId) ?? null,
      accounts: data.accounts,
      suggestedColor: nextAccountColor(data.subscriptions),
      currency: data.settings.currency,
    };
  });
  const notify = useUiStore((s) => s.notify);
  const today = todayISO();

  const [name, setName] = useState(existing?.name ?? '');
  const [image, setImage] = useState<string | null>(existing?.image ?? null);
  const [color, setColor] = useState(existing?.color ?? suggestedColor);
  const [amountText, setAmountText] = useState(existing ? centsToInput(existing.amount) : '');
  const [interval, setIntervalValue] = useState(intervalKey(existing?.intervalUnit ?? 'month', existing?.intervalCount ?? 1));
  const [nextDueDate, setNextDueDate] = useState(existing?.nextDueDate ?? addMonths(today, 1));
  const [accountId, setAccountId] = useState(
    existing ? (existing.accountId ?? '') : (accounts.find((a) => a.type === 'bank')?.id ?? accounts[0]?.id ?? ''),
  );
  const [autoPay, setAutoPay] = useState(existing ? existing.autoPay : true);
  const [note, setNote] = useState(existing?.note ?? '');
  const [errors, setErrors] = useState<Errors>({});

  const [unit, countText] = interval.split(':') as [IntervalUnit, string];
  const count = Number(countText);
  const presets = INTERVAL_PRESETS.some((p) => intervalKey(p.unit, p.count) === interval)
    ? INTERVAL_PRESETS
    : [...INTERVAL_PRESETS, { unit, count, label: intervalLabel(unit, count) }];

  const amount = parseMoney(amountText);
  const hasAccount = accountId !== '';
  const effectiveAutoPay = autoPay && hasAccount;
  const validDate = isISODate(nextDueDate);
  const following = validDate ? nextOccurrenceAfter({ anchorDate: nextDueDate, intervalUnit: unit, intervalCount: count }, nextDueDate) : null;
  const days = validDate ? diffDays(today, nextDueDate) : null;

  const submit = () => {
    const next: Errors = {};
    if (!name.trim()) next.name = 'Bitte gib dem Abo einen Namen, z. B. Netflix.';
    if (amount === null || amount <= 0) next.amount = 'Bitte einen Betrag größer als 0 eingeben.';
    if (!validDate) next.date = 'Bitte ein gültiges Datum wählen.';
    else if (effectiveAutoPay && nextDueDate < today) {
      next.date = 'Bei automatischer Abbuchung muss das Datum heute oder später sein.';
    }
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    const input = {
      name,
      amount: amount!,
      intervalUnit: unit,
      intervalCount: count,
      nextDueDate,
      accountId: accountId || null,
      autoPay: effectiveAutoPay,
      color,
      image,
      note,
    };
    try {
      if (existing) {
        updateSubscription(existing.id, input);
        notify('Abo gespeichert.');
      } else {
        addSubscription(input);
        notify(`„${name.trim()}“ wurde hinzugefügt.`);
      }
      onClose();
    } catch (error) {
      setErrors({ general: errorMessage(error) });
    }
  };

  const perMonth =
    amount !== null && amount > 0 && !(unit === 'month' && count === 1)
      ? monthlyCost({ amount, intervalUnit: unit, intervalCount: count })
      : null;

  return (
    <Modal
      title={existing ? 'Abo bearbeiten' : 'Neues Abo'}
      subtitle={existing ? existing.name : 'Zum Beispiel Netflix, Spotify, Handyvertrag oder Fitnessstudio.'}
      onClose={onClose}
      onSubmit={submit}
      width={540}
      footer={
        <>
          {existing && (
            <>
              <Button
                variant="ghost"
                className="dialog-delete"
                onClick={() => {
                  onClose();
                  confirmDeleteSubscription(existing);
                }}
              >
                Löschen
              </Button>
              <span className="modal__footer-spacer" />
            </>
          )}
          <Button onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="primary">
            {existing ? 'Speichern' : 'Abo hinzufügen'}
          </Button>
        </>
      }
    >
      <ProfileFields
        id="subscription-name"
        label="Name"
        name={name}
        onNameChange={(value) => {
          setName(value);
          setErrors((e) => ({ ...e, name: undefined }));
        }}
        image={image}
        onImageChange={setImage}
        color={color}
        placeholder="z. B. Netflix"
        error={errors.name}
        autoFocus
      />

      {!image && (
        <Field label="Farbe (ohne Bild)">
          <ColorSwatches value={color} onChange={setColor} size="sm" />
        </Field>
      )}

      <div className="field-row">
        <Field
          label="Betrag"
          htmlFor="subscription-amount"
          error={errors.amount}
          hint={perMonth !== null ? `≈ ${formatMoney(Math.round(perMonth), currency)} pro Monat` : undefined}
        >
          <MoneyInput
            id="subscription-amount"
            value={amountText}
            invalid={Boolean(errors.amount)}
            onChange={(value) => {
              setAmountText(value);
              setErrors((e) => ({ ...e, amount: undefined }));
            }}
          />
        </Field>
        <Field label="Wie oft?" htmlFor="subscription-interval">
          <Select id="subscription-interval" value={interval} onChange={(event) => setIntervalValue(event.target.value)}>
            {presets.map((p) => (
              <option key={intervalKey(p.unit, p.count)} value={intervalKey(p.unit, p.count)}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Nächste Abbuchung"
        htmlFor="subscription-date"
        error={errors.date}
        hint={
          validDate && days !== null && following ? (
            <span className="subscription-dialog__schedule">
              <CalendarClock aria-hidden />
              {days === 0 ? 'heute' : days < 0 ? `vor ${-days} Tagen` : relativeDays(days)}, danach am {formatDate(following)}
            </span>
          ) : undefined
        }
      >
        <TextInput
          id="subscription-date"
          type="date"
          value={nextDueDate}
          invalid={Boolean(errors.date)}
          onChange={(event) => {
            setNextDueDate(event.target.value);
            setErrors((e) => ({ ...e, date: undefined }));
          }}
        />
      </Field>

      <Field label="Konto" htmlFor="subscription-account">
        <Select id="subscription-account" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          <option value="">Kein Konto</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>

      <label className={`subscription-dialog__auto${hasAccount ? '' : ' is-disabled'}`}>
        <input
          type="checkbox"
          checked={effectiveAutoPay}
          disabled={!hasAccount}
          onChange={(event) => setAutoPay(event.target.checked)}
        />
        <span>
          <span className="subscription-dialog__auto-title">
            <Zap aria-hidden /> Automatisch abbuchen
          </span>
          <span className="subscription-dialog__auto-text">
            {!hasAccount
              ? 'Wähle ein Konto, damit das Abo automatisch abgebucht werden kann.'
              : effectiveAutoPay
                ? 'Am Fälligkeitstag wird der Betrag von selbst vom Konto abgezogen – so stimmt dein Kontostand immer.'
                : 'Das Abo erscheint bei den anstehenden Zahlungen und du markierst es selbst als bezahlt.'}
          </span>
        </span>
      </label>

      <Field label="Notiz (optional)" htmlFor="subscription-note">
        <TextInput
          id="subscription-note"
          value={note}
          maxLength={200}
          placeholder="z. B. kündbar bis 31.12."
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>

      {errors.general && <p className="form-error">{errors.general}</p>}
    </Modal>
  );
}
