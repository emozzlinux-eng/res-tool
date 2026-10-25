import React from 'react';
import { Button } from './Button';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onCancel,
}) => (
  <div className="modal-overlay" onClick={onCancel}>
    <div className="modal-content" role="alertdialog" aria-modal="true" onClick={e => e.stopPropagation()}>
      <h3 className="text-lg font-semibold mb-2 text-[var(--text-main)]">{title}</h3>
      <p className="text-sm mb-4 text-[var(--text-sub)]">{message}</p>
      <div className="flex gap-3">
        <Button variant="outline" fullWidth onClick={onCancel}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} fullWidth onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </div>
  </div>
);
