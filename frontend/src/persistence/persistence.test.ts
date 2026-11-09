import { describe, expect, it } from 'vitest';
import {
  addBooking,
  addObligation,
  addReceivable,
  addSavingsGoal,
  addSubscription,
  addTag,
  createAccount,
  markReceivableReceived,
  processDueSubscriptions,
  transfer,
  updateSettings,
} from '../domain/operations';
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

/**
 * A data.json exactly as version 0.2.0 of the app writes it (schema 2):
 * tags with and without picture, a subscription with automatic payment,
 * an expense with tag, a statistics-only booking and a tagged obligation.
 * Keep this fixture unchanged forever, like SCHEMA_1_FILE.
 */
const SCHEMA_2_FILE = `{
  "schemaVersion": 2,
  "accounts": [
    { "id": "a1", "name": "Bargeld", "type": "cash", "color": "blue", "createdAt": "2026-11-08T10:00:00.000Z" },
    { "id": "a2", "name": "Sparkasse", "type": "bank", "color": "orange", "createdAt": "2026-11-08T10:00:00.000Z" }
  ],
  "transactions": [
    { "id": "t1", "kind": "opening", "amount": 20000, "fromAccountId": null, "toAccountId": "a1", "date": "2026-11-08", "note": "", "obligationId": null, "subscriptionId": null, "tagId": null, "affectsBalance": true, "createdAt": "2026-11-08T10:00:00.000Z" },
    { "id": "t2", "kind": "opening", "amount": 49900, "fromAccountId": null, "toAccountId": "a2", "date": "2026-11-08", "note": "", "obligationId": null, "subscriptionId": null, "tagId": null, "affectsBalance": true, "createdAt": "2026-11-08T10:00:00.000Z" },
    { "id": "t3", "kind": "expense", "amount": 2350, "fromAccountId": "a2", "toAccountId": null, "date": "2026-11-07", "note": "Wocheneinkauf", "obligationId": null, "subscriptionId": null, "tagId": "g1", "affectsBalance": true, "createdAt": "2026-11-08T11:00:00.000Z" },
    { "id": "t4", "kind": "income", "amount": 150000, "fromAccountId": null, "toAccountId": "a2", "date": "2026-11-01", "note": "Gehalt", "obligationId": null, "subscriptionId": null, "tagId": null, "affectsBalance": true, "createdAt": "2026-11-08T11:05:00.000Z" },
    { "id": "t5", "kind": "subscription", "amount": 1299, "fromAccountId": "a2", "toAccountId": null, "date": "2026-11-08", "note": "Netflix", "obligationId": null, "subscriptionId": "s1", "tagId": null, "affectsBalance": true, "createdAt": "2026-11-08T11:10:00.000Z" },
    { "id": "t6", "kind": "expense", "amount": 899, "fromAccountId": "a1", "toAccountId": null, "date": "2026-10-28", "note": "", "obligationId": null, "subscriptionId": null, "tagId": "g2", "affectsBalance": false, "createdAt": "2026-11-08T11:15:00.000Z" }
  ],
  "obligations": [
    { "id": "o1", "kind": "bill", "title": "Fernseher", "counterparty": "", "amount": 49900, "dueDate": "2026-11-20", "accountId": "a2", "tagId": "g3", "note": "", "createdAt": "2026-11-08T12:00:00.000Z", "paidAt": null, "paymentTransactionId": null }
  ],
  "tags": [
    { "id": "g1", "name": "Rewe", "color": "red", "image": null, "createdAt": "2026-11-08T11:00:00.000Z" },
    { "id": "g2", "name": "Rossmann", "color": "violet", "image": null, "createdAt": "2026-11-08T11:15:00.000Z" },
    { "id": "g3", "name": "MediaMarkt", "color": "red", "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "createdAt": "2026-11-08T12:00:00.000Z" }
  ],
  "subscriptions": [
    { "id": "s1", "name": "Netflix", "amount": 1299, "intervalUnit": "month", "intervalCount": 1, "anchorDate": "2026-11-08", "nextDueDate": "2026-12-08", "accountId": "a2", "autoPay": true, "color": "red", "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "note": "", "paused": false, "createdAt": "2026-11-08T11:10:00.000Z" },
    { "id": "s2", "name": "Fitnessstudio", "amount": 2990, "intervalUnit": "month", "intervalCount": 1, "anchorDate": "2026-11-30", "nextDueDate": "2026-11-30", "accountId": null, "autoPay": false, "color": "green", "image": null, "note": "Vertrag bis 2027", "paused": true, "createdAt": "2026-11-08T11:20:00.000Z" }
  ],
  "settings": { "theme": "light", "currency": "EUR" },
  "meta": { "createdAt": "2026-11-08T10:00:00.000Z", "updatedAt": "2026-11-08T12:00:00.000Z", "appVersion": "0.2.0" }
}`;

