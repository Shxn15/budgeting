import { useMemo, useState } from 'react';
import { nextAccountColor } from '../../domain/colors';
import { addMonths, formatDate, isISODate, todayISO } from '../../domain/dates';
import { computeBalances } from '../../domain/ledger';
import { centsToInput, formatMoney, parseMoney } from '../../domain/money';
import {
  allocatedOnAccount,
  buildGoalTree,
  descendantIds,
  flattenGoalTree,
  goalLevel,
  MAX_GOAL_DEPTH,
  subtreeHeight,
} from '../../domain/savings';
import { ProfileFields } from '../../components/avatar/ProfileFields';
import { Button } from '../../components/ui/Button';
import { ColorSwatches } from '../../components/ui/ColorSwatches';
import { cx } from '../../components/ui/cx';
import { errorMessage } from '../../components/ui/errorMessage';
import { Field, Select, TextInput } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { MoneyInput } from '../../components/ui/MoneyInput';
import { addSavingsGoal, updateSavingsGoal } from '../../store/actions';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';
import { confirmDeleteGoal } from './confirmDeleteGoal';
import '../../components/ui/Form.css';
import '../obligations/ObligationDialog.css';
import '../subscriptions/SubscriptionDialog.css';

interface Props {
  accountId: string;
  goalId?: string;
  /** New sub-goal inside this goal. */
  parentId?: string;
  onClose(): void;
}

interface Errors {
  name?: string;
  target?: string;
  date?: string;
  allocate?: string;
  general?: string;
}

