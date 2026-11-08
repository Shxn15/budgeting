import type { ISODate } from '../../domain/types';
import type { UpcomingItem } from '../../domain/upcoming';
import { ObligationRow } from '../obligations/ObligationRow';
import { SubscriptionChargeRow } from '../subscriptions/SubscriptionChargeRow';
import './UpcomingList.css';

interface UpcomingListProps {
  items: readonly UpcomingItem[];
  today: ISODate;
  limit?: number;
  onMore?(): void;
}

/** Open payments and subscription charges, soonest first. */
export function UpcomingList({ items, today, limit = items.length, onMore }: UpcomingListProps) {
  const shown = items.slice(0, limit);
  return (
    <div className="upcoming-list">
      {shown.map((item) =>
        item.type === 'obligation' ? (
          <ObligationRow key={item.key} obligation={item.obligation} today={today} compact />
        ) : (
          <SubscriptionChargeRow key={item.key} subscription={item.subscription} date={item.date} today={today} />
        ),
      )}
      {items.length > shown.length && onMore && (
        <button type="button" className="upcoming-list__more" onClick={onMore}>
          + {items.length - shown.length} weitere
        </button>
      )}
    </div>
  );
}
