import React from 'react';
import { Minus, Plus } from 'lucide-react';

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  unit?: string;
}

export const Stepper: React.FC<StepperProps> = ({ value, onChange, step = 1, min = 0, unit }) => {
  const round = (n: number) => Math.round(n * 1000) / 1000;
  return (
    <div className="flex flex-col items-center">
      <div className="stepper">
        <button
          type="button"
          className="stepper__btn"
          onClick={() => onChange(Math.max(min, round(value - step)))}
          disabled={value <= min}
          aria-label="Decrease"
        >
          <Minus size={20} />
        </button>
        <input
          type="number"
          inputMode="decimal"
          className="stepper__input"
          value={Number.isFinite(value) ? value : ''}
          min={min}
          step="any"
          onChange={e => {
            const n = parseFloat(e.target.value);
            onChange(Number.isFinite(n) ? Math.max(min, n) : 0);
          }}
          aria-label="Quantity"
        />
        <button
          type="button"
          className="stepper__btn"
          onClick={() => onChange(round(value + step))}
          aria-label="Increase"
        >
          <Plus size={20} />
        </button>
      </div>
      {unit && <span className="text-xs text-[var(--text-muted)] mt-1">{unit}</span>}
    </div>
  );
};
