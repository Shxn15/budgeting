import { ChevronDown } from 'lucide-react';
import type { InputHTMLAttributes, ReactNode, Ref, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cx } from './cx';
import './Field.css';

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  /** Optional content on the right of the label (e.g. quick actions). */
  aside?: ReactNode;
}

export function Field({ label, htmlFor, hint, error, children, aside }: FieldProps) {
  return (
    <div className={cx('field', error && 'field--invalid')}>
      <div className="field__top">
        <label className="field__label" htmlFor={htmlFor}>
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="field__hint">{hint}</p>
      )}
    </div>
  );
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  ref?: Ref<HTMLInputElement>;
  invalid?: boolean;
  /** Text shown in front of the value, e.g. "in". */
  leading?: ReactNode;
  /** Text shown after the value, e.g. "€". */
  suffix?: ReactNode;
}

export function TextInput({ invalid, leading, suffix, className, ...rest }: TextInputProps) {
  return (
    <div className={cx('input', invalid && 'input--invalid', rest.disabled && 'input--disabled', className)}>
      {leading && <span className="input__leading">{leading}</span>}
      <input className="input__control" aria-invalid={invalid || undefined} {...rest} />
      {suffix && <span className="input__suffix">{suffix}</span>}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export function Select({ invalid, className, children, ...rest }: SelectProps) {
  return (
    <div className={cx('input', 'input--select', invalid && 'input--invalid', className)}>
      <select className="input__control" aria-invalid={invalid || undefined} {...rest}>
        {children}
      </select>
      <ChevronDown className="input__chevron" aria-hidden />
    </div>
  );
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className={cx('input', 'input--textarea', className)}>
      <textarea className="input__control" rows={2} {...rest} />
    </div>
  );
}
