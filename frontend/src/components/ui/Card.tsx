import { useId, type HTMLAttributes, type ReactNode } from 'react';
import { Chevron, Collapse } from './Collapse';
import { cx } from './cx';
import './Card.css';

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  actions?: ReactNode;
  padded?: boolean;
  /** With onToggle the card can be folded: a click on the title hides or shows the content. */
  collapsed?: boolean;
  onToggle?(): void;
  /** Shown after the title while the card is folded, e.g. "12 Buchungen". */
  collapsedNote?: ReactNode;
}

export function Card({ title, actions, padded = true, className, children, collapsed = false, onToggle, collapsedNote, ...rest }: CardProps) {
  const bodyId = useId();
  const foldable = onToggle !== undefined;

  if (!foldable) {
    return (
      <section className={cx('card', padded && 'card--padded', className)} {...rest}>
        {(title || actions) && (
          <header className="card__header">
            {title && <h2 className="card__title">{title}</h2>}
            {actions && <div className="card__actions">{actions}</div>}
          </header>
        )}
        {children}
      </section>
    );
  }

  return (
    <section className={cx('card', 'card--foldable', padded && 'card--padded', collapsed && 'is-collapsed', className)} {...rest}>
      <header className="card__header">
        <h2 className="card__title">
          <button
            type="button"
            className="card__toggle"
            aria-expanded={!collapsed}
            aria-controls={bodyId}
            title={collapsed ? 'Aufklappen' : 'Einklappen'}
            onClick={onToggle}
          >
            <Chevron open={!collapsed} />
            {title}
            {collapsed && collapsedNote && <span className="card__collapsed-note">{collapsedNote}</span>}
          </button>
        </h2>
        {actions && <div className="card__actions">{actions}</div>}
      </header>
      <Collapse open={!collapsed} id={bodyId}>
        <div className="card__body">{children}</div>
      </Collapse>
    </section>
  );
}
