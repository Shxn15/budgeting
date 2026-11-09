import { Plus, Target, TriangleAlert } from 'lucide-react';
import { useMemo, type CSSProperties } from 'react';
import { accountColorCss } from '../../domain/colors';
import { formatMoney } from '../../domain/money';
import { allocatedOnAccount, buildGoalTree, isSavingsAccount } from '../../domain/savings';
import type { Account, Cents, ISODate } from '../../domain/types';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { useCurrency, useSavingsGoals } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { GoalRow } from './GoalRow';
import './SavingsGoals.css';

/** "Sparziele" of a savings account: how its money is divided, and the goals as a tree. */
export function SavingsGoalsCard({ account, balance, today }: { account: Account; balance: Cents; today: ISODate }) {
  const goals = useSavingsGoals();
  const currency = useCurrency();
  const openDialog = useUiStore((s) => s.openDialog);
  const tree = useMemo(() => buildGoalTree(goals, account.id), [goals, account.id]);
  const allocated = allocatedOnAccount(goals, account.id);
  const free = balance - allocated;
  const canCreate = isSavingsAccount(account);
  const scale = Math.max(balance, allocated, 1);

  const add = () => openDialog({ type: 'goal', accountId: account.id });

  return (
    <Card
      className="goals-card"
      title={
        <>
          Sparziele
          {tree.length > 0 && <span className="card__title-note">{formatMoney(allocated, currency)} zugewiesen</span>}
        </>
      }
      actions={
        canCreate && (
          <Button size="sm" variant={tree.length === 0 ? 'ghost' : 'secondary'} icon={<Plus />} onClick={add}>
            Neues Sparziel
          </Button>
        )
      }
    >
      {tree.length === 0 ? (
        <EmptyState
          compact
          icon={<Target />}
          title="Noch keine Sparziele"
          action={
            canCreate && (
              <Button variant="primary" size="sm" icon={<Plus />} onClick={add}>
                Erstes Sparziel anlegen
              </Button>
            )
          }
        >
          Lege Ziele wie „Japan-Reise“ an und weise ihnen Geld von diesem Sparkonto zu. In jedem Ziel kannst du weitere
          Unterziele anlegen – zum Beispiel „Flug“ und „Hotel“.
        </EmptyState>
      ) : (
        <>
          <div className="goals-split">
            <div className="goals-split__bar" aria-hidden>
              {tree.map((node) =>
                node.total > 0 ? (
                  <span
                    key={node.goal.id}
                    title={`${node.goal.name}: ${formatMoney(node.total, currency)}`}
                    style={{ width: `${(node.total / scale) * 100}%`, '--goal-color': accountColorCss(node.goal.color) } as CSSProperties}
                  />
                ) : null,
              )}
            </div>
            <div className="goals-split__legend">
              <span>
                <strong className="num">{formatMoney(allocated, currency)}</strong> für Ziele
              </span>
              <span className={free < 0 ? 'amount-negative' : undefined}>
                <strong className="num">{formatMoney(free, currency)}</strong> {free < 0 ? 'zu viel zugewiesen' : 'noch frei'}
              </span>
              <span>
                von <strong className="num">{formatMoney(balance, currency)}</strong> auf dem Konto
              </span>
            </div>
          </div>

          {free < 0 && (
            <p className="goals-warning" role="status">
              <TriangleAlert aria-hidden />
              Auf dem Konto ist weniger Geld, als den Zielen zugewiesen ist. Nimm bei einem Ziel{' '}
              {formatMoney(-free, currency)} zurück – oder zahle wieder etwas ein.
            </p>
          )}

          <div className="goals-tree">
            {tree.map((node) => (
              <GoalRow key={node.goal.id} node={node} today={today} />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
