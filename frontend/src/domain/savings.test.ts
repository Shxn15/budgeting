import { describe, expect, it } from 'vitest';
import {
  allocatedOnAccount,
  buildGoalTree,
  descendantIds,
  flattenGoalTree,
  goalLevel,
  goalProgress,
  missingToTarget,
  monthlySavingNeeded,
  subtreeHeight,
  unassignedOnAccount,
} from './savings';
import type { SavingsGoal } from './types';

function goal(id: string, fields: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id,
    accountId: 'spar',
    parentId: null,
    name: id,
    targetAmount: null,
    targetDate: null,
    allocated: 0,
    color: 'blue',
    image: null,
    note: '',
    createdAt: '2026-11-01T10:00:00.000Z',
    ...fields,
  };
}

// Japan-Reise (3.000 €, 500 € direkt) › Flug (1.200 €, 400 €) › Hinflug (600 €, 100 €)
//                                     › Hotel (900 €, 0 €)
// Notgroschen (ohne Ziel, 1.000 €)   – and a goal of another account
const goals = [
  goal('japan', { name: 'Japan-Reise', targetAmount: 300000, allocated: 50000, targetDate: '2027-08-01' }),
  goal('flug', { parentId: 'japan', targetAmount: 120000, allocated: 40000 }),
  goal('hotel', { parentId: 'japan', targetAmount: 90000 }),
  goal('hinflug', { parentId: 'flug', targetAmount: 60000, allocated: 10000 }),
  goal('not', { name: 'Notgroschen', allocated: 100000 }),
  goal('fremd', { accountId: 'anderes', allocated: 99999 }),
];

describe('savings goals', () => {
  it('builds the tree of one account with totals of all sub-goals', () => {
    const tree = buildGoalTree(goals, 'spar');
    expect(tree.map((n) => [n.goal.id, n.total, n.target, n.depth])).toEqual([
      ['japan', 50000 + 40000 + 10000, 300000, 0],
      ['not', 100000, null, 0],
    ]);
    const japan = tree[0]!;
    expect(japan.children.map((n) => [n.goal.id, n.total, n.depth])).toEqual([
      ['flug', 50000, 1],
      ['hotel', 0, 1],
    ]);
    expect(flattenGoalTree(tree).map((n) => n.goal.id)).toEqual(['japan', 'flug', 'hinflug', 'hotel', 'not']);
  });

  it('uses the sum of the sub-goals as target when a goal has none', () => {
    const tree = buildGoalTree(
      [goal('urlaub'), goal('a', { parentId: 'urlaub', targetAmount: 1000 }), goal('b', { parentId: 'urlaub', targetAmount: 500 }), goal('c', { parentId: 'urlaub' })],
      'spar',
    );
    expect(tree[0]!.target).toBe(1500);
  });

  it('treats goals with a missing parent as top-level goals', () => {
    const tree = buildGoalTree([goal('waise', { parentId: 'weg' })], 'spar');
    expect(tree.map((n) => n.goal.id)).toEqual(['waise']);
  });

  it('knows how much of the account is assigned and free', () => {
    expect(allocatedOnAccount(goals, 'spar')).toBe(50000 + 40000 + 10000 + 100000);
    expect(unassignedOnAccount(250000, goals, 'spar')).toBe(50000);
    // Less money on the account than assigned (money was taken out).
    expect(unassignedOnAccount(150000, goals, 'spar')).toBe(-50000);
  });

  it('calculates progress and what is missing', () => {
    const [japan, not] = buildGoalTree(goals, 'spar');
    expect(goalProgress(japan!)).toBeCloseTo(1 / 3);
    expect(missingToTarget(japan!)).toBe(200000);
    expect(goalProgress(not!)).toBeNull();
    expect(missingToTarget(not!)).toBeNull();
    expect(missingToTarget({ total: 5000, target: 4000 })).toBe(0);
  });

  it('suggests a monthly amount until the target date', () => {
    const [japan] = buildGoalTree(goals, 'spar');
    // 2.000 € missing, November 2026 → August 2027 = 9 months.
    expect(monthlySavingNeeded(japan!, '2026-11-09')).toBe(Math.ceil(200000 / 9));
    // In the target month itself: everything now.
    expect(monthlySavingNeeded(japan!, '2027-08-01')).toBe(200000);
    // Date passed or no date.
    expect(monthlySavingNeeded(japan!, '2027-08-02')).toBeNull();
    expect(monthlySavingNeeded(buildGoalTree(goals, 'spar')[1]!, '2026-11-09')).toBeNull();
  });

  it('knows levels, sub-goals and the height of a subtree', () => {
    expect(goalLevel(goals, 'japan')).toBe(1);
    expect(goalLevel(goals, 'hinflug')).toBe(3);
    expect([...descendantIds(goals, 'japan')].sort()).toEqual(['flug', 'hinflug', 'hotel']);
    expect(subtreeHeight(goals, 'japan')).toBe(3);
    expect(subtreeHeight(goals, 'hotel')).toBe(1);
  });
});
