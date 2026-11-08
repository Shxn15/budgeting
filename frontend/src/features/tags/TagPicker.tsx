import { Check, Plus, Search, X } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { nextAccountColor } from '../../domain/colors';
import type { Tag } from '../../domain/types';
import { Avatar } from '../../components/avatar/Avatar';
import { AvatarPicker } from '../../components/avatar/AvatarPicker';
import { Button } from '../../components/ui/Button';
import { ColorSwatches } from '../../components/ui/ColorSwatches';
import { cx } from '../../components/ui/cx';
import { errorMessage } from '../../components/ui/errorMessage';
import { TextInput } from '../../components/ui/Field';
import { addTag } from '../../store/actions';
import { useTagMap, useTags, useTagUsage } from '../../store/selectors';
import './TagPicker.css';

interface TagPickerProps {
  value: string | null;
  onChange(tagId: string | null): void;
  /** id of the search field (for <label htmlFor>). */
  id?: string;
  placeholder?: string;
  /** Number of frequently used tags offered as one-click chips. */
  suggestions?: number;
}

type Option = { type: 'tag'; tag: Tag } | { type: 'create'; name: string };

const lower = (text: string) => text.trim().toLocaleLowerCase('de');

/**
 * Choose a tag (with picture) – search, pick a frequently used one, or
 * create a new one right here, including its profile picture.
 */
