import {
  ArrowLeftRight,
  BanknoteArrowDown,
  CalendarClock,
  ChartPie,
  ChevronRight,
  History,
  Minus,
  Plus,
  Repeat,
  Wallet,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useId, useMemo, type CSSProperties } from 'react';
import { formatMonthName, monthKey } from '../../domain/dates';
import { buildPortfolio, sumBalances } from '../../domain/ledger';
import { formatMoney } from '../../domain/money';
import { countPeople, openReceivables, sumReceivables } from '../../domain/receivables';
import { lastMonths, previousPeriodSpending, totalSpending } from '../../domain/spending';
import { remainingThisMonth, totalMonthlyCost } from '../../domain/subscriptions';
import { computeFreeMoney, planCount } from '../../domain/upcoming';
import { PageHeader, SectionHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Collapse } from '../../components/ui/Collapse';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatTile } from '../../components/ui/StatTile';
import { AccountCard } from '../accounts/AccountCard';
import { ReceivablesList } from '../receivables/ReceivablesList';
import { sortNewestFirst } from '../transactions/describe';
import { TransactionRow } from '../transactions/TransactionRow';
import { comparisonPeriod, relativeChange } from '../spending/compare';
import { UpcomingPlanList } from '../upcoming/UpcomingList';
import {
  useAccounts,
  useBalances,
  useCollapsed,
  useCurrency,
  useReceivables,
  useSubscriptions,
  useToday,
  useTransactions,
  useUpcomingPlan,
} from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { PortfolioCard } from './PortfolioCard';
import './OverviewPage.css';

const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 0 });
const RECENT_COUNT = 8;

