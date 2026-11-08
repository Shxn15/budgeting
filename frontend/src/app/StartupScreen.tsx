import { CircleAlert, DatabaseBackup, FolderOpen, RefreshCw } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { BrandMark } from '../components/layout/BrandMark';
import { Button } from '../components/ui/Button';
import type { LoadState } from '../store/dataStore';
import { getBackend, startFresh } from '../store/persistence';
import '../components/ui/Form.css';
import './StartupScreen.css';

/** Shown while loading and whenever the data cannot be opened safely. */
export function StartupScreen({ load }: { load: LoadState }) {
  if (load.status === 'loading') {
    return (
      <div className="startup">
        <div className="startup__loading">
          <BrandMark size={56} />
        </div>
      </div>
    );
  }

  if (load.status === 'tooNew') {
    return (
      <Problem
        title="Bitte nutze die neueste Version"
        text={`Deine Daten wurden mit einer neueren Version von Budgeting gespeichert (Datenformat v${load.version}). Diese Version kennt nur bis v${load.supported}. Damit nichts kaputtgeht, wird hier nichts verändert – öffne einfach wieder die neueste Version.`}
      />
    );
  }

  if (load.status === 'corrupt') {
    return <CorruptProblem />;
  }

  if (load.status === 'error') {
    return (
      <Problem
        title="Budgeting konnte nicht starten"
        text={`Die Daten konnten nicht geladen werden: ${load.message}`}
        actions={
          <Button variant="primary" icon={<RefreshCw />} onClick={() => window.location.reload()}>
            Erneut versuchen
          </Button>
        }
      />
    );
  }

  return null;
}

function CorruptProblem() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Problem
      title="Die Datendatei ist beschädigt"
      text="Die gespeicherte Datei konnte nicht gelesen werden. Du kannst eine Sicherung aus dem Ordner „backups“ zurückkopieren oder mit leeren Daten neu beginnen – die beschädigte Datei wird dabei nicht gelöscht, sondern umbenannt."
      error={error}
      actions={
        <>
          <Button icon={<FolderOpen />} onClick={() => void getBackend().openDataFolder().catch((e: Error) => setError(e.message))}>
            Datenordner öffnen
          </Button>
          <Button
            variant="primary"
            icon={<DatabaseBackup />}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await startFresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
                setBusy(false);
              }
            }}
          >
            Neu beginnen
          </Button>
        </>
      }
    />
  );
}

function Problem({ title, text, actions, error }: { title: string; text: string; actions?: ReactNode; error?: string | null }) {
  return (
    <div className="startup">
      <div className="startup__card">
        <span className="startup__icon">
          <CircleAlert />
        </span>
        <h1 className="startup__title">{title}</h1>
        <p className="startup__text">{text}</p>
        {error && <p className="form-error">{error}</p>}
        {actions && <div className="startup__actions">{actions}</div>}
      </div>
    </div>
  );
}
