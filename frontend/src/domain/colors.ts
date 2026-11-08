import type { Account } from './types';

/**
 * Account colours. Stored in data.json as the palette key (e.g. "blue"), so
 * every theme can use its own, contrast-checked shade of the same hue.
 *
 * The order is deliberate: neighbouring slots stay distinguishable for
 * colour-blind readers (validated in light and dark mode). New accounts get
 * the first unused colour in this order. Do not reorder.
 * The matching CSS variables (--series-<key>) live in styles/tokens.css.
 */
export const ACCOUNT_COLORS = [
  { key: 'blue', label: 'Blau', light: '#2a78d6', dark: '#3987e5' },
  { key: 'orange', label: 'Orange', light: '#eb6834', dark: '#d95926' },
  { key: 'aqua', label: 'Türkis', light: '#1baf7a', dark: '#199e70' },
  { key: 'yellow', label: 'Gelb', light: '#eda100', dark: '#c98500' },
  { key: 'magenta', label: 'Pink', light: '#e87ba4', dark: '#d55181' },
  { key: 'green', label: 'Grün', light: '#008300', dark: '#008300' },
  { key: 'violet', label: 'Violett', light: '#6250d6', dark: '#9085e9' },
  { key: 'red', label: 'Rot', light: '#e34948', dark: '#e66767' },
] as const;

export type AccountColorKey = (typeof ACCOUNT_COLORS)[number]['key'];

const HEX = /^#[0-9a-fA-F]{6}$/;

/** A palette key or a custom "#rrggbb" colour. */
export function isAccountColor(value: unknown): value is string {
  return typeof value === 'string' && (ACCOUNT_COLORS.some((c) => c.key === value) || HEX.test(value));
}

/** First palette colour not used yet; if all are used, the least used one. */
export function nextAccountColor(accounts: readonly Pick<Account, 'color'>[]): AccountColorKey {
  const usage = new Map<string, number>();
  for (const a of accounts) usage.set(a.color, (usage.get(a.color) ?? 0) + 1);
  let best: AccountColorKey = ACCOUNT_COLORS[0].key;
  let bestCount = Number.POSITIVE_INFINITY;
  for (const c of ACCOUNT_COLORS) {
    const count = usage.get(c.key) ?? 0;
    if (count < bestCount) {
      best = c.key;
      bestCount = count;
    }
  }
  return best;
}

/** CSS colour value for an account colour; follows the active theme. */
export function accountColorCss(color: string): string {
  return ACCOUNT_COLORS.some((c) => c.key === color) ? `var(--series-${color})` : color;
}
