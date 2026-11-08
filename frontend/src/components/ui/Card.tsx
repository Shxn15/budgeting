import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import './Card.css';

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  actions?: ReactNode;
  padded?: boolean;
}

export function Card({ title, actions, padded = true, className, children, ...rest }: CardProps) {
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
