import { useEffect, useState } from 'react';
import type { ThemePreference } from '../domain/types';
import { getBackend } from './persistence';
import { useDataStore } from './dataStore';

export type ResolvedTheme = 'light' | 'dark';

const THEME_CACHE_KEY = 'budgeting.theme';
const PALETTE_CACHE_KEY = 'budgeting.palette';
const query = () => window.matchMedia('(prefers-color-scheme: dark)');

function resolve(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemDark ? 'dark' : 'light';
  return preference;
}

/** Whether Windows (or the browser) is in dark mode; follows changes. */
function useSystemDark(): boolean {
  const [systemDark, setSystemDark] = useState(() => query().matches);
  useEffect(() => {
    const mq = query();
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return systemDark;
}

/** Light or dark – as the app is shown right now. */
export function useResolvedTheme(): ResolvedTheme {
  const preference = useDataStore((s) => s.data.settings.theme);
  return resolve(preference, useSystemDark());
}

/**
 * Applies the theme from the settings to the page (data-theme and
 * data-palette on <html>) and to the native window title bar. Returns the
 * resolved light/dark theme.
 */
export function useThemeSync(): ResolvedTheme {
  const preference = useDataStore((s) => s.data.settings.theme);
  const palette = useDataStore((s) => s.data.settings.colorTheme);
  const ready = useDataStore((s) => s.load.status === 'ready');
  const resolved = resolve(preference, useSystemDark());

  useEffect(() => {
    // Until the data is loaded, keep the theme index.html picked from the
    // cached setting – otherwise a user who chose a theme different from
    // Windows would see a short flash of the wrong one at startup.
    if (!ready) return;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.palette = palette;
  }, [resolved, palette, ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(THEME_CACHE_KEY, preference);
      window.localStorage.setItem(PALETTE_CACHE_KEY, palette);
    } catch {
      // Storage may be unavailable; the theme still works for this session.
    }
    try {
      getBackend().setWindowTheme(preference);
    } catch {
      // Backend not ready.
    }
  }, [preference, palette, ready]);

  return resolved;
}
