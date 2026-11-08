import { Pause, Repeat, Zap } from 'lucide-react';
import { chargeLabel, dueLabelForDate, dueStateForDate } from '../../domain/obligations';
import type { ISODate, Subscription } from '../../domain/types';
import { Avatar } from '../../components/avatar/Avatar';
import { Badge } from '../../components/ui/Badge';
import { DUE_TONES } from '../obligations/obligationUi';

/** Round picture of a subscription with a small repeat badge. */
export function SubscriptionAvatar({ subscription, size = 44 }: { subscription: Subscription; size?: number }) {
  return (
    <Avatar
      name={subscription.name}
      image={subscription.image}
      color={subscription.color}
      size={size}
      badge={size >= 36 ? <Repeat aria-hidden /> : undefined}
    />
  );
}

/** "Abbuchung in 5 Tagen" (automatic) or "fällig in 5 Tagen" / "überfällig" (manual). */
export function ChargeBadge({ subscription, date, today }: { subscription: Subscription; date?: ISODate; today: ISODate }) {
  if (subscription.paused) {
    return (
      <Badge tone="neutral" icon={<Pause aria-hidden />}>
        pausiert
      </Badge>
    );
  }
  const due = date ?? subscription.nextDueDate;
  const state = dueStateForDate(due, today);
  if (subscription.autoPay) {
    return (
      <Badge tone={state === 'today' ? 'warning' : state === 'soon' ? 'accent' : 'neutral'} icon={<Zap aria-hidden />}>
        {chargeLabel(due, today)}
      </Badge>
    );
  }
  const { tone, icon: Icon } = DUE_TONES[state];
  return (
    <Badge tone={tone} icon={Icon ? <Icon aria-hidden /> : undefined}>
      {dueLabelForDate(due, today)}
    </Badge>
  );
}
