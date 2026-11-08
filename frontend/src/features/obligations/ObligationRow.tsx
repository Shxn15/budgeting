import { Check, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { formatDateCompact, toISODate } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import { dueState, isOpen, obligationTitle } from '../../domain/obligations';
import type { ISODate, Obligation } from '../../domain/types';
import { Avatar } from '../../components/avatar/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { cx } from '../../components/ui/cx';
import { Menu } from '../../components/ui/Menu';
import { deleteObligation, reopenObligation } from '../../store/actions';
import { useAccountMap, useCurrency, useTagMap } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { DueBadge, OBLIGATION_KINDS } from './obligationUi';
import './ObligationRow.css';

function subtitle(o: Obligation, accountName: string | undefined, tagName: string | undefined): string {
  const parts: string[] = [];
  const who = o.counterparty.trim();
  const title = o.title.trim();
  const same = (a: string, b: string) => a.toLocaleLowerCase('de') === b.toLocaleLowerCase('de');
  if (tagName && !same(tagName, title) && !same(tagName, who)) parts.push(tagName);
  if (title && who) parts.push(o.kind === 'debt' ? `bei ${who}` : `an ${who}`);
  if (!title && !who && !tagName) parts.push(OBLIGATION_KINDS[o.kind].short);
  if (accountName) parts.push(`über ${accountName}`);
  return parts.join(' · ');
}

export function ObligationRow({ obligation: o, today, compact }: { obligation: Obligation; today: ISODate; compact?: boolean }) {
  const openDialog = useUiStore((s) => s.openDialog);
  const notify = useUiStore((s) => s.notify);
  const accounts = useAccountMap();
  const tags = useTagMap();
  const currency = useCurrency();
  const Icon = OBLIGATION_KINDS[o.kind].icon;
  const open = isOpen(o);
  const state = open ? dueState(o, today) : null;
  const tag = o.tagId ? tags.get(o.tagId) : undefined;
  const meta = subtitle(o, o.accountId ? accounts.get(o.accountId)?.name : undefined, tag?.name);

  const reopen = () => {
    reopenObligation(o.id);
    notify(o.paymentTransactionId ? 'Wieder offen – die Abbuchung wurde rückgängig gemacht.' : 'Wieder offen.', 'info');
  };

  const confirmDelete = () =>
    openDialog({
      type: 'confirm',
      title: 'Eintrag löschen?',
      message: open
        ? `„${obligationTitle(o)}“ wird gelöscht.`
        : `„${obligationTitle(o)}“ wird gelöscht. Eine bereits gebuchte Zahlung bleibt in den Buchungen erhalten.`,
      confirmLabel: 'Löschen',
      danger: true,
      onConfirm: () => {
        deleteObligation(o.id);
        notify('Eintrag gelöscht.');
      },
    });

  return (
    <div className={cx('ob-row', state === 'overdue' && 'ob-row--overdue', !open && 'ob-row--done')}>
      {tag ? (
        <Avatar name={tag.name} image={tag.image} color={tag.color} size={40} className="ob-row__avatar" title={tag.name} />
      ) : (
        <span className={cx('ob-row__icon', `ob-row__icon--${o.kind}`)} aria-hidden>
          <Icon />
        </span>
      )}
      <div className="ob-row__main">
        <p className="ob-row__title">{obligationTitle(o)}</p>
        <div className="ob-row__meta">
          {open ? (
            <DueBadge obligation={o} today={today} />
          ) : (
            <Badge tone="success" icon={<Check aria-hidden />}>
              erledigt am {formatDateCompact(toISODate(new Date(o.paidAt!)), today)}
            </Badge>
          )}
          {meta && <span className="ob-row__meta-text">{meta}</span>}
        </div>
      </div>
      <span className="ob-row__amount num">{formatMoney(o.amount, currency)}</span>
      <div className="ob-row__actions">
        {open ? (
          <Button size="sm" icon={<Check />} onClick={() => openDialog({ type: 'pay', obligationId: o.id })}>
            Bezahlt
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
            label={`Aktionen für ${obligationTitle(o)}`}
            items={[
              { label: 'Bearbeiten', icon: <Pencil />, onSelect: () => openDialog({ type: 'obligation', obligationId: o.id }) },
              'separator',
              { label: 'Löschen', icon: <Trash2 />, danger: true, onSelect: confirmDelete },
            ]}
          />
        )}
      </div>
    </div>
  );
}
