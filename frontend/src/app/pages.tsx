import {
  ArrowLeftRight,
  CalendarClock,
  ChartPie,
  LayoutDashboard,
  Repeat,
  Settings,
  Tags,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { AccountPage } from '../features/accounts/AccountPage';
import { ObligationsPage } from '../features/obligations/ObligationsPage';
import { OverviewPage } from '../features/overview/OverviewPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { SpendingPage } from '../features/spending/SpendingPage';
import { SubscriptionsPage } from '../features/subscriptions/SubscriptionsPage';
import { TagsPage } from '../features/tags/TagsPage';
import { TransactionsPage } from '../features/transactions/TransactionsPage';
import type { PageId } from '../store/uiStore';

export interface PageDefinition {
  id: PageId;
  label: string;
  icon: LucideIcon;
  component: ComponentType;
  /** Where the entry sits in the sidebar; 'hidden' pages are opened from other pages. */
  position: 'top' | 'bottom' | 'hidden';
  /** Sidebar entry that is highlighted while a hidden page is open. */
  parent?: PageId;
}

/**
 * All pages of the app. To add a page: create the component in features/,
 * add its id to PageId in store/uiStore.ts and register it here.
 */
export const PAGES: readonly PageDefinition[] = [
  { id: 'overview', label: 'Übersicht', icon: LayoutDashboard, component: OverviewPage, position: 'top' },
  { id: 'account', label: 'Konto', icon: LayoutDashboard, component: AccountPage, position: 'hidden', parent: 'overview' },
  { id: 'obligations', label: 'Zahlungen & Schulden', icon: CalendarClock, component: ObligationsPage, position: 'top' },
  { id: 'subscriptions', label: 'Abos', icon: Repeat, component: SubscriptionsPage, position: 'top' },
  { id: 'spending', label: 'Ausgaben', icon: ChartPie, component: SpendingPage, position: 'top' },
  { id: 'tags', label: 'Tags', icon: Tags, component: TagsPage, position: 'top' },
  { id: 'transactions', label: 'Buchungen', icon: ArrowLeftRight, component: TransactionsPage, position: 'top' },
  { id: 'settings', label: 'Einstellungen', icon: Settings, component: SettingsPage, position: 'bottom' },
];
