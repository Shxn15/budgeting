import { describe, expect, it } from 'vitest';
import { centsToInput, formatMoney, parseMoney } from './money';

describe('parseMoney', () => {
  it.each([
    ['12', 1200],
    ['12,5', 1250],
    ['12,50', 1250],
    ['12.50', 1250],
    ['0,99', 99],
    [',5', 50],
    ['5,', 500],
    ['1.234', 123400],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['1.234.567', 123456700],
    ['1 234,56 €', 123456],
    ['€ 20', 2000],
    ['20 EUR', 2000],
    ['-20', -2000],
    ['−7,10', -710],
    ['+3', 300],
    ['0', 0],
    ['1,005', 101],
    ['1,004', 100],
    ['0.123', 12],
  ])('parses %s', (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '12a', ',', '.', '1,2.3,4', '1.23.4', '--5', '1e5'])(
    'rejects %s',
    (input) => {
      expect(parseMoney(input)).toBeNull();
    },
  );

  it('rejects absurdly large values', () => {
    expect(parseMoney('9999999999999999999')).toBeNull();
  });
});

describe('formatting', () => {
  it('formats German currency', () => {
    expect(formatMoney(123456)).toBe('1.234,56 €');
    expect(formatMoney(-500)).toBe('-5,00 €');
    expect(formatMoney(500, 'EUR', { sign: true })).toBe('+5,00 €');
    expect(formatMoney(0, 'EUR', { sign: true })).toBe('0,00 €');
  });

  it('round-trips through the input format', () => {
    for (const value of [0, 5, 99, 100, 123456, -2050]) {
      expect(parseMoney(centsToInput(value))).toBe(value);
    }
    expect(centsToInput(123456)).toBe('1234,56');
    expect(centsToInput(1200)).toBe('12');
  });
});
