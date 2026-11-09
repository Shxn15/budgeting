/**
 * Savings goals ("Sparziele") of a savings account: the tree of goals, how
 * much money is assigned to them and how much of the account is still free.
 *
 * Only the assignment is stored (SavingsGoal.allocated); the money stays on
 * the account. A goal's total is its own assignment plus that of all its
 * sub-goals.
 */
import { monthDiff } from './dates';
import type { Account, Cents, ISODate, SavingsGoal } from './types';

/** Goals can be nested this many levels deep (a top-level goal is level 1). */
export const MAX_GOAL_DEPTH = 4;

export interface GoalNode {
  goal: SavingsGoal;
  children: GoalNode[];
  /** 0 = top level. */
  depth: number;
  /** Money assigned to this goal and all its sub-goals. */
  total: Cents;
  /** The goal's own target – or, without one, the sum of its sub-goals' targets. null = no target. */
  target: Cents | null;
}

export function isSavingsAccount(account: Pick<Account, 'type'>): boolean {
  return account.type === 'savings';
}

export function goalsOfAccount(goals: readonly SavingsGoal[], accountId: string): SavingsGoal[] {
  return goals.filter((g) => g.accountId === accountId);
}

/** The goals of one account as a tree, in the order they were created. */
export function buildGoalTree(goals: readonly SavingsGoal[], accountId: string): GoalNode[] {
  const own = goalsOfAccount(goals, accountId);
  const ids = new Set(own.map((g) => g.id));
  const children = new Map<string | null, SavingsGoal[]>();
  for (const goal of own) {
    // A parent that does not exist (any more) makes the goal a top-level goal.
    const key = goal.parentId !== null && ids.has(goal.parentId) ? goal.parentId : null;
    const list = children.get(key);
    if (list) list.push(goal);
    else children.set(key, [goal]);
  }

  const visited = new Set<string>();
  const build = (goal: SavingsGoal, depth: number): GoalNode => {
    visited.add(goal.id);
    const kids = (children.get(goal.id) ?? []).filter((c) => !visited.has(c.id)).map((c) => build(c, depth + 1));
    const total = goal.allocated + kids.reduce((sum, k) => sum + k.total, 0);
    const childTargets = kids.filter((k) => k.target !== null);
    const target =
      goal.targetAmount ?? (childTargets.length > 0 ? childTargets.reduce((sum, k) => sum + k.target!, 0) : null);
    return { goal, children: kids, depth, total, target };
  };
  return (children.get(null) ?? []).map((g) => build(g, 0));
}

/** All nodes of a tree, parents before their children. */
export function flattenGoalTree(nodes: readonly GoalNode[]): GoalNode[] {
  return nodes.flatMap((node) => [node, ...flattenGoalTree(node.children)]);
}

export function findGoalNode(nodes: readonly GoalNode[], id: string): GoalNode | null {
  for (const node of nodes) {
    if (node.goal.id === id) return node;
    const found = findGoalNode(node.children, id);
    if (found) return found;
  }
  return null;
}

/** Ids of all sub-goals (children, grandchildren, ...) of a goal. */
export function descendantIds(goals: readonly SavingsGoal[], id: string): Set<string> {
  const result = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const g of goals) {
      if (g.parentId === current && !result.has(g.id) && g.id !== id) {
        result.add(g.id);
        queue.push(g.id);
      }
    }
  }
  return result;
}

/** Level of a goal: 1 = top level, 2 = sub-goal, ... */
export function goalLevel(goals: readonly SavingsGoal[], id: string): number {
  const byId = new Map(goals.map((g) => [g.id, g]));
  let level = 0;
  let current = byId.get(id);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    level += 1;
    current = current.parentId === null ? undefined : byId.get(current.parentId);
  }
  return level;
}

/** Number of levels of a goal and its sub-goals (1 = no sub-goals). */
export function subtreeHeight(goals: readonly SavingsGoal[], id: string): number {
  const seen = new Set<string>([id]);
  const height = (goalId: string): number => {
    let deepest = 0;
    for (const g of goals) {
      if (g.parentId === goalId && !seen.has(g.id)) {
        seen.add(g.id);
        deepest = Math.max(deepest, height(g.id));
      }
    }
    return 1 + deepest;
  };
  return height(id);
}

/** Money of an account that is assigned to its goals. */
export function allocatedOnAccount(goals: readonly SavingsGoal[], accountId: string): Cents {
  return goalsOfAccount(goals, accountId).reduce((sum, g) => sum + g.allocated, 0);
}

/**
 * Money of the account that is not assigned to any goal yet. Negative if
 * more is assigned than the account holds (e.g. after taking money out).
 */
export function unassignedOnAccount(balance: Cents, goals: readonly SavingsGoal[], accountId: string): Cents {
  return balance - allocatedOnAccount(goals, accountId);
}

/** Share of the target that is reached (may be above 1); null without a target. */
export function goalProgress(node: Pick<GoalNode, 'total' | 'target'>): number | null {
  if (node.target === null || node.target <= 0) return null;
  return node.total / node.target;
}

/** Money still missing to the target (0 when reached); null without a target. */
export function missingToTarget(node: Pick<GoalNode, 'total' | 'target'>): Cents | null {
  if (node.target === null) return null;
  return Math.max(0, node.target - node.total);
}

/**
 * How much to put aside per month to reach the target by its date.
 * null without target or date, when it is reached already or the date has passed.
 */
export function monthlySavingNeeded(node: GoalNode, today: ISODate): Cents | null {
  const missing = missingToTarget(node);
  const date = node.goal.targetDate;
  if (missing === null || missing === 0 || date === null || date < today) return null;
  const months = Math.max(1, monthDiff(today, date));
  return Math.ceil(missing / months);
}
