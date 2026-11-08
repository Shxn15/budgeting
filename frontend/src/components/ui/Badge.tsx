import type { ReactNode } from 'react';
import './Badge.css';

export type BadgeTone = 'neutral' | 'accent' | 'warning' | 'danger' | 'success';

export function Badge({ tone = 'neutral', icon, children }: { tone?: BadgeTone; icon?: ReactNode; children: ReactNode }) {
  return (
    <span className={`badge badge--${tone}`}>
      {icon}
      {children}
    </span>
  );
}
