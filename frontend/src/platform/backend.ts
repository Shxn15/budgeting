/**
 * Bridge to the Go backend (app.go).
 *
 * Inside the desktop app, Wails exposes every exported method of the Go `App`
 * struct as window.go.main.App.<Method>(). When the UI runs in a normal
 * browser (npm run dev), a localStorage-based stand-in is used instead, so
 * the UI can be developed and tested without building the app.
 */
import type { ThemePreference } from '../domain/types';

export interface AppInfo {
  name: string;
  version: string;
  dataDir: string;
  dataFile: string;
  backupDir: string;
  platform: string;
}

export interface LoadResult {
  found: boolean;
  content: string;
}

export interface Backend {
  readonly kind: 'desktop' | 'browser';
  getAppInfo(): Promise<AppInfo>;
  loadData(): Promise<LoadResult>;
  saveData(content: string): Promise<void>;
  createBackup(label: string): Promise<string>;
  quarantineData(): Promise<string>;
  openDataFolder(): Promise<void>;
  /** Colours the native title bar (Windows). */
  setWindowTheme(theme: ThemePreference): void;
}

/** Mirror of the Go methods in app.go – keep both in sync. */
interface GoApp {
  GetAppInfo(): Promise<AppInfo>;
  LoadData(): Promise<LoadResult>;
  SaveData(content: string): Promise<void>;
  CreateBackup(label: string): Promise<string>;
  QuarantineData(): Promise<string>;
  OpenDataFolder(): Promise<void>;
}

interface WailsRuntime {
  WindowSetDarkTheme?: () => void;
  WindowSetLightTheme?: () => void;
  WindowSetSystemDefaultTheme?: () => void;
}

declare global {
  interface Window {
    go?: { main?: { App?: GoApp } };
    runtime?: WailsRuntime;
  }
}

/** Go errors arrive as plain strings; turn everything into an Error. */
function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === 'string' ? error : JSON.stringify(error));
}

async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw toError(error);
  }
}

function desktopBackend(app: GoApp): Backend {
  return {
    kind: 'desktop',
    getAppInfo: () => call(() => app.GetAppInfo()),
    loadData: () => call(() => app.LoadData()),
    saveData: (content) => call(() => app.SaveData(content)),
    createBackup: (label) => call(() => app.CreateBackup(label)),
    quarantineData: () => call(() => app.QuarantineData()),
    openDataFolder: () => call(() => app.OpenDataFolder()),
    setWindowTheme(theme) {
      const rt = window.runtime;
      if (!rt) return;
      if (theme === 'dark') rt.WindowSetDarkTheme?.();
      else if (theme === 'light') rt.WindowSetLightTheme?.();
      else rt.WindowSetSystemDefaultTheme?.();
    },
  };
}

const DEV_KEY = 'budgeting.dev.data';
const DEV_BACKUP_PREFIX = 'budgeting.dev.backup.';

function browserBackend(): Backend {
  const store = window.localStorage;
  const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
  return {
    kind: 'browser',
    async getAppInfo() {
      return {
        name: 'Budgeting',
        version: 'dev',
        dataDir: 'Browser (localStorage)',
        dataFile: `localStorage["${DEV_KEY}"]`,
        backupDir: `localStorage["${DEV_BACKUP_PREFIX}*"]`,
        platform: 'browser',
      };
    },
    async loadData() {
      const content = store.getItem(DEV_KEY);
      return { found: content !== null, content: content ?? '' };
    },
    async saveData(content) {
      store.setItem(DEV_KEY, content);
    },
    async createBackup(label) {
      const content = store.getItem(DEV_KEY);
      if (content === null) return '';
      const key = `${DEV_BACKUP_PREFIX}${stamp()}-${label}`;
      store.setItem(key, content);
      return key;
    },
    async quarantineData() {
      const content = store.getItem(DEV_KEY);
      if (content === null) return '';
      const key = `budgeting.dev.corrupt.${stamp()}`;
      store.setItem(key, content);
      store.removeItem(DEV_KEY);
      return key;
    },
    async openDataFolder() {
      throw new Error('Im Browser-Modus gibt es keinen Datenordner.');
    },
    setWindowTheme() {},
  };
}

function looksLikeDesktop(): boolean {
  return window.location.hostname === 'wails.localhost' || window.location.protocol === 'wails:';
}

/**
 * Detects the backend. Wails injects its bindings before the app's scripts
 * run; the short wait is only a safety net.
 */
export async function detectBackend(): Promise<Backend> {
  const app = window.go?.main?.App;
  if (app) return desktopBackend(app);
  if (looksLikeDesktop()) {
    for (let waited = 0; waited < 3000; waited += 25) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      const late = window.go?.main?.App;
      if (late) return desktopBackend(late);
    }
    throw new Error('Die Verbindung zum Programm-Kern konnte nicht hergestellt werden.');
  }
  return browserBackend();
}
