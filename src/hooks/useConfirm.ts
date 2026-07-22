import { useState, useCallback } from 'react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  onConfirm: () => void | Promise<void>;
}

export function useConfirm() {
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { isOpen: boolean }) | null>(null);

  const askConfirm = useCallback((options: ConfirmOptions) => {
    setConfirmState({
      ...options,
      isOpen: true
    });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState(prev => prev ? { ...prev, isOpen: false } : null);
  }, []);

  return {
    confirmState,
    askConfirm,
    closeConfirm
  };
}
