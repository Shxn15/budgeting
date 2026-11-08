import { useEffect } from 'react';
import { Toaster } from '../components/ui/Toaster';
import { formatMoney } from '../domain/money';
import { runAutoPay } from '../store/actions';
import { useDataStore } from '../store/dataStore';
import { startApp } from '../store/persistence';
import { useSubscriptions, useToday } from '../store/selectors';
import { useThemeSync } from '../store/theme';
import { useUiStore } from '../store/uiStore';
import { AppShell } from './AppShell';
import { DialogHost } from './DialogHost';
import { StartupScreen } from './StartupScreen';

/**
 * Books due subscription charges with automatic payment: right after the
 * start (also charges missed while the app was closed), at midnight and
 * whenever a subscription changes.
 */
function useAutoPay(ready: boolean) {
  const today = useToday();
  const subscriptions = useSubscriptions();
  useEffect(() => {
    if (!ready) return;
    const booked = runAutoPay(today);
    if (booked.length === 0) return;
    const { data } = useDataStore.getState();
    const sum = formatMoney(
      booked.reduce((total, t) => total + t.amount, 0),
      data.settings.currency,
    );
    const first = booked[0]!;
    const account = data.accounts.find((a) => a.id === first.fromAccountId)?.name;
    useUiStore
      .getState()
      .notify(
        booked.length === 1
          ? `Abo „${first.note}“ automatisch abgebucht: ${sum}${account ? ` von „${account}“` : ''}.`
          : `${booked.length} Abo-Zahlungen automatisch abgebucht (zusammen ${sum}).`,
        'info',
      );
  }, [ready, today, subscriptions]);
}

export function App() {
  useThemeSync();
  const load = useDataStore((s) => s.load);
  useAutoPay(load.status === 'ready');

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
