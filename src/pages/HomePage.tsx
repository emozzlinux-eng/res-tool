import React from 'react';
import { Card } from '../components/ui/Card';

export const HomePage: React.FC = () => {
  return (
    <div className="page-content">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-[var(--text-main)] mb-1">
          Good Morning, Manager
        </h2>
        <p className="text-sm text-[var(--text-sub)]">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats Grid - Placeholder */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="text-center py-6">
            <div className="skeleton w-12 h-12 mx-auto mb-2 rounded-full" />
            <div className="skeleton w-16 h-6 mx-auto mb-1" />
            <div className="skeleton w-20 h-3 mx-auto" />
          </Card>
        ))}
      </div>

      {/* Action Required Card - Placeholder */}
      <Card className="mb-4">
        <div className="skeleton w-32 h-5 mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton w-8 h-8 rounded-lg" />
              <div className="flex-1">
                <div className="skeleton w-24 h-4 mb-1" />
                <div className="skeleton w-16 h-3" />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Activity - Placeholder */}
      <Card>
        <div className="skeleton w-28 h-5 mb-3" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton w-2 h-2 rounded-full" />
              <div className="flex-1">
                <div className="skeleton w-32 h-4 mb-1" />
                <div className="skeleton w-20 h-3" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
