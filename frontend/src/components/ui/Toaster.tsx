import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useUiStore } from '../../store/uiStore';
import './Toaster.css';

const ICONS = { success: CircleCheck, info: Info, error: CircleAlert };

export function Toaster() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);
  return (
    <div className="toaster" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const Icon = ICONS[toast.tone];
          return (
            <motion.div
              key={toast.id}
              layout
              className={`toast toast--${toast.tone}`}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 500, damping: 36 }}
            >
              <Icon className="toast__icon" aria-hidden />
              <span className="toast__message">{toast.message}</span>
              <button type="button" className="toast__close" aria-label="Schließen" onClick={() => dismiss(toast.id)}>
                <X />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
