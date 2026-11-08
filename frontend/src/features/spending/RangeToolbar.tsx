import { ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { addMonthsToKey, formatMonthRange } from '../../domain/dates';
import type { MonthKey } from '../../domain/types';
import { Button, IconButton } from '../../components/ui/Button';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { lastMonths } from '../../domain/spending';
import './RangeToolbar.css';

export type RangePreset = '1' | '3' | '6' | '12' | 'custom';

export const MIN_CUSTOM_MONTHS = 2;
export const MAX_CUSTOM_MONTHS = 36;

interface RangeToolbarProps {
  preset: RangePreset;
  customMonths: number;
  endMonth: MonthKey;
  currentMonth: MonthKey;
  onPresetChange(preset: RangePreset): void;
  onCustomMonthsChange(months: number): void;
  onEndMonthChange(month: MonthKey): void;
}

export function presetMonths(preset: RangePreset, customMonths: number): number {
  return preset === 'custom' ? customMonths : Number(preset);
}

/** Period filter: one month or the last N months, browsable with ‹ ›. */
export function RangeToolbar({
  preset,
  customMonths,
  endMonth,
  currentMonth,
  onPresetChange,
  onCustomMonthsChange,
  onEndMonthChange,
}: RangeToolbarProps) {
  const months = presetMonths(preset, customMonths);
  const range = lastMonths(endMonth, months);
  const atCurrent = endMonth >= currentMonth;

  return (
    <div className="range-toolbar" role="group" aria-label="Zeitraum">
      <div className="range-toolbar__nav">
        <IconButton
          label={months === 1 ? 'Vorheriger Monat' : `Vorherige ${months} Monate`}
          icon={<ChevronLeft />}
          onClick={() => onEndMonthChange(addMonthsToKey(endMonth, -months))}
        />
        <span className="range-toolbar__label" aria-live="polite">
          {formatMonthRange(range.start, range.end)}
        </span>
        <IconButton
          label={months === 1 ? 'Nächster Monat' : `Nächste ${months} Monate`}
          icon={<ChevronRight />}
          disabled={atCurrent}
          onClick={() => {
            const next = addMonthsToKey(endMonth, months);
            onEndMonthChange(next > currentMonth ? currentMonth : next);
          }}
        />
        {!atCurrent && (
          <Button size="sm" variant="ghost" onClick={() => onEndMonthChange(currentMonth)}>
            Heute
          </Button>
        )}
      </div>

      <div className="range-toolbar__presets">
        <SegmentedControl<RangePreset>
          label="Länge des Zeitraums"
          size="sm"
          value={preset}
          onChange={onPresetChange}
          options={[
            { value: '1', label: 'Monat' },
            { value: '3', label: '3 Monate' },
            { value: '6', label: '6 Monate' },
            { value: '12', label: '12 Monate' },
            { value: 'custom', label: 'Eigene' },
          ]}
        />
        {preset === 'custom' && (
          <div className="range-toolbar__custom">
            <IconButton
              label="Ein Monat weniger"
              size="sm"
              icon={<Minus />}
              disabled={customMonths <= MIN_CUSTOM_MONTHS}
              onClick={() => onCustomMonthsChange(customMonths - 1)}
            />
            <input
              className="range-toolbar__input"
              type="number"
              aria-label="Anzahl Monate"
              min={MIN_CUSTOM_MONTHS}
              max={MAX_CUSTOM_MONTHS}
              value={customMonths}
              onChange={(event) => {
                const value = Math.round(Number(event.target.value));
                if (Number.isFinite(value)) {
                  onCustomMonthsChange(Math.min(MAX_CUSTOM_MONTHS, Math.max(MIN_CUSTOM_MONTHS, value)));
                }
              }}
            />
            <span className="range-toolbar__unit">Monate</span>
            <IconButton
              label="Ein Monat mehr"
              size="sm"
              icon={<Plus />}
              disabled={customMonths >= MAX_CUSTOM_MONTHS}
              onClick={() => onCustomMonthsChange(customMonths + 1)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
