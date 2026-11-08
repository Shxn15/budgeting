import { CalendarClock, Plus, Repeat, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { addDays } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import { chargeLabel, dueLabelForDate } from '../../domain/obligations';
import { chargesUntil, monthlyCost, sortSubscriptions, totalMonthlyCost } from '../../domain/subscriptions';
import type { Subscription } from '../../domain/types';
import { UPCOMING_DAYS } from '../../domain/upcoming';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { StatTile } from '../../components/ui/StatTile';
import { useCurrency, useSubscriptions, useToday } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { SubscriptionRow } from './SubscriptionRow';
import './SubscriptionsPage.css';

type Sort = 'date' | 'cost' | 'name';

function sortBy(list: readonly Subscription[], sort: Sort): Subscription[] {
  if (sort === 'cost') return [...list].sort((a, b) => monthlyCost(b) - monthlyCost(a) || a.name.localeCompare(b.name, 'de'));
  if (sort === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  return sortSubscriptions(list);
}

export function SubscriptionsPage() {
  const subscriptions = useSubscriptions();
  const currency = useCurrency();
  const today = useToday();
  const openDialog = useUiStore((s) => s.openDialog);
  const [sort, setSort] = useState<Sort>('date');

  const active = useMemo(() => sortBy(subscriptions.filter((s) => !s.paused), sort), [subscriptions, sort]);
  const paused = useMemo(() => sortBy(subscriptions.filter((s) => s.paused), 'name'), [subscriptions]);
  const monthly = totalMonthlyCost(subscriptions);
  const next = sortSubscriptions(active)[0] ?? null;
  const until = addDays(today, UPCOMING_DAYS);
  const soon = active.flatMap((s) => chargesUntil(s, until).map(() => s.amount));
  const soonSum = soon.reduce((sum, a) => sum + a, 0);
  const autoCount = active.filter((s) => s.autoPay).length;

  const add = () => openDialog({ type: 'subscription' });

  return (
    <div className="page">
      <PageHeader
        title="Abos"
        subtitle="Wiederkehrende Zahlungen wie Netflix, Spotify, Handyvertrag oder Fitnessstudio."
        actions={
          <Button variant="primary" icon={<Plus />} onClick={add}>
            Abo hinzufügen
          </Button>
        }
      />

      {subscriptions.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Repeat />}
            title="Noch keine Abos"
            action={
              <Button variant="primary" icon={<Plus />} onClick={add}>
                Erstes Abo hinzufügen
              </Button>
            }
          >
            Trage deine Abos mit Bild ein – dann siehst du, was sie dich im Monat kosten, und sie werden auf Wunsch
            automatisch vom Konto abgebucht.
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="stat-row">
            <StatTile label="Kosten pro Monat" icon={<Repeat />} value={formatMoney(monthly, currency)}>
              {active.length === 1 ? '1 aktives Abo' : `${active.length} aktive Abos`}
            </StatTile>
            <StatTile label="Kosten pro Jahr" icon={<Sparkles />} value={formatMoney(monthly * 12, currency)}>
              hochgerechnet auf 12 Monate
            </StatTile>
            <StatTile label="Nächste Abbuchung" icon={<CalendarClock />} value={next ? next.name : '–'}>
              {next
                ? `${next.autoPay ? chargeLabel(next.nextDueDate, today) : dueLabelForDate(next.nextDueDate, today)} · ${formatMoney(next.amount, currency)}`
                : 'Keine aktiven Abos'}
            </StatTile>
            <StatTile label={`Nächste ${UPCOMING_DAYS} Tage`} value={formatMoney(soonSum, currency)}>
              {soon.length === 1 ? '1 Abbuchung' : `${soon.length} Abbuchungen`}
              {autoCount > 0 && ` · ${autoCount} automatisch`}
            </StatTile>
          </div>

          <Card padded={false} className="sub-card">
            <div className="sub-card__toolbar">
              <SegmentedControl<Sort>
                label="Sortieren"
                size="sm"
                value={sort}
                onChange={setSort}
                options={[
                  { value: 'date', label: 'Nach Datum' },
                  { value: 'cost', label: 'Nach Kosten' },
                  { value: 'name', label: 'A–Z' },
                ]}
              />
              <span className="sub-card__count">
                {subscriptions.length === 1 ? '1 Abo' : `${subscriptions.length} Abos`}
              </span>
            </div>

            {active.length === 0 ? (
              <EmptyState compact icon={<Repeat />} title="Alle Abos sind pausiert">
                Pausierte Abos werden nicht abgebucht und nicht mitgezählt.
              </EmptyState>
            ) : (
              <SubscriptionList list={active} today={today} />
            )}

            {paused.length > 0 && (
              <section className="sub-card__paused">
                <h3 className="sub-card__section-title">Pausiert ({paused.length})</h3>
                <SubscriptionList list={paused} today={today} />
              </section>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function SubscriptionList({ list, today }: { list: Subscription[]; today: string }) {
  return (
    <div className="sub-list">
      <AnimatePresence initial={false} mode="popLayout">
        {list.map((sub) => (
          <motion.div
            key={sub.id}
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
          >
            <SubscriptionRow subscription={sub} today={today} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
