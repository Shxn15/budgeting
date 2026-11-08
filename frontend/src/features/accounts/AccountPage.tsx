import { ArrowLeft, ArrowLeftRight, CalendarClock, History, Minus, Plus, Repeat, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useMemo, type CSSProperties } from 'react';
import { accountColorCss } from '../../domain/colors';
import { formatMonthName, monthKey } from '../../domain/dates';
import { buildPortfolio } from '../../domain/ledger';
import { formatMoney } from '../../domain/money';
import { accountFlows, lastMonths } from '../../domain/spending';
import { totalMonthlyCost } from '../../domain/subscriptions';
import { sumUpcoming, upcomingForAccount } from '../../domain/upcoming';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { cx } from '../../components/ui/cx';
import { EmptyState } from '../../components/ui/EmptyState';
import { Menu } from '../../components/ui/Menu';
import { StatTile } from '../../components/ui/StatTile';
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
import { TransactionGroups } from '../transactions/TransactionGroups';
import { UpcomingList } from '../upcoming/UpcomingList';
import { AccountIcon } from './AccountIcon';
import { accountMenu } from './accountMenu';
import { accountTypeInfo } from './accountTypes';
import './AccountPage.css';

const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 });

/** One account: balance, add / remove money, what is coming up and its history. */
export function AccountPage() {
  const accountId = useUiStore((s) => s.accountId);
  const navigate = useUiStore((s) => s.navigate);
  const openDialog = useUiStore((s) => s.openDialog);
  const accounts = useAccounts();
  const balances = useBalances();
  const transactions = useTransactions();
  const subscriptions = useSubscriptions();
  const currency = useCurrency();
  const today = useToday();
  const upcoming = useUpcoming(today);
  const account = accounts.find((a) => a.id === accountId) ?? null;

  const history = useMemo(
    () => (account ? transactions.filter((t) => t.fromAccountId === account.id || t.toAccountId === account.id) : []),
    [transactions, account],
  );

  const back = (
    <button type="button" className="back-link" onClick={() => navigate('overview')}>
      <ArrowLeft aria-hidden />
      Übersicht
    </button>
  );

  if (!account) {
    return (
      <div className="page">
        {back}
        <Card>
          <EmptyState
            icon={<Wallet />}
            title="Dieses Konto gibt es nicht mehr"
            action={
              <Button variant="primary" onClick={() => navigate('overview')}>
                Zur Übersicht
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const balance = balances.get(account.id) ?? 0;
  const share = buildPortfolio(accounts, balances).slices.find((s) => s.account.id === account.id)?.share ?? null;
  const month = monthKey(today);
  const monthName = formatMonthName(month);
  const flows = accountFlows(transactions, account.id, lastMonths(month, 1));
  const mine = upcomingForAccount(upcoming, account.id);
  const upcomingSum = sumUpcoming(mine);
  const accountSubs = subscriptions.filter((s) => s.accountId === account.id && !s.paused);
  const typeInfo = accountTypeInfo(account.type);
  const afterUpcoming = balance - upcomingSum;

  return (
    <div className="page">
      {back}

      <section className="card account-hero" style={{ '--account-color': accountColorCss(account.color) } as CSSProperties}>
        <div className="account-hero__top">
          <AccountIcon account={account} size={52} />
          <div className="account-hero__titles">
            <h1 className="account-hero__name">{account.name}</h1>
            <p className="account-hero__type">
              {typeInfo.label}
              {share !== null && ` · ${percent.format(share)} deines Guthabens`}
            </p>
          </div>
          <Menu label={`Aktionen für ${account.name}`} items={accountMenu(account, { withMoney: false })} />
        </div>

        <div className="account-hero__money">
          <div>
            <p className="account-hero__label">Kontostand</p>
            <p className={cx('account-hero__balance', balance < 0 && 'amount-negative')}>{formatMoney(balance, currency)}</p>
            {upcomingSum > 0 && (
              <p className="account-hero__after">
                nach anstehenden Zahlungen:{' '}
                <strong className={cx(afterUpcoming < 0 && 'amount-negative')}>{formatMoney(afterUpcoming, currency)}</strong>
              </p>
            )}
          </div>
          <div className="account-hero__actions">
            <Button variant="primary" size="lg" icon={<Plus />} onClick={() => openDialog({ type: 'booking', kind: 'income', accountId: account.id })}>
              Geld hinzufügen
            </Button>
            <Button variant="primary" size="lg" icon={<Minus />} onClick={() => openDialog({ type: 'booking', kind: 'expense', accountId: account.id })}>
              Geld entfernen
            </Button>
            <Button size="lg" icon={<ArrowLeftRight />} onClick={() => openDialog({ type: 'transfer', fromAccountId: account.id })} disabled={accounts.length < 2}>
              Umbuchen
            </Button>
          </div>
        </div>
      </section>

      <div className="stat-row account-page__stats">
        <StatTile label={`Ausgaben im ${monthName}`} icon={<TrendingDown />} value={formatMoney(flows.spent, currency)}>
          Zahlungen und Abos
        </StatTile>
        <StatTile label={`Einnahmen im ${monthName}`} icon={<TrendingUp />} value={formatMoney(flows.received, currency)}>
          hinzugefügtes Geld
        </StatTile>
        <StatTile label="Anstehend" icon={<CalendarClock />} value={formatMoney(upcomingSum, currency)}>
          {mine.length === 0 ? 'nichts in den nächsten 30 Tagen' : mine.length === 1 ? '1 Zahlung' : `${mine.length} Zahlungen`}
        </StatTile>
        <StatTile
          label="Abos auf diesem Konto"
          icon={<Repeat />}
          value={formatMoney(totalMonthlyCost(accountSubs), currency)}
          onClick={() => navigate('subscriptions')}
        >
          {accountSubs.length === 1 ? '1 Abo · pro Monat' : `${accountSubs.length} Abos · pro Monat`}
        </StatTile>
      </div>

      <div className="account-page__columns">
        <Card
          title="Buchungen"
          padded={false}
          className="account-page__history"
          actions={
            <Button size="sm" variant="ghost" icon={<Minus />} onClick={() => openDialog({ type: 'booking', kind: 'expense', accountId: account.id })}>
              Zahlung eintragen
            </Button>
          }
        >
          {history.length === 0 ? (
            <EmptyState compact icon={<History />} title="Noch keine Buchungen">
              Hinzugefügtes und entferntes Geld, Zahlungen und Abos dieses Kontos erscheinen hier.
            </EmptyState>
          ) : (
            <TransactionGroups transactions={history} today={today} perspective={account.id} pageSize={40} />
          )}
        </Card>

        <Card title="Anstehend von diesem Konto">
          {mine.length === 0 ? (
            <EmptyState compact icon={<CalendarClock />} title="Nichts geplant">
              Zahlungen und Abos, die du diesem Konto zuordnest, erscheinen hier.
            </EmptyState>
          ) : (
            <UpcomingList items={mine} today={today} limit={8} onMore={() => navigate('obligations')} />
          )}
        </Card>
      </div>
    </div>
  );
}
