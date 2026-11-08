import { ArrowRight, TriangleAlert } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { formatDate, todayISO } from '../../domain/dates';
import { computeBalances } from '../../domain/ledger';
import { formatMoney } from '../../domain/money';
import { followingDueDate } from '../../domain/subscriptions';
import { Button } from '../../components/ui/Button';
import { cx } from '../../components/ui/cx';
import { errorMessage } from '../../components/ui/errorMessage';
import { Select, TextInput } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { paySubscription, skipSubscriptionCharge } from '../../store/actions';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import '../../components/ui/Form.css';

type Mode = 'account' | 'skip';

/** Marks the current charge of a manual subscription as paid (or skips it). */
export function PaySubscriptionDialog({ subscriptionId, onClose }: { subscriptionId: string; onClose(): void }) {
  const [{ subscription, accounts, balances, currency }] = useState(() => {
    const { data } = useDataStore.getState();
    return {
      subscription: data.subscriptions.find((s) => s.id === subscriptionId) ?? null,
      accounts: data.accounts,
      balances: computeBalances(data.accounts, data.transactions),
      currency: data.settings.currency,
    };
  });
  const notify = useUiStore((s) => s.notify);
  const [mode, setMode] = useState<Mode>(accounts.length > 0 ? 'account' : 'skip');
  const [accountId, setAccountId] = useState(
    subscription?.accountId && accounts.some((a) => a.id === subscription.accountId)
      ? subscription.accountId
      : (accounts[0]?.id ?? ''),
  );
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);

  if (!subscription) return null;

  const account = accounts.find((a) => a.id === accountId);
  const before = balances.get(accountId) ?? 0;
  const after = before - subscription.amount;
  const next = formatDate(followingDueDate(subscription));

  const submit = () => {
    try {
      if (mode === 'account') {
        paySubscription(subscription.id, { accountId, date });
        notify(`Bezahlt – ${formatMoney(subscription.amount, currency)} von „${account?.name}“ abgebucht. Nächste Zahlung am ${next}.`);
      } else {
        skipSubscriptionCharge(subscription.id);
        notify(`Übersprungen. Nächste Zahlung am ${next}.`, 'info');
      }
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const choice = (value: Mode, disabled = false) => ({
    role: 'radio' as const,
    'aria-checked': mode === value,
    'aria-disabled': disabled || undefined,
    tabIndex: 0,
    className: cx('choice', mode === value && 'is-active'),
    onClick: () => !disabled && setMode(value),
    onKeyDown: (event: KeyboardEvent) => {
      if ((event.key === ' ' || event.key === 'Enter') && !disabled) {
        event.preventDefault();
        setMode(value);
      }
    },
  });

  return (
    <Modal
      title="Abo bezahlt?"
      subtitle={`${subscription.name} · ${formatMoney(subscription.amount, currency)} · fällig am ${formatDate(subscription.nextDueDate)}`}
      onClose={onClose}
      onSubmit={submit}
      width={480}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="primary">
            {mode === 'account' ? 'Bezahlt' : 'Überspringen'}
          </Button>
        </>
      }
    >
      <div className="choice-list" role="radiogroup" aria-label="Wie wurde bezahlt?">
        <div {...choice('account', accounts.length === 0)}>
          <span className="choice__radio" />
          <span className="choice__body">
            <span className="choice__title">Von einem Konto bezahlt</span>
            <span className="choice__text">
              {accounts.length > 0 ? 'Der Betrag wird vom Konto abgezogen.' : 'Lege zuerst ein Konto an.'}
            </span>
            {mode === 'account' && accounts.length > 0 && (
              <span className="choice__extra" onClick={(event) => event.stopPropagation()}>
                <span className="field-row">
                  <Select aria-label="Konto" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                  <TextInput aria-label="Datum" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                </span>
                {account && (
                  <span className="preview" style={{ marginTop: 10 }}>
                    <span className="preview__row">
                      <span className="preview__name">{account.name}</span>
                      <span className="preview__values">
                        {formatMoney(before, currency)}
                        <ArrowRight aria-hidden />
                        <span className={cx('preview__new', after < 0 && 'amount-negative')}>{formatMoney(after, currency)}</span>
                        {after < 0 && <TriangleAlert className="amount-negative" aria-label="Konto wird negativ" />}
                      </span>
                    </span>
                  </span>
                )}
              </span>
            )}
          </span>
        </div>
        <div {...choice('skip')}>
          <span className="choice__radio" />
          <span className="choice__body">
            <span className="choice__title">Diesmal überspringen</span>
            <span className="choice__text">Ohne Buchung, z. B. bei einem Gratismonat. Weiter geht es am {next}.</span>
          </span>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
    </Modal>
  );
}
