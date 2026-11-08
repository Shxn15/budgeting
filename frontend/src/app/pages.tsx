import { ArrowLeftRight, CalendarClock, LayoutDashboard, Settings, type LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import { ObligationsPage } from '../features/obligations/ObligationsPage';
import { OverviewPage } from '../features/overview/OverviewPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { TransactionsPage } from '../features/transactions/TransactionsPage';
import type { PageId } from '../store/uiStore';

export interface PageDefinition {
  id: PageId;
  label: string;
  icon: LucideIcon;
  component: ComponentType;
  /** Where the entry sits in the sidebar. */
  position: 'top' | 'bottom';
}

/**
 * All pages of the app. To add a page: create the component in features/,
 * add its id to PageId in store/uiStore.ts and register it here.
 */
export const PAGES: readonly PageDefinition[] = [
  { id: 'overview', label: 'Übersicht', icon: LayoutDashboard, component: OverviewPage, position: 'top' },
  { id: 'obligations', label: 'Zahlungen & Schulden', icon: CalendarClock, component: ObligationsPage, position: 'top' },
  { id: 'transactions', label: 'Buchungen', icon: ArrowLeftRight, component: TransactionsPage, position: 'top' },
  { id: 'settings', label: 'Einstellungen', icon: Settings, component: SettingsPage, position: 'bottom' },
];
