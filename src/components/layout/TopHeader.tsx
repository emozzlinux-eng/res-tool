import React from 'react';
import { SyncStatus } from '../../types';

interface TopHeaderProps {
  title: string;
  isOnline: boolean;
  syncStatus?: SyncStatus;
  onSync?: () => void;
  rightAction?: React.ReactNode;
}

const statusDisplay: Record<SyncStatus, { color: string; label: string }> = {
  synced: { color: 'var(--success)', label: 'Synced' },
  syncing: { color: 'var(--primary)', label: 'Syncing…' },
  pending: { color: 'var(--warning)', label: 'Pending' },
  offline: { color: 'var(--warning)', label: 'Offline' },
  error: { color: 'var(--danger)', label: 'Sync error' },
};

export const TopHeader: React.FC<TopHeaderProps> = ({ title, isOnline, syncStatus, onSync, rightAction }) => {
  const status = statusDisplay[syncStatus ?? (isOnline ? 'synced' : 'offline')];

  return (
    <header className="top-header">
      <h1 className="top-header__title">{title}</h1>
      <div className="top-header__actions">
        {/* Sync Status Indicator — tap to sync now */}
        <button
          className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer"
          onClick={onSync}
          disabled={!isOnline}
          aria-label={`Sync status: ${status.label}`}
        >
          <div
            className={`w-2 h-2 rounded-full ${syncStatus === 'syncing' ? 'animate-pulse' : ''}`}
            style={{ background: status.color }}
          />
          <span className="text-xs text-[var(--text-muted)] font-medium">{status.label}</span>
        </button>
        {rightAction}
      </div>
    </header>
  );
};
