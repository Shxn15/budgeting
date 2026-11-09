import { Pencil, Plus, Search, Tags as TagsIcon, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { formatMonthName, monthKey } from '../../domain/dates';
import { formatMoney } from '../../domain/money';
import { lastMonths, summarizeSpending } from '../../domain/spending';
import type { Tag } from '../../domain/types';
import { Avatar } from '../../components/avatar/Avatar';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, IconButton } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { TextInput } from '../../components/ui/Field';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { useCurrency, useTags, useTagUsage, useToday, useTransactions } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { confirmDeleteTag } from './confirmDeleteTag';
import './TagsPage.css';

type Sort = 'usage' | 'name';

const lower = (text: string) => text.trim().toLocaleLowerCase('de');

/** All tags in one place: rename them, give them a picture or delete them. */
export function TagsPage() {
  const tags = useTags();
  const usage = useTagUsage();
  const transactions = useTransactions();
  const currency = useCurrency();
  const today = useToday();
  const openDialog = useUiStore((s) => s.openDialog);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('usage');
  const month = monthKey(today);

  const spentThisMonth = useMemo(() => {
    const summary = summarizeSpending(transactions, lastMonths(month, 1));
    return new Map(summary.groups.map((g) => [g.key, g.total]));
  }, [transactions, month]);

  const q = lower(query);
  const list = useMemo(() => {
    const filtered = q ? tags.filter((t) => lower(t.name).includes(q)) : tags;
    return [...filtered].sort((a, b) =>
      sort === 'usage'
        ? (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'de')
        : a.name.localeCompare(b.name, 'de'),
    );
  }, [tags, q, sort, usage]);

  const edit = (tag: Tag) => openDialog({ type: 'tag', tagId: tag.id });

  return (
    <div className="page">
      <PageHeader
        title="Tags"
        subtitle="Geschäfte, Dienste und Personen, mit denen du Buchungen markierst – umbenennen, Bild ändern oder löschen."
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => openDialog({ type: 'tag' })}>
            Neuer Tag
          </Button>
        }
      />

      {tags.length === 0 ? (
        <Card>
          <EmptyState
            icon={<TagsIcon />}
            title="Noch keine Tags"
            action={
              <Button variant="primary" icon={<Plus />} onClick={() => openDialog({ type: 'tag' })}>
                Ersten Tag erstellen
              </Button>
            }
          >
            Mit Tags wie „Rewe“, „PayPal“ oder „Max“ siehst du unter „Ausgaben“, wofür dein Geld draufgeht. Du kannst sie
            auch direkt beim Eintragen einer Zahlung anlegen.
          </EmptyState>
        </Card>
      ) : (
        <Card padded={false}>
          <div className="tags-toolbar">
            <TextInput
              className="tags-toolbar__search"
              value={query}
              placeholder="Tag suchen …"
              aria-label="Tag suchen"
              leading={<Search className="tags-toolbar__icon" aria-hidden />}
              onChange={(event) => setQuery(event.target.value)}
            />
            <SegmentedControl<Sort>
              label="Sortieren"
              size="sm"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'usage', label: 'Häufig genutzt' },
                { value: 'name', label: 'A–Z' },
              ]}
            />
            <span className="tags-toolbar__count">{tags.length === 1 ? '1 Tag' : `${tags.length} Tags`}</span>
          </div>

          {list.length === 0 ? (
            <EmptyState
              compact
              icon={<Search />}
              title="Kein Tag gefunden"
              action={
                <Button size="sm" icon={<Plus />} onClick={() => openDialog({ type: 'tag' })}>
                  Neuen Tag erstellen
                </Button>
              }
            >
              Zu „{query.trim()}“ gibt es noch keinen Tag.
            </EmptyState>
          ) : (
            <ul className="tags-grid" aria-label="Tags">
              <AnimatePresence initial={false} mode="popLayout">
                {list.map((tag) => {
                  const used = usage.get(tag.id) ?? 0;
                  const spent = spentThisMonth.get(tag.id) ?? 0;
                  return (
                    <motion.li
                      key={tag.id}
                      layout
                      className="tag-tile"
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    >
                      <button type="button" className="tag-tile__main" onClick={() => edit(tag)} title="Bearbeiten">
                        <Avatar name={tag.name} image={tag.image} color={tag.color} size={44} />
                        <span className="tag-tile__text">
                          <span className="tag-tile__name">{tag.name}</span>
                          <span className="tag-tile__meta">
                            {used === 0 ? 'noch nicht benutzt' : used === 1 ? '1× benutzt' : `${used}× benutzt`}
                          </span>
                          {spent > 0 && (
                            <span className="tag-tile__meta">
                              {formatMoney(spent, currency)} im {formatMonthName(month)}
                            </span>
                          )}
                        </span>
                      </button>
                      <span className="tag-tile__tools">
                        <IconButton label={`${tag.name} bearbeiten`} icon={<Pencil />} size="sm" onClick={() => edit(tag)} />
                        <IconButton label={`${tag.name} löschen`} icon={<Trash2 />} size="sm" onClick={() => confirmDeleteTag(tag)} />
                      </span>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
