import type { ReactNode } from 'react';
import { Chevron } from '../ui/Collapse';
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

interface SectionHeaderProps {
  title: string;
  count?: number;
  actions?: ReactNode;
  /** With onToggle the section can be folded away (the title becomes a button). */
  collapsed?: boolean;
  onToggle?(): void;
  /** id of the element that is shown or hidden. */
  controls?: string;
  /** Shown next to the title while folded. */
  collapsedNote?: ReactNode;
}

export function SectionHeader({ title, count, actions, collapsed = false, onToggle, controls, collapsedNote }: SectionHeaderProps) {
  const content = (
    <>
      {onToggle && <Chevron open={!collapsed} />}
      {title}
      {count !== undefined && <span className="section-header__count">{count}</span>}
      {onToggle && collapsed && collapsedNote && <span className="section-header__note">{collapsedNote}</span>}
    </>
  );
  return (
    <div className="section-header">
      <h2 className="section-header__title">
        {onToggle ? (
          <button
            type="button"
            className="section-header__toggle"
            aria-expanded={!collapsed}
            aria-controls={controls}
            title={collapsed ? 'Aufklappen' : 'Einklappen'}
            onClick={onToggle}
          >
            {content}
          </button>
        ) : (
          content
        )}
      </h2>
      {actions && <div className="section-header__actions">{actions}</div>}
    </div>
  );
}
