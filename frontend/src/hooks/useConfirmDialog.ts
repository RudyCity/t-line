import { useState, useCallback } from 'react';

export interface ConfirmDialogState {
  show: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  isAlert?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function useConfirmDialog() {
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

  const showAlert = useCallback((title: string, message: string) => {
    setConfirmDialog({
      show: true,
      title,
      message,
      isAlert: true,
      onConfirm: () => setConfirmDialog(null)
    });
  }, []);

  const showConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    variant: 'primary' | 'secondary' | 'danger' = 'primary',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel'
  ) => {
    setConfirmDialog({
      show: true,
      title,
      message,
      confirmLabel,
      cancelLabel,
      variant,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null)
    });
  }, []);

  return {
    confirmDialog,
    setConfirmDialog,
    showAlert,
    showConfirm
  };
}
