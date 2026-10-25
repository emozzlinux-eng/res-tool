import React, { useId } from 'react';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  hint,
  icon,
  className = '',
  ...props
}) => {
  const id = useId();

  return (
    <div className="w-full">
      <div className="input-group">
        {icon && (
          <span className="absolute left-14 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none z-10">
            {icon}
          </span>
        )}
        <input
          id={id}
          className={`input-field ${error ? 'input-field--error' : ''} ${icon ? 'pl-14' : ''} ${className}`}
          placeholder=" "
          {...props}
        />
        <label htmlFor={id} className="input-label">
          {label}
        </label>
      </div>
      {error && <p className="input-error">{error}</p>}
      {hint && !error && <p className="input-hint">{hint}</p>}
    </div>
  );
};

/* Select variant with floating label */
interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  error?: string;
  children: React.ReactNode;
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  children,
  className = '',
  ...props
}) => {
  const id = useId();

  return (
    <div className="w-full">
      <div className="input-group">
        <select
          id={id}
          className={`input-field input-select ${error ? 'input-field--error' : ''} ${className}`}
          {...props}
        >
          {children}
        </select>
        <label htmlFor={id} className="input-label input-label--floated">
          {label}
        </label>
      </div>
      {error && <p className="input-error">{error}</p>}
    </div>
  );
};
