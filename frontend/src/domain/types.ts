/**
 * Domain model of the app.
 *
 * IMPORTANT: These types describe the data document that is stored on disk
 * (data.json). Every change here that affects stored data needs a new schema
 * version plus a migration, see src/persistence/migrations.ts.
 */

/** Money is always stored as integer cents to avoid floating point errors. */
export type Cents = number;

/** A calendar day in local time: "YYYY-MM-DD". */
export type ISODate = string;

/** A point in time: new Date().toISOString(). */
export type ISODateTime = string;

export type AccountType = 'cash' | 'bank' | 'savings' | 'card' | 'investment' | 'other';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /** Hex colour used in the chart and on the account card. */
  color: string;
  createdAt: ISODateTime;
}

/**
 * Kinds of bookings. The balance of an account is never stored directly; it
 * is always the sum of its bookings (see ledger.ts). That keeps a complete
 * history and makes statistics over time possible later on.
 */
export type TransactionKind =
  /** Starting balance entered when the account was created. */
  | 'opening'
  /** Manual correction of the balance ("Kontostand ändern"). */
  | 'adjustment'
  /** Money moved between two own accounts. */
  | 'transfer'
  /** Payment of an obligation (debt or bill). */
  | 'payment';

export interface Transaction {
  id: string;
  kind: TransactionKind;
  /** Always > 0. The direction comes from fromAccountId / toAccountId. */
  amount: Cents;
  /** Account the money leaves. null = outside world (or a deleted account). */
  fromAccountId: string | null;
  /** Account the money arrives at. null = outside world (or a deleted account). */
  toAccountId: string | null;
  date: ISODate;
  note: string;
  /** Set when this booking pays an obligation. */
  obligationId: string | null;
  createdAt: ISODateTime;
}

/** debt = "Ich schulde jemandem Geld", bill = "Ich muss etwas bezahlen". */
export type ObligationKind = 'debt' | 'bill';

export interface Obligation {
  id: string;
  kind: ObligationKind;
  /** What it is for, e.g. "Miete" or "Konzertkarten". */
  title: string;
  /** Whom the money is owed to, e.g. "Max" or "Vermieter". */
  counterparty: string;
  amount: Cents;
  /** null = no due date. */
  dueDate: ISODate | null;
  /** Account it will (probably) be paid from. */
  accountId: string | null;
  note: string;
  createdAt: ISODateTime;
  /** null while the obligation is still open. */
  paidAt: ISODateTime | null;
  /** Booking created when it was paid from an account. */
  paymentTransactionId: string | null;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemePreference;
  /** ISO 4217 currency code. */
  currency: string;
}

export interface Meta {
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /** App version that last saved the document (informational). */
  appVersion: string;
}

/** The whole document that is stored in data.json. */
export interface AppData {
  schemaVersion: number;
  accounts: Account[];
  transactions: Transaction[];
  obligations: Obligation[];
  settings: Settings;
  meta: Meta;
}
