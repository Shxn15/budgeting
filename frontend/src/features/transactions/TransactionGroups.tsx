import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { diffDays, formatDate } from '../../domain/dates';
import type { ISODate, Transaction } from '../../domain/types';
import { sortNewestFirst } from './describe';
import { TransactionRow } from './TransactionRow';
import './TransactionsPage.css';

function dayLabel(date: string, today: string): string {
  const days = diffDays(date, today);
  if (days === 0) return 'Heute';
  if (days === 1) return 'Gestern';
  return formatDate(date);
}

interface TransactionGroupsProps {
  transactions: readonly Transaction[];
  today: ISODate;
  /** Account the list belongs to: transfers then show as + or -. */
  perspective?: string | null;
  /** How many bookings are shown before "Weitere anzeigen". */
  pageSize?: number;
}

/** Bookings grouped by day, newest first. */
export function TransactionGroups({ transactions, today, perspective = null, pageSize = 150 }: TransactionGroupsProps) {
  const [visible, setVisible] = useState(pageSize);
  const sorted = useMemo(() => sortNewestFirst(transactions), [transactions]);

  const groups = useMemo(() => {
    const result: { date: string; items: Transaction[] }[] = [];
    for (const t of sorted.slice(0, visible)) {
      const last = result[result.length - 1];
      if (last && last.date === t.date) last.items.push(t);
      else result.push({ date: t.date, items: [t] });
    }
    return result;
  }, [sorted, visible]);

  const hidden = sorted.length - Math.min(visible, sorted.length);

  return (
    <div className="tx-groups">
      <AnimatePresence initial={false}>
        {groups.map((group) => (
          <motion.section
            key={group.date}
            layout="position"
            className="tx-group"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <h3 className="tx-group__title">{dayLabel(group.date, today)}</h3>
            <AnimatePresence initial={false}>
              {group.items.map((t) => (
                <motion.div
                  key={t.id}
                  layout="position"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -16, transition: { duration: 0.16 } }}
                >
                  <TransactionRow transaction={t} today={today} perspective={perspective} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.section>
        ))}
      </AnimatePresence>
      {hidden > 0 && (
        <button type="button" className="tx-groups__more" onClick={() => setVisible((v) => v + pageSize)}>
          Weitere anzeigen ({hidden})
        </button>
      )}
    </div>
  );
}
