import { createEmptyData } from '../persistence/schema';
import type { Env } from './env';
import type { AppData } from './types';

/** Deterministic environment for tests: ids id-1, id-2, ... and a fixed clock. */
export function testEnv(start = '2026-11-08T10:00:00.000Z'): Env & { advance(ms: number): void } {
  let counter = 0;
  let time = new Date(start).getTime();
  return {
    newId: () => `id-${++counter}`,
    now: () => new Date(time),
    advance(ms: number) {
      time += ms;
    },
  };
}

export function emptyData(): AppData {
  return createEmptyData('test', new Date('2026-11-08T10:00:00.000Z'));
}
