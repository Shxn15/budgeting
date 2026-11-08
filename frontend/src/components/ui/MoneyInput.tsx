import { centsToInput, parseMoney } from '../../domain/money';
import { TextInput } from './Field';

interface MoneyInputProps {
  id?: string;
  value: string;
  onChange(value: string): void;
  invalid?: boolean;
  placeholder?: string;
  large?: boolean;
  autoFocus?: boolean;
}

/** Text field for amounts in euros. Keeps the raw text; parse it with parseMoney(). */
export function MoneyInput({ id, value, onChange, invalid, placeholder = '0,00', large, autoFocus }: MoneyInputProps) {
  return (
    <TextInput
      id={id}
      className={large ? 'input--lg' : undefined}
      value={value}
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      placeholder={placeholder}
      invalid={invalid}
      suffix="€"
      data-autofocus={autoFocus || undefined}
      onChange={(event) => onChange(event.target.value)}
      onFocus={(event) => event.target.select()}
      onBlur={() => {
        // Tidy up the input, e.g. "12,5" -> "12,50".
        const cents = parseMoney(value);
        if (cents !== null) onChange(centsToInput(cents));
      }}
    />
  );
}
