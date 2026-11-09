import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { todayISO } from '../../domain/dates';
import { computeBalances } from '../../domain/ledger';
import { formatMoney } from '../../domain/money';
import { receivableName } from '../../domain/receivables';
import { Button } from '../../components/ui/Button';
import { cx } from '../../components/ui/cx';
import { errorMessage } from '../../components/ui/errorMessage';
import { Select, TextInput } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { markReceivableReceived } from '../../store/actions';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import '../../components/ui/Form.css';

type Mode = 'account' | 'none';

/** The money arrived: add it to an account – or just tick it off. */
export function ReceiveDialog({ receivableId, onClose }: { receivableId: string; onClose(): void }) {
  const [{ receivable, accounts, balances, currency }] = useState(() => {
    const { data } = useDataStore.getState();
    return {
      receivable: data.receivables.find((r) => r.id === receivableId) ?? null,
      accounts: data.accounts,
      balances: computeBalances(data.accounts, data.transactions),
      currency: data.settings.currency,
    };
  });
  const notify = useUiStore((s) => s.notify);
  const [mode, setMode] = useState<Mode>(accounts.length > 0 ? 'account' : 'none');
  const [accountId, setAccountId] = useState(
    receivable?.accountId && accounts.some((a) => a.id === receivable.accountId) ? receivable.accountId : (accounts[0]?.id ?? ''),
  );
  const [date, setDate] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);

  if (!receivable) return null;

  const before = balances.get(accountId) ?? 0;
  const after = before + receivable.amount;
  const account = accounts.find((a) => a.id === accountId);

  const submit = () => {
    try {
      markReceivableReceived(receivable.id, { accountId: mode === 'account' ? accountId : null, date });
      notify(
        mode === 'account' && account
          ? `Erhalten – ${formatMoney(receivable.amount, currency)} zu „${account.name}“ hinzugefügt.`
          : 'Als erhalten markiert.',
      );
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const choose = (next: Mode) => {
    if (next === 'account' && accounts.length === 0) return;
    setMode(next);
  };

  return (
    <Modal
      title="Geld erhalten"
      subtitle={`${receivableName(receivable)} · ${formatMoney(receivable.amount, currency)}`}
      onClose={onClose}
      onSubmit={submit}
      width={480}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="primary">
            Erhalten
          </Button>
        </>
      }
    >
      <div className="choice-list" role="radiogroup" aria-label="Wo ist das Geld angekommen?">
        <div
          role="radio"
          aria-checked={mode === 'account'}
          aria-disabled={accounts.length === 0}
          tabIndex={0}
          className={cx('choice', mode === 'account' && 'is-active')}
          onClick={() => choose('account')}
          onKeyDown={(event) => {
            if (event.key === ' ' || event.key === 'Enter') {
              event.preventDefault();
              choose('account');
            }
          }}
        >
          <span className="choice__radio" />
          <span className="choice__body">
            <span className="choice__title">Auf ein Konto buchen</span>
            <span className="choice__text">
              {accounts.length > 0 ? 'Der Betrag wird dem Konto gutgeschrieben.' : 'Lege zuerst ein Konto an.'}
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
                        <span className="preview__new">{formatMoney(after, currency)}</span>
                      </span>
                    </span>
                  </span>
                )}
              </span>
            )}
          </span>
        </div>

        <div
          role="radio"
          aria-checked={mode === 'none'}
          tabIndex={0}
          className={cx('choice', mode === 'none' && 'is-active')}
          onClick={() => choose('none')}
          onKeyDown={(event) => {
            if (event.key === ' ' || event.key === 'Enter') {
              event.preventDefault();
              choose('none');
            }
          }}
        >
          <span className="choice__radio" />
          <span className="choice__body">
            <span className="choice__title">Nur als erhalten markieren</span>
            <span className="choice__text">Ohne Buchung – zum Beispiel, wenn du das Geld schon eingetragen hast.</span>
          </span>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}
    </Modal>
  );
}
