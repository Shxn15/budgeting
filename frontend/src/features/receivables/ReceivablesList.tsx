import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import type { ISODate, Receivable } from '../../domain/types';
import { ReceivableRow } from './ReceivableRow';
import './ReceivablesList.css';

interface ReceivablesListProps {
  list: readonly Receivable[];
  today: ISODate;
  compact?: boolean;
  /** Rows shown before "+ n weitere". */
  limit?: number;
}

export function ReceivablesList({ list, today, compact, limit = list.length }: ReceivablesListProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? list : list.slice(0, limit);
  return (
    <div className="rc-list">
      <AnimatePresence initial={false} mode="popLayout">
        {shown.map((r) => (
          <motion.div
            key={r.id}
            layout
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
          >
            <ReceivableRow receivable={r} today={today} compact={compact} />
          </motion.div>
        ))}
      </AnimatePresence>
      {list.length > shown.length && (
        <button type="button" className="rc-list__more" onClick={() => setExpanded(true)}>
          + {list.length - shown.length} weitere
        </button>
      )}
    </div>
  );
}
