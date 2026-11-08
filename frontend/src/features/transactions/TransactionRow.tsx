import { Trash2 } from 'lucide-react';
import { formatDateCompact } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import type { ISODate, Transaction } from '../../domain/types';
import { IconButton } from '../../components/ui/Button';
import { cx } from '../../components/ui/cx';
import { deleteTransaction } from '../../store/actions';
import { useAccountMap, useCurrency } from '../../store/selectors';
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
  const currency = useCurrency();
  const openDialog = useUiStore((s) => s.openDialog);
  const notify = useUiStore((s) => s.notify);
  const view = describeTransaction(t, accounts, perspective);
  const Icon = view.icon;

  const amountText =
    view.sign === 0 ? formatMoney(view.amount, currency) : formatMoney(view.sign * view.amount, currency, { sign: true });

  const confirmDelete = () =>
    openDialog({
      type: 'confirm',
      title: 'Buchung löschen?',
      message:
        t.kind === 'payment' && t.obligationId
          ? 'Die Zahlung wird rückgängig gemacht: Der Kontostand wird zurückgesetzt und der Eintrag ist wieder offen.'
          : 'Die Buchung wird entfernt und die Kontostände werden entsprechend zurückgerechnet.',
      confirmLabel: 'Buchung löschen',
      danger: true,
      onConfirm: () => {
        deleteTransaction(t.id);
        notify('Buchung gelöscht.');
      },
    });

  return (
    <div className={cx('tx-row', compact && 'tx-row--compact')}>
      <span className={cx('tx-row__icon', `tx-row__icon--${t.kind}`)} aria-hidden>
        <Icon />
      </span>
      <div className="tx-row__main">
        <p className="tx-row__title">{view.title}</p>
        <p className="tx-row__detail" title={view.detail}>
          {showDate ? `${formatDateCompact(t.date, today)} · ${view.detail}` : view.detail}
        </p>
      </div>
      <span
        className={cx(
          'tx-row__amount num',
          view.sign > 0 && 'amount-positive',
          view.sign < 0 && 'amount-negative',
        )}
      >
        {amountText}
      </span>
      {!compact && (
        <IconButton label="Buchung löschen" icon={<Trash2 />} size="sm" className="tx-row__delete" onClick={confirmDelete} />
      )}
    </div>
  );
}
