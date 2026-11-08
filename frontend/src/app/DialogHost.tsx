import { AnimatePresence } from 'motion/react';
import { AccountDialog } from '../features/accounts/AccountDialog';
import { BalanceDialog } from '../features/accounts/BalanceDialog';
import { BookingDialog } from '../features/booking/BookingDialog';
import { ObligationDialog } from '../features/obligations/ObligationDialog';
import { PayDialog } from '../features/obligations/PayDialog';
import { PaySubscriptionDialog } from '../features/subscriptions/PaySubscriptionDialog';
import { SubscriptionDialog } from '../features/subscriptions/SubscriptionDialog';
import { TagDialog } from '../features/tags/TagDialog';
import { TransferDialog } from '../features/transfers/TransferDialog';
import { useUiStore, type DialogRequest } from '../store/uiStore';
import { ConfirmDialog } from './ConfirmDialog';

let dialogCounter = 0;
const dialogKeys = new WeakMap<DialogRequest, number>();

/** Every opened dialog gets its own key so a new one animates in while the old one leaves. */
function keyOf(dialog: DialogRequest): number {
  let key = dialogKeys.get(dialog);
  if (key === undefined) {
    key = ++dialogCounter;
    dialogKeys.set(dialog, key);
  }
  return key;
}

function renderDialog(dialog: DialogRequest, onClose: () => void) {
  switch (dialog.type) {
    case 'account':
      return <AccountDialog accountId={dialog.accountId} onClose={onClose} />;
    case 'balance':
      return <BalanceDialog accountId={dialog.accountId} onClose={onClose} />;
    case 'transfer':
      return <TransferDialog fromAccountId={dialog.fromAccountId} toAccountId={dialog.toAccountId} onClose={onClose} />;
    case 'obligation':
      return <ObligationDialog obligationId={dialog.obligationId} kind={dialog.kind} onClose={onClose} />;
    case 'pay':
      return <PayDialog obligationId={dialog.obligationId} onClose={onClose} />;
    case 'booking':
      return (
        <BookingDialog
          kind={dialog.kind}
          accountId={dialog.accountId}
          transactionId={dialog.transactionId}
          tagId={dialog.tagId}
          onClose={onClose}
        />
      );
    case 'subscription':
      return <SubscriptionDialog subscriptionId={dialog.subscriptionId} onClose={onClose} />;
    case 'paySubscription':
      return <PaySubscriptionDialog subscriptionId={dialog.subscriptionId} onClose={onClose} />;
    case 'tag':
      return <TagDialog tagId={dialog.tagId} onClose={onClose} />;
    case 'confirm':
      return <ConfirmDialog {...dialog} onClose={onClose} />;
  }
}

export function DialogHost() {
  const dialog = useUiStore((s) => s.dialog);
  const closeDialog = useUiStore((s) => s.closeDialog);
  return (
    <AnimatePresence>
      {dialog && <DialogSlot key={keyOf(dialog)} dialog={dialog} onClose={closeDialog} />}
    </AnimatePresence>
  );
}

function DialogSlot({ dialog, onClose }: { dialog: DialogRequest; onClose(): void }) {
  // Close only if this dialog is still the current one (another may have replaced it).
  const close = () => {
    if (useUiStore.getState().dialog === dialog) onClose();
  };
  return renderDialog(dialog, close);
}
