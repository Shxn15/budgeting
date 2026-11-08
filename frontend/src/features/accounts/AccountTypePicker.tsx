import type { AccountType } from '../../domain/types';
import { cx } from '../../components/ui/cx';
import { ACCOUNT_TYPES } from './accountTypes';
import './AccountTypePicker.css';

export function AccountTypePicker({ value, onChange }: { value: AccountType; onChange(type: AccountType): void }) {
  return (
    <div className="type-picker" role="radiogroup" aria-label="Kontoart">
      {ACCOUNT_TYPES.map((type) => {
        const Icon = type.icon;
        const active = type.value === value;
        return (
          <button
            key={type.value}
            type="button"
            role="radio"
            aria-checked={active}
            className={cx('type-picker__option', active && 'is-active')}
            onClick={() => onChange(type.value)}
          >
            <Icon aria-hidden />
            <span>{type.label}</span>
          </button>
        );
      })}
    </div>
  );
}
