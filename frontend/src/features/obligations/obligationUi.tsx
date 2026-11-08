import { CalendarClock, Clock, HandCoins, Receipt, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import { dueLabel, dueState, type DueState } from '../../domain/obligations';
import type { ISODate, Obligation, ObligationKind } from '../../domain/types';

export const OBLIGATION_KINDS: Record<ObligationKind, { label: string; short: string; icon: LucideIcon }> = {
  debt: { label: 'Ich schulde jemandem Geld', short: 'Schulden', icon: HandCoins },
  bill: { label: 'Anstehende Zahlung', short: 'Zahlung', icon: Receipt },
};

export const DUE_TONES: Record<DueState, { tone: BadgeTone; icon: LucideIcon | null }> = {
  overdue: { tone: 'danger', icon: TriangleAlert },
  today: { tone: 'warning', icon: Clock },
  soon: { tone: 'accent', icon: CalendarClock },
  upcoming: { tone: 'neutral', icon: CalendarClock },
  none: { tone: 'neutral', icon: null },
};

/** Coloured due-date label – always icon + text, never colour alone. */
export function DueBadge({ obligation, today }: { obligation: Obligation; today: ISODate }) {
  const { tone, icon: Icon } = DUE_TONES[dueState(obligation, today)];
  return (
    <Badge tone={tone} icon={Icon ? <Icon aria-hidden /> : undefined}>
      {dueLabel(obligation, today)}
    </Badge>
  );
}
