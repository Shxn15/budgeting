import { BanknoteArrowDown, Check, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { formatDateCompact, toISODate } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import { dueStateForDate } from '../../domain/obligations';
import { expectedLabel, isReceivableOpen, receivableName } from '../../domain/receivables';
import type { ISODate, Receivable } from '../../domain/types';
import { Avatar } from '../../components/avatar/Avatar';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { cx } from '../../components/ui/cx';
import { Menu } from '../../components/ui/Menu';
import { reopenReceivable } from '../../store/actions';
import { useAccountMap, useCurrency, useTagMap } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { confirmDeleteReceivable } from './confirmDeleteReceivable';
import '../obligations/ObligationRow.css';
import './ReceivableRow.css';

const TONES: Record<ReturnType<typeof dueStateForDate>, BadgeTone> = {
  overdue: 'warning',
  today: 'accent',
  soon: 'accent',
  upcoming: 'neutral',
  none: 'neutral',
};

/** One entry of "Bekomme ich noch": who, how much, when – and "Erhalten". */
export function ReceivableRow({ receivable: r, today, compact }: { receivable: Receivable; today: ISODate; compact?: boolean }) {
  const openDialog = useUiStore((s) => s.openDialog);
  const notify = useUiStore((s) => s.notify);
  const accounts = useAccountMap();
  const tags = useTagMap();
  const currency = useCurrency();
  const open = isReceivableOpen(r);
  const tag = r.tagId ? tags.get(r.tagId) : undefined;
  const name = receivableName(r);
  const accountName = r.accountId ? accounts.get(r.accountId)?.name : undefined;
  const meta = [r.counterparty.trim() && r.title.trim() ? r.title.trim() : null, accountName ? `auf ${accountName}` : null]
    .filter(Boolean)
    .join(' · ');
  const state = open ? dueStateForDate(r.expectedDate, today) : null;

  const reopen = () => {
    reopenReceivable(r.id);
    notify(r.receiptTransactionId ? 'Wieder offen – die Buchung wurde entfernt.' : 'Wieder offen.', 'info');
  };

  return (
    <div className={cx('ob-row', 'rc-row', !open && 'ob-row--done', state === 'overdue' && 'rc-row--late')}>
      {tag ? (
        <Avatar name={tag.name} image={tag.image} color={tag.color} size={40} className="ob-row__avatar" title={tag.name} />
      ) : (
        <span className="ob-row__icon rc-row__icon" aria-hidden>
          <BanknoteArrowDown />
        </span>
      )}
      <div className="ob-row__main">
        <p className="ob-row__title">{name}</p>
        <div className="ob-row__meta">
          {open ? (
            <Badge tone={TONES[state!]}>{expectedLabel(r.expectedDate, today)}</Badge>
          ) : (
            <Badge tone="success" icon={<Check aria-hidden />}>
              erhalten am {formatDateCompact(toISODate(new Date(r.receivedAt!)), today)}
            </Badge>
          )}
          {meta && <span className="ob-row__meta-text">{meta}</span>}
        </div>
      </div>
      <span className={cx('ob-row__amount num', open && 'amount-positive')}>{formatMoney(r.amount, currency, { sign: open })}</span>
      <div className="ob-row__actions">
        {open ? (
          <Button size="sm" icon={<Check />} onClick={() => openDialog({ type: 'receive', receivableId: r.id })}>
            Erhalten
          </Button>
        ) : (
          !compact && (
            <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={reopen}>
              Wieder öffnen
            </Button>
          )
        )}
        {!compact && (
          <Menu
            label={`Aktionen für ${name}`}
            items={[
              { label: 'Bearbeiten', icon: <Pencil />, onSelect: () => openDialog({ type: 'receivable', receivableId: r.id }) },
              'separator',
              { label: 'Löschen', icon: <Trash2 />, danger: true, onSelect: () => confirmDeleteReceivable(r) },
            ]}
          />
        )}
      </div>
    </div>
  );
}
