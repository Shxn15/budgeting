import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useId, useRef, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from './Button';
import './Modal.css';

interface ModalProps {
  title: string;
  subtitle?: ReactNode;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  /** When set, the body is a <form> and Enter submits it. */
  onSubmit?(): void;
  width?: number;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog window. Render it inside <AnimatePresence> (see app/DialogHost.tsx)
 * so it can animate out when it is closed.
 */
export function Modal({ title, subtitle, onClose, children, footer, onSubmit, width = 460 }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus the first field, keep focus inside, restore it afterwards.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const first =
      panel?.querySelector<HTMLElement>('[data-autofocus]') ??
      panel?.querySelector<HTMLElement>('input, select, textarea') ??
      panel?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previous?.focus?.({ preventScroll: true });
    };
  }, []);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit?.();
  };

  const content = (
    <>
      <header className="modal__header">
        <div className="modal__titles">
          <h2 id={titleId} className="modal__title">
            {title}
          </h2>
          {subtitle && <p className="modal__subtitle">{subtitle}</p>}
        </div>
        <IconButton label="Schließen" icon={<X />} size="sm" onClick={onClose} className="modal__close" />
      </header>
      <div className="modal__body">{children}</div>
      {footer && <footer className="modal__footer">{footer}</footer>}
    </>
  );

  return createPortal(
    <motion.div
      className="modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal"
        style={{ width }}
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.14 } }}
        transition={{ type: 'spring', stiffness: 460, damping: 34, mass: 0.8 }}
      >
        {onSubmit ? (
          <form className="modal__form" onSubmit={handleSubmit} noValidate>
            {content}
          </form>
        ) : (
          content
        )}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
