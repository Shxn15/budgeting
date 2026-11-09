import { CircleCheck, FolderPlus, Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { accountColorCss } from '../../domain/colors';
import { formatDate } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import { goalProgress, MAX_GOAL_DEPTH, missingToTarget, monthlySavingNeeded, type GoalNode } from '../../domain/savings';
import type { ISODate } from '../../domain/types';
import { Avatar } from '../../components/avatar/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Chevron, Collapse } from '../../components/ui/Collapse';
import { cx } from '../../components/ui/cx';
import { Menu, type MenuItem } from '../../components/ui/Menu';
import { useCurrency } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { confirmDeleteGoal } from './confirmDeleteGoal';

const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 0 });

/** One savings goal with progress – and its sub-goals below it. */
export function GoalRow({ node, today }: { node: GoalNode; today: ISODate }) {
  const openDialog = useUiStore((s) => s.openDialog);
  const currency = useCurrency();
  const [open, setOpen] = useState(true);
  const { goal, children, total, target, depth } = node;
  const progress = goalProgress(node);
  const missing = missingToTarget(node);
  const monthly = monthlySavingNeeded(node, today);
  const reached = progress !== null && progress >= 1;
  const hasChildren = children.length > 0;
  const canNest = depth + 1 < MAX_GOAL_DEPTH;

  const facts = [
    progress !== null && !reached ? `${percent.format(Math.min(progress, 1))} · noch ${formatMoney(missing!, currency)}` : null,
    goal.targetDate ? `bis ${formatDate(goal.targetDate)}` : null,
    monthly !== null ? `ca. ${formatMoney(monthly, currency)} pro Monat` : null,
    hasChildren && goal.allocated > 0 ? `davon direkt ${formatMoney(goal.allocated, currency)}` : null,
    goal.targetDate && goal.targetDate < today && !reached ? 'Datum vorbei' : null,
  ].filter(Boolean);

  const menu: (MenuItem | 'separator')[] = [
    { label: 'Geld zuweisen', icon: <Plus />, onSelect: () => openDialog({ type: 'allocate', goalId: goal.id, mode: 'add' }) },
    {
      label: 'Geld zurücknehmen',
      icon: <Minus />,
      disabled: goal.allocated === 0,
      onSelect: () => openDialog({ type: 'allocate', goalId: goal.id, mode: 'remove' }),
    },
    ...(canNest
      ? [
          {
            label: 'Unterziel hinzufügen',
            icon: <FolderPlus />,
            onSelect: () => openDialog({ type: 'goal', accountId: goal.accountId, parentId: goal.id }),
          },
        ]
      : []),
    { label: 'Bearbeiten', icon: <Pencil />, onSelect: () => openDialog({ type: 'goal', accountId: goal.accountId, goalId: goal.id }) },
    'separator',
    { label: 'Löschen', icon: <Trash2 />, danger: true, onSelect: () => confirmDeleteGoal(goal) },
  ];

  return (
    <div className={cx('goal', depth > 0 && 'goal--sub', reached && 'is-reached')} style={{ '--goal-color': accountColorCss(goal.color) } as CSSProperties}>
      <div className="goal__row">
        {hasChildren ? (
          <button
            type="button"
            className="goal__expand"
            aria-expanded={open}
            aria-label={open ? `Unterziele von ${goal.name} einklappen` : `Unterziele von ${goal.name} aufklappen`}
            onClick={() => setOpen((v) => !v)}
          >
            <Chevron open={open} />
          </button>
        ) : (
          <span className="goal__expand-spacer" aria-hidden />
        )}
        <button
          type="button"
          className="goal__avatar"
          title="Bearbeiten"
          onClick={() => openDialog({ type: 'goal', accountId: goal.accountId, goalId: goal.id })}
        >
          <Avatar name={goal.name} image={goal.image} color={goal.color} size={depth === 0 ? 42 : 34} />
        </button>
        <div className="goal__main">
          <div className="goal__top">
            <span className="goal__name">
              {goal.name}
              {hasChildren && !open && <span className="goal__count">{children.length} Unterziele</span>}
            </span>
            <span className="goal__amount num">
              {formatMoney(total, currency)}
              {target !== null && <span className="goal__target"> von {formatMoney(target, currency)}</span>}
            </span>
          </div>
          {target !== null && (
            <div
              className="goal__bar"
              role="progressbar"
              aria-label={`Fortschritt ${goal.name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(Math.min(progress ?? 0, 1) * 100)}
            >
              <span style={{ width: `${Math.min(progress ?? 0, 1) * 100}%` }} />
            </div>
          )}
          <div className="goal__meta">
            {reached && (
              <Badge tone="success" icon={<CircleCheck aria-hidden />}>
                Ziel erreicht
              </Badge>
            )}
            {facts.length > 0 && <span className="goal__facts">{facts.join(' · ')}</span>}
            {!reached && facts.length === 0 && target === null && <span className="goal__facts">ohne Zielbetrag</span>}
            {goal.note && <span className="goal__facts goal__note">{goal.note}</span>}
          </div>
        </div>
        <div className="goal__actions">
          <Button size="sm" icon={<Plus />} onClick={() => openDialog({ type: 'allocate', goalId: goal.id, mode: 'add' })}>
            Zuweisen
          </Button>
          <Menu label={`Aktionen für ${goal.name}`} items={menu} />
        </div>
      </div>
      {hasChildren && (
        <Collapse open={open}>
          <div className="goal__children">
            {children.map((child) => (
              <GoalRow key={child.goal.id} node={child} today={today} />
            ))}
          </div>
        </Collapse>
      )}
    </div>
  );
}
