import { Check, DatabaseBackup, FolderOpen, Monitor, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useState, type CSSProperties, type KeyboardEvent } from 'react';
import { COLOR_THEMES } from '../../domain/themes';
import type { ThemePreference } from '../../domain/types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { cx } from '../../components/ui/cx';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { CURRENT_SCHEMA_VERSION } from '../../persistence/schema';
import { updateSettings } from '../../store/actions';
import { useDataStore } from '../../store/dataStore';
import { getBackend } from '../../store/persistence';
import { useSettings } from '../../store/selectors';
import { useResolvedTheme } from '../../store/theme';
import { useUiStore } from '../../store/uiStore';
import './SettingsPage.css';

export function SettingsPage() {
  const settings = useSettings();
  const appInfo = useDataStore((s) => s.appInfo);
  // Select primitives: a selector returning a new object would re-render forever.
  const accountCount = useDataStore((s) => s.data.accounts.length);
  const transactionCount = useDataStore((s) => s.data.transactions.length);
  const obligationCount = useDataStore((s) => s.data.obligations.length);
  const subscriptionCount = useDataStore((s) => s.data.subscriptions.length);
  const tagCount = useDataStore((s) => s.data.tags.length);
  const receivableCount = useDataStore((s) => s.data.receivables.length);
  const goalCount = useDataStore((s) => s.data.savingsGoals.length);
  const notify = useUiStore((s) => s.notify);
  const [busy, setBusy] = useState(false);
  const isDesktop = appInfo?.platform !== 'browser';

  const backupNow = async () => {
    setBusy(true);
    try {
      const path = await getBackend().createBackup('manual');
      notify(path ? 'Sicherung erstellt.' : 'Noch keine Daten zum Sichern.', path ? 'success' : 'info');
    } catch (error) {
      notify(`Sicherung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  const openFolder = async () => {
    try {
      await getBackend().openDataFolder();
    } catch (error) {
      notify(error instanceof Error ? error.message : String(error), 'error');
    }
  };

  return (
    <div className="page page--narrow">
      <PageHeader title="Einstellungen" />

      <Card title="Darstellung">
        <div className="setting setting--stacked">
          <div className="setting__text">
            <p className="setting__title">Farbthema</p>
            <p className="setting__hint">Bringt Farbe in die App – jedes Thema gibt es hell und dunkel.</p>
          </div>
          <ThemePicker value={settings.colorTheme} onChange={(colorTheme) => updateSettings({ colorTheme })} />
        </div>

        <div className="setting">
          <div className="setting__text">
            <p className="setting__title">Hell oder dunkel</p>
            <p className="setting__hint">Hell, dunkel oder automatisch wie bei Windows.</p>
          </div>
          <SegmentedControl<ThemePreference>
            label="Farbschema"
            value={settings.theme}
            onChange={(theme) => updateSettings({ theme })}
            options={[
              { value: 'system', label: 'System', icon: <Monitor /> },
              { value: 'light', label: 'Hell', icon: <Sun /> },
              { value: 'dark', label: 'Dunkel', icon: <Moon /> },
            ]}
          />
        </div>
      </Card>

      <Card title="Deine Daten">
        <div className="data-safety">
          <ShieldCheck aria-hidden />
          <p>
            Alles wird nur lokal auf diesem PC gespeichert – nach jeder Änderung automatisch. Neue Versionen der App
            übernehmen deine Daten; vor jeder Umstellung des Datenformats wird vorher eine Sicherung angelegt.
          </p>
        </div>

        <div className="setting">
          <div className="setting__text">
            <p className="setting__title">Speicherort</p>
            <p className="setting__path selectable">{appInfo?.dataFile ?? '–'}</p>
          </div>
          <Button icon={<FolderOpen />} onClick={openFolder} disabled={!isDesktop}>
            Ordner öffnen
          </Button>
        </div>

        <div className="setting">
          <div className="setting__text">
            <p className="setting__title">Sicherungen</p>
            <p className="setting__hint">
              Jeden Tag wird beim Start automatisch eine Sicherung angelegt; die letzten 30 bleiben erhalten.
            </p>
          </div>
          <Button icon={<DatabaseBackup />} onClick={backupNow} disabled={busy}>
            Jetzt sichern
          </Button>
        </div>
      </Card>

      <Card title="Über Budgeting">
        <dl className="about">
          <div>
            <dt>Version</dt>
            <dd>{appInfo?.version ?? '–'}</dd>
          </div>
          <div>
            <dt>Datenformat</dt>
            <dd>v{CURRENT_SCHEMA_VERSION}</dd>
          </div>
          <div>
            <dt>Konten</dt>
            <dd>{accountCount}</dd>
          </div>
          <div>
            <dt>Buchungen</dt>
            <dd>{transactionCount}</dd>
          </div>
          <div>
            <dt>Zahlungen &amp; Schulden</dt>
            <dd>{obligationCount}</dd>
          </div>
          <div>
            <dt>Abos</dt>
            <dd>{subscriptionCount}</dd>
          </div>
          <div>
            <dt>Tags</dt>
            <dd>{tagCount}</dd>
          </div>
          <div>
            <dt>Bekomme ich noch</dt>
            <dd>{receivableCount}</dd>
          </div>
          <div>
            <dt>Sparziele</dt>
            <dd>{goalCount}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}

/** Colour themes as small previews (sidebar, card, accent) in the current light/dark mode. */
function ThemePicker({ value, onChange }: { value: string; onChange(key: string): void }) {
  const resolved = useResolvedTheme();

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = COLOR_THEMES.findIndex((t) => t.key === value);
    const next = COLOR_THEMES[(index + step + COLOR_THEMES.length) % COLOR_THEMES.length]!;
    onChange(next.key);
    const buttons = event.currentTarget.parentElement?.querySelectorAll('button');
    buttons?.[COLOR_THEMES.indexOf(next)]?.focus();
  };

  return (
    <div className="theme-grid" role="radiogroup" aria-label="Farbthema">
      {COLOR_THEMES.map((theme) => {
        const active = theme.key === value || (!COLOR_THEMES.some((t) => t.key === value) && theme.key === 'standard');
        const [bg, surface, accent] = theme.preview[resolved];
        return (
          <button
            key={theme.key}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            className={cx('theme-option', active && 'is-active')}
            style={{ '--preview-bg': bg, '--preview-surface': surface, '--preview-accent': accent } as CSSProperties}
            onClick={() => onChange(theme.key)}
            onKeyDown={onKeyDown}
          >
            <span className="theme-option__preview" aria-hidden>
              <span className="theme-option__sidebar">
                <span />
                <span />
                <span />
              </span>
              <span className="theme-option__card">
                <span className="theme-option__line" />
                <span className="theme-option__line theme-option__line--short" />
                <span className="theme-option__pill" />
              </span>
            </span>
            <span className="theme-option__text">
              <span className="theme-option__label">{theme.label}</span>
              <span className="theme-option__desc">{theme.description}</span>
            </span>
            {active && (
              <span className="theme-option__check" aria-hidden>
                <Check />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
