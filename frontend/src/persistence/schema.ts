import { DEFAULT_COLOR_THEME } from '../domain/themes';
import type { AppData } from '../domain/types';

/**
 * Version of the data document format (data.json).
 *
 * Increase this ONLY together with a new migration in migrations.ts.
 * An app version that finds a document with a higher schema version refuses
 * to modify it, so an older .exe can never destroy data of a newer one.
 */
export const CURRENT_SCHEMA_VERSION: number = 3;

export const DEFAULT_CURRENCY = 'EUR';

export function createEmptyData(appVersion: string, now: Date = new Date()): AppData {
  const timestamp = now.toISOString();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    accounts: [],
    transactions: [],
    obligations: [],
    tags: [],
    subscriptions: [],
    receivables: [],
    savingsGoals: [],
    settings: { theme: 'system', colorTheme: DEFAULT_COLOR_THEME, collapsedSections: [], currency: DEFAULT_CURRENCY },
    meta: { createdAt: timestamp, updatedAt: timestamp, appVersion },
  };
}

/** Pretty-printed so the file stays readable if someone opens it. */
export function serializeData(data: AppData): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}
