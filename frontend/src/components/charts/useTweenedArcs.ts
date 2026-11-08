import { useEffect, useRef, useState } from 'react';

export interface ArcAngles {
  key: string;
  start: number;
  end: number;
}

const TAU = Math.PI * 2;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * Smoothly animates arc angles whenever the target angles change.
 * New arcs grow from their position, removed arcs shrink away, and on the
 * very first render the whole ring sweeps in clockwise.
 */
export function useTweenedArcs(targets: readonly ArcAngles[], duration = 650): ArcAngles[] {
  const [display, setDisplay] = useState<ArcAngles[]>(() =>
    prefersReducedMotion() ? [...targets] : targets.map((t) => ({ ...t, start: 0, end: 0 })),
  );
  const displayRef = useRef(display);
  displayRef.current = display;
  const firstRun = useRef(true);

  const signature = targets.map((t) => `${t.key}:${t.start.toFixed(5)}:${t.end.toFixed(5)}`).join('|');

  useEffect(() => {
    const isFirst = firstRun.current;
    firstRun.current = false;
    if (prefersReducedMotion()) {
      setDisplay([...targets]);
      return;
    }

    const from = new Map(displayRef.current.map((a) => [a.key, a]));
    const targetKeys = new Set(targets.map((t) => t.key));

    // Arcs that disappear shrink towards their own start angle.
    const leaving = displayRef.current
      .filter((a) => !targetKeys.has(a.key) && a.end - a.start > 1e-4)
      .map((a) => ({ key: a.key, start: a.start, end: a.start }));

    const plan = [...targets, ...leaving].map((to) => {
      const start = from.get(to.key) ?? { key: to.key, start: to.start, end: to.start };
      return { key: to.key, from: start, to };
    });

    const total = isFirst ? duration * 1.35 : duration;
    let frame = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / total);
      const eased = easeOutCubic(progress);
      setDisplay(
        plan
          .map(({ key, from: a, to: b }) => ({
            key,
            start: a.start + (b.start - a.start) * eased,
            end: a.end + (b.end - a.end) * eased,
          }))
          .filter((a) => progress < 1 || targetKeys.has(a.key)),
      );
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // `signature` captures every change of `targets`.
  }, [signature, duration]);

  return display;
}

/**
 * Converts values into consecutive angles (clockwise, starting at 12 o'clock).
 * Very small values get at least `minAngle` so they stay visible and
 * hoverable; the other slices shrink proportionally to make room.
 */
export function anglesFromValues(
  items: readonly { key: string; value: number }[],
  minAngle = 0.03,
): ArcAngles[] {
  const values = items.map((item) => Math.max(0, item.value));
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return [];

  const raw = values.map((v) => (v / total) * TAU);
  const positive = raw.filter((a) => a > 0).length;
  const small = raw.map((a) => a > 0 && a < minAngle);
  const smallCount = small.filter(Boolean).length;
  let sizes = raw;
  if (smallCount > 0 && smallCount < positive && smallCount * minAngle < TAU / 2) {
    const largeTotal = raw.reduce((sum, a, i) => (small[i] ? sum : sum + a), 0);
    const scale = (TAU - smallCount * minAngle) / largeTotal;
    sizes = raw.map((a, i) => (small[i] ? minAngle : a * scale));
  }

  let cursor = 0;
  return items.map((item, i) => {
    const start = cursor;
    cursor += sizes[i]!;
    return { key: item.key, start, end: cursor };
  });
}
