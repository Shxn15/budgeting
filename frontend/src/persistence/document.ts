import type { AppData } from '../domain/types';
import { InvalidDataError, migrateDocument } from './migrations';
import { normalizeData } from './normalize';

export interface ParsedDocument {
  data: AppData;
  /** Schema version the file had on disk. */
  fromVersion: number;
  /** True if migrations were applied (the file should be saved again). */
  migrated: boolean;
}

/**
 * Reads the content of data.json: parse -> migrate to the current schema ->
 * normalize. Throws InvalidDataError or DataTooNewError (see migrations.ts).
 */
export function parseDocument(content: string, appVersion: string, now: Date = new Date()): ParsedDocument {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    throw new InvalidDataError('The data file does not contain valid JSON.');
  }
  const { doc, fromVersion, toVersion } = migrateDocument(raw);
  return {
    data: normalizeData(doc, appVersion, now),
    fromVersion,
    migrated: fromVersion !== toVersion,
  };
}
