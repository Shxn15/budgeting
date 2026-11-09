import { CalendarCheck } from 'lucide-react';
import { useState } from 'react';
import { formatMonth, formatMonthName } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import type { ISODate, MonthKey } from '../../domain/types';
import type { UpcomingGroup, UpcomingItem, UpcomingPlan } from '../../domain/upcoming';
import { Collapse, ToggleRow } from '../../components/ui/Collapse';
import { cx } from '../../components/ui/cx';
import { useCurrency } from '../../store/selectors';
import { ObligationRow } from '../obligations/ObligationRow';
import { SubscriptionChargeRow } from '../subscriptions/SubscriptionChargeRow';
import './UpcomingList.css';

interface UpcomingListProps {
  items: readonly UpcomingItem[];
  today: ISODate;
  limit?: number;
  /** Rows with all actions (Zahlungen page) instead of the compact ones. */
  full?: boolean;
  /** "+ 3 weitere": shows the rest. Without it the button expands the list in place. */
  onMore?(): void;
}

/** Open payments and subscription charges, soonest first. */
export function UpcomingList({ items, today, limit = items.length, full, onMore }: UpcomingListProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, limit);
  return (
    <div className={cx('upcoming-list', full && 'upcoming-list--full')}>
      {shown.map((item) =>
        item.type === 'obligation' ? (
          <ObligationRow key={item.key} obligation={item.obligation} today={today} compact={!full} />
        ) : (
          <SubscriptionChargeRow key={item.key} subscription={item.subscription} date={item.date} today={today} full={full} />
        ),
      )}
      {items.length > shown.length && (
        <button type="button" className="upcoming-list__more" onClick={onMore ?? (() => setExpanded(true))}>
          + {items.length - shown.length} weitere
        </button>
      )}
    </div>
  );
}

/** "Dezember" – with the year if it is not the current one ("Januar 2027"). */
export function monthTitle(month: MonthKey, current: MonthKey): string {
  return month.slice(0, 4) === current.slice(0, 4) ? formatMonthName(month) : formatMonth(month);
}

interface UpcomingPlanListProps {
  plan: UpcomingPlan;
  today: ISODate;
  /** Rows of the current month shown before "+ n weitere". */
  limit?: number;
  full?: boolean;
}

/**
 * The payments of this month, and below them the later months and the
 * entries without a date as folded groups – "Dezember (3)" opens with a click.
 */
export function UpcomingPlanList({ plan, today, limit, full }: UpcomingPlanListProps) {
  const currency = useCurrency();
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (key: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const groups: { key: string; title: string; group: UpcomingGroup }[] = [
    ...plan.later.map((group) => ({ key: group.month!, title: monthTitle(group.month!, plan.month), group })),
    ...(plan.undated.items.length > 0 ? [{ key: 'undated', title: 'Ohne Datum', group: plan.undated }] : []),
  ];

  return (
    <div className="upcoming-plan">
      <div className="upcoming-plan__current">
        <div className="upcoming-plan__month">
          <span>Noch im {formatMonthName(plan.month)}</span>
          <span className="upcoming-plan__sum num">{formatMoney(plan.current.total, currency)}</span>
        </div>
        {plan.current.items.length === 0 ? (
          <p className="upcoming-plan__empty">
            <CalendarCheck aria-hidden />
            Diesen Monat steht nichts mehr an.
          </p>
        ) : (
          <UpcomingList items={plan.current.items} today={today} limit={limit} full={full} />
        )}
      </div>

      {groups.length > 0 && (
        <div className="upcoming-plan__later">
          {groups.map(({ key, title, group }) => {
            const isOpen = open.has(key);
            return (
              <section key={key} className="upcoming-plan__group">
                <ToggleRow
                  open={isOpen}
                  onClick={() => toggle(key)}
                  title={
                    <>
                      {title}
                      <span className="upcoming-plan__count">({group.items.length})</span>
                    </>
                  }
                  aside={formatMoney(group.total, currency)}
                  aria-label={`${title}: ${group.items.length} ${group.items.length === 1 ? 'Zahlung' : 'Zahlungen'}, ${formatMoney(group.total, currency)}`}
                />
                <Collapse open={isOpen}>
                  <UpcomingList items={group.items} today={today} full={full} />
                </Collapse>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