export function TagPicker({ value, onChange, id, placeholder = 'Tag suchen oder neu erstellen …', suggestions = 6 }: TagPickerProps) {
  const tags = useTags();
  const tagMap = useTagMap();
  const usage = useTagUsage();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = value ? (tagMap.get(value) ?? null) : null;

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [changing, setChanging] = useState(false);
  const [creating, setCreating] = useState<{ name: string; color: string; image: string | null } | null>(null);

  // Focus the search right away when changing the tag (before the next key press arrives).
  useLayoutEffect(() => {
    if (changing) inputRef.current?.focus({ preventScroll: true });
  }, [changing]);

  // The chosen tag was deleted meanwhile: forget it.
  useEffect(() => {
    if (value !== null && !tagMap.has(value)) onChange(null);
  }, [value, tagMap, onChange]);

  const sorted = useMemo(
    () =>
      [...tags].sort(
        (a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0) || a.name.localeCompare(b.name, 'de'),
      ),
    [tags, usage],
  );

  const q = lower(query);
  const options: Option[] = useMemo(() => {
    const matches = q
      ? sorted
          .filter((t) => lower(t.name).includes(q))
          .sort((a, b) => Number(!lower(a.name).startsWith(q)) - Number(!lower(b.name).startsWith(q)))
      : sorted;
    const exact = tags.some((t) => lower(t.name) === q);
    const list: Option[] = matches.map((tag) => ({ type: 'tag', tag }));
    if (!exact) list.push({ type: 'create', name: query.trim() });
    return list;
  }, [q, query, sorted, tags]);

  const startCreate = (name: string) => {
    setCreating({ name, color: nextAccountColor(tags), image: null });
    setOpen(false);
  };

  const choose = (option: Option) => {
    if (option.type === 'create') {
      startCreate(option.name);
      return;
    }
    onChange(option.tag.id);
    setQuery('');
    setOpen(false);
    setChanging(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(0);
        return;
      }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + options.length) % options.length);
    } else if (event.key === 'Enter') {
      if (open && options[active]) {
        event.preventDefault(); // do not submit the dialog
        choose(options[active]!);
      }
    } else if (event.key === 'Escape') {
      if (open || changing) {
        event.stopPropagation(); // close the list, not the dialog
        setOpen(false);
        if (!open) setChanging(false);
      }
    }
  };

  if (creating) {
    return (
      <CreateTag
        draft={creating}
        onDraftChange={setCreating}
        onCancel={() => {
          setCreating(null);
          requestAnimationFrame(() => inputRef.current?.focus());
        }}
        onCreated={(tagId) => {
          onChange(tagId);
          setCreating(null);
          setQuery('');
          setChanging(false);
        }}
      />
    );
  }

  if (selected && !changing) {
    return (
      <div className="tag-picker">
        <div className="tag-selected">
          <button
            type="button"
            className="tag-selected__main"
            onClick={() => {
              setChanging(true);
              setOpen(true);
              setActive(0);
            }}
            title="Anderen Tag wählen"
          >
            <Avatar name={selected.name} image={selected.image} color={selected.color} size={30} />
            <span className="tag-selected__name">{selected.name}</span>
            <span className="tag-selected__change">ändern</span>
          </button>
          <button type="button" className="tag-selected__clear" aria-label="Tag entfernen" title="Tag entfernen" onClick={() => onChange(null)}>
            <X />
          </button>
        </div>
      </div>
    );
  }

  const quick = sorted.slice(0, suggestions);

  return (
    <div className="tag-picker">
      <TextInput
        ref={inputRef}
        id={id}
        value={query}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        maxLength={40}
        placeholder={placeholder}
        leading={<Search className="tag-picker__search" aria-hidden />}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => {
          if (changing) setOpen(true);
        }}
        onClick={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          if (selected) setChanging(false);
        }}
        onKeyDown={onKeyDown}
      />

      {open ? (
        <ul className="tag-list" id={listId} role="listbox" aria-label="Tags">
          {options.map((option, index) => (
            <li
              key={option.type === 'tag' ? option.tag.id : '__create__'}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={cx('tag-list__option', index === active && 'is-active', option.type === 'create' && 'tag-list__option--create')}
              // Keep the focus in the search field while clicking.
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(option)}
            >
              {option.type === 'tag' ? (
                <>
                  <Avatar name={option.tag.name} image={option.tag.image} color={option.tag.color} size={28} />
                  <span className="tag-list__name">{option.tag.name}</span>
                  {option.tag.id === value ? (
                    <Check className="tag-list__check" aria-label="ausgewählt" />
                  ) : (
                    (usage.get(option.tag.id) ?? 0) > 0 && <span className="tag-list__count">{usage.get(option.tag.id)}×</span>
                  )}
                </>
              ) : (
                <>
                  <span className="tag-list__plus">
                    <Plus aria-hidden />
                  </span>
                  <span className="tag-list__name">
                    {option.name ? (
                      <>
                        „<strong>{option.name}</strong>“ als neuen Tag erstellen
                      </>
                    ) : (
                      'Neuen Tag erstellen'
                    )}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="chips tag-picker__quick">
          {quick.map((tag) => (
            <button key={tag.id} type="button" className="chip tag-chip" onClick={() => choose({ type: 'tag', tag })}>
              <Avatar name={tag.name} image={tag.image} color={tag.color} size={20} />
              {tag.name}
            </button>
          ))}
          <button type="button" className="chip tag-chip tag-chip--new" onClick={() => startCreate(query.trim())}>
            <Plus aria-hidden />
            Neuer Tag
          </button>
        </div>
      )}
    </div>
  );
}

interface CreateTagProps {
  draft: { name: string; color: string; image: string | null };
  onDraftChange(draft: { name: string; color: string; image: string | null }): void;
  onCancel(): void;
  onCreated(tagId: string): void;
}

function CreateTag({ draft, onDraftChange, onCancel, onCreated }: CreateTagProps) {
  const [error, setError] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);
  const nameId = useId();

  const create = () => {
    if (!draft.name.trim()) {
      setError('Bitte gib dem Tag einen Namen.');
      return;
    }
    try {
      onCreated(addTag({ name: draft.name, color: draft.color, image: draft.image }));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div
      className={cx('tag-create', cropping && 'is-cropping')}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !cropping) {
          event.stopPropagation(); // cancel creating, keep the dialog open
          onCancel();
        }
      }}
    >
      <AvatarPicker
        compact={!cropping}
        size={56}
        name={draft.name}
        color={draft.color}
        image={draft.image}
        onChange={(image) => onDraftChange({ ...draft, image })}
        onCroppingChange={setCropping}
      />
      <div className="tag-create__fields">
        <label className="tag-create__label" htmlFor={nameId}>
          Neuer Tag
        </label>
        <TextInput
          id={nameId}
          value={draft.name}
          maxLength={40}
          autoFocus
          autoComplete="off"
          placeholder="z. B. Rewe, PayPal, MediaMarkt"
          invalid={Boolean(error)}
          onChange={(event) => {
            onDraftChange({ ...draft, name: event.target.value });
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault(); // create the tag, do not submit the dialog
              create();
            }
          }}
        />
        {!draft.image && (
          <div className="tag-create__colors">
            <ColorSwatches value={draft.color} onChange={(color) => onDraftChange({ ...draft, color })} size="sm" />
          </div>
        )}
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
        <div className="tag-create__actions">
          <Button size="sm" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button size="sm" variant="primary" icon={<Check />} onClick={create}>
            Tag erstellen
          </Button>
        </div>
      </div>
    </div>
  );
}
