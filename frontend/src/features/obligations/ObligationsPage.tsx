import { BanknoteArrowDown, CalendarCheck, HandCoins, Plus, Receipt } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { formatMonthName } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import { isOpen, openObligations, sumAmounts } from '../../domain/obligations';
import { countPeople, openReceivables, receivedReceivables, sumReceivables } from '../../domain/receivables';
import { planCount, sumUpcoming } from '../../domain/upcoming';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Collapse, ToggleRow } from '../../components/ui/Collapse';
import { EmptyState } from '../../components/ui/EmptyState';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { StatTile } from '../../components/ui/StatTile';
import { useCurrency, useObligations, useReceivables, useToday, useUpcomingPlan } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { ReceivablesList } from '../receivables/ReceivablesList';
import { UpcomingPlanList } from '../upcoming/UpcomingList';
import { ObligationRow } from './ObligationRow';
import './ObligationsPage.css';

type Filter = 'open' | 'done';

export function ObligationsPage() {
  const obligations = useObligations();
  const receivables = useReceivables();
  const today = useToday();
  const currency = useCurrency();
  const openDialog = useUiStore((s) => s.openDialog);
  const [filter, setFilter] = useState<Filter>('open');
  const [showReceived, setShowReceived] = useState(false);
  const plan = useUpcomingPlan(today);
  const monthName = formatMonthName(plan.month);

  const open = useMemo(() => openObligations(obligations), [obligations]);
  const done = useMemo(
    () => obligations.filter((o) => !isOpen(o)).sort((a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? '')),
    [obligations],
  );
  const owed = useMemo(() => openReceivables(receivables), [receivables]);
  const received = useMemo(() => receivedReceivables(receivables), [receivables]);

  // Late: obligations past their date and manual subscription charges that were not paid.
  const overdue = plan.current.items.filter(
    (item) => item.date !== null && item.date < today && (item.type === 'obligation' || !item.subscription.autoPay),
  );
  const debts = open.filter((o) => o.kind === 'debt');
  const creditors = new Set(debts.map((d) => d.counterparty.trim().toLowerCase() || d.id)).size;
  const people = countPeople(owed);

  return (
    <div className="page">
      <PageHeader
        title="Zahlungen & Schulden"
        subtitle="Was du bezahlen musst, wem du Geld schuldest – und was du noch bekommst."
        actions={
          <>
            <Button icon={<BanknoteArrowDown />} onClick={() => openDialog({ type: 'receivable' })}>
              Geld bekommen
            </Button>
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
        <StatTile label={`Noch im ${monthName}`} value={formatMoney(plan.current.total, currency)}>
          {plan.current.items.length === 0
            ? 'Nichts mehr offen'
            : plan.current.items.length === 1
              ? '1 Zahlung'
              : `${plan.current.items.length} Zahlungen`}
          {plan.undated.items.length > 0 && ` · +${formatMoney(plan.undated.total, currency)} ohne Datum`}
        </StatTile>
        <StatTile
          label="Überfällig"
          value={formatMoney(sumUpcoming(overdue), currency)}
          tone={overdue.length > 0 ? 'danger' : undefined}
        >
          {overdue.length === 0 ? 'Nichts überfällig' : overdue.length === 1 ? '1 Zahlung' : `${overdue.length} Zahlungen`}
        </StatTile>
        <StatTile label="Schulden bei Personen" value={formatMoney(sumAmounts(debts), currency)}>
          {creditors === 1 ? '1 Person' : `${creditors} Personen`}
        </StatTile>
        <StatTile label="Bekomme ich noch" value={formatMoney(sumReceivables(owed), currency)} tone={owed.length > 0 ? 'positive' : undefined}>
          {owed.length === 0 ? 'Niemand schuldet dir Geld' : people === 1 ? 'von 1 Person' : `von ${people} Personen`}
        </StatTile>
      </div>

      <Card padded={false} className="ob-card">
        <div className="ob-card__toolbar">
          <h2 className="ob-card__title">Anstehende Zahlungen</h2>
          <SegmentedControl<Filter>
            label="Anzeigen"
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'open', label: 'Offen' },
              { value: 'done', label: `Erledigt (${done.length})` },
            ]}
          />
        </div>

        {filter === 'open' ? (
          planCount(plan) === 0 ? (
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
            <div className="ob-plan">
              <UpcomingPlanList plan={plan} today={today} full />
              <p className="ob-plan__hint">
                Abos siehst du hier bis Ende {formatMonthName(plan.until.slice(0, 7))}. Spätere Monate klappst du mit einem
                Klick auf.
              </p>
            </div>
          )
        ) : done.length === 0 ? (
          <EmptyState icon={<CalendarCheck />} title="Noch nichts erledigt">
            Bezahlte Einträge landen hier.
          </EmptyState>
        ) : (
          <div className="ob-list">
            <AnimatePresence initial={false} mode="popLayout">
              {done.map((o) => (
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

      <Card
        className="ob-receivables"
        title={
          <>
            Bekomme ich noch
            {owed.length > 0 && <span className="card__title-note">{formatMoney(sumReceivables(owed), currency)}</span>}
          </>
        }
        actions={
          <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => openDialog({ type: 'receivable' })}>
            Eintragen
          </Button>
        }
      >
        {owed.length === 0 ? (
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
            Hast du jemandem etwas ausgelegt? Trag es hier ein – auch ohne Datum. Mit „Erhalten“ buchst du das Geld später
            direkt auf ein Konto.
          </EmptyState>
        ) : (
          <ReceivablesList list={owed} today={today} />
        )}

        {received.length > 0 && (
          <div className="ob-receivables__done">
            <ToggleRow
              open={showReceived}
              onClick={() => setShowReceived((v) => !v)}
              title={
                <>
                  Erhalten <span className="upcoming-plan__count">({received.length})</span>
                </>
              }
              aside={formatMoney(sumReceivables(received), currency)}
            />
            <Collapse open={showReceived}>
              <ReceivablesList list={received} today={today} />
            </Collapse>
          </div>
        )}
      </Card>
    </div>
  );
}
