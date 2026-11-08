import { arc as d3Arc } from 'd3-shape';
import { useMemo, type ReactNode } from 'react';
import { cx } from '../ui/cx';
import { anglesFromValues, useTweenedArcs, type ArcAngles } from './useTweenedArcs';
import './DonutChart.css';

export interface DonutSlice {
  key: string;
  value: number;
  /** Any CSS colour, e.g. var(--series-blue). */
  color: string;
}

interface DonutChartProps {
  slices: readonly DonutSlice[];
  size?: number;
  thickness?: number;
  /** Highlighted slice (hover / keyboard focus in the legend). */
  activeKey: string | null;
  onActiveChange(key: string | null): void;
  /** Content in the middle of the ring (HTML). */
  center?: ReactNode;
  ariaLabel: string;
}

/** Width of the gap between two slices in px (the "surface gap"). */
const GAP_PX = 2.5;
const CORNER_RADIUS = 5;
/** Room around the ring so a highlighted slice can grow. */
const HOVER_ROOM = 10;

/**
 * Ring-shaped pie chart. Slices animate smoothly when values change and the
 * hovered slice pops out while the others step back.
 */
export function DonutChart({
  slices,
  size = 280,
  thickness = 40,
  activeKey,
  onActiveChange,
  center,
  ariaLabel,
}: DonutChartProps) {
  const targets = useMemo(() => anglesFromValues(slices), [slices]);
  const arcs = useTweenedArcs(targets);
  const colors = useMemo(() => new Map(slices.map((s) => [s.key, s.color])), [slices]);

  const outer = size / 2 - HOVER_ROOM;
  const inner = outer - thickness;
  const padRadius = (outer + inner) / 2;

  const path = useMemo(
    () =>
      d3Arc<ArcAngles>()
        .innerRadius(inner)
        .outerRadius(outer)
        .startAngle((d) => d.start)
        .endAngle((d) => d.end)
        .cornerRadius(CORNER_RADIUS)
        .padRadius(padRadius)
        .padAngle(arcs.length > 1 ? GAP_PX / padRadius : 0),
    [inner, outer, padRadius, arcs.length],
  );

  const visible = arcs.filter((a) => a.end - a.start > 1e-4);
  const half = size / 2;

  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg
        className={cx('donut__svg', activeKey !== null && 'has-active')}
        width={size}
        height={size}
        viewBox={`${-half} ${-half} ${size} ${size}`}
        role="img"
        aria-label={ariaLabel}
        onPointerLeave={() => onActiveChange(null)}
      >
        <circle className="donut__track" r={(outer + inner) / 2} strokeWidth={thickness} />
        {visible.map((a) => (
          <path
            key={a.key}
            d={path(a) ?? undefined}
            className={cx('donut__slice', activeKey === a.key && 'is-active')}
            style={{ fill: colors.get(a.key) ?? 'var(--series-other)' }}
            onPointerEnter={() => onActiveChange(a.key)}
          />
        ))}
      </svg>
      {center && <div className="donut__center">{center}</div>}
    </div>
  );
}
