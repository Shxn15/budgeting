import { useEffect } from 'react';
import { Toaster } from '../components/ui/Toaster';
import { useDataStore } from '../store/dataStore';
import { startApp } from '../store/persistence';
import { useThemeSync } from '../store/theme';
import { AppShell } from './AppShell';
import { DialogHost } from './DialogHost';
import { StartupScreen } from './StartupScreen';

export function App() {
  useThemeSync();
  const load = useDataStore((s) => s.load);

  useEffect(() => {
    void startApp();
  }, []);

  if (load.status !== 'ready') return <StartupScreen load={load} />;

  return (
    <>
      <AppShell />
      <DialogHost />
      <Toaster />
    </>
  );
}
