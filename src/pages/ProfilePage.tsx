import React from 'react';
import { ChevronRight } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  return (
    <div className="page-content">
      {/* Profile Header */}
      <div className="text-center mb-6 pt-2">
        <div className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl bg-[var(--primary-light)]">
          👤
        </div>
        <h2 className="text-lg font-semibold text-[var(--text-main)]">Manager</h2>
        <p className="text-sm text-[var(--text-sub)]">Store Manager</p>
      </div>

      {/* Security Group */}
      <div className="mb-6">
        <p className="settings-group__title">Security</p>
        <div className="settings-group">
          {[
            { icon: '🔐', label: 'Change PIN', desc: 'Update your security PIN' },
            { icon: '⏱️', label: 'Auto-Lock Timer', desc: '5 minutes' },
            { icon: '🎓', label: 'App Tutorial', desc: 'Replay onboarding' },
          ].map((item, i) => (
            <button key={i} className="settings-item">
              <div className="settings-item__icon bg-[var(--primary-light)]">{item.icon}</div>
              <div className="settings-item__content">
                <div className="settings-item__label">{item.label}</div>
                <div className="settings-item__desc">{item.desc}</div>
              </div>
              <ChevronRight size={16} className="settings-item__chevron" />
            </button>
          ))}
        </div>
      </div>

      {/* Master Data Group */}
      <div className="mb-6">
        <p className="settings-group__title">Master Data</p>
        <div className="settings-group">
          {[
            { icon: '🍞', label: 'Foods', count: 4 },
            { icon: '📋', label: 'Recipes', count: 4 },
            { icon: '📦', label: 'Raw Items', count: 5 },
            { icon: '🏪', label: 'Suppliers', count: 2 },
          ].map((item, i) => (
            <button key={i} className="settings-item">
              <div className="settings-item__icon bg-[var(--surface-2)]">{item.icon}</div>
              <div className="settings-item__content">
                <div className="settings-item__label">{item.label}</div>
              </div>
              <span className="badge badge--primary mr-2">{item.count}</span>
              <ChevronRight size={16} className="settings-item__chevron" />
            </button>
          ))}
        </div>
      </div>

      {/* Preferences Group */}
      <div className="mb-6">
        <p className="settings-group__title">Preferences</p>
        <div className="settings-group">
          <div className="settings-item">
            <div className="settings-item__icon bg-[var(--surface-2)]">🌙</div>
            <div className="settings-item__content">
              <div className="settings-item__label">Dark Mode</div>
            </div>
            {/* ToggleSwitch placeholder */}
            <div className="w-[51px] h-[31px] rounded-full bg-[var(--border-strong)] relative">
              <div className="absolute top-0.5 left-0.5 w-[27px] h-[27px] rounded-full bg-white shadow" />
            </div>
          </div>
          <button className="settings-item">
            <div className="settings-item__icon bg-[var(--surface-2)]">💾</div>
            <div className="settings-item__content">
              <div className="settings-item__label">Backup Data</div>
              <div className="settings-item__desc">Export as JSON</div>
            </div>
            <ChevronRight size={16} className="settings-item__chevron" />
          </button>
          <button className="settings-item">
            <div className="settings-item__icon bg-[var(--surface-2)]">📂</div>
            <div className="settings-item__content">
              <div className="settings-item__label">Restore Backup</div>
              <div className="settings-item__desc">Import from JSON</div>
            </div>
            <ChevronRight size={16} className="settings-item__chevron" />
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="mb-6">
        <p className="settings-group__title">Danger Zone</p>
        <div className="settings-group">
          <button className="settings-item settings-item--danger">
            <div className="settings-item__icon bg-[var(--danger-bg)]">🗑️</div>
            <div className="settings-item__content">
              <div className="settings-item__label">Reset All Data</div>
              <div className="settings-item__desc" style={{ color: 'var(--danger)' }}>This cannot be undone</div>
            </div>
          </button>
        </div>
      </div>

      {/* About */}
      <div className="text-center py-4">
        <p className="text-xs text-[var(--text-muted)]">Inventory Pro v4.0.0</p>
      </div>
    </div>
  );
};
