import { Check } from 'lucide-react';
import type { CSSProperties } from 'react';
import { ACCOUNT_COLORS, accountColorCss } from '../../domain/colors';
import { cx } from './cx';
import './ColorSwatches.css';

interface ColorSwatchesProps {
  value: string;
  onChange(color: string): void;
  size?: 'sm' | 'md';
}

export function ColorSwatches({ value, onChange, size = 'md' }: ColorSwatchesProps) {
  return (
    <div className={cx('swatches', size === 'sm' && 'swatches--sm')} role="radiogroup" aria-label="Farbe">
      {ACCOUNT_COLORS.map((color) => {
        const active = color.key === value;
        return (
          <button
            key={color.key}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={color.label}
            title={color.label}
            className={cx('swatch', active && 'is-active')}
            style={{ '--swatch': accountColorCss(color.key) } as CSSProperties}
            onClick={() => onChange(color.key)}
          >
            {active && <Check aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}
