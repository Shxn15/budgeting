import { describe, expect, it } from 'vitest';
import { createAccount, transfer } from '../domain/operations';
import { emptyData, testEnv } from '../domain/testing';
import { parseDocument } from './document';
import { DataTooNewError, InvalidDataError, migrateDocument, type Migration } from './migrations';
import { CURRENT_SCHEMA_VERSION, serializeData } from './schema';

/**
 * A data.json exactly as version 0.1.0 of the app writes it (schema 1).
 * Keep this fixture unchanged forever: it guarantees that files written by
 * the first release can still be opened by every later release.
 */
const SCHEMA_1_FILE = `{
  "schemaVersion": 1,
  "accounts": [
    { "id": "a1", "name": "Bargeld", "type": "cash", "color": "blue", "createdAt": "2026-11-08T10:00:00.000Z" },
    { "id": "a2", "name": "Sparkasse", "type": "bank", "color": "orange", "createdAt": "2026-11-08T10:00:00.000Z" }
  ],
  "transactions": [
    { "id": "t1", "kind": "opening", "amount": 20000, "fromAccountId": null, "toAccountId": "a1", "date": "2026-11-08", "note": "", "obligationId": null, "createdAt": "2026-11-08T10:00:00.000Z" },
    { "id": "t2", "kind": "opening", "amount": 49900, "fromAccountId": null, "toAccountId": "a2", "date": "2026-11-08", "note": "", "obligationId": null, "createdAt": "2026-11-08T10:00:00.000Z" },
    { "id": "t3", "kind": "transfer", "amount": 5000, "fromAccountId": "a2", "toAccountId": "a1", "date": "2026-11-08", "note": "Abgehoben", "obligationId": null, "createdAt": "2026-11-08T11:00:00.000Z" }
  ],
  "obligations": [
    { "id": "o1", "kind": "debt", "title": "Pizza", "counterparty": "Max", "amount": 1500, "dueDate": "2026-11-13", "accountId": "a1", "note": "", "createdAt": "2026-11-08T12:00:00.000Z", "paidAt": null, "paymentTransactionId": null }
  ],
  "settings": { "theme": "dark", "currency": "EUR" },
  "meta": { "createdAt": "2026-11-08T10:00:00.000Z", "updatedAt": "2026-11-08T12:00:00.000Z", "appVersion": "0.1.0" }
}`;

describe('loading data files', () => {
  it('reads a schema-1 file without losing anything', () => {
    const { data, fromVersion, migrated } = parseDocument(SCHEMA_1_FILE, '9.9.9');
    expect(fromVersion).toBe(1);
    expect(migrated).toBe(CURRENT_SCHEMA_VERSION !== 1);
    expect(data.accounts.map((a) => a.name)).toEqual(['Bargeld', 'Sparkasse']);
    expect(data.transactions).toHaveLength(3);
    expect(data.obligations[0]).toMatchObject({ title: 'Pizza', counterparty: 'Max', amount: 1500 });
    expect(data.settings.theme).toBe('dark');
    expect(data.meta.appVersion).toBe('0.1.0');
  });

  it('round-trips what the app writes', () => {
    const env = testEnv();
    let data = createAccount(emptyData(), { name: 'Bargeld', type: 'cash', color: 'blue', initialBalance: 20000 }, env);
    data = createAccount(data, { name: 'Revolut', type: 'bank', color: 'aqua', initialBalance: 10000 }, env);
    data = transfer(
      data,
      { fromAccountId: data.accounts[1]!.id, toAccountId: data.accounts[0]!.id, amount: 2500, date: '2026-11-08', note: '' },
      env,
    );
    const { data: loaded } = parseDocument(serializeData(data), 'test');
    expect(loaded).toEqual(data);
  });

  it('rejects broken files instead of starting empty', () => {
    expect(() => parseDocument('{"schemaVersion": 1, "accounts": [', 'test')).toThrow(InvalidDataError);
    expect(() => parseDocument('[]', 'test')).toThrow(InvalidDataError);
    expect(() => parseDocument('{"accounts": []}', 'test')).toThrow(InvalidDataError);
  });

  it('refuses files from a newer app version', () => {
    const newer = SCHEMA_1_FILE.replace('"schemaVersion": 1', `"schemaVersion": ${CURRENT_SCHEMA_VERSION + 1}`);
    expect(() => parseDocument(newer, 'test')).toThrow(DataTooNewError);
  });

  it('repairs damaged entries but keeps valid data', () => {
    const damaged = JSON.stringify({
      schemaVersion: 1,
      accounts: [
        { id: 'a1', name: 'Bargeld', type: 'unknown', color: 'pink-ish' },
        { name: 'no id' },
        { id: 'a1', name: 'duplicate' },
      ],
      transactions: [
        { id: 't1', kind: 'opening', amount: 1000.4, toAccountId: 'a1', date: 'bad', createdAt: '2026-11-08T10:00:00.000Z' },
        { id: 't2', kind: 'adjustment', amount: -300, fromAccountId: null, toAccountId: 'a1', date: '2026-11-08' },
        { id: 't3', amount: 'many' },
      ],
      obligations: [{ id: 'o1', amount: 500, accountId: 'gone', paymentTransactionId: 'gone' }],
      settings: { theme: 'neon', currency: 'usd' },
    });
    const { data } = parseDocument(damaged, 'test');
    expect(data.accounts).toHaveLength(1);
    expect(data.accounts[0]).toMatchObject({ type: 'other', color: 'blue' });
    expect(data.transactions).toHaveLength(2);
    expect(data.transactions[0]).toMatchObject({ amount: 1000, date: '2026-11-08' });
    // A negative amount means the opposite direction.
    expect(data.transactions[1]).toMatchObject({ amount: 300, fromAccountId: 'a1', toAccountId: null });
    expect(data.obligations[0]).toMatchObject({ kind: 'bill', accountId: null, paymentTransactionId: null });
    expect(data.settings).toEqual({ theme: 'system', currency: 'USD' });
  });
});

describe('migration framework', () => {
  const migrations: Record<number, Migration> = {
    2: (doc) => ({ ...doc, accounts: (doc.accounts as object[]).map((a) => ({ ...a, archived: false })) }),
    3: (doc) => ({ ...doc, renamed: true }),
  };

  it('applies every step in order and stamps the version', () => {
    const result = migrateDocument({ schemaVersion: 1, accounts: [{ id: 'a' }] }, 3, migrations);
    expect(result).toEqual({
      doc: { schemaVersion: 3, accounts: [{ id: 'a', archived: false }], renamed: true },
      fromVersion: 1,
      toVersion: 3,
    });
  });

  it('only applies the missing steps', () => {
    const result = migrateDocument({ schemaVersion: 2, accounts: [] }, 3, migrations);
    expect(result.doc).toEqual({ schemaVersion: 3, accounts: [], renamed: true });
  });

  it('fails loudly if a step is missing', () => {
    expect(() => migrateDocument({ schemaVersion: 1, accounts: [] }, 4, migrations)).toThrow(/Missing migration/);
  });
});
