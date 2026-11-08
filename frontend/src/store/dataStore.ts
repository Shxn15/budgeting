import { create } from 'zustand';
import type { AppData } from '../domain/types';
import { createEmptyData } from '../persistence/schema';
import type { AppInfo } from '../platform/backend';

export type LoadState =
  | { status: 'loading' }
  | { status: 'ready' }
  /** data.json exists but cannot be read. */
  | { status: 'corrupt'; message: string }
  /** data.json was written by a newer version of the app. */
  | { status: 'tooNew'; version: number; supported: number }
  /** The backend failed (e.g. no permission to write the data folder). */
  | { status: 'error'; message: string };

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface DataState {
  load: LoadState;
  data: AppData;
  appInfo: AppInfo | null;
  save: { status: SaveStatus; error: string | null; lastSavedAt: number | null };
}

/**
 * Holds the data document. Change it only through the functions in
 * actions.ts; persistence.ts saves every change automatically.
 */
export const useDataStore = create<DataState>()(() => ({
  load: { status: 'loading' },
  data: createEmptyData('dev'),
  appInfo: null,
  save: { status: 'idle', error: null, lastSavedAt: null },
}));
