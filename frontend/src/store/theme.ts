import { useEffect, useState } from 'react';
import type { ThemePreference } from '../domain/types';
import { getBackend } from './persistence';
import { useDataStore } from './dataStore';

export type ResolvedTheme = 'light' | 'dark';

const THEME_CACHE_KEY = 'budgeting.theme';
const query = () => window.matchMedia('(prefers-color-scheme: dark)');

function resolve(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemDark ? 'dark' : 'light';
  return preference;
}

/**
 * Applies the theme from the settings to the page (data-theme on <html>)
 * and to the native window title bar. Returns the resolved theme.
 */
export function useThemeSync(): ResolvedTheme {
  const preference = useDataStore((s) => s.data.settings.theme);
  const ready = useDataStore((s) => s.load.status === 'ready');
  const [systemDark, setSystemDark] = useState(() => query().matches);

  useEffect(() => {
    const mq = query();
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved = resolve(preference, systemDark);

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(THEME_CACHE_KEY, preference);
    } catch {
      // Storage may be unavailable; the theme still works for this session.
    }
    try {
      getBackend().setWindowTheme(preference);
    } catch {
      // Backend not ready.
    }
  }, [preference, ready]);

  return resolved;
}
