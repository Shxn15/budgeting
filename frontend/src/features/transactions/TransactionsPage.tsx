import { ArrowLeftRight, History, Minus, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Select } from '../../components/ui/Field';
import { NO_TAG } from '../../domain/spending';
import { useAccounts, useTags, useToday, useTransactions } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { TransactionGroups } from './TransactionGroups';
import './TransactionsPage.css';

export function TransactionsPage() {
  const transactions = useTransactions();
  const accounts = useAccounts();
  const tags = useTags();
  const today = useToday();
  const openDialog = useUiStore((s) => s.openDialog);
  const [accountFilter, setAccountFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');

  const filterActive = accountFilter !== '' && accounts.some((a) => a.id === accountFilter);
  const tagActive = tagFilter === NO_TAG || tags.some((t) => t.id === tagFilter);

  const filtered = useMemo(
    () =>
      transactions.filter(
        (t) =>
          (!filterActive || t.fromAccountId === accountFilter || t.toAccountId === accountFilter) &&
          (!tagActive || (tagFilter === NO_TAG ? t.tagId === null : t.tagId === tagFilter)),
      ),
    [transactions, accountFilter, filterActive, tagFilter, tagActive],
  );

  return (
    <div className="page">
      <PageHeader
        title="Buchungen"
        subtitle="Alles, was sich auf deinen Konten getan hat."
        actions={
          <>
            <Button icon={<ArrowLeftRight />} onClick={() => openDialog({ type: 'transfer' })}>
              Umbuchen
            </Button>
            <Button
              icon={<Plus />}
              onClick={() => openDialog({ type: 'booking', kind: 'income', accountId: filterActive ? accountFilter : undefined })}
            >
              Einnahme
            </Button>
            <Button
              variant="primary"
              icon={<Minus />}
              onClick={() =>
                openDialog({
                  type: 'booking',
                  kind: 'expense',
                  accountId: filterActive ? accountFilter : undefined,
                  tagId: tagActive && tagFilter !== NO_TAG ? tagFilter : undefined,
                })
              }
            >
              Zahlung eintragen
            </Button>
          </>
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
          {tags.length > 0 && (
            <Select
              aria-label="Nach Tag filtern"
              className="tx-card__filter"
              value={tagActive ? tagFilter : ''}
              onChange={(event) => setTagFilter(event.target.value)}
            >
              <option value="">Alle Tags</option>
              {[...tags]
                .sort((a, b) => a.name.localeCompare(b.name, 'de'))
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              <option value={NO_TAG}>Ohne Tag</option>
            </Select>
          )}
          <span className="tx-card__spacer" />
          <span className="tx-card__count">
            {filtered.length === 1 ? '1 Buchung' : `${filtered.length} Buchungen`}
          </span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<History />}
            title={filterActive || tagActive ? 'Keine passenden Buchungen' : 'Noch keine Buchungen'}
          >
            Zahlungen, Einnahmen, Abos, Umbuchungen und Korrekturen erscheinen hier automatisch.
          </EmptyState>
        ) : (
          <TransactionGroups
            key={`${accountFilter}|${tagFilter}`}
            transactions={filtered}
            today={today}
            perspective={filterActive ? accountFilter : null}
          />
        )}
      </Card>
    </div>
  );
}
