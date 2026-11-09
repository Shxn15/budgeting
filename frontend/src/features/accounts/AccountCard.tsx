import { ArrowLeftRight, Minus, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import type { CSSProperties } from 'react';
import { accountColorCss } from '../../domain/colors';
import { formatMoney } from '../../domain/money';
import { goalsOfAccount } from '../../domain/savings';
import type { Account, Cents } from '../../domain/types';
import { Button, IconButton } from '../../components/ui/Button';
import { cx } from '../../components/ui/cx';
import { Menu } from '../../components/ui/Menu';
import { useSavingsGoals } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { AccountIcon } from './AccountIcon';
import { accountMenu } from './accountMenu';
import { accountTypeInfo } from './accountTypes';
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
  const openAccount = useUiStore((s) => s.openAccount);
  const highlight = useUiStore((s) => s.highlight);
  const setHighlight = useUiStore((s) => s.setHighlight);
  const goals = useSavingsGoals();
  const typeInfo = accountTypeInfo(account.type);
  const goalCount = goalsOfAccount(goals, account.id).filter((g) => g.parentId === null).length;
  const showType = typeInfo.label.toLowerCase() !== account.name.trim().toLowerCase();
  const goalNote = goalCount > 0 ? (goalCount === 1 ? '1 Sparziel' : `${goalCount} Sparziele`) : null;

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
      {/* The whole card opens the account; buttons inside sit on top of this. */}
      <button
        type="button"
        className="account-card__open"
        aria-label={`${account.name} öffnen – ${formatMoney(balance, currency)}`}
        onClick={() => openAccount(account.id)}
        onFocus={() => setHighlight(account.id)}
        onBlur={() => setHighlight(null)}
      />

      <header className="account-card__header">
        <AccountIcon account={account} size={42} />
        <div className="account-card__titles">
          <h3 className="account-card__name" title={account.name}>
            {account.name}
          </h3>
          {(showType || goalNote) && (
            <p className="account-card__type">{[showType ? typeInfo.label : null, goalNote].filter(Boolean).join(' · ')}</p>
          )}
        </div>
        <div className="account-card__menu">
          <Menu label={`Aktionen für ${account.name}`} items={accountMenu(account)} />
        </div>
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
          icon={<Plus />}
          onClick={() => openDialog({ type: 'booking', kind: 'income', accountId: account.id })}
        >
          Hinzufügen
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<Minus />}
          onClick={() => openDialog({ type: 'booking', kind: 'expense', accountId: account.id })}
        >
          Entfernen
        </Button>
        <IconButton
          label="Geld umbuchen"
          size="sm"
          icon={<ArrowLeftRight />}
          className="account-card__transfer"
          onClick={() => openDialog({ type: 'transfer', fromAccountId: account.id })}
        />
      </footer>
    </motion.article>
  );
}
