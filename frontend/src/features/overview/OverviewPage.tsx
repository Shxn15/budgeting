import { ArrowLeftRight, CalendarClock, ChevronRight, HandCoins, History, Plus, Wallet } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo } from 'react';
import { buildPortfolio, sumBalances } from '../../domain/ledger';
import { formatMoney } from '../../domain/money';
import { dueLabel, obligationTitle, openObligations, sumAmounts } from '../../domain/obligations';
import { PageHeader, SectionHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatTile } from '../../components/ui/StatTile';
import { AccountCard } from '../accounts/AccountCard';
import { ObligationRow } from '../obligations/ObligationRow';
import { sortNewestFirst } from '../transactions/describe';
import { TransactionRow } from '../transactions/TransactionRow';
import { useAccounts, useBalances, useCurrency, useObligations, useToday, useTransactions } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { PortfolioCard } from './PortfolioCard';
import './OverviewPage.css';

const weekday = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export function OverviewPage() {
  const accounts = useAccounts();
  const balances = useBalances();
  const obligations = useObligations();
  const transactions = useTransactions();
  const currency = useCurrency();
  const today = useToday();
  const openDialog = useUiStore((s) => s.openDialog);
  const navigate = useUiStore((s) => s.navigate);

  const portfolio = useMemo(() => buildPortfolio(accounts, balances), [accounts, balances]);
  const open = useMemo(() => openObligations(obligations), [obligations]);
  const recent = useMemo(() => sortNewestFirst(transactions).slice(0, 5), [transactions]);
  const total = sumBalances(balances);
  const openSum = sumAmounts(open);
  const free = total - openSum;
  const next = open[0] ?? null;

  return (
    <div className="page">
      <PageHeader
        title="Übersicht"
        subtitle={weekday.format(new Date())}
        actions={
          <>
            <Button icon={<ArrowLeftRight />} onClick={() => openDialog({ type: 'transfer' })} disabled={accounts.length < 2}>
              Umbuchen
            </Button>
            <Button variant="primary" icon={<Plus />} onClick={() => openDialog({ type: 'account' })}>
              Konto hinzufügen
            </Button>
          </>
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
              label="Offene Zahlungen"
              icon={<CalendarClock />}
              value={formatMoney(openSum, currency)}
              onClick={() => navigate('obligations')}
            >
              {open.length === 0 ? 'Nichts offen' : open.length === 1 ? '1 offener Eintrag' : `${open.length} offene Einträge`}
            </StatTile>
            <StatTile
              label="Frei verfügbar"
              icon={<Wallet />}
              value={formatMoney(free, currency)}
              tone={free < 0 ? 'danger' : undefined}
            >
              Vermögen minus offene Zahlungen
            </StatTile>
            <StatTile
              label="Als Nächstes fällig"
              icon={<HandCoins />}
              value={next ? obligationTitle(next) : '–'}
              onClick={() => navigate('obligations')}
            >
              {next ? `${dueLabel(next, today)} · ${formatMoney(next.amount, currency)}` : 'Keine offenen Zahlungen'}
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
              {open.length === 0 ? (
                <EmptyState
                  compact
                  icon={<CalendarClock />}
                  title="Nichts offen"
                  action={
                    <Button size="sm" icon={<Plus />} onClick={() => openDialog({ type: 'obligation' })}>
                      Eintragen
                    </Button>
                  }
                >
                  Schulden oder Rechnungen, die bald fällig sind, erscheinen hier.
                </EmptyState>
              ) : (
                <div className="overview__list">
                  {open.slice(0, 4).map((o) => (
                    <ObligationRow key={o.id} obligation={o} today={today} compact />
                  ))}
                  {open.length > 4 && (
                    <button type="button" className="overview__more" onClick={() => navigate('obligations')}>
                      + {open.length - 4} weitere
                    </button>
                  )}
                </div>
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
                  Umbuchungen und Änderungen am Kontostand erscheinen hier.
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
