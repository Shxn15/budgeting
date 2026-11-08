import { ArrowLeftRight, CalendarClock, ChartPie, ChevronRight, History, Minus, Plus, Repeat, Wallet } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo } from 'react';
import { formatMonthName, monthKey } from '../../domain/dates';
import { buildPortfolio, sumBalances } from '../../domain/ledger';
import { formatMoney } from '../../domain/money';
import { lastMonths, previousPeriodSpending, totalSpending } from '../../domain/spending';
import { totalMonthlyCost } from '../../domain/subscriptions';
import { sumUpcoming } from '../../domain/upcoming';
import { PageHeader, SectionHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatTile } from '../../components/ui/StatTile';
import { AccountCard } from '../accounts/AccountCard';
import { sortNewestFirst } from '../transactions/describe';
import { TransactionRow } from '../transactions/TransactionRow';
import { comparisonPeriod, relativeChange } from '../spending/compare';
import { UpcomingList } from '../upcoming/UpcomingList';
import {
  useAccounts,
  useBalances,
  useCurrency,
  useSubscriptions,
  useToday,
  useTransactions,
  useUpcoming,
} from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { PortfolioCard } from './PortfolioCard';
import './OverviewPage.css';

const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 0 });

export function OverviewPage() {
  const accounts = useAccounts();
  const balances = useBalances();
  const transactions = useTransactions();
  const subscriptions = useSubscriptions();
  const currency = useCurrency();
  const today = useToday();
  const upcoming = useUpcoming(today);
  const openDialog = useUiStore((s) => s.openDialog);
  const navigate = useUiStore((s) => s.navigate);

  const portfolio = useMemo(() => buildPortfolio(accounts, balances), [accounts, balances]);
  const recent = useMemo(() => sortNewestFirst(transactions).slice(0, 6), [transactions]);
  const total = sumBalances(balances);
  const upcomingSum = sumUpcoming(upcoming);
  const subscriptionCharges = upcoming.filter((item) => item.type === 'subscription').length;
  const free = total - upcomingSum;
  const activeSubs = subscriptions.filter((s) => !s.paused);
  const monthlySubs = totalMonthlyCost(subscriptions);
  const month = monthKey(today);
  const thisMonth = lastMonths(month, 1);
  const spentThisMonth = totalSpending(transactions, thisMonth);
  const previous = previousPeriodSpending(transactions, thisMonth, today);
  const change = relativeChange(spentThisMonth, previous.total);

  return (
    <div className="page">
      <PageHeader
        title="Übersicht"
        subtitle={weekday.format(new Date())}
        actions={
          accounts.length > 0 ? (
            <>
              <Button icon={<ArrowLeftRight />} onClick={() => openDialog({ type: 'transfer' })} disabled={accounts.length < 2}>
                Umbuchen
              </Button>
              <Button icon={<Plus />} onClick={() => openDialog({ type: 'booking', kind: 'income' })}>
                Einnahme
              </Button>
              <Button variant="primary" icon={<Minus />} onClick={() => openDialog({ type: 'booking', kind: 'expense' })}>
                Zahlung eintragen
              </Button>
            </>
          ) : (
            <Button variant="primary" icon={<Plus />} onClick={() => openDialog({ type: 'account' })}>
              Konto hinzufügen
            </Button>
          )
        }
      />

      {accounts.length === 0 ? (
        <Card className="welcome">
          <EmptyState
            icon={<Wallet />}
            title="Willkommen bei Budgeting"
            action={
              <Button variant="primary" size="lg" icon={<Plus />} onClick={() => openDialog({ type: 'account' })}>
                Erstes Konto anlegen
              </Button>
            }
          >
            Lege deine Konten an – zum Beispiel Bargeld, Sparkasse oder Revolut – und trage ein, wie viel Geld darauf
            ist. Das Diagramm zeigt dir dann sofort, wie sich dein Geld verteilt.
          </EmptyState>
        </Card>
      ) : (
        <>
          <PortfolioCard />

          <div className="stat-row overview__stats">
            <StatTile
              label="Frei verfügbar"
              icon={<Wallet />}
              value={formatMoney(free, currency)}
              tone={free < 0 ? 'danger' : undefined}
            >
              nach anstehenden Zahlungen
            </StatTile>
            <StatTile label="Anstehend" icon={<CalendarClock />} value={formatMoney(upcomingSum, currency)} onClick={() => navigate('obligations')}>
              {upcoming.length === 0
                ? 'Nichts offen'
                : `${upcoming.length === 1 ? '1 Zahlung' : `${upcoming.length} Zahlungen`}${
                    subscriptionCharges > 0 ? `, davon ${subscriptionCharges} Abos` : ''
                  }`}
            </StatTile>
            <StatTile label="Abos pro Monat" icon={<Repeat />} value={formatMoney(monthlySubs, currency)} onClick={() => navigate('subscriptions')}>
              {activeSubs.length === 0 ? 'Noch keine Abos' : activeSubs.length === 1 ? '1 aktives Abo' : `${activeSubs.length} aktive Abos`}
            </StatTile>
            <StatTile
              label={`Ausgaben im ${formatMonthName(month)}`}
              icon={<ChartPie />}
              value={formatMoney(spentThisMonth, currency)}
              onClick={() => navigate('spending')}
            >
              {change === null
                ? 'nach Tags auswerten'
                : Math.abs(change) < 0.005
                  ? `genauso viel wie ${comparisonPeriod(previous, 1)}`
                  : `${percent.format(Math.abs(change))} ${change > 0 ? 'mehr' : 'weniger'} als ${comparisonPeriod(previous, 1)}`}
            </StatTile>
          </div>

          <SectionHeader title="Konten" count={accounts.length} />
          <div className="accounts-grid">
            <AnimatePresence initial={false}>
              {accounts.map((account) => {
                const balance = balances.get(account.id) ?? 0;
                const slice = portfolio.slices.find((s) => s.account.id === account.id);
                return (
                  <AccountCard
                    key={account.id}
                    account={account}
                    balance={balance}
                    share={slice ? slice.share : null}
                    currency={currency}
                  />
                );
              })}
              <motion.button
                key="__add__"
                layout
                type="button"
                className="add-account"
                onClick={() => openDialog({ type: 'account' })}
              >
                <span className="add-account__icon">
                  <Plus />
                </span>
                Konto hinzufügen
              </motion.button>
            </AnimatePresence>
          </div>

          <div className="overview__columns">
            <Card
              title="Anstehende Zahlungen"
              actions={
                <Button size="sm" variant="ghost" onClick={() => navigate('obligations')}>
                  Alle <ChevronRight />
                </Button>
              }
            >
              {upcoming.length === 0 ? (
                <EmptyState
                  compact
                  icon={<CalendarClock />}
                  title="Nichts offen"
                  action={
                    <>
                      <Button size="sm" icon={<Plus />} onClick={() => openDialog({ type: 'obligation' })}>
                        Zahlung
                      </Button>{' '}
                      <Button size="sm" icon={<Repeat />} onClick={() => openDialog({ type: 'subscription' })}>
                        Abo
                      </Button>
                    </>
                  }
                >
                  Rechnungen, Schulden und Abos, die bald fällig sind, erscheinen hier.
                </EmptyState>
              ) : (
                <UpcomingList items={upcoming} today={today} limit={6} onMore={() => navigate('obligations')} />
              )}
            </Card>

            <Card
              title="Letzte Buchungen"
              actions={
                <Button size="sm" variant="ghost" onClick={() => navigate('transactions')}>
                  Alle <ChevronRight />
                </Button>
              }
            >
              {recent.length === 0 ? (
                <EmptyState compact icon={<History />} title="Noch keine Buchungen">
                  Zahlungen, Einnahmen, Abos und Umbuchungen erscheinen hier.
                </EmptyState>
              ) : (
                <div className="overview__list">
                  {recent.map((t) => (
                    <TransactionRow key={t.id} transaction={t} today={today} compact showDate />
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
