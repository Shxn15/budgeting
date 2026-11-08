/**
 * Loads the data document at startup and saves every change.
 *
 * Startup: load -> parse/migrate (backup first!) -> ready.
 * Saving: every change of `data` is written immediately; writes are
 * serialised so they never overlap and the newest state always wins.
 */
import type { AppData } from '../domain/types';
import { parseDocument } from '../persistence/document';
import { DataTooNewError, InvalidDataError } from '../persistence/migrations';
import { createEmptyData, serializeData } from '../persistence/schema';
import { detectBackend, type Backend } from '../platform/backend';
import { useDataStore, type DataState } from './dataStore';

let backend: Backend | null = null;
let started = false;
let unsubscribe: (() => void) | null = null;
let saving = false;
let pending: AppData | null = null;

export function getBackend(): Backend {
  if (!backend) throw new Error('Backend not initialised yet.');
  return backend;
}

function setSave(save: Partial<DataState['save']>) {
  useDataStore.setState((s) => ({ save: { ...s.save, ...save } }));
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function startApp(): Promise<void> {
  if (started) return; // React StrictMode runs effects twice in development
  started = true;
  try {
    backend = await detectBackend();
    const appInfo = await backend.getAppInfo();
    useDataStore.setState({ appInfo });

    const result = await backend.loadData();
    let data: AppData;
    if (!result.found) {
      data = createEmptyData(appInfo.version);
      await backend.saveData(serializeData(data));
    } else {
      let parsed;
      try {
        parsed = parseDocument(result.content, appInfo.version);
      } catch (error) {
        if (error instanceof DataTooNewError) {
          useDataStore.setState({ load: { status: 'tooNew', version: error.version, supported: error.supported } });
          return;
        }
        if (error instanceof InvalidDataError) {
          useDataStore.setState({ load: { status: 'corrupt', message: error.message } });
          return;
        }
        throw error;
      }
      data = parsed.data;
      if (parsed.migrated) {
        // Keep the old file before writing it in the new format.
        await backend.createBackup(`pre-migration-v${parsed.fromVersion}`);
        data = { ...data, meta: { ...data.meta, appVersion: appInfo.version } };
        await backend.saveData(serializeData(data));
      }
    }

    useDataStore.setState({ data, load: { status: 'ready' } });
    watchChanges();
  } catch (error) {
    useDataStore.setState({ load: { status: 'error', message: message(error) } });
  }
}

/** Corrupt file: move it aside (never delete it) and start with empty data. */
export async function startFresh(): Promise<string> {
  const b = getBackend();
  const movedTo = await b.quarantineData();
  const appInfo = useDataStore.getState().appInfo;
  const data = createEmptyData(appInfo?.version ?? 'dev');
  await b.saveData(serializeData(data));
  useDataStore.setState({ data, load: { status: 'ready' } });
  watchChanges();
  return movedTo;
}

function watchChanges() {
  unsubscribe?.();
  unsubscribe = useDataStore.subscribe((state, prev) => {
    if (state.data !== prev.data && state.load.status === 'ready') void queueSave(state.data);
  });
}

async function queueSave(data: AppData): Promise<void> {
  pending = data;
  if (saving) return;
  saving = true;
  setSave({ status: 'saving' });
  try {
    while (pending) {
      const next = pending;
      pending = null;
      try {
        await getBackend().saveData(serializeData(next));
        setSave({ status: 'saved', error: null, lastSavedAt: Date.now() });
      } catch (error) {
        setSave({ status: 'error', error: message(error) });
      }
    }
  } finally {
    saving = false;
  }
}

/** Writes the current state again (used by "Erneut versuchen"). */
export function retrySave(): Promise<void> {
  return queueSave(useDataStore.getState().data);
}
