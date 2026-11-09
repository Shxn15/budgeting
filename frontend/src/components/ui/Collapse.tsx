import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import './Collapse.css';

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Shows or hides its content with a short height animation. While open the
 * content is not clipped, so shadows and hover effects stay visible.
 */
export function Collapse({ open, children, id, className }: { open: boolean; children: ReactNode; id?: string; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="collapse"
          id={id}
          className={className}
          initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
          animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
          exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
          transition={{ duration: 0.24, ease: EASE }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Small round chevron that turns when the section opens. */
export function Chevron({ open }: { open: boolean }) {
  return <ChevronDown className={cx('collapse-chevron', open && 'is-open')} aria-hidden />;
}

interface ToggleRowProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> {
  open: boolean;
  title: ReactNode;
  /** Right-aligned value, e.g. the sum of the group. */
  aside?: ReactNode;
}

/** A full-width row that opens or closes a group ("Dezember (3) · 120 €"). */
export function ToggleRow({ open, title, aside, className, ...rest }: ToggleRowProps) {
  return (
    <button type="button" className={cx('toggle-row', open && 'is-open', className)} aria-expanded={open} {...rest}>
      <Chevron open={open} />
      <span className="toggle-row__title">{title}</span>
      {aside !== undefined && <span className="toggle-row__aside">{aside}</span>}
    </button>
  );
}
