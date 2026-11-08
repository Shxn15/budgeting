import { ArrowLeftRight, Pencil, PencilLine, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import type { CSSProperties } from 'react';
import { accountColorCss } from '../../domain/colors';
import { formatMoney } from '../../domain/money';
import type { Account, Cents } from '../../domain/types';
import { Button } from '../../components/ui/Button';
import { cx } from '../../components/ui/cx';
import { Menu } from '../../components/ui/Menu';
import { useUiStore } from '../../store/uiStore';
import { AccountIcon } from './AccountIcon';
import { accountTypeInfo } from './accountTypes';
import { confirmDeleteAccount } from './confirmDeleteAccount';
import './AccountCard.css';

interface AccountCardProps {
  account: Account;
  balance: Cents;
  /** Share of all positive balances (0..1), null if the balance is not positive. */
  share: number | null;
  currency: string;
}

const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 });

export function AccountCard({ account, balance, share, currency }: AccountCardProps) {
  const openDialog = useUiStore((s) => s.openDialog);
  const highlight = useUiStore((s) => s.highlight);
  const setHighlight = useUiStore((s) => s.setHighlight);
  const typeInfo = accountTypeInfo(account.type);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className={cx('account-card', highlight === account.id && 'is-highlighted')}
      style={{ '--account-color': accountColorCss(account.color) } as CSSProperties}
      onPointerEnter={() => setHighlight(account.id)}
      onPointerLeave={() => setHighlight(null)}
    >
      <header className="account-card__header">
        <AccountIcon account={account} size={42} />
        <div className="account-card__titles">
          <h3 className="account-card__name" title={account.name}>
            {account.name}
          </h3>
          {typeInfo.label.toLowerCase() !== account.name.trim().toLowerCase() && (
            <p className="account-card__type">{typeInfo.label}</p>
          )}
        </div>
        <Menu
          label={`Aktionen für ${account.name}`}
          items={[
            {
              label: 'Kontostand ändern',
              icon: <PencilLine />,
              onSelect: () => openDialog({ type: 'balance', accountId: account.id }),
            },
            {
              label: 'Geld umbuchen',
              icon: <ArrowLeftRight />,
              onSelect: () => openDialog({ type: 'transfer', fromAccountId: account.id }),
            },
            { label: 'Bearbeiten', icon: <Pencil />, onSelect: () => openDialog({ type: 'account', accountId: account.id }) },
            'separator',
            { label: 'Löschen', icon: <Trash2 />, danger: true, onSelect: () => confirmDeleteAccount(account) },
          ]}
        />
      </header>

      <p className={cx('account-card__balance', balance < 0 && 'amount-negative')}>{formatMoney(balance, currency)}</p>

      <div className="account-card__share">
        <div className="account-card__bar" aria-hidden>
          <span style={{ width: `${Math.max(0, (share ?? 0) * 100)}%` }} />
        </div>
        <span className="account-card__percent">
          {share === null ? (balance < 0 ? 'im Minus' : '–') : percent.format(share)}
        </span>
      </div>

      <footer className="account-card__actions">
        <Button
          size="sm"
          variant="ghost"
          icon={<PencilLine />}
          onClick={() => openDialog({ type: 'balance', accountId: account.id })}
        >
          Kontostand
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<ArrowLeftRight />}
          onClick={() => openDialog({ type: 'transfer', fromAccountId: account.id })}
        >
          Umbuchen
        </Button>
      </footer>
    </motion.article>
  );
}
