import { ArrowRight, Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { computeBalances } from '../../domain/ledger';
import { centsToInput, formatMoney, parseMoney } from '../../domain/money';
import { allocatedOnAccount, buildGoalTree, findGoalNode, missingToTarget } from '../../domain/savings';
import { Button } from '../../components/ui/Button';
import { errorMessage } from '../../components/ui/errorMessage';
import { Field } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { allocateToSavingsGoal } from '../../store/actions';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import '../../components/ui/Form.css';

type Mode = 'add' | 'remove';

/** Assign money of the savings account to a goal – or take it back. */
export function AllocateDialog({ goalId, mode: initialMode = 'add', onClose }: { goalId: string; mode?: Mode; onClose(): void }) {
  const [{ goal, node, account, free, currency }] = useState(() => {
    const { data } = useDataStore.getState();
    const found = data.savingsGoals.find((g) => g.id === goalId) ?? null;
    const accountId = found?.accountId ?? '';
    const balance = computeBalances(data.accounts, data.transactions).get(accountId) ?? 0;
    return {
      goal: found,
      node: found ? findGoalNode(buildGoalTree(data.savingsGoals, accountId), found.id) : null,
      account: data.accounts.find((a) => a.id === accountId) ?? null,
      free: Math.max(0, balance - allocatedOnAccount(data.savingsGoals, accountId)),
      currency: data.settings.currency,
    };
  });
  const notify = useUiStore((s) => s.notify);
  const [mode, setMode] = useState<Mode>(initialMode === 'remove' && goal && goal.allocated > 0 ? 'remove' : 'add');
  const [amountText, setAmountText] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!goal || !node || !account) return null;

  const adding = mode === 'add';
  const amount = parseMoney(amountText);
  const value = amount !== null && amount > 0 ? amount : 0;
  const newTotal = node.total + (adding ? value : -value);
  const missing = missingToTarget(node);
  const toTarget = missing !== null && missing > 0 ? Math.min(missing, free) : null;

  const submit = () => {
    if (amount === null || amount <= 0) {
      setError('Bitte einen Betrag größer als 0 eingeben.');
      return;
    }
    if (adding && amount > free) {
      setError(`Auf „${account.name}“ sind nur ${formatMoney(free, currency)} frei.`);
      return;
    }
    if (!adding && amount > goal.allocated) {
      setError(`„${goal.name}“ sind nur ${formatMoney(goal.allocated, currency)} direkt zugewiesen.`);
      return;
    }
    try {
      allocateToSavingsGoal(goal.id, adding ? amount : -amount);
      notify(
        adding
          ? `${formatMoney(amount, currency)} für „${goal.name}“ zurückgelegt.`
          : `${formatMoney(amount, currency)} von „${goal.name}“ zurückgenommen – das Geld ist wieder frei.`,
      );
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const quick: { label: string; value: number }[] = adding
    ? [
        ...(toTarget !== null && toTarget !== free ? [{ label: `Bis zum Ziel (${formatMoney(toTarget, currency)})`, value: toTarget }] : []),
        ...(free > 0 ? [{ label: `Alles Freie (${formatMoney(free, currency)})`, value: free }] : []),
      ]
    : goal.allocated > 0
      ? [{ label: `Alles (${formatMoney(goal.allocated, currency)})`, value: goal.allocated }]
      : [];

  return (
    <Modal
      title={adding ? 'Geld zuweisen' : 'Geld zurücknehmen'}
      subtitle={`${goal.name} · ${account.name}`}
      onClose={onClose}
      onSubmit={submit}
      width={480}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="primary" icon={adding ? <Plus /> : <Minus />}>
            {adding ? 'Zuweisen' : 'Zurücknehmen'}
          </Button>
        </>
      }
    >
      <SegmentedControl<Mode>
        label="Art"
        fullWidth
        value={mode}
        onChange={(next) => {
          setMode(next);
          setError(null);
        }}
        options={[
          { value: 'add', label: 'Zuweisen', icon: <Plus /> },
          { value: 'remove', label: 'Zurücknehmen', icon: <Minus /> },
        ]}
      />

      <Field
        label="Betrag"
        htmlFor="allocate-amount"
        error={error}
        hint={
          adding
            ? `Frei auf „${account.name}“: ${formatMoney(free, currency)}`
            : node.children.length > 0
              ? `Direkt zugewiesen: ${formatMoney(goal.allocated, currency)} – Geld der Unterziele nimmst du dort zurück.`
              : `Zugewiesen: ${formatMoney(goal.allocated, currency)}`
        }
      >
        <MoneyInput
          id="allocate-amount"
          value={amountText}
          large
          autoFocus
          invalid={Boolean(error)}
          onChange={(text) => {
            setAmountText(text);
            setError(null);
          }}
        />
      </Field>

      {quick.length > 0 && (
        <div className="chips">
          {quick.map((q) => (
            <button key={q.label} type="button" className="chip" onClick={() => setAmountText(centsToInput(q.value))}>
              {q.label}
            </button>
          ))}
        </div>
      )}

      <div className="preview">
        <div className="preview__row">
          <span className="preview__name">{goal.name}</span>
          <span className="preview__values">
            {formatMoney(node.total, currency)}
            <ArrowRight aria-hidden />
            <span className="preview__new">{formatMoney(Math.max(0, newTotal), currency)}</span>
            {node.target !== null && <span>von {formatMoney(node.target, currency)}</span>}
          </span>
        </div>
      </div>
    </Modal>
  );
}
