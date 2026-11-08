import { CURRENT_SCHEMA_VERSION } from './schema';

export type RawDocument = Record<string, unknown>;
export type Migration = (doc: RawDocument) => RawDocument;

/**
 * MIGRATIONS[n] upgrades a document from schema version n-1 to version n.
 *
 * How to change the stored data model:
 *  1. Increase CURRENT_SCHEMA_VERSION in schema.ts (e.g. to 2).
 *  2. Add MIGRATIONS[2] here that turns a version-1 document into version 2.
 *  3. Update domain/types.ts and normalize.ts.
 *  4. Add a test with a real version-1 document to migrations.test.ts.
 *
 * Never change or delete a migration once it has been released – users may
 * skip versions, so every step must keep working forever. Before migrating,
 * the app automatically creates a backup of the old file.
 */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // Example:
  // 2: (doc) => ({
  //   ...doc,
  //   accounts: (doc.accounts as RawDocument[]).map((a) => ({ ...a, archived: false })),
  // }),
};

/** The document was written by a newer app version. */
export class DataTooNewError extends Error {
  constructor(
    readonly version: number,
    readonly supported: number,
  ) {
    super(`Data schema version ${version} is newer than the supported version ${supported}.`);
    this.name = 'DataTooNewError';
  }
}

/** The document cannot be read at all (broken JSON, wrong structure). */
export class InvalidDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDataError';
  }
}

export function isRawDocument(value: unknown): value is RawDocument {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readSchemaVersion(doc: RawDocument): number {
  const version = doc.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new InvalidDataError('Missing or invalid schemaVersion.');
  }
  return version;
}

export interface MigrationResult {
  doc: RawDocument;
  fromVersion: number;
  toVersion: number;
}

/** Runs all migrations needed to bring `doc` to the `target` schema version. */
export function migrateDocument(
  doc: unknown,
  target: number = CURRENT_SCHEMA_VERSION,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
): MigrationResult {
  if (!isRawDocument(doc)) throw new InvalidDataError('The document is not a JSON object.');
  const fromVersion = readSchemaVersion(doc);
  if (fromVersion > target) throw new DataTooNewError(fromVersion, target);

  let current: RawDocument = doc;
  for (let version = fromVersion + 1; version <= target; version++) {
    const step = migrations[version];
    if (!step) throw new Error(`Missing migration to schema version ${version}.`);
    current = { ...step(current), schemaVersion: version };
  }
  return { doc: current, fromVersion, toVersion: target };
}
