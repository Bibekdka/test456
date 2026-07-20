/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const typeStyles = {
    danger: {
      buttonBg: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500',
      iconBg: 'bg-rose-100 text-rose-600',
    },
    warning: {
      buttonBg: 'bg-amber-500 hover:bg-amber-600 text-white focus:ring-amber-400',
      iconBg: 'bg-amber-100 text-amber-600',
    },
    info: {
      buttonBg: 'bg-slate-900 hover:bg-slate-800 text-white focus:ring-slate-900',
      iconBg: 'bg-slate-100 text-slate-600',
    }
  };

  const styles = typeStyles[type] || typeStyles.danger;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity" 
        onClick={onClose} 
      />

      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-xl bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
          
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className={`mx-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:mx-0 ${styles.iconBg}`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                <h3 className="text-base font-semibold leading-6 text-slate-950">
                  {title}
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-slate-500 whitespace-pre-line leading-relaxed">
                    {message}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 px-4 py-3.5 sm:flex sm:flex-row-reverse sm:px-6 gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`inline-flex w-full justify-center rounded-lg px-4 py-2 text-sm font-semibold shadow-xs sm:ml-0 sm:w-auto transition ${styles.buttonBg} cursor-pointer`}
            >
              {confirmText}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 inline-flex w-full justify-center rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs ring-1 ring-inset ring-slate-200 hover:bg-slate-50 sm:mt-0 sm:w-auto transition cursor-pointer"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
