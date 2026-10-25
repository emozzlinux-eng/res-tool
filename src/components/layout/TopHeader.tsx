import React from 'react';
import { Cloud, CloudOff, Wifi } from 'lucide-react';

interface TopHeaderProps {
  title: string;
  isOnline: boolean;
  rightAction?: React.ReactNode;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ title, isOnline, rightAction }) => {
  return (
    <header className="top-header">
      <h1 className="top-header__title">{title}</h1>
      <div className="top-header__actions">
        {/* Sync Status Indicator */}
        <div className="flex items-center gap-1.5">
          {isOnline ? (
            <>
              <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
              <span className="text-xs text-[var(--text-muted)] font-medium">Synced</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-[var(--warning)]" />
              <span className="text-xs text-[var(--text-muted)] font-medium">Offline</span>
            </>
          )}
        </div>
        {rightAction}
      </div>
    </header>
  );
};
