import type { Cents } from './types';

/** Upper bound for amounts (1 trillion euros) – keeps all maths in safe integers. */
export const MAX_CENTS = 100_000_000_000_000;

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, signDisplay: 'auto' | 'exceptZero'): Intl.NumberFormat {
  const key = `${currency}|${signDisplay}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat('de-DE', { style: 'currency', currency, signDisplay });
    formatters.set(key, f);
  }
  return f;
}

/** 123456 -> "1.234,56 €". With `sign: true`: "+1.234,56 €". */
export function formatMoney(cents: Cents, currency = 'EUR', options: { sign?: boolean } = {}): string {
  return formatter(currency, options.sign ? 'exceptZero' : 'auto').format(cents / 100);
}

/** 123456 -> "1234,56" – the format used to prefill input fields. */
export function centsToInput(cents: Cents): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const rest = abs % 100;
  const text = rest === 0 ? String(euros) : `${euros},${String(rest).padStart(2, '0')}`;
  return negative ? `-${text}` : text;
}

/**
 * Parses what a (German) user types into a money field and returns cents.
 * Accepts "12", "12,5", "12,50", "1.234,56", "1234.56", "1 234,56 €", "-20".
 * Returns null if the input is empty or not a number.
 */
export function parseMoney(input: string): Cents | null {
  let s = input.replace(/[\s  ]/g, '').replace(/€|eur/gi, '');
  if (s === '') return null;

  let negative = false;
  if (s.startsWith('-') || s.startsWith('−')) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;

  let intPart: string;
  let fracPart = '';
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    // Both separators: the last one is the decimal separator.
    const decimal = lastComma > lastDot ? ',' : '.';
    const thousands = decimal === ',' ? '.' : ',';
    const idx = s.lastIndexOf(decimal);
    intPart = s.slice(0, idx);
    fracPart = s.slice(idx + 1);
    if (intPart.includes(decimal) || fracPart.includes(thousands)) return null;
    intPart = intPart.split(thousands).join('');
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? ',' : '.';
    const parts = s.split(sep);
    if (parts.length > 2) {
      // "1.234.567" – only thousands separators.
      if (parts.slice(1).some((p) => p.length !== 3)) return null;
      intPart = parts.join('');
    } else {
      const [a = '', b = ''] = parts;
      // "1.234" is read as one thousand two hundred thirty-four (German style).
      if (sep === '.' && b.length === 3 && a.length >= 1 && a.length <= 3 && Number(a) !== 0) {
        intPart = a + b;
      } else {
        intPart = a;
        fracPart = b;
      }
    }
  } else {
    intPart = s;
  }

  if (intPart === '') intPart = '0';
  if (!/^\d+$/.test(intPart) || !/^\d*$/.test(fracPart)) return null;

  const frac3 = (fracPart + '000').slice(0, 3);
  let cents = Number(intPart) * 100 + Number(frac3.slice(0, 2));
  if (Number(frac3[2]) >= 5) cents += 1; // round half up to whole cents
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) return null;
  return negative && cents !== 0 ? -cents : cents;
}
