import type { ReactNode } from 'react';
import { cx } from './cx';
import './StatTile.css';

interface StatTileProps {
  label: string;
  value: ReactNode;
  children?: ReactNode;
  tone?: 'danger' | 'positive';
  icon?: ReactNode;
  onClick?(): void;
}

/** Small card with one key figure (label · value · note). */
export function StatTile({ label, value, children, tone, icon, onClick }: StatTileProps) {
  const content = (
    <>
      <span className="stat-tile__label">
        {icon}
        {label}
      </span>
      <span className={cx('stat-tile__value', tone === 'danger' && 'amount-negative', tone === 'positive' && 'amount-positive')}>
        {value}
      </span>
      {children && <span className="stat-tile__note">{children}</span>}
    </>
  );
  return onClick ? (
    <button type="button" className="stat-tile stat-tile--button" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="stat-tile">{content}</div>
  );
}
