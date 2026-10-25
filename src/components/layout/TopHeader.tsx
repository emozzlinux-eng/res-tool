import React from 'react';

interface TopHeaderProps {
  title: string;
  isOnline: boolean;
  /** Human-readable "last saved" label shown next to the saved-locally dot. */
  lastSavedLabel?: string;
  rightAction?: React.ReactNode;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ title, isOnline, lastSavedLabel, rightAction }) => {
  return (
    <header className="top-header">
      <h1 className="top-header__title">{title}</h1>
      <div className="top-header__actions">
        {/* Data always lives on this device — show that, plus an offline badge only when offline */}
        <div
          className="flex items-center gap-1.5"
          title={isOnline ? 'Saved locally on this device' : 'Offline — changes are still saved on this device'}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: isOnline ? 'var(--success)' : 'var(--warning)' }}
            aria-hidden="true"
          />
          <span className="text-xs text-[var(--text-muted)] font-medium">
            Saved locally{lastSavedLabel ? ` · ${lastSavedLabel}` : ''}
          </span>
          {!isOnline && (
            <span className="badge badge--warning" role="status">
              Offline
            </span>
          )}
        </div>
        {rightAction}
      </div>
    </header>
  );
};