/**
 * A data.json exactly as version 0.3.0 of the app writes it (schema 3):
 * money others owe me (open without date, open with date and account,
 * received with its income booking), nested savings goals in a savings
 * account and the new settings (colour theme, folded sections).
 * Keep this fixture unchanged forever, like SCHEMA_1_FILE.
 */
const SCHEMA_3_FILE = `{
  "schemaVersion": 3,
  "accounts": [
    { "id": "a1", "name": "Bargeld", "type": "cash", "color": "blue", "createdAt": "2026-11-08T10:00:00.000Z" },
    { "id": "a2", "name": "Sparkasse", "type": "bank", "color": "orange", "createdAt": "2026-11-08T10:00:00.000Z" },
    { "id": "a3", "name": "Tagesgeld", "type": "savings", "color": "green", "createdAt": "2026-11-09T09:00:00.000Z" }
  ],
  "transactions": [
    { "id": "t1", "kind": "opening", "amount": 20000, "fromAccountId": null, "toAccountId": "a1", "date": "2026-11-08", "note": "", "obligationId": null, "subscriptionId": null, "tagId": null, "affectsBalance": true, "createdAt": "2026-11-08T10:00:00.000Z" },
    { "id": "t2", "kind": "opening", "amount": 49900, "fromAccountId": null, "toAccountId": "a2", "date": "2026-11-08", "note": "", "obligationId": null, "subscriptionId": null, "tagId": null, "affectsBalance": true, "createdAt": "2026-11-08T10:00:00.000Z" },
    { "id": "t3", "kind": "opening", "amount": 250000, "fromAccountId": null, "toAccountId": "a3", "date": "2026-11-09", "note": "", "obligationId": null, "subscriptionId": null, "tagId": null, "affectsBalance": true, "createdAt": "2026-11-09T09:00:00.000Z" },
    { "id": "t4", "kind": "income", "amount": 3500, "fromAccountId": null, "toAccountId": "a1", "date": "2026-11-09", "note": "Konzertkarten von Lisa", "obligationId": null, "subscriptionId": null, "tagId": null, "affectsBalance": true, "createdAt": "2026-11-09T12:00:00.000Z" }
  ],
  "obligations": [],
  "tags": [
    { "id": "g1", "name": "Max", "color": "violet", "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "createdAt": "2026-11-09T10:00:00.000Z" }
  ],
  "subscriptions": [],
  "receivables": [
    { "id": "r1", "counterparty": "Max", "title": "Pizza", "amount": 1500, "expectedDate": null, "accountId": null, "tagId": "g1", "note": "", "createdAt": "2026-11-09T10:00:00.000Z", "receivedAt": null, "receiptTransactionId": null },
    { "id": "r2", "counterparty": "Oma", "title": "Geburtstag", "amount": 5000, "expectedDate": "2026-11-24", "accountId": "a2", "tagId": null, "note": "Überweisung", "createdAt": "2026-11-09T10:05:00.000Z", "receivedAt": null, "receiptTransactionId": null },
    { "id": "r3", "counterparty": "Lisa", "title": "Konzertkarten", "amount": 3500, "expectedDate": "2026-11-09", "accountId": "a1", "tagId": null, "note": "", "createdAt": "2026-11-09T10:10:00.000Z", "receivedAt": "2026-11-09T12:00:00.000Z", "receiptTransactionId": "t4" }
  ],
  "savingsGoals": [
    { "id": "sg1", "accountId": "a3", "parentId": null, "name": "Japan-Reise", "targetAmount": 300000, "targetDate": "2027-08-01", "allocated": 50000, "color": "red", "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "note": "Tokio und Kyoto", "createdAt": "2026-11-09T09:10:00.000Z" },
    { "id": "sg2", "accountId": "a3", "parentId": "sg1", "name": "Flug", "targetAmount": 120000, "targetDate": null, "allocated": 40000, "color": "blue", "image": null, "note": "", "createdAt": "2026-11-09T09:11:00.000Z" },
    { "id": "sg3", "accountId": "a3", "parentId": null, "name": "Notgroschen", "targetAmount": null, "targetDate": null, "allocated": 100000, "color": "yellow", "image": null, "note": "", "createdAt": "2026-11-09T09:12:00.000Z" }
  ],
  "settings": { "theme": "dark", "colorTheme": "rose", "collapsedSections": ["overview.recent"], "currency": "EUR" },
  "meta": { "createdAt": "2026-11-08T10:00:00.000Z", "updatedAt": "2026-11-09T12:00:00.000Z", "appVersion": "0.3.0" }
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

  it('upgrades a schema-1 file: everything stays, the lists of schema 2 start empty', () => {
    const { data, migrated, fromVersion } = parseDocument(SCHEMA_1_FILE, '0.2.0');
    expect(fromVersion).toBe(1);
    expect(migrated).toBe(true);
    expect(data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(data.tags).toEqual([]);
    expect(data.subscriptions).toEqual([]);
    expect(data.transactions.map((t) => [t.id, t.kind, t.amount, t.tagId, t.subscriptionId, t.affectsBalance])).toEqual([
      ['t1', 'opening', 20000, null, null, true],
      ['t2', 'opening', 49900, null, null, true],
      ['t3', 'transfer', 5000, null, null, true],
    ]);
    expect(data.obligations[0]).toMatchObject({ id: 'o1', title: 'Pizza', accountId: 'a1', tagId: null, dueDate: '2026-11-13' });
    expect(data.accounts.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(data.settings).toMatchObject({ theme: 'dark', currency: 'EUR' });
  });

  it('reads a schema-2 file without losing anything', () => {
    const { data, fromVersion, migrated } = parseDocument(SCHEMA_2_FILE, '9.9.9');
    expect(fromVersion).toBe(2);
    expect(migrated).toBe(CURRENT_SCHEMA_VERSION !== 2);
    expect(data).toMatchObject({ ...JSON.parse(SCHEMA_2_FILE), schemaVersion: CURRENT_SCHEMA_VERSION });
  });

  it('upgrades a schema-2 file to schema 3: everything stays, new lists start empty', () => {
    const { data, migrated, fromVersion } = parseDocument(SCHEMA_2_FILE, '0.3.0');
    const old = JSON.parse(SCHEMA_2_FILE);
    expect(fromVersion).toBe(2);
    expect(migrated).toBe(true);
    expect(data.schemaVersion).toBe(3);
    expect(data.receivables).toEqual([]);
    expect(data.savingsGoals).toEqual([]);
    expect(data.settings).toEqual({ theme: 'light', colorTheme: 'standard', collapsedSections: [], currency: 'EUR' });
    expect(data.accounts).toEqual(old.accounts);
    expect(data.transactions).toEqual(old.transactions);
    expect(data.obligations).toEqual(old.obligations);
    expect(data.tags).toEqual(old.tags);
    expect(data.subscriptions).toEqual(old.subscriptions);
    expect(data.meta).toEqual(old.meta);
  });

  it('upgrades a schema-1 file over all steps to the current schema', () => {
    const { data, fromVersion } = parseDocument(SCHEMA_1_FILE, '0.3.0');
    expect(fromVersion).toBe(1);
    expect(data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(data.obligations[0]).toMatchObject({ title: 'Pizza', counterparty: 'Max', tagId: null });
    expect(data).toMatchObject({ receivables: [], savingsGoals: [], settings: { theme: 'dark', colorTheme: 'standard' } });
  });

  it('reads a schema-3 file without changing anything', () => {
    const { data, fromVersion, migrated } = parseDocument(SCHEMA_3_FILE, '9.9.9');
    expect(fromVersion).toBe(3);
    expect(migrated).toBe(CURRENT_SCHEMA_VERSION !== 3);
    expect(data).toEqual(JSON.parse(SCHEMA_3_FILE));
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

  it('round-trips tags, subscriptions and the new bookings', () => {
    const env = testEnv();
    let data = createAccount(emptyData(), { name: 'Sparkasse', type: 'bank', color: 'orange', initialBalance: 49900 }, env);
    const bank = data.accounts[0]!.id;
    data = addTag(data, { name: 'PayPal', color: 'blue', image: PIXEL }, env);
    const tag = data.tags[0]!.id;
    data = addBooking(
      data,
      { kind: 'expense', accountId: bank, amount: 1999, date: '2026-11-08', tagId: tag, note: '', affectsBalance: false },
      env,
    );
    data = addObligation(
      data,
      { kind: 'bill', title: 'Kopfhörer', counterparty: '', amount: 7900, dueDate: '2026-11-20', accountId: bank, tagId: tag, note: '' },
      env,
    );
    data = addSubscription(
      data,
      {
        name: 'Spotify',
        amount: 1199,
        intervalUnit: 'month',
        intervalCount: 1,
        nextDueDate: '2026-11-08',
        accountId: bank,
        autoPay: true,
        color: 'green',
        image: PIXEL,
        note: '',
      },
      env,
    );
    data = processDueSubscriptions(data, '2026-11-08', env);
    const { data: loaded } = parseDocument(serializeData(data), 'test');
    expect(loaded).toEqual(data);
  });

  it('round-trips receivables, savings goals and the new settings', () => {
    const env = testEnv();
    let data = createAccount(emptyData(), { name: 'Bargeld', type: 'cash', color: 'blue', initialBalance: 20000 }, env);
    data = createAccount(data, { name: 'Tagesgeld', type: 'savings', color: 'green', initialBalance: 250000 }, env);
    const [cash, savings] = [data.accounts[0]!.id, data.accounts[1]!.id];
    data = addReceivable(
      data,
      { counterparty: 'Max', title: 'Pizza', amount: 1500, expectedDate: null, accountId: null, tagId: null, note: '' },
      env,
    );
    data = addReceivable(
      data,
      { counterparty: 'Lisa', title: '', amount: 3500, expectedDate: '2026-11-09', accountId: cash, tagId: null, note: '' },
      env,
    );
    data = markReceivableReceived(data, data.receivables[1]!.id, { accountId: cash, date: '2026-11-09' }, env);
    const goal = { name: 'Japan-Reise', parentId: null, targetAmount: 300000, targetDate: '2027-08-01', color: 'red', image: PIXEL, note: '' };
    data = addSavingsGoal(data, { ...goal, accountId: savings, allocate: 50000 }, env);
    data = addSavingsGoal(
      data,
      { ...goal, name: 'Flug', parentId: data.savingsGoals[0]!.id, targetDate: null, image: null, accountId: savings, allocate: 40000 },
      env,
    );
    data = updateSettings(data, { colorTheme: 'lavender', collapsedSections: ['overview.accounts'] });
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
    expect(data.settings).toEqual({ theme: 'system', colorTheme: 'standard', collapsedSections: [], currency: 'USD' });
  });

  it('repairs damaged tags and subscriptions', () => {
    const damaged = JSON.stringify({
      schemaVersion: 2,
      accounts: [{ id: 'a1', name: 'Bargeld', type: 'cash', color: 'blue' }],
      tags: [
        { id: 'g1', name: '  ', color: 'nope', image: 'https://example.com/x.png' },
        { id: 'g1', name: 'Duplikat' },
        { name: 'ohne id' },
      ],
      subscriptions: [
        { id: 's1', name: 'Netflix', amount: -1299, intervalUnit: 'day', intervalCount: 0, nextDueDate: 'bald', accountId: 'gone', autoPay: true },
        { id: 's2', name: 'Gym', amount: 2990, intervalUnit: 'week', intervalCount: 2, anchorDate: '2026-12-01', nextDueDate: '2026-11-03', accountId: 'a1', autoPay: true, paused: 'yes' },
        { id: 's3', amount: 'viel' },
      ],
      transactions: [
        { id: 't1', kind: 'subscription', amount: 1299, fromAccountId: 'a1', date: '2026-11-08', subscriptionId: 'gone', tagId: 'g1', affectsBalance: 'no' },
        { id: 't2', kind: 'mystery', amount: 100, toAccountId: 'a1', date: '2026-11-08', tagId: 'missing' },
      ],
      obligations: [{ id: 'o1', amount: 500, tagId: 'missing' }],
    });
    const { data } = parseDocument(damaged, 'test', new Date('2026-11-08T10:00:00.000Z'));
    expect(data.tags).toEqual([{ id: 'g1', name: 'Tag', color: 'blue', image: null, createdAt: '2026-11-08T10:00:00.000Z' }]);
    expect(data.subscriptions).toHaveLength(2);
    expect(data.subscriptions[0]).toMatchObject({
      amount: 1299,
      intervalUnit: 'month',
      intervalCount: 1,
      nextDueDate: '2026-11-08',
      anchorDate: '2026-11-08',
      accountId: null,
      autoPay: false,
    });
    // An anchor after the next date is not possible: the next date becomes the anchor.
    expect(data.subscriptions[1]).toMatchObject({ intervalUnit: 'week', intervalCount: 2, anchorDate: '2026-11-03', autoPay: true, paused: false });
    expect(data.transactions[0]).toMatchObject({ subscriptionId: null, tagId: 'g1', affectsBalance: true });
    expect(data.transactions[1]).toMatchObject({ kind: 'adjustment', tagId: null });
    expect(data.obligations[0]!.tagId).toBeNull();
  });

  it('repairs damaged receivables, savings goals and settings', () => {
    const damaged = JSON.stringify({
      schemaVersion: 3,
      accounts: [
        { id: 'a1', name: 'Bargeld', type: 'cash', color: 'blue' },
        { id: 'a2', name: 'Tagesgeld', type: 'savings', color: 'green' },
        { id: 'a3', name: 'Depot', type: 'investment', color: 'red' },
      ],
      transactions: [{ id: 't1', kind: 'opening', amount: 5000, toAccountId: 'a2', date: '2026-11-09' }],
      receivables: [
        { id: 'r1', counterparty: 'Max', amount: -1500, expectedDate: 'irgendwann', accountId: 'gone', tagId: 'gone', receivedAt: '', receiptTransactionId: 'gone' },
        { id: 'r1', counterparty: 'Duplikat', amount: 1 },
        { counterparty: 'ohne id', amount: 1 },
        { id: 'r2', amount: 'viel' },
      ],
      savingsGoals: [
        { id: 'g1', accountId: 'a2', name: '  ', targetAmount: -5, allocated: -300, targetDate: 'bald', color: 'nope', image: 'x' },
        { id: 'g2', accountId: 'a2', parentId: 'g3', name: 'A', allocated: 100 },
        { id: 'g3', accountId: 'a2', parentId: 'g2', name: 'B', allocated: 200 },
        { id: 'g4', accountId: 'a2', parentId: 'g5', name: 'Fremder Elternteil' },
        { id: 'g5', accountId: 'a3', name: 'Im Depot' },
        { id: 'g6', accountId: 'gone', name: 'Ohne Konto' },
        { id: 'g7', name: 'Ohne Konto-Angabe' },
        { id: 'g8', accountId: 'a2', parentId: 'g8', name: 'Selbst' },
      ],
      settings: { theme: 'dark', colorTheme: 'neon', collapsedSections: ['overview.accounts', 7, '', 'overview.accounts', 'overview.recent'] },
    });
    const { data } = parseDocument(damaged, 'test', new Date('2026-11-09T10:00:00.000Z'));
    expect(data.receivables).toHaveLength(1);
    expect(data.receivables[0]).toMatchObject({
      counterparty: 'Max',
      title: '',
      amount: 1500,
      expectedDate: null,
      accountId: null,
      tagId: null,
      receivedAt: null,
      receiptTransactionId: null,
    });
    expect(data.savingsGoals.map((g) => g.id)).toEqual(['g1', 'g2', 'g3', 'g4', 'g5', 'g8']);
    expect(data.savingsGoals[0]).toMatchObject({
      name: 'Sparziel',
      targetAmount: null,
      targetDate: null,
      allocated: 0,
      color: 'blue',
      image: null,
      parentId: null,
    });
    // A loop of parents is broken up, a parent in another account or itself is dropped.
    const parents = Object.fromEntries(data.savingsGoals.map((g) => [g.id, g.parentId]));
    expect([parents.g2, parents.g3].filter((p) => p === null)).toHaveLength(1);
    expect(parents.g4).toBeNull();
    expect(parents.g8).toBeNull();
    expect(data.settings).toEqual({
      theme: 'dark',
      colorTheme: 'standard',
      collapsedSections: ['overview.accounts', 'overview.recent'],
      currency: 'EUR',
    });
  });
});

/** A valid (1×1 px) picture as the UI would store it. */
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

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
