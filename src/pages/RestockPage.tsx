import React from 'react';
import { Card } from '../components/ui/Card';

export const RestockPage: React.FC = () => {
  return (
    <div className="page-content">
      {/* Summary Stats Header - Placeholder */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="text-center py-4">
            <div className="skeleton w-8 h-8 mx-auto mb-2" />
            <div className="skeleton w-12 h-5 mx-auto mb-1" />
            <div className="skeleton w-16 h-3 mx-auto" />
          </Card>
        ))}
      </div>

      {/* Search - Sticky */}
      <div className="sticky top-0 z-10 bg-[var(--bg)] pb-3 mb-3">
        <div className="skeleton w-full h-[52px] rounded-[var(--radius)]" />
      </div>

      {/* Inventory List */}
      <Card>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-[var(--radius)] bg-[var(--surface-2)] border border-[var(--border)]">
              <div className="skeleton w-8 h-8 rounded-lg" />
              <div className="flex-1">
                <div className="skeleton w-24 h-4 mb-1" />
                <div className="skeleton w-16 h-3" />
              </div>
              <div className="text-right">
                <div className="skeleton w-12 h-5 mb-1 ml-auto" />
                <div className="skeleton w-10 h-4 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* FAB - Generate Orders */}
      <button className="fixed bottom-24 right-4 w-14 h-14 rounded-full bg-[var(--primary)] text-white shadow-lg flex items-center justify-center z-40">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
};