/** Create or edit a savings goal ("Japan-Reise") or sub-goal ("Flug"). */
export function GoalDialog({ accountId, goalId, parentId: initialParent, onClose }: Props) {
  const [{ goals, account, existing, free, currency }] = useState(() => {
    const { data } = useDataStore.getState();
    const balance = computeBalances(data.accounts, data.transactions).get(accountId) ?? 0;
    return {
      goals: data.savingsGoals,
      account: data.accounts.find((a) => a.id === accountId) ?? null,
      existing: data.savingsGoals.find((g) => g.id === goalId) ?? null,
      free: Math.max(0, balance - allocatedOnAccount(data.savingsGoals, accountId)),
      currency: data.settings.currency,
    };
  });
  const notify = useUiStore((s) => s.notify);
  const today = todayISO();

  const [name, setName] = useState(existing?.name ?? '');
  const [image, setImage] = useState<string | null>(existing?.image ?? null);
  const [color, setColor] = useState(existing?.color ?? nextAccountColor(goals.filter((g) => g.accountId === accountId)));
  const [parentId, setParentId] = useState(existing ? (existing.parentId ?? '') : (initialParent ?? ''));
  const [targetText, setTargetText] = useState(existing?.targetAmount ? centsToInput(existing.targetAmount) : '');
  const [hasDate, setHasDate] = useState(Boolean(existing?.targetDate));
  const [date, setDate] = useState(existing?.targetDate ?? addMonths(today, 6));
  const [allocateText, setAllocateText] = useState('');
  const [note, setNote] = useState(existing?.note ?? '');
  const [errors, setErrors] = useState<Errors>({});

  // Goals it can be placed in: not itself, none of its sub-goals, not too deep.
  const parents = useMemo(() => {
    const blocked = existing ? descendantIds(goals, existing.id).add(existing.id) : new Set<string>();
    const height = existing ? subtreeHeight(goals, existing.id) : 1;
    return flattenGoalTree(buildGoalTree(goals, accountId)).filter(
      (node) => !blocked.has(node.goal.id) && goalLevel(goals, node.goal.id) + height <= MAX_GOAL_DEPTH,
    );
  }, [goals, accountId, existing]);

  if (!account) return null;
  const parent = goals.find((g) => g.id === parentId) ?? null;

  const submit = () => {
    const next: Errors = {};
    if (!name.trim()) next.name = 'Bitte gib dem Sparziel einen Namen.';
    const target = targetText.trim() === '' ? null : parseMoney(targetText);
    if (target !== null && target <= 0) next.target = 'Der Zielbetrag muss größer als 0 sein.';
    if (targetText.trim() !== '' && target === null) next.target = 'Bitte einen gültigen Betrag eingeben.';
    if (hasDate && !isISODate(date)) next.date = 'Bitte ein gültiges Datum wählen.';
    const allocate = allocateText.trim() === '' ? 0 : parseMoney(allocateText);
    if (allocate === null || allocate < 0) next.allocate = 'Bitte einen gültigen Betrag eingeben.';
    else if (allocate > free) next.allocate = `Auf „${account.name}“ sind nur ${formatMoney(free, currency)} frei.`;
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    const input = {
      name,
      parentId: parentId || null,
      targetAmount: target,
      targetDate: hasDate ? date : null,
      color,
      image,
      note,
    };
    try {
      if (existing) {
        updateSavingsGoal(existing.id, input);
        notify('Sparziel gespeichert.');
      } else {
        addSavingsGoal({ ...input, accountId, allocate: allocate! });
        notify(
          allocate! > 0
            ? `Sparziel „${name.trim()}“ angelegt – ${formatMoney(allocate!, currency)} zugewiesen.`
            : `Sparziel „${name.trim()}“ angelegt.`,
        );
      }
      onClose();
    } catch (error) {
      setErrors({ general: errorMessage(error) });
    }
  };

  const title = existing ? 'Sparziel bearbeiten' : initialParent ? 'Unterziel anlegen' : 'Neues Sparziel';
  const subtitle = existing
    ? existing.name
    : parent
      ? `In „${parent.name}“ auf ${account.name}`
      : `Auf ${account.name} – das Geld bleibt auf dem Konto, du teilst es nur auf.`;

  return (
    <Modal
      title={title}
      subtitle={subtitle}
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
                  confirmDeleteGoal(existing);
                }}
              >
                Löschen
              </Button>
              <span className="modal__footer-spacer" />
            </>
          )}
          <Button onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="primary">
            {existing ? 'Speichern' : 'Anlegen'}
          </Button>
        </>
      }
    >
      <ProfileFields
        id="goal-name"
        label="Name"
        name={name}
        onNameChange={(value) => {
          setName(value);
          setErrors((e) => ({ ...e, name: undefined }));
        }}
        image={image}
        onImageChange={setImage}
        color={color}
        placeholder={parent ? 'z. B. Flug, Hotel' : 'z. B. Japan-Reise, Notgroschen'}
        error={errors.name}
        hint="Mit einem Bild (z. B. vom Reiseziel) erkennst du es sofort wieder."
        autoFocus
      />
      {!image && (
        <Field label="Farbe (ohne Bild)">
          <ColorSwatches value={color} onChange={setColor} size="sm" />
        </Field>
      )}

      {(parents.length > 0 || parentId) && (
        <Field label="Gehört zu" htmlFor="goal-parent" hint="Unterziele zählen bei ihrem Oberziel mit.">
          <Select id="goal-parent" value={parentId} onChange={(event) => setParentId(event.target.value)}>
            <option value="">Keinem – eigenes Sparziel</option>
            {parents.map((node) => (
              <option key={node.goal.id} value={node.goal.id}>
                {`${' '.repeat(node.depth)}${node.depth > 0 ? '↳ ' : ''}${node.goal.name}`}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div className="field-row">
        <Field label="Zielbetrag (optional)" htmlFor="goal-target" error={errors.target}>
          <MoneyInput
            id="goal-target"
            value={targetText}
            placeholder="z. B. 3.000"
            invalid={Boolean(errors.target)}
            onChange={(value) => {
              setTargetText(value);
              setErrors((e) => ({ ...e, target: undefined }));
            }}
          />
        </Field>
        <Field
          label="Bis wann? (optional)"
          htmlFor="goal-date"
          error={errors.date}
          aside={
            <label className="due-toggle">
              <input type="checkbox" checked={!hasDate} onChange={(event) => setHasDate(!event.target.checked)} />
              Kein Datum
            </label>
          }
        >
          <div className={cx('due-picker', !hasDate && 'is-disabled')}>
            <TextInput
              id="goal-date"
              type="date"
              value={date}
              disabled={!hasDate}
              onChange={(event) => {
                setDate(event.target.value);
                setErrors((e) => ({ ...e, date: undefined }));
              }}
            />
          </div>
        </Field>
      </div>
      {hasDate && isISODate(date) && targetText.trim() !== '' && (
        <p className="due-picker__summary">Ziel: {formatDate(date)} – du siehst dann, wie viel du pro Monat zurücklegen solltest.</p>
      )}

      {!existing && (
        <Field
          label="Gleich zuweisen (optional)"
          htmlFor="goal-allocate"
          error={errors.allocate}
          hint={`Frei auf „${account.name}“: ${formatMoney(free, currency)}`}
          aside={
            free > 0 && (
              <button type="button" className="chip" onClick={() => setAllocateText(centsToInput(free))}>
                Alles Freie
              </button>
            )
          }
        >
          <MoneyInput
            id="goal-allocate"
            value={allocateText}
            invalid={Boolean(errors.allocate)}
            onChange={(value) => {
              setAllocateText(value);
              setErrors((e) => ({ ...e, allocate: undefined }));
            }}
          />
        </Field>
      )}

      <Field label="Notiz (optional)" htmlFor="goal-note">
        <TextInput
          id="goal-note"
          value={note}
          maxLength={200}
          placeholder="z. B. Tokio und Kyoto"
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>

      {errors.general && <p className="form-error">{errors.general}</p>}
    </Modal>
  );
}
