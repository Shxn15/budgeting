import { CalendarCheck, ChevronRight, HandCoins, Plus, Receipt } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { formatMoney } from '../../domain/money';
import { dueState, isOpen, openObligations, sumAmounts } from '../../domain/obligations';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { StatTile } from '../../components/ui/StatTile';
import { useCurrency, useObligations, useToday, useUpcoming } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { UPCOMING_DAYS } from '../../domain/upcoming';
import { UpcomingList } from '../upcoming/UpcomingList';
import { ObligationRow } from './ObligationRow';
import './ObligationsPage.css';

type Filter = 'open' | 'done';

export function ObligationsPage() {
  const obligations = useObligations();
  const today = useToday();
  const currency = useCurrency();
  const openDialog = useUiStore((s) => s.openDialog);
  const navigate = useUiStore((s) => s.navigate);
  const [filter, setFilter] = useState<Filter>('open');
  const upcoming = useUpcoming(today);
  const subscriptionCharges = useMemo(() => upcoming.filter((item) => item.type === 'subscription'), [upcoming]);

  const open = useMemo(() => openObligations(obligations), [obligations]);
  const done = useMemo(
    () => obligations.filter((o) => !isOpen(o)).sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? '')),
    [obligations],
  );
  const overdue = open.filter((o) => dueState(o, today) === 'overdue');
  const nextWeek = open.filter((o) => ['today', 'soon'].includes(dueState(o, today)));
  const debts = open.filter((o) => o.kind === 'debt');
  const creditors = new Set(debts.map((d) => d.counterparty.trim().toLowerCase() || d.id)).size;

  const list = filter === 'open' ? open : done;

  return (
    <div className="page">
      <PageHeader
        title="Zahlungen & Schulden"
        subtitle="Was du anderen schuldest und was demnächst bezahlt werden muss."
        actions={
          <>
            <Button icon={<HandCoins />} onClick={() => openDialog({ type: 'obligation', kind: 'debt' })}>
              Schulden eintragen
            </Button>
            <Button variant="primary" icon={<Plus />} onClick={() => openDialog({ type: 'obligation', kind: 'bill' })}>
              Zahlung eintragen
            </Button>
          </>
        }
      />

      <div className="stat-row">
        <StatTile label="Offen insgesamt" value={formatMoney(sumAmounts(open), currency)}>
          {open.length === 1 ? '1 offener Eintrag' : `${open.length} offene Einträge`}
        </StatTile>
        <StatTile
          label="Überfällig"
          value={formatMoney(sumAmounts(overdue), currency)}
          tone={overdue.length > 0 ? 'danger' : undefined}
        >
          {overdue.length === 0 ? 'Nichts überfällig' : overdue.length === 1 ? '1 Eintrag' : `${overdue.length} Einträge`}
        </StatTile>
        <StatTile label="In den nächsten 7 Tagen" value={formatMoney(sumAmounts(nextWeek), currency)}>
          {nextWeek.length === 1 ? '1 Zahlung' : `${nextWeek.length} Zahlungen`}
        </StatTile>
        <StatTile label="Schulden bei Personen" value={formatMoney(sumAmounts(debts), currency)}>
          {creditors === 1 ? '1 Person' : `${creditors} Personen`}
        </StatTile>
      </div>

      <Card padded={false} className="ob-card">
        <div className="ob-card__toolbar">
          <SegmentedControl<Filter>
            label="Anzeigen"
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'open', label: `Offen (${open.length})` },
              { value: 'done', label: `Erledigt (${done.length})` },
            ]}
          />
        </div>

        {list.length === 0 ? (
          filter === 'open' ? (
            <EmptyState
              icon={<CalendarCheck />}
              title={done.length > 0 ? 'Alles erledigt' : 'Noch nichts eingetragen'}
              action={
                <Button variant="primary" icon={<Receipt />} onClick={() => openDialog({ type: 'obligation' })}>
                  Eintrag hinzufügen
                </Button>
              }
            >
              Trage ein, wenn du jemandem Geld schuldest oder in ein paar Tagen etwas bezahlen musst – so siehst du
              immer, was davon noch frei verfügbar ist.
            </EmptyState>
          ) : (
            <EmptyState icon={<CalendarCheck />} title="Noch nichts erledigt">
              Bezahlte Einträge landen hier.
            </EmptyState>
          )
        ) : (
          <div className="ob-list">
            <AnimatePresence initial={false} mode="popLayout">
              {list.map((o) => (
                <motion.div
                  key={o.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                >
                  <ObligationRow obligation={o} today={today} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </Card>

      {subscriptionCharges.length > 0 && (
        <Card
          className="ob-subscriptions"
          title={`Abos in den nächsten ${UPCOMING_DAYS} Tagen`}
          actions={
            <Button size="sm" variant="ghost" onClick={() => navigate('subscriptions')}>
              Alle Abos <ChevronRight />
            </Button>
          }
        >
          <UpcomingList items={subscriptionCharges} today={today} />
        </Card>
      )}
    </div>
  );
}
