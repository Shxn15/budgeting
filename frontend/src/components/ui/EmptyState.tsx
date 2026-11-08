import type { ReactNode } from 'react';
import './EmptyState.css';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon, title, children, action, compact }: EmptyStateProps) {
  return (
    <div className={compact ? 'empty empty--compact' : 'empty'}>
      <div className="empty__icon">{icon}</div>
      <h3 className="empty__title">{title}</h3>
      {children && <p className="empty__text">{children}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}
