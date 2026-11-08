import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo } from 'react';
import { dueState, openObligations } from '../../domain/obligations';
import { PAGES } from '../../app/pages';
import { useDataStore } from '../../store/dataStore';
import { retrySave } from '../../store/persistence';
import { useObligations, useSubscriptions, useToday } from '../../store/selectors';
import { useUiStore } from '../../store/uiStore';
import { cx } from '../ui/cx';
import { BrandMark } from './BrandMark';
import './Sidebar.css';

export function Sidebar() {
  const page = useUiStore((s) => s.page);
  const navigate = useUiStore((s) => s.navigate);
  const obligations = useObligations();
  const subscriptions = useSubscriptions();
  const today = useToday();
  const current = PAGES.find((p) => p.id === page);
  const activeId = current?.parent ?? page;

  const urgent = useMemo(
    () =>
      openObligations(obligations).filter((o) => {
        const state = dueState(o, today);
        return state === 'overdue' || state === 'today';
      }).length,
    [obligations, today],
  );
  // Manual subscriptions that are due today or overdue (automatic ones book themselves).
  const dueSubscriptions = subscriptions.filter((s) => !s.paused && !s.autoPay && s.nextDueDate <= today).length;

  const renderNav = (position: 'top' | 'bottom') =>
    PAGES.filter((p) => p.position === position).map((p) => {
      const Icon = p.icon;
      const active = p.id === activeId;
      const badge =
        p.id === 'obligations' && urgent > 0
          ? urgent
          : p.id === 'subscriptions' && dueSubscriptions > 0
            ? dueSubscriptions
            : null;
      return (
        <button
          key={p.id}
          type="button"
          className={cx('nav-item', active && 'is-active')}
          aria-current={p.id === page ? 'page' : undefined}
          onClick={() => navigate(p.id)}
        >
          {active && (
            <motion.span
              layoutId="nav-indicator"
              className="nav-item__indicator"
              transition={{ type: 'spring', stiffness: 500, damping: 38 }}
            />
          )}
          <Icon className="nav-item__icon" aria-hidden />
          <span className="nav-item__label">{p.label}</span>
          {badge !== null && (
            <span className="nav-item__badge" title={`${badge} heute fällig oder überfällig`}>
              {badge}
            </span>
          )}
        </button>
      );
    });

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <BrandMark size={34} />
        <div>
          <p className="sidebar__name">Budgeting</p>
          <p className="sidebar__tagline">Deine Finanzen</p>
        </div>
      </div>
      <nav className="sidebar__nav" aria-label="Hauptnavigation">
        {renderNav('top')}
      </nav>
      <div className="sidebar__spacer" />
      <nav className="sidebar__nav" aria-label="Weitere">
        {renderNav('bottom')}
      </nav>
      <SaveStatus />
    </aside>
  );
}

function SaveStatus() {
  const save = useDataStore((s) => s.save);
  const version = useDataStore((s) => s.appInfo?.version);

  if (save.status === 'error') {
    return (
      <div className="save-status save-status--error" role="alert">
        <CircleAlert aria-hidden />
        <div>
          <p>Speichern fehlgeschlagen</p>
          <button type="button" onClick={() => void retrySave()}>
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="save-status" title={save.error ?? undefined}>
      {save.status === 'saving' ? <LoaderCircle className="spin" aria-hidden /> : <CircleCheck aria-hidden />}
      <p>
        {save.status === 'saving' ? 'Speichert …' : 'Alles gespeichert'}
        {version && <span className="save-status__version"> · {/^\d/.test(version) ? `v${version}` : version}</span>}
      </p>
    </div>
  );
}
