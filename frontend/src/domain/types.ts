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

/** A calendar month: "YYYY-MM". */
export type MonthKey = string;

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
 * history and makes statistics over time possible.
 */
export type TransactionKind =
  /** Starting balance entered when the account was created. */
  | 'opening'
  /** Manual correction of the balance ("Kontostand korrigieren"). */
  | 'adjustment'
  /** Money moved between two own accounts. */
  | 'transfer'
  /** Payment of an obligation (debt or bill). */
  | 'payment'
  /** Money added to an account ("Geld hinzufügen"), e.g. salary. Since schema 2. */
  | 'income'
  /** Money spent ("Geld entfernen", "Zahlung eintragen"), e.g. shopping at Rewe. Since schema 2. */
  | 'expense'
  /** A charge of a subscription (Abo). Since schema 2. */
  | 'subscription';

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
  /** Set when this booking is a charge of a subscription. Since schema 2. */
  subscriptionId: string | null;
  /** Tag for the statistics, e.g. "Rewe" or "PayPal". Since schema 2. */
  tagId: string | null;
  /**
   * false = only recorded for the statistics, the balance stays the same
   * (for payments that are already included in the balance). Since schema 2.
   */
  affectsBalance: boolean;
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
  /** Tag (e.g. "PayPal", "MediaMarkt"); its picture is shown in the list. Since schema 2. */
  tagId: string | null;
  note: string;
  createdAt: ISODateTime;
  /** null while the obligation is still open. */
  paidAt: ISODateTime | null;
  /** Booking created when it was paid from an account. */
  paymentTransactionId: string | null;
}

/**
 * A label such as "Rewe", "PayPal" or "Max" that can be attached to
 * bookings and obligations. The statistics group spending by tag.
 * Since schema 2.
 */
export interface Tag {
  id: string;
  name: string;
  /** Palette key (see colors.ts) for the initials avatar when there is no picture. */
  color: string;
  /** Profile picture: a small square image as data URL (shown round). null = initials. */
  image: string | null;
  createdAt: ISODateTime;
}

export type IntervalUnit = 'week' | 'month' | 'year';

/**
 * A recurring payment such as Netflix or the gym. Since schema 2.
 *
 * Charge dates are anchorDate + n × interval. Months are added with
 * clamping, so a subscription on the 31st is charged on the last day of
 * shorter months and on the 31st again afterwards.
 */
export interface Subscription {
  id: string;
  name: string;
  amount: Cents;
  /** Charged every `intervalCount` × `intervalUnit`, e.g. every 1 month or every 3 months. */
  intervalUnit: IntervalUnit;
  intervalCount: number;
  /** Reference date of the schedule (reset whenever the date or interval is edited). */
  anchorDate: ISODate;
  /** Next charge that has not been booked yet. */
  nextDueDate: ISODate;
  /** Account it is charged to. */
  accountId: string | null;
  /** Book the charge automatically on the due date (needs an account). */
  autoPay: boolean;
  /** Palette key for the initials avatar when there is no picture. */
  color: string;
  /** Profile picture as data URL (shown round). null = initials. */
  image: string | null;
  note: string;
  /** Paused subscriptions are not charged and not counted. */
  paused: boolean;
  createdAt: ISODateTime;
}

/**
 * Money someone else still owes me ("Max gibt mir noch 20 €"), possibly
 * without knowing when. Since schema 3.
 */
export interface Receivable {
  id: string;
  /** From whom, e.g. "Max". */
  counterparty: string;
  /** What for, e.g. "Pizza" or "Konzertkarten". */
  title: string;
  amount: Cents;
  /** When the money is expected; null = not known. */
  expectedDate: ISODate | null;
  /** Account the money will (probably) arrive on. */
  accountId: string | null;
  /** Optional tag, e.g. the person with a picture. */
  tagId: string | null;
  note: string;
  createdAt: ISODateTime;
  /** null while the money has not arrived yet. */
  receivedAt: ISODateTime | null;
  /** Income booking created when the money arrived on an account. */
  receiptTransactionId: string | null;
}

/**
 * A savings goal ("Japan-Reise") inside a savings account. Money of the
 * account is assigned to goals; goals can contain sub-goals ("Flug" inside
 * "Japan-Reise"). Since schema 3.
 *
 * Only the assignment is stored – the money itself stays on the account, so
 * the balance is still derived from the bookings alone.
 */
export interface SavingsGoal {
  id: string;
  /** Savings account the money is kept on. */
  accountId: string;
  /** Goal this one belongs to; null = top level. Always in the same account. */
  parentId: string | null;
  name: string;
  /** Amount to reach; null = no target. */
  targetAmount: Cents | null;
  /** Day by which the target should be reached; null = no date. */
  targetDate: ISODate | null;
  /** Money of the account assigned directly to this goal (sub-goals have their own). Always >= 0. */
  allocated: Cents;
  /** Palette key for the initials avatar when there is no picture. */
  color: string;
  /** Picture as data URL (shown round). null = initials. */
  image: string | null;
  note: string;
  createdAt: ISODateTime;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  /** Light or dark (or like Windows). */
  theme: ThemePreference;
  /** Colour theme such as "rose" (see domain/themes.ts). Since schema 3. */
  colorTheme: string;
  /** Sections the user folded away, e.g. "overview.accounts" (see store/selectors.ts). Since schema 3. */
  collapsedSections: string[];
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
  /** Since schema 2. */
  tags: Tag[];
  /** Since schema 2. */
  subscriptions: Subscription[];
  /** Since schema 3. */
  receivables: Receivable[];
  /** Since schema 3. */
  savingsGoals: SavingsGoal[];
  settings: Settings;
  meta: Meta;
}
