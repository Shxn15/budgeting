import { describe, expect, it } from 'vitest';
import {
  countPeople,
  expectedLabel,
  openReceivables,
  receivableName,
  receivableNote,
  receivedReceivables,
  sumReceivables,
} from './receivables';
import type { Receivable } from './types';

function receivable(id: string, fields: Partial<Receivable> = {}): Receivable {
  return {
    id,
    counterparty: id,
    title: '',
    amount: 1000,
    expectedDate: null,
    accountId: null,
    tagId: null,
    note: '',
    createdAt: '2026-11-01T10:00:00.000Z',
    receivedAt: null,
    receiptTransactionId: null,
    ...fields,
  };
}

describe('receivables', () => {
  const list = [
    receivable('Ohne', { createdAt: '2026-11-02T10:00:00.000Z' }),
    receivable('Später', { expectedDate: '2026-12-01' }),
    receivable('Bald', { expectedDate: '2026-11-12' }),
    receivable('Erhalten', { receivedAt: '2026-11-05T10:00:00.000Z', expectedDate: '2026-11-05' }),
    receivable('max', { counterparty: 'Max', amount: 500 }),
    receivable('MAX2', { counterparty: ' max ', amount: 700 }),
  ];

  it('orders open ones by date, without a date last', () => {
    expect(openReceivables(list).map((r) => r.id)).toEqual(['Bald', 'Später', 'max', 'MAX2', 'Ohne']);
    expect(receivedReceivables(list).map((r) => r.id)).toEqual(['Erhalten']);
  });

  it('sums up and counts people by name', () => {
    const open = openReceivables(list);
    expect(sumReceivables(open)).toBe(3 * 1000 + 500 + 700);
    // "Max" and " max " are the same person.
    expect(countPeople(open)).toBe(4);
  });

  it('names the person first and describes the booking', () => {
    expect(receivableName({ counterparty: 'Max', title: 'Pizza' })).toBe('Max');
    expect(receivableName({ counterparty: '', title: 'Pfand' })).toBe('Pfand');
    expect(receivableNote({ counterparty: 'Max', title: 'Pizza' })).toBe('Pizza von Max');
    expect(receivableNote({ counterparty: 'Max', title: '' })).toBe('Von Max');
    expect(receivableNote({ counterparty: '', title: 'Pfand' })).toBe('Pfand');
  });

  it('says when the money is expected', () => {
    const today = '2026-11-09';
    expect(expectedLabel(null, today)).toBe('ohne Datum');
    expect(expectedLabel('2026-11-09', today)).toBe('heute erwartet');
    expect(expectedLabel('2026-11-10', today)).toBe('morgen erwartet');
    expect(expectedLabel('2026-11-16', today)).toBe('erwartet in 7 Tagen');
    expect(expectedLabel('2026-11-08', today)).toBe('seit gestern fällig');
    expect(expectedLabel('2026-11-01', today)).toBe('seit 8 Tagen fällig');
    expect(expectedLabel('2027-02-01', today)).toBe('erwartet am 1. Feb. 2027');
  });
});
