import { Pencil, Repeat, Trash2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { formatDateCompact } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import type { ISODate, Transaction } from '../../domain/types';
import { Avatar } from '../../components/avatar/Avatar';
import { IconButton } from '../../components/ui/Button';
import { cx } from '../../components/ui/cx';
import { deleteTransaction } from '../../store/actions';
import { useAccountMap, useCurrency, useSubscriptionMap, useTagMap } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { describeTransaction } from './describe';
import './TransactionRow.css';

interface Props {
  transaction: Transaction;
  today: ISODate;
  perspective?: string | null;
  compact?: boolean;
  showDate?: boolean;
}

export function TransactionRow({ transaction: t, today, perspective = null, compact, showDate }: Props) {
  const accounts = useAccountMap();
  const tags = useTagMap();
  const subscriptions = useSubscriptionMap();
  const currency = useCurrency();
  const openDialog = useUiStore((s) => s.openDialog);
  const notify = useUiStore((s) => s.notify);
  const view = describeTransaction(t, { accounts, tags, subscriptions }, perspective);
  const Icon = view.icon;
  const editable = t.kind === 'income' || t.kind === 'expense';

  const amountText =
    view.sign === 0 ? formatMoney(view.amount, currency) : formatMoney(view.sign * view.amount, currency, { sign: true });

  const confirmDelete = () =>
    openDialog({
      type: 'confirm',
      title: 'Buchung löschen?',
      message:
        t.kind === 'payment' && t.obligationId
          ? 'Die Zahlung wird rückgängig gemacht: Der Kontostand wird zurückgesetzt und der Eintrag ist wieder offen.'
          : t.kind === 'subscription'
            ? 'Die Abbuchung wird entfernt und der Kontostand zurückgerechnet. Das Abo selbst läuft normal weiter.'
            : view.statsOnly
              ? 'Die Buchung wird entfernt. Der Kontostand ändert sich nicht, weil sie nur für die Statistik war.'
              : 'Die Buchung wird entfernt und die Kontostände werden entsprechend zurückgerechnet.',
      confirmLabel: 'Buchung löschen',
      danger: true,
      onConfirm: () => {
        deleteTransaction(t.id);
        notify('Buchung gelöscht.');
      },
    });

  const edit = () => openDialog({ type: 'booking', transactionId: t.id });

  return (
    <div
      className={cx('tx-row', compact && 'tx-row--compact', view.statsOnly && 'tx-row--stats-only')}
      style={compact ? undefined : ({ '--tools-width': editable ? '70px' : '36px' } as CSSProperties)}
    >
      {view.avatar ? (
        <Avatar
          name={view.avatar.name}
          image={view.avatar.image}
          color={view.avatar.color}
          size={compact ? 34 : 36}
          badge={t.kind === 'subscription' ? <Repeat aria-hidden /> : undefined}
        />
      ) : (
        <span className={cx('tx-row__icon', `tx-row__icon--${t.kind}`)} aria-hidden>
          <Icon />
        </span>
      )}
      <div className="tx-row__main">
        <p className="tx-row__title">{view.title}</p>
        <p className="tx-row__detail" title={view.detail}>
          {showDate ? `${formatDateCompact(t.date, today)} · ${view.detail}` : view.detail}
        </p>
      </div>
      <span
        className={cx(
          'tx-row__amount num',
          !view.statsOnly && view.sign > 0 && 'amount-positive',
          !view.statsOnly && view.sign < 0 && 'amount-negative',
        )}
        title={view.statsOnly ? 'Nur für die Statistik – ändert den Kontostand nicht' : undefined}
      >
        {amountText}
      </span>
      {!compact && (
        <span className="tx-row__tools">
          {editable && <IconButton label="Buchung bearbeiten" icon={<Pencil />} size="sm" onClick={edit} />}
          <IconButton label="Buchung löschen" icon={<Trash2 />} size="sm" onClick={confirmDelete} />
        </span>
      )}
    </div>
  );
}
