import React from 'react';

interface SettingsItemProps {
  icon: string;
  /** Tailwind/CSS variable background class for the icon bubble, e.g. "bg-[var(--primary-light)]". */
  iconClass?: string;
  label: string;
  desc?: string;
  danger?: boolean;
  /** When provided the row renders as a <button>; otherwise it is static content. */
  onClick?: () => void;
  /** Right-hand side content (toggle, badge, select…) — replaces the chevron. */
  control?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * One row inside a settings group: icon bubble + label/description + optional
 * trailing control or chevron. Shared by every settings list in the app so the
 * markup and accessibility stay consistent.
 */
export const SettingsItem: React.FC<SettingsItemProps> = ({
  icon,
  iconClass = 'bg-[var(--surface-2)]',
  label,
  desc,
  danger = false,
  onClick,
  control,
  children,
}) => {
  const className = `settings-item${danger ? ' settings-item--danger' : ''}`;
  const inner = (
    <>
      <div className={`settings-item__icon ${iconClass}`}>{icon}</div>
      <div className="settings-item__content">
        <div className="settings-item__label">{label}</div>
        {desc && (
          <div className="settings-item__desc" style={danger ? { color: 'var(--danger)' } : undefined}>
            {desc}
          </div>
        )}
        {children}
      </div>
      {control ?? (onClick ? <span className="settings-item__chevron">›</span> : null)}
    </>
  );

  return onClick ? (
    <button className={className} onClick={onClick}>
      {inner}
    </button>
  ) : (
    <div className={className}>{inner}</div>
  );
};
