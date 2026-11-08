import { motion } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { cx } from './cx';
import './SegmentedControl.css';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange(value: T): void;
  label: string;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
}

/** Pill-shaped radio group with a sliding indicator. */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
  fullWidth,
}: SegmentedControlProps<T>) {
  const layoutId = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('segmented', `segmented--${size}`, fullWidth && 'segmented--full')}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={cx('segmented__option', active && 'is-active')}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
              event.preventDefault();
              const index = options.findIndex((o) => o.value === value);
              const step = event.key === 'ArrowRight' ? 1 : -1;
              const next = options[(index + step + options.length) % options.length]!;
              onChange(next.value);
              const buttons = event.currentTarget.parentElement?.querySelectorAll('button');
              buttons?.[options.indexOf(next)]?.focus();
            }}
            tabIndex={active ? 0 : -1}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="segmented__indicator"
                transition={{ type: 'spring', stiffness: 520, damping: 38 }}
              />
            )}
            <span className="segmented__content">
              {option.icon}
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
