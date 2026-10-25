import React from 'react';
import { Card } from '../components/ui/Card';

export const ManagePage: React.FC = () => {
  return (
    <div className="page-content">
      {/* Segment Control Placeholder */}
      <div className="flex gap-2 mb-4 p-1 bg-[var(--surface-2)] rounded-[var(--radius)] border border-[var(--border)]">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex-1 skeleton h-10 rounded-[6px]" />
        ))}
      </div>

      {/* Input Form - Top 60% */}
      <Card className="mb-4">
        <div className="skeleton w-24 h-5 mb-4" />
        
        {/* Item Selector */}
        <div className="skeleton w-full h-[52px] rounded-[var(--radius)] mb-3" />
        
        {/* Logic Guide */}
        <div className="skeleton w-full h-12 rounded-[var(--radius-sm)] mb-3" />
        
        {/* Quantity Stepper */}
        <div className="flex items-center justify-center gap-4 my-6">
          <div className="skeleton w-12 h-12 rounded-full" />
          <div className="skeleton w-16 h-8" />
          <div className="skeleton w-12 h-12 rounded-full" />
        </div>
        
        {/* Save Button */}
        <div className="skeleton w-full h-11 rounded-[var(--radius)]" />
      </Card>

      {/* Today's Log - Bottom 40% */}
      <Card>
        <div className="skeleton w-28 h-5 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-[var(--radius)] bg-[var(--surface-2)] border border-[var(--border)]">
              <div className="skeleton w-8 h-8 rounded-lg" />
              <div className="flex-1">
                <div className="skeleton w-24 h-4 mb-1" />
                <div className="skeleton w-16 h-3" />
              </div>
              <div className="skeleton w-12 h-4" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
