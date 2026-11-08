import { DatabaseBackup, FolderOpen, Monitor, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useState } from 'react';
import type { ThemePreference } from '../../domain/types';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { CURRENT_SCHEMA_VERSION } from '../../persistence/schema';
import { updateSettings } from '../../store/actions';
import { useDataStore } from '../../store/dataStore';
import { getBackend } from '../../store/persistence';
import { useSettings } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import './SettingsPage.css';

export function SettingsPage() {
  const settings = useSettings();
  const appInfo = useDataStore((s) => s.appInfo);
  // Select primitives: a selector returning a new object would re-render forever.
  const accountCount = useDataStore((s) => s.data.accounts.length);
  const transactionCount = useDataStore((s) => s.data.transactions.length);
  const obligationCount = useDataStore((s) => s.data.obligations.length);
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
        <div className="setting">
          <div className="setting__text">
            <p className="setting__title">Farbschema</p>
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
        </dl>
      </Card>
    </div>
  );
}
