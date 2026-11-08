import { formatMonthName, formatMonthShort } from '../../domain/dates';
import type { PreviousPeriod } from '../../domain/spending';

/** Short name of the comparison period: "im Oktober", "1.–8. Okt.", "Feb.–Juni". */
export function comparisonPeriod(prev: PreviousPeriod, months: number): string {
  if (months === 1) {
    if (!prev.partial) return `im ${formatMonthName(prev.range.end)}`;
    const day = Number(prev.until.slice(8, 10));
    const month = formatMonthShort(prev.range.end);
    return day === 1 ? `am 1. ${month}` : `1.–${day}. ${month}`;
  }
  return `${formatMonthShort(prev.range.start)}–${formatMonthShort(prev.range.end)}`;
}

/** Relative change, or null if there is nothing to compare with. */
export function relativeChange(current: number, previous: number): number | null {
  return previous > 0 ? (current - previous) / previous : null;
}
