import { Banknote, CreditCard, Landmark, PiggyBank, TrendingUp, Wallet, type LucideIcon } from 'lucide-react';
import type { AccountType } from '../../domain/types';

export interface AccountTypeInfo {
  value: AccountType;
  label: string;
  icon: LucideIcon;
}

export const ACCOUNT_TYPES: readonly AccountTypeInfo[] = [
  { value: 'bank', label: 'Girokonto', icon: Landmark },
  { value: 'cash', label: 'Bargeld', icon: Banknote },
  { value: 'savings', label: 'Sparkonto', icon: PiggyBank },
  { value: 'card', label: 'Kreditkarte', icon: CreditCard },
  { value: 'investment', label: 'Depot', icon: TrendingUp },
  { value: 'other', label: 'Sonstiges', icon: Wallet },
];

export function accountTypeInfo(type: AccountType): AccountTypeInfo {
  return ACCOUNT_TYPES.find((t) => t.value === type) ?? ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1]!;
}

/** Guesses the account type from its name ("Bargeld" -> cash, "Sparkasse" -> bank, ...). */
export function guessAccountType(name: string): AccountType | null {
  const n = name.toLowerCase();
  if (/\b(bar(geld)?|cash|portemonnaie|geldbeutel|brieftasche)\b/.test(n)) return 'cash';
  if (/spar(konto|schwein|buch|dose)|tagesgeld|festgeld|rücklage|notgroschen/.test(n)) return 'savings';
  if (/kredit|credit|\bkarte\b|visa|mastercard|amex/.test(n)) return 'card';
  if (/depot|\betf|aktie|broker|invest|krypto|crypto|bitcoin|trade republic|scalable/.test(n)) return 'investment';
  if (
    /\b(bank|giro\w*|sparkasse|volksbank|raiffeisen\w*|revolut|n26|dkb|ing|comdirect|commerzbank|postbank|paypal|wise|c24|vivid|bunq)\b/.test(
      n,
    )
  ) {
    return 'bank';
  }
  return null;
}
