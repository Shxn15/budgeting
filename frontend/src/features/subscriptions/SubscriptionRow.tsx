import { Check, Pause, Pencil, Play, SkipForward, Trash2 } from 'lucide-react';
import { formatDate } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import { followingDueDate, intervalLabel, monthlyCost, perIntervalLabel } from '../../domain/subscriptions';
import type { ISODate, Subscription } from '../../domain/types';
import { Button } from '../../components/ui/Button';
import { cx } from '../../components/ui/cx';
import { Menu, type MenuItem } from '../../components/ui/Menu';
import { setSubscriptionPaused, skipSubscriptionCharge } from '../../store/actions';
import { useAccountMap, useCurrency } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { confirmDeleteSubscription } from './confirmDeleteSubscription';
import { ChargeBadge, SubscriptionAvatar } from './subscriptionUi';
import './SubscriptionRow.css';

export function subscriptionMenu(sub: Subscription): (MenuItem | 'separator')[] {
  const ui = useUiStore.getState();
  const manual = !sub.autoPay && !sub.paused;
  return [
    { label: 'Bearbeiten', icon: <Pencil />, onSelect: () => ui.openDialog({ type: 'subscription', subscriptionId: sub.id }) },
    ...(manual
      ? [
          { label: 'Als bezahlt markieren', icon: <Check />, onSelect: () => ui.openDialog({ type: 'paySubscription', subscriptionId: sub.id }) },
          {
            label: 'Diese Zahlung überspringen',
            icon: <SkipForward />,
            onSelect: () => {
              const next = formatDate(followingDueDate(sub));
              skipSubscriptionCharge(sub.id);
              ui.notify(`Übersprungen – nächste Zahlung am ${next}.`, 'info');
            },
          },
        ]
      : []),
    sub.paused
      ? {
          label: 'Fortsetzen',
          icon: <Play />,
          onSelect: () => {
            setSubscriptionPaused(sub.id, false);
            ui.notify(`„${sub.name}“ läuft wieder.`);
          },
        }
      : {
          label: 'Pausieren',
          icon: <Pause />,
          onSelect: () => {
            setSubscriptionPaused(sub.id, true);
            ui.notify(`„${sub.name}“ ist pausiert – es wird nichts abgebucht.`, 'info');
          },
        },
    'separator',
    { label: 'Löschen', icon: <Trash2 />, danger: true, onSelect: () => confirmDeleteSubscription(sub) },
  ];
}

/** A subscription on the Abos page: picture, schedule, price and actions. */
export function SubscriptionRow({ subscription: sub, today }: { subscription: Subscription; today: ISODate }) {
  const openDialog = useUiStore((s) => s.openDialog);
  const accounts = useAccountMap();
  const currency = useCurrency();
  const accountName = sub.accountId ? accounts.get(sub.accountId)?.name : undefined;
  const monthly = sub.intervalUnit === 'month' && sub.intervalCount === 1;
  const manualDue = !sub.paused && !sub.autoPay;

  const meta = [intervalLabel(sub.intervalUnit, sub.intervalCount), accountName ? `von ${accountName}` : 'ohne Konto']
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={cx('sub-row', sub.paused && 'sub-row--paused')}>
      <button
        type="button"
        className="sub-row__open"
        onClick={() => openDialog({ type: 'subscription', subscriptionId: sub.id })}
        title="Abo bearbeiten"
      >
        <SubscriptionAvatar subscription={sub} size={48} />
        <span className="sub-row__main">
          <span className="sub-row__title">{sub.name}</span>
          <span className="sub-row__meta">
            <ChargeBadge subscription={sub} today={today} />
            <span className="sub-row__meta-text">{meta}</span>
          </span>
        </span>
      </button>
      <span className="sub-row__price">
        <span className="sub-row__amount num">
          {formatMoney(sub.amount, currency)}
          <span className="sub-row__per"> {perIntervalLabel(sub.intervalUnit, sub.intervalCount)}</span>
        </span>
        {!monthly && <span className="sub-row__monthly num">≈ {formatMoney(Math.round(monthlyCost(sub)), currency)} / Monat</span>}
      </span>
      <span className="sub-row__actions">
        {manualDue && (
          <Button size="sm" icon={<Check />} onClick={() => openDialog({ type: 'paySubscription', subscriptionId: sub.id })}>
            Bezahlt
          </Button>
        )}
        <Menu label={`Aktionen für ${sub.name}`} items={subscriptionMenu(sub)} />
      </span>
    </div>
  );
}
