import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { useUiStore } from '../store/uiStore';
import { PAGES } from './pages';
import './AppShell.css';

export function AppShell() {
  const page = useUiStore((s) => s.page);
  const accountId = useUiStore((s) => s.accountId);
  const mainRef = useRef<HTMLElement>(null);
  const Page = (PAGES.find((p) => p.id === page) ?? PAGES[0]!).component;
  const pageKey = page === 'account' ? `account:${accountId}` : page;

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pageKey]);

  return (
    <div className="shell">
      <Sidebar />
      <main className="shell__main" ref={mainRef}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pageKey}
            className="shell__page"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          >
            <Page />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
