import { TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { DonutChart } from '../../components/charts/DonutChart';
import { cx } from '../../components/ui/cx';
import { accountColorCss } from '../../domain/colors';
import { buildPortfolio, sumBalances } from '../../domain/ledger';
import { formatMoney } from '../../domain/money';
import type { Cents } from '../../domain/types';
import { useAccounts, useBalances, useCurrency } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import './PortfolioCard.css';

/** More slices than this are folded into "Weitere Konten" (a 9th colour would be indistinguishable). */
const MAX_SLICES = 8;
const OTHER_KEY = '__other__';
const CHART_SIZE = 300;
const RING = 38;

interface Entry {
  key: string;
  label: string;
  balance: Cents;
  share: number;
  color: string;
  accountIds: string[];
}

const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 });

/** Font size that lets `text` fit into the hole of the ring. */
function fitFontSize(text: string, maxWidth: number, max: number, min = 16): number {
  return Math.max(min, Math.min(max, maxWidth / (text.length * 0.6)));
}

export function PortfolioCard() {
  const accounts = useAccounts();
  const balances = useBalances();
  const currency = useCurrency();
  const highlight = useUiStore((s) => s.highlight);
  const setHighlight = useUiStore((s) => s.setHighlight);

  const portfolio = useMemo(() => buildPortfolio(accounts, balances), [accounts, balances]);
  const total = sumBalances(balances);

  const entries = useMemo<Entry[]>(() => {
    const all = portfolio.slices.map((s) => ({
      key: s.account.id,
      label: s.account.name,
      balance: s.balance,
      share: s.share,
      color: accountColorCss(s.account.color),
      accountIds: [s.account.id],
    }));
    if (all.length <= MAX_SLICES) return all;
    const keep = new Set(
      [...all]
        .sort((a, b) => b.balance - a.balance)
        .slice(0, MAX_SLICES - 1)
        .map((e) => e.key),
    );
    const rest = all.filter((e) => !keep.has(e.key));
    return [
      ...all.filter((e) => keep.has(e.key)),
      {
        key: OTHER_KEY,
        label: `Weitere Konten (${rest.length})`,
        balance: rest.reduce((sum, e) => sum + e.balance, 0),
        share: rest.reduce((sum, e) => sum + e.share, 0),
        color: 'var(--series-other)',
        accountIds: rest.map((e) => e.key),
      },
    ];
  }, [portfolio]);

  const activeKey = highlight === null ? null : (entries.find((e) => e.accountIds.includes(highlight))?.key ?? null);
  const active = entries.find((e) => e.key === activeKey) ?? null;
  const slices = useMemo(() => entries.map((e) => ({ key: e.key, value: e.balance, color: e.color })), [entries]);

  const hole = CHART_SIZE - 20 - RING * 2;
  const centerText = active ? formatMoney(active.balance, currency) : formatMoney(total, currency);

  const center = (
    <div className="portfolio__center" key={active?.key ?? 'total'}>
      <span className="portfolio__center-label">{active ? active.label : 'Gesamtvermögen'}</span>
      <span
        className={cx('portfolio__center-value', !active && total < 0 && 'amount-negative')}
        style={{ fontSize: fitFontSize(centerText, hole - 36, active ? 30 : 36) }}
      >
        {centerText}
      </span>
      <span className="portfolio__center-note">
        {active
          ? `${percent.format(active.share)} des Guthabens`
          : accounts.length === 1
            ? '1 Konto'
            : `${accounts.length} Konten`}
      </span>
    </div>
  );

  const summary =
    entries.length > 0
      ? `Kreisdiagramm der Kontostände: ${entries.map((e) => `${e.label} ${percent.format(e.share)}`).join(', ')}`
      : 'Kreisdiagramm der Kontostände: noch keine Guthaben';

  return (
    <section className="card portfolio" aria-labelledby="portfolio-title">
      <div className="portfolio__chart">
        <DonutChart
          slices={slices}
          size={CHART_SIZE}
          thickness={RING}
          activeKey={activeKey}
          onActiveChange={(key) => setHighlight(key === null ? null : (entries.find((e) => e.key === key)?.accountIds[0] ?? null))}
          center={center}
          ariaLabel={summary}
        />
      </div>

      <div className="portfolio__details">
        <div className="portfolio__head">
          <h2 id="portfolio-title" className="portfolio__title">
            Verteilung auf deine Konten
          </h2>
          <p className="portfolio__subtitle">
            {entries.length > 0
              ? `${formatMoney(portfolio.positiveTotal, currency)} Guthaben auf ${portfolio.slices.length} ${
                  portfolio.slices.length === 1 ? 'Konto' : 'Konten'
                }`
              : 'Sobald ein Konto Guthaben hat, erscheint es hier.'}
          </p>
        </div>

        {entries.length > 0 && (
          <ul className="legend" aria-label="Kontostände">
            {entries.map((e) => (
              <li
                key={e.key}
                tabIndex={0}
                className={cx('legend__row', activeKey === e.key && 'is-active', activeKey !== null && activeKey !== e.key && 'is-dimmed')}
                onPointerEnter={() => setHighlight(e.accountIds[0] ?? null)}
                onPointerLeave={() => setHighlight(null)}
                onFocus={() => setHighlight(e.accountIds[0] ?? null)}
                onBlur={() => setHighlight(null)}
              >
                <span className="legend__swatch" style={{ background: e.color }} aria-hidden />
                <span className="legend__name">{e.label}</span>
                <span className="legend__amount num">{formatMoney(e.balance, currency)}</span>
                <span className="legend__share num">{percent.format(e.share)}</span>
              </li>
            ))}
          </ul>
        )}

        {portfolio.negative.length > 0 && (
          <p className="portfolio__negative">
            <TriangleAlert aria-hidden />
            <span>
              Im Minus und daher nicht im Diagramm:{' '}
              {portfolio.negative.map((n, i) => (
                <span key={n.account.id}>
                  {i > 0 && ', '}
                  {n.account.name} <span className="amount-negative num">{formatMoney(n.balance, currency)}</span>
                </span>
              ))}
            </span>
          </p>
        )}
      </div>
    </section>
  );
}
