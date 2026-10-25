import React from 'react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
}) => {
  return (
    <label
      className={`toggle ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      onClick={(e) => {
        if (disabled) return;
        e.preventDefault();
        onChange(!checked);
      }}
    >
      {label && <span className="toggle__label">{label}</span>}
      <div className={`toggle__track ${checked ? 'toggle__track--active' : ''}`}>
        <div className="toggle__thumb" />
      </div>
    </label>
  );
};
