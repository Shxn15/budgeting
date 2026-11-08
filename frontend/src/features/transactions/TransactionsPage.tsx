import { ArrowLeftRight, History } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { diffDays, formatDate } from '../../domain/dates';
import type { Transaction } from '../../domain/types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Select } from '../../components/ui/Field';
import { useAccounts, useToday, useTransactions } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { sortNewestFirst } from './describe';
import { TransactionRow } from './TransactionRow';
import './TransactionsPage.css';

function dayLabel(date: string, today: string): string {
  const days = diffDays(date, today);
  if (days === 0) return 'Heute';
  if (days === 1) return 'Gestern';
  return formatDate(date);
}

export function TransactionsPage() {
  const transactions = useTransactions();
  const accounts = useAccounts();
  const today = useToday();
  const openDialog = useUiStore((s) => s.openDialog);
  const [accountFilter, setAccountFilter] = useState('');

  const groups = useMemo(() => {
    const filtered = accountFilter
      ? transactions.filter((t) => t.fromAccountId === accountFilter || t.toAccountId === accountFilter)
      : transactions;
    const result: { date: string; items: Transaction[] }[] = [];
    for (const t of sortNewestFirst(filtered)) {
      const last = result[result.length - 1];
      if (last && last.date === t.date) last.items.push(t);
      else result.push({ date: t.date, items: [t] });
    }
    return result;
  }, [transactions, accountFilter]);

  const filterActive = accountFilter !== '' && accounts.some((a) => a.id === accountFilter);

  return (
    <div className="page">
      <PageHeader
        title="Buchungen"
        subtitle="Alles, was sich auf deinen Konten getan hat."
        actions={
          <Button variant="primary" icon={<ArrowLeftRight />} onClick={() => openDialog({ type: 'transfer' })}>
            Umbuchen
          </Button>
        }
      />

      <Card padded={false} className="tx-card">
        <div className="tx-card__toolbar">
          <Select
            aria-label="Nach Konto filtern"
            className="tx-card__filter"
            value={filterActive ? accountFilter : ''}
            onChange={(event) => setAccountFilter(event.target.value)}
          >
            <option value="">Alle Konten</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <span className="tx-card__count">
            {groups.reduce((n, g) => n + g.items.length, 0)} Buchungen
          </span>
        </div>

        {groups.length === 0 ? (
          <EmptyState icon={<History />} title={filterActive ? 'Keine Buchungen für dieses Konto' : 'Noch keine Buchungen'}>
            Startguthaben, Umbuchungen, Korrekturen und bezahlte Rechnungen erscheinen hier automatisch.
          </EmptyState>
        ) : (
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
                        <TransactionRow transaction={t} today={today} perspective={filterActive ? accountFilter : null} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.section>
              ))}
            </AnimatePresence>
          </div>
        )}
      </Card>
    </div>
  );
}
