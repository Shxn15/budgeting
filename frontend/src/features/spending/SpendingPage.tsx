import { ChartColumn, Minus, Pencil, Plus, Receipt, Table2, Tag as TagIcon, Trash2, TrendingDown, TrendingUp, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { daysInMonth, formatMonth, formatMonthName, monthKey } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import type { Transaction } from '../../domain/types';
import {
  lastMonths,
  NO_TAG,
  previousPeriodSpending,
  subscriptionIdOfGroup,
  summarizeSpending,
  type SpendingGroup,
} from '../../domain/spending';
import { PageHeader } from '../../components/layout/PageHeader';
import { Avatar } from '../../components/avatar/Avatar';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { cx } from '../../components/ui/cx';
import { EmptyState } from '../../components/ui/EmptyState';
import { Menu, type MenuItem } from '../../components/ui/Menu';
import { StatTile } from '../../components/ui/StatTile';
import { useCurrency, useSubscriptionMap, useTagMap, useTags, useToday, useTransactions } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { confirmDeleteTag } from '../tags/confirmDeleteTag';
import { TransactionRow } from '../transactions/TransactionRow';
import { comparisonPeriod, relativeChange } from './compare';
import { GroupAvatar, groupInfo, type GroupInfo } from './groupInfo';
import { MonthlyChart, type MonthValue } from './MonthlyChart';
import { presetMonths, RangeToolbar, type RangePreset } from './RangeToolbar';
import './SpendingPage.css';

const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 0 });
const PAYMENTS_SHOWN = 12;

