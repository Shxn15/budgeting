import type { ReactNode } from 'react';
import './PageHeader.css';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="page-header__titles">
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export function SectionHeader({ title, count, actions }: { title: string; count?: number; actions?: ReactNode }) {
  return (
    <div className="section-header">
      <h2 className="section-header__title">
        {title}
        {count !== undefined && <span className="section-header__count">{count}</span>}
      </h2>
      {actions && <div className="section-header__actions">{actions}</div>}
    </div>
  );
}
