import { formatMoney } from '../../domain/money';
import { buildGoalTree, descendantIds, findGoalNode } from '../../domain/savings';
import type { SavingsGoal } from '../../domain/types';
import { deleteSavingsGoal } from '../../store/actions';
import { useDataStore } from '../../store/dataStore';
import { useUiStore } from '../../store/uiStore';

export function confirmDeleteGoal(goal: SavingsGoal) {
  const { data } = useDataStore.getState();
  const subGoals = descendantIds(data.savingsGoals, goal.id).size;
  const node = findGoalNode(buildGoalTree(data.savingsGoals, goal.accountId), goal.id);
  const total = node?.total ?? goal.allocated;
  const what =
    subGoals === 0
      ? `„${goal.name}“ wird gelöscht.`
      : `„${goal.name}“ und ${subGoals === 1 ? 'sein Unterziel werden' : `seine ${subGoals} Unterziele werden`} gelöscht.`;
  const money =
    total > 0
      ? ` Die zugewiesenen ${formatMoney(total, data.settings.currency)} sind danach wieder frei – das Geld selbst bleibt auf dem Konto.`
      : '';
  useUiStore.getState().openDialog({
    type: 'confirm',
    title: 'Sparziel löschen?',
    message: what + money,
    confirmLabel: 'Sparziel löschen',
    danger: true,
    onConfirm: () => {
      deleteSavingsGoal(goal.id);
      useUiStore.getState().notify(`Sparziel „${goal.name}“ gelöscht.`);
    },
  });
}