/** "Ausgaben": how much went where – by tag, for one month or a range of months. */
export function SpendingPage() {
  const transactions = useTransactions();
  const tags = useTags();
  const tagMap = useTagMap();
  const subscriptionMap = useSubscriptionMap();
  const currency = useCurrency();
  const today = useToday();
  const openDialog = useUiStore((s) => s.openDialog);
  const navigate = useUiStore((s) => s.navigate);
  const currentMonth = monthKey(today);

  const [preset, setPreset] = useState<RangePreset>('1');
  const [customMonths, setCustomMonths] = useState(5);
  const [endMonth, setEndMonth] = useState(currentMonth);
  const [selected, setSelected] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [allPayments, setAllPayments] = useState(false);

  const months = presetMonths(preset, customMonths);
  const range = useMemo(() => lastMonths(endMonth, months), [endMonth, months]);
  const summary = useMemo(() => summarizeSpending(transactions, range), [transactions, range]);
  // The chart shows at least 6 months, the months outside the period in grey as context.
  const chartRange = useMemo(() => lastMonths(endMonth, Math.max(months, 6)), [endMonth, months]);
  const chartSummary = useMemo(() => summarizeSpending(transactions, chartRange), [transactions, chartRange]);

  const info = (key: string) => groupInfo(key, tagMap, subscriptionMap);
  const selectedGroup: SpendingGroup | null = selected ? (summary.groups.find((g) => g.key === selected) ?? null) : null;
  const selectedInfo = selected ? info(selected) : null;
  const total = selected ? (selectedGroup?.total ?? 0) : summary.total;
  const count = selected ? (selectedGroup?.count ?? 0) : summary.count;
  const prev = previousPeriodSpending(transactions, range, today, selected ?? undefined);

  const chartData: MonthValue[] = chartSummary.months.map((month) => ({
    month,
    value: selected
      ? (chartSummary.groups.find((g) => g.key === selected)?.byMonth.get(month) ?? 0)
      : (chartSummary.byMonth.get(month) ?? 0),
    inRange: month >= range.start && month <= range.end,
  }));

  const hasAnySpending = transactions.some((t) => t.kind === 'expense' || t.kind === 'payment' || t.kind === 'subscription');
  const usedKeys = new Set(summary.groups.map((g) => g.key));
  const unusedTags = tags.filter((t) => !usedKeys.has(t.id)).sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const maxGroup = summary.groups[0]?.total ?? 0;

  const days = endMonth === currentMonth && months === 1 ? Number(today.slice(8, 10)) : null;
  const perDay =
    months === 1 ? total / (days ?? daysInMonth(Number(endMonth.slice(0, 4)), Number(endMonth.slice(5, 7)))) : null;

  const payments = selected ? (selectedGroup?.transactions ?? []) : summary.groups.flatMap((g) => g.transactions).sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1,
  );
  const shownPayments = allPayments ? payments : payments.slice(0, PAYMENTS_SHOWN);

  const toggle = (key: string) => {
    setSelected((current) => (current === key ? null : key));
    setAllPayments(false);
  };

  const groupMenu = (key: string): (MenuItem | 'separator')[] => {
    const subId = subscriptionIdOfGroup(key);
    if (subId) {
      return [{ label: 'Abo bearbeiten', icon: <Pencil />, onSelect: () => openDialog({ type: 'subscription', subscriptionId: subId }) }];
    }
    const tag = tagMap.get(key);
    if (!tag) return [];
    return [
      { label: 'Zahlung mit diesem Tag eintragen', icon: <Minus />, onSelect: () => openDialog({ type: 'booking', kind: 'expense', tagId: tag.id }) },
      { label: 'Tag bearbeiten', icon: <Pencil />, onSelect: () => openDialog({ type: 'tag', tagId: tag.id }) },
      'separator',
      { label: 'Tag löschen', icon: <Trash2 />, danger: true, onSelect: () => confirmDeleteTag(tag) },
    ];
  };

  const deltaNote = () => {
    const change = relativeChange(total, prev.total);
    const period = comparisonPeriod(prev, months);
    if (change === null) return total > 0 ? `${period}: nichts` : 'keine Ausgaben';
    if (Math.abs(change) < 0.005) return `genauso viel wie ${period}`;
    const up = change > 0;
    const Icon = up ? TrendingUp : TrendingDown;
    return (
      <span className={cx('spending-delta', up ? 'is-up' : 'is-down')}>
        <Icon aria-hidden />
        {percent.format(Math.abs(change))} {up ? 'mehr' : 'weniger'} als {period}
      </span>
    );
  };

  return (
    <div className="page">
      <PageHeader
        title="Ausgaben"
        subtitle="Wofür du wie viel Geld ausgibst – nach Tags, für einen Monat oder mehrere."
        actions={
          <>
            <Button icon={<TagIcon />} onClick={() => navigate('tags')}>
              Tags verwalten
            </Button>
            <Button
              variant="primary"
              icon={<Minus />}
              onClick={() => openDialog({ type: 'booking', kind: 'expense', tagId: selectedInfo?.tag?.id })}
            >
              Zahlung eintragen
            </Button>
          </>
        }
      />

      {!hasAnySpending ? (
        <Card>
          <EmptyState
            icon={<Receipt />}
            title="Noch keine Ausgaben"
            action={
              <Button variant="primary" icon={<Minus />} onClick={() => openDialog({ type: 'booking', kind: 'expense' })}>
                Zahlung eintragen
              </Button>
            }
          >
            Trage Zahlungen mit einem Tag wie „Rewe“ oder „Rossmann“ ein – auch vergangene. Hier siehst du dann, wie viel
            du pro Monat oder über mehrere Monate wofür ausgegeben hast. Abos und bezahlte Rechnungen zählen automatisch mit.
          </EmptyState>
        </Card>
      ) : (
        <>
          <RangeToolbar
            preset={preset}
            customMonths={customMonths}
            endMonth={endMonth}
            currentMonth={currentMonth}
            onPresetChange={(value) => {
              setPreset(value);
              setAllPayments(false);
            }}
            onCustomMonthsChange={setCustomMonths}
            onEndMonthChange={(month) => {
              setEndMonth(month);
              setAllPayments(false);
            }}
          />

          <AnimatePresence initial={false}>
            {selectedInfo && (
              <motion.div
                className="spending-filter"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
              >
                <div className="spending-filter__inner">
                  <GroupAvatar info={selectedInfo} size={28} />
                  <span>
                    Nur <strong>{selectedInfo.name}</strong>
                  </span>
                  <Button size="sm" variant="ghost" icon={<X />} onClick={() => setSelected(null)}>
                    Alle anzeigen
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="stat-row">
            <StatTile label={selectedInfo ? `Ausgaben · ${selectedInfo.name}` : 'Ausgaben gesamt'} value={formatMoney(total, currency)}>
              {deltaNote()}
            </StatTile>
            {months === 1 ? (
              <StatTile label="Ø pro Tag" value={formatMoney(Math.round(perDay ?? 0), currency)}>
                {days !== null ? `in den ersten ${days} Tagen` : `im ${formatMonthName(endMonth)}`}
              </StatTile>
            ) : (
              <StatTile label="Ø pro Monat" value={formatMoney(Math.round(total / months), currency)}>
                über {months} Monate
              </StatTile>
            )}
            <StatTile label="Zahlungen" value={String(count)}>
              {count > 0 ? `Ø ${formatMoney(Math.round(total / count), currency)} pro Zahlung` : 'keine im Zeitraum'}
            </StatTile>
            {selectedInfo ? (
              <StatTile label="Anteil an allen Ausgaben" value={summary.total > 0 ? percent.format(total / summary.total) : '–'}>
                von {formatMoney(summary.total, currency)}
              </StatTile>
            ) : (
              <StatTile label="Größter Posten" value={summary.groups[0] ? info(summary.groups[0].key).name : '–'}>
                {summary.groups[0]
                  ? `${formatMoney(summary.groups[0].total, currency)} · ${percent.format(summary.groups[0].total / summary.total)}`
                  : 'keine Ausgaben'}
              </StatTile>
            )}
          </div>

          <Card
            title={selectedInfo ? `${selectedInfo.name} pro Monat` : 'Ausgaben pro Monat'}
            className="spending-chart"
            actions={
              <Button
                size="sm"
                variant="ghost"
                icon={showTable ? <ChartColumn /> : <Table2 />}
                onClick={() => setShowTable((v) => !v)}
              >
                {showTable ? 'Diagramm' : 'Tabelle'}
              </Button>
            }
          >
            {showTable ? (
              <table className="spending-table">
                <thead>
                  <tr>
                    <th scope="col">Monat</th>
                    <th scope="col">Ausgaben</th>
                  </tr>
                </thead>
                <tbody>
                  {[...chartData].reverse().map((d) => (
                    <tr key={d.month} className={cx(!d.inRange && 'is-context')}>
                      <td>{formatMonth(d.month)}</td>
                      <td className="num">{formatMoney(d.value, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <MonthlyChart
                data={chartData}
                currency={currency}
                ariaLabel={`${selectedInfo ? selectedInfo.name : 'Ausgaben'} pro Monat: ${chartData
                  .map((d) => `${formatMonth(d.month)} ${formatMoney(d.value, currency)}`)
                  .join(', ')}`}
                onSelectMonth={(month) => {
                  setPreset('1');
                  setEndMonth(month);
                  setAllPayments(false);
                }}
              />
            )}
            {months < 6 && !showTable && (
              <p className="spending-chart__note">
                <span className="spending-chart__key" aria-hidden /> ausgewählter Zeitraum
                <span className="spending-chart__key is-context" aria-hidden /> Monate davor zum Vergleich
              </p>
            )}
          </Card>

          <div className="spending-columns">
            <Card
              title="Nach Tags"
              padded={false}
              className="spending-ranking"
              actions={
                <Button size="sm" variant="ghost" icon={<Plus />} onClick={() => openDialog({ type: 'tag' })}>
                  Tag
                </Button>
              }
            >
              {summary.groups.length === 0 ? (
                <EmptyState compact icon={<Receipt />} title="Keine Ausgaben in diesem Zeitraum">
                  Wähle einen anderen Zeitraum oder trage eine Zahlung ein.
                </EmptyState>
              ) : (
                <ul className="rank-list" aria-label="Ausgaben nach Tags">
                  {summary.groups.map((group) => {
                    const gi = info(group.key);
                    const menu = groupMenu(group.key);
                    const isSelected = selected === group.key;
                    return (
                      <li
                        key={group.key}
                        className={cx('rank-row', isSelected && 'is-selected', selected !== null && !isSelected && 'is-dimmed')}
                      >
                        <button type="button" className="rank-row__main" aria-pressed={isSelected} onClick={() => toggle(group.key)}>
                          <GroupAvatar info={gi} size={38} />
                          <span className="rank-row__text">
                            <span className="rank-row__name">
                              {gi.name}
                              {gi.subscription && <Badge tone="accent">Abo</Badge>}
                            </span>
                            <span className="rank-row__meta">
                              {group.count === 1 ? '1 Zahlung' : `${group.count} Zahlungen`}
                            </span>
                          </span>
                          <span className="rank-row__bar" aria-hidden>
                            <span style={{ width: `${maxGroup > 0 ? (group.total / maxGroup) * 100 : 0}%` }} />
                          </span>
                          <span className="rank-row__amount num">{formatMoney(group.total, currency)}</span>
                          <span className="rank-row__share num">{percent.format(group.total / summary.total)}</span>
                        </button>
                        <span className="rank-row__menu">
                          {menu.length > 0 && <Menu label={`Aktionen für ${gi.name}`} items={menu} />}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {summary.groups.some((g) => g.key === NO_TAG) && (
                <p className="spending-hint">
                  Tipp: Gib Zahlungen „Ohne Tag“ einen Tag (über ✎ bei der Zahlung), dann siehst du genauer, wofür dein Geld
                  draufgeht.
                </p>
              )}

              {unusedTags.length > 0 && (
                <div className="unused-tags">
                  <p className="unused-tags__title">Ohne Ausgaben im Zeitraum</p>
                  <div className="chips">
                    {unusedTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        className="chip tag-chip"
                        title="Tag bearbeiten"
                        onClick={() => openDialog({ type: 'tag', tagId: tag.id })}
                      >
                        <Avatar name={tag.name} image={tag.image} color={tag.color} size={20} />
                        {tag.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <PaymentsCard
              info={selectedInfo}
              payments={shownPayments}
              total={payments.length}
              today={today}
              expanded={allPayments}
              onExpand={() => setAllPayments(true)}
            />
          </div>
        </>
      )}
    </div>
  );
}

interface PaymentsCardProps {
  info: GroupInfo | null;
  payments: readonly Transaction[];
  total: number;
  today: string;
  expanded: boolean;
  onExpand(): void;
}

function PaymentsCard({ info, payments, total, today, expanded, onExpand }: PaymentsCardProps) {
  return (
    <Card title={info ? `Zahlungen · ${info.name}` : 'Zahlungen im Zeitraum'} padded={false} className="spending-payments">
      {payments.length === 0 ? (
        <EmptyState compact icon={<Receipt />} title="Keine Zahlungen">
          In diesem Zeitraum gibt es dafür keine Zahlungen.
        </EmptyState>
      ) : (
        <div className="spending-payments__list">
          {payments.map((t) => (
            <TransactionRow key={t.id} transaction={t} today={today} showDate />
          ))}
          {!expanded && total > payments.length && (
            <button type="button" className="tx-groups__more" onClick={onExpand}>
              Alle {total} anzeigen
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

