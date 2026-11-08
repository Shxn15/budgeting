import type { CSSProperties } from 'react';
import { accountColorCss } from '../../domain/colors';
import type { Account } from '../../domain/types';
import { accountTypeInfo } from './accountTypes';
import './AccountIcon.css';

export function AccountIcon({ account, size = 40 }: { account: Pick<Account, 'type' | 'color'>; size?: number }) {
  const Icon = accountTypeInfo(account.type).icon;
  return (
    <span
      className="account-icon"
      aria-hidden
      style={{ '--account-color': accountColorCss(account.color), width: size, height: size } as CSSProperties}
    >
      <Icon />
    </span>
  );
}
