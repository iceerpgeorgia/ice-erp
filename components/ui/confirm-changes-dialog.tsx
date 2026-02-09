'use client';

import React from 'react';
import { Button } from './button';

export type ConfirmChange = {
  label: string;
  from: React.ReactNode;
  to: React.ReactNode;
  layout?: 'inline' | 'stacked';
};

type ConfirmChangesDialogProps = {
  open: boolean;
  title?: string;
  subtitle?: string;
  changes: ConfirmChange[];
  confirmLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
  isConfirming?: boolean;
};

export function ConfirmChangesDialog({
  open,
  title = 'Confirm Changes',
  subtitle = 'You are about to update the following fields:',
  changes,
  confirmLabel = 'Confirm & Save',
  cancelLabel = 'Cancel',
  onCancel,
  onConfirm,
  isConfirming = false,
}: ConfirmChangesDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4 rounded-t-lg">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">⚠️</span>
            {title}
          </h2>
        </div>

        <div className="p-6">
          <p className="text-gray-700 mb-4 font-medium">{subtitle}</p>

          <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4 space-y-3">
            {changes.length === 0 ? (
              <div className="text-sm text-gray-600">No field changes detected.</div>
            ) : (
              changes.map((change, idx) => (
                <div
                  key={`${change.label}-${idx}`}
                  className="flex items-center gap-2 bg-white rounded p-3 border border-amber-200"
                >
                  <span className="font-semibold text-gray-700 min-w-[140px]">{change.label}:</span>
                  {change.layout === 'stacked' ? (
                    <div className="flex-1 space-y-1">
                      <div className="text-red-600 line-through break-all">{change.from}</div>
                      <span className="text-gray-400 text-xl">↓</span>
                      <div className="text-green-600 font-bold break-all">{change.to}</div>
                    </div>
                  ) : (
                    <>
                      <span className="text-red-600 line-through break-all">{change.from}</span>
                      <span className="text-gray-400 text-xl">→</span>
                      <span className="text-green-600 font-bold break-all">{change.to}</span>
                    </>
                  )}
                </div>
              ))
            )}
          </div>

          <p className="text-sm text-gray-600 mt-4 italic">
            These changes will be saved immediately and cannot be undone.
          </p>
        </div>

        <div className="bg-gray-50 border-t px-6 py-4 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isConfirming}>
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm} disabled={isConfirming}>
            {isConfirming ? 'Saving...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
