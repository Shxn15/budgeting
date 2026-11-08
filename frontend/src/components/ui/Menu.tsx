import { MoreHorizontal } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconButton } from './Button';
import { cx } from './cx';
import './Menu.css';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect(): void;
  danger?: boolean;
  disabled?: boolean;
}

interface MenuProps {
  items: readonly (MenuItem | 'separator')[];
  label?: string;
  align?: 'left' | 'right';
}

/** "⋯" button with a small dropdown menu. */
export function Menu({ items, label = 'Weitere Aktionen', align = 'right' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    // Focus the first entry for keyboard users.
    rootRef.current?.querySelector<HTMLElement>('.menu__item:not(:disabled)')?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  return (
    <div className="menu" ref={rootRef}>
      <IconButton
        label={label}
        icon={<MoreHorizontal />}
        size="sm"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cx(open && 'is-pressed')}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      />
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            className={cx('menu__popover', `menu__popover--${align}`)}
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -2, transition: { duration: 0.1 } }}
            transition={{ type: 'spring', stiffness: 600, damping: 36 }}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
              event.preventDefault();
              const entries = Array.from(
                event.currentTarget.querySelectorAll<HTMLElement>('.menu__item:not(:disabled)'),
              );
              const index = entries.indexOf(document.activeElement as HTMLElement);
              const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
              entries[(next + entries.length) % entries.length]?.focus();
            }}
          >
            {items.map((item, index) =>
              item === 'separator' ? (
                <div key={`sep-${index}`} className="menu__separator" role="separator" />
              ) : (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  className={cx('menu__item', item.danger && 'menu__item--danger')}
                  onClick={(event) => {
                    event.stopPropagation();
                    setOpen(false);
                    item.onSelect();
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ),
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
