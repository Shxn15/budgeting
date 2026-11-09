import { Check, Pencil, Zap } from 'lucide-react';
import { formatMoney } from '../../domain/money';
import type { ISODate, Subscription } from '../../domain/types';
import { Button } from '../../components/ui/Button';
import { cx } from '../../components/ui/cx';
import { Menu } from '../../components/ui/Menu';
import { useAccountMap, useCurrency } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { subscriptionMenu } from './SubscriptionRow';
import { ChargeBadge, SubscriptionAvatar } from './subscriptionUi';
import '../obligations/ObligationRow.css';

interface Props {
  subscription: Subscription;
  date: ISODate;
  today: ISODate;
  /** With the "⋯" menu (Zahlungen page). */
  full?: boolean;
}

/** One upcoming charge of a subscription (overview, Zahlungen page and account page). */
export function SubscriptionChargeRow({ subscription: sub, date, today, full }: Props) {
  const openDialog = useUiStore((s) => s.openDialog);
  const accounts = useAccountMap();
  const currency = useCurrency();
  const accountName = sub.accountId ? accounts.get(sub.accountId)?.name : undefined;
  const isCurrent = date === sub.nextDueDate;
  const overdue = !sub.autoPay && date < today;

  return (
    <div className={cx('ob-row', overdue && 'ob-row--overdue')}>
      <button
        type="button"
        className="ob-row__avatar-button"
        onClick={() => openDialog({ type: 'subscription', subscriptionId: sub.id })}
        title="Abo bearbeiten"
      >
        <SubscriptionAvatar subscription={sub} size={40} />
      </button>
      <div className="ob-row__main">
        <p className="ob-row__title">{sub.name}</p>
        <div className="ob-row__meta">
          <ChargeBadge subscription={sub} date={date} today={today} />
          <span className="ob-row__meta-text">{accountName ? `Abo · ${accountName}` : 'Abo'}</span>
        </div>
      </div>
      <span className="ob-row__amount num">{formatMoney(sub.amount, currency)}</span>
      <div className="ob-row__actions">
        {sub.autoPay ? (
          <span className="ob-row__auto" title="Wird automatisch abgebucht">
            <Zap aria-hidden />
            <span className="sr-only">wird automatisch abgebucht</span>
          </span>
        ) : (
          isCurrent && (
            <Button size="sm" icon={<Check />} onClick={() => openDialog({ type: 'paySubscription', subscriptionId: sub.id })}>
              Bezahlt
            </Button>
          )
        )}
        {full && (
          <Menu
            label={`Aktionen für ${sub.name}`}
            items={
              isCurrent
                ? subscriptionMenu(sub)
                : [{ label: 'Abo bearbeiten', icon: <Pencil />, onSelect: () => openDialog({ type: 'subscription', subscriptionId: sub.id }) }]
            }
          />
        )}
      </div>
    </div>
  );
}