export function OverviewPage() {
  const accounts = useAccounts();
  const balances = useBalances();
  const transactions = useTransactions();
  const subscriptions = useSubscriptions();
  const receivables = useReceivables();
  const currency = useCurrency();
  const today = useToday();
  const plan = useUpcomingPlan(today);
  const openDialog = useUiStore((s) => s.openDialog);
  const navigate = useUiStore((s) => s.navigate);
  const [accountsCollapsed, toggleAccounts] = useCollapsed('overview.accounts');
  const [recentCollapsed, toggleRecent] = useCollapsed('overview.recent');
  const accountsId = useId();

  const portfolio = useMemo(() => buildPortfolio(accounts, balances), [accounts, balances]);
  const recent = useMemo(() => sortNewestFirst(transactions).slice(0, RECENT_COUNT), [transactions]);
  const openOwed = useMemo(() => openReceivables(receivables), [receivables]);
  const total = sumBalances(balances);
  const month = monthKey(today);
  const monthName = formatMonthName(month);

  // "Frei verfügbar": everything except savings accounts, minus what is still due this month.
  const free = computeFreeMoney(accounts, balances, plan);
  const hasSavings = accounts.some((a) => a.type === 'savings');
  const dueNow = plan.current.items;
  const subscriptionCharges = dueNow.filter((item) => item.type === 'subscription').length;

  const activeSubs = subscriptions.filter((s) => !s.paused);
  const monthlySubs = totalMonthlyCost(subscriptions);
  const subsLeft = remainingThisMonth(subscriptions, today);

  const thisMonth = lastMonths(month, 1);
  const spentThisMonth = totalSpending(transactions, thisMonth);
  const previous = previousPeriodSpending(transactions, thisMonth, today);
  const change = relativeChange(spentThisMonth, previous.total);
  const owedSum = sumReceivables(openOwed);

  const dueNote =
    dueNow.length === 0
      ? `im ${monthName} nichts mehr offen`
      : `${dueNow.length === 1 ? '1 Zahlung' : `${dueNow.length} Zahlungen`}${
          plan.undated.items.length > 0
            ? ` · +${formatMoney(plan.undated.total, currency)} ohne Datum`
            : subscriptionCharges > 0
              ? `, davon ${subscriptionCharges} ${subscriptionCharges === 1 ? 'Abo' : 'Abos'}`
              : ''
        }`;

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
              value={formatMoney(free.free, currency)}
              tone={free.free < 0 ? 'danger' : undefined}
              title={`${formatMoney(free.available, currency)} auf deinen Konten${
                hasSavings ? ' (ohne Sparkonten)' : ''
              } minus ${formatMoney(free.due, currency)}, die im ${monthName} noch bezahlt werden müssen`}
            >
              {hasSavings ? `ohne Sparkonten, nach den Zahlungen im ${monthName}` : `nach den Zahlungen im ${monthName}`}
            </StatTile>
            <StatTile
              label={`Anstehend im ${monthName}`}
              icon={<CalendarClock />}
              value={formatMoney(plan.current.total, currency)}
              onClick={() => navigate('obligations')}
            >
              {dueNote}
            </StatTile>
            <StatTile
              label="Abos pro Monat"
              icon={<Repeat />}
              value={formatMoney(monthlySubs, currency)}
              onClick={() => navigate('subscriptions')}
            >
              {activeSubs.length === 0 ? (
                'Noch keine Abos'
              ) : (
                <>
                  {activeSubs.length === 1 ? '1 Abo' : `${activeSubs.length} Abos`} ·{' '}
                  {subsLeft.total > 0 ? (
                    <>
                      noch <strong className="overview__strong">{formatMoney(subsLeft.total, currency)}</strong> im {monthName}
                    </>
                  ) : (
                    `im ${monthName} alles bezahlt`
                  )}
                </>
              )}
            </StatTile>
            <StatTile
              label={`Ausgaben im ${monthName}`}
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

          <SectionHeader
            title="Konten"
            count={accounts.length}
            collapsed={accountsCollapsed}
            onToggle={toggleAccounts}
            controls={accountsId}
            collapsedNote={formatMoney(total, currency)}
          />
          <Collapse open={!accountsCollapsed} id={accountsId}>
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
          </Collapse>

          <div className="overview__columns">
            <Card
              title="Anstehende Zahlungen"
              actions={
                <Button size="sm" variant="ghost" onClick={() => navigate('obligations')}>
                  Alle <ChevronRight />
                </Button>
              }
            >
              {planCount(plan) === 0 ? (
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
                  Rechnungen, Schulden und Abos, die bald fällig sind, erscheinen hier – Monat für Monat.
                </EmptyState>
              ) : (
                <UpcomingPlanList plan={plan} today={today} limit={6} />
              )}
            </Card>

            <Card
              title={
                <>
                  Bekomme ich noch
                  {openOwed.length > 0 && <span className="card__title-note">{formatMoney(owedSum, currency)}</span>}
                </>
              }
              actions={
                <>
                  <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => openDialog({ type: 'receivable' })}>
                    Eintragen
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => navigate('obligations')}>
                    Alle <ChevronRight />
                  </Button>
                </>
              }
            >
              {openOwed.length === 0 ? (
                <EmptyState
                  compact
                  icon={<BanknoteArrowDown />}
                  title="Niemand schuldet dir Geld"
                  action={
                    <Button size="sm" icon={<Plus />} onClick={() => openDialog({ type: 'receivable' })}>
                      Eintragen
                    </Button>
                  }
                >
                  Hast du jemandem etwas ausgelegt? Trag es hier ein – auch wenn du noch nicht weißt, wann du das Geld
                  zurückbekommst.
                </EmptyState>
              ) : (
                <>
                  <p className="overview__owed-note">
                    {countPeople(openOwed) === 1 ? 'von 1 Person' : `von ${countPeople(openOwed)} Personen`} · zählt nicht
                    zu „Frei verfügbar“, bis es da ist
                  </p>
                  <ReceivablesList list={openOwed} today={today} compact limit={6} />
                </>
              )}
            </Card>
          </div>

          <Card
            className="overview__recent"
            title="Letzte Buchungen"
            collapsed={recentCollapsed}
            onToggle={toggleRecent}
            collapsedNote={transactions.length === 1 ? '1 Buchung' : `${transactions.length} Buchungen`}
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
              <div className="overview__list" style={{ '--rows': Math.ceil(recent.length / 2) } as CSSProperties}>
                {recent.map((t) => (
                  <TransactionRow key={t.id} transaction={t} today={today} compact showDate />
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
