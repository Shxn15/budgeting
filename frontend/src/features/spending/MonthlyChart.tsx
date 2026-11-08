import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { formatMonth, formatMonthShort } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import type { Cents, MonthKey } from '../../domain/types';
import { cx } from '../../components/ui/cx';
import './MonthlyChart.css';

export interface MonthValue {
  month: MonthKey;
  value: Cents;
  /** Part of the selected period (others are shown as context in grey). */
  inRange: boolean;
}

interface MonthlyChartProps {
  data: readonly MonthValue[];
  currency: string;
  /** Click on a column: show that month. */
  onSelectMonth?(month: MonthKey): void;
  ariaLabel: string;
}

const HEIGHT = 236;
const MARGIN = { top: 26, right: 6, bottom: 34, left: 58 };
const MAX_BAR = 24;
const RADIUS = 4;

/** A "nice" step in whole euros (1, 2, 5 × 10^n; 2.5 only from 25 € on) for about `count` grid lines. */
export function niceStep(maxEuros: number, count: number): number {
  const raw = Math.max(1, maxEuros / count);
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const steps = power >= 10 ? [1, 2, 2.5, 5, 10] : [1, 2, 5, 10];
  return steps.find((f) => fraction <= f)! * power;
}

/** Column with rounded data-end (top) and a square base. */
function columnPath(x: number, y: number, width: number, height: number): string {
  const r = Math.min(RADIUS, width / 2, height);
  const bottom = y + height;
  return `M${x},${bottom}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${bottom}Z`;
}

/** Monthly spending as thin columns, with a tooltip on hover and keyboard focus. */
export function MonthlyChart({ data, currency, onSelectMonth, ariaLabel }: MonthlyChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(240, Math.floor(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const axisFormat = useMemo(
    () => new Intl.NumberFormat('de-DE', { style: 'currency', currency, maximumFractionDigits: 0 }),
    [currency],
  );

  const innerW = width - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const maxValue = Math.max(0, ...data.map((d) => d.value));
  const step = maxValue > 0 ? niceStep(maxValue / 100, 4) * 100 : 1;
  const top = maxValue > 0 ? Math.ceil(maxValue / step) * step : 4 * 100_00;
  const ticks = Array.from({ length: Math.round(top / (maxValue > 0 ? step : 100_00)) + 1 }, (_, i) => i * (maxValue > 0 ? step : 100_00));
  const y = (value: number) => MARGIN.top + innerH - (value / top) * innerH;
  const band = innerW / Math.max(1, data.length);
  const barW = Math.max(4, Math.min(MAX_BAR, band * 0.56));
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(innerW / 46))));

  // Label selectively: only the largest column of the selected period.
  const labelled = data.reduce<number | null>(
    (best, d, i) => (d.inRange && d.value > 0 && (best === null || d.value > data[best]!.value) ? i : best),
    null,
  );

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (data.length === 0) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const start = active ?? (event.key === 'ArrowRight' ? -1 : data.length);
      setActive(Math.min(data.length - 1, Math.max(0, start + (event.key === 'ArrowRight' ? 1 : -1))));
    } else if ((event.key === 'Enter' || event.key === ' ') && active !== null && onSelectMonth) {
      event.preventDefault();
      onSelectMonth(data[active]!.month);
    }
  };

  const activeItem = active !== null ? data[active] : undefined;
  const tooltipX = active !== null ? MARGIN.left + band * active + band / 2 : 0;
  const tooltipY = activeItem ? y(activeItem.value) : 0;
  // Not enough room above a tall column: show the tooltip inside the plot instead.
  const below = tooltipY < 72;

  return (
    <div className="mchart" ref={wrapRef}>
      <svg
        className="mchart__svg"
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
        onPointerLeave={() => setActive(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="mchart__grid" x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} />
            <text className="mchart__tick" x={MARGIN.left - 10} y={y(tick)} dy="0.32em" textAnchor="end">
              {axisFormat.format(tick / 100)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const x = MARGIN.left + band * i + (band - barW) / 2;
          const h = MARGIN.top + innerH - y(d.value);
          const showLabel = i % labelEvery === 0 || i === data.length - 1;
          const january = d.month.endsWith('-01');
          return (
            <g
              key={d.month}
              className={cx('mchart__col', !d.inRange && 'is-context', active === i && 'is-active', onSelectMonth && 'is-clickable')}
              onPointerEnter={() => setActive(i)}
              onClick={() => onSelectMonth?.(d.month)}
            >
              {/* The hit target is the whole column band, not just the painted bar. */}
              <rect className="mchart__hit" x={MARGIN.left + band * i} y={MARGIN.top} width={band} height={innerH} />
              {d.value > 0 && <path className="mchart__bar" d={columnPath(x, y(d.value), barW, h)} />}
              {showLabel && (
                <text className="mchart__month" x={x + barW / 2} y={HEIGHT - MARGIN.bottom + 18} textAnchor="middle">
                  {formatMonthShort(d.month)}
                  {(i === 0 || january) && (
                    <tspan className="mchart__year" x={x + barW / 2} dy="13">
                      {d.month.slice(0, 4)}
                    </tspan>
                  )}
                </text>
              )}
              {labelled === i && active === null && (
                <text className="mchart__value" x={x + barW / 2} y={y(d.value) - 8} textAnchor="middle">
                  {axisFormat.format(Math.round(d.value / 100))}
                </text>
              )}
            </g>
          );
        })}

        <line className="mchart__axis" x1={MARGIN.left} x2={width - MARGIN.right} y1={y(0)} y2={y(0)} />
      </svg>

      {maxValue === 0 && <p className="mchart__empty">Keine Ausgaben in diesem Zeitraum</p>}

      {activeItem && (
        <div
          className={cx('mchart__tooltip', below && 'is-below')}
          style={{
            left: Math.min(width - 80, Math.max(80, tooltipX)),
            top: below ? tooltipY + 12 : tooltipY - 12,
          }}
          role="status"
        >
          <strong>{formatMoney(activeItem.value, currency)}</strong>
          <span>{formatMonth(activeItem.month)}</span>
          {onSelectMonth && <span className="mchart__tooltip-hint">Klicken für diesen Monat</span>}
        </div>
      )}
    </div>
  );
}
