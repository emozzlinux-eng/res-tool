import React, { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { verifyPin } from '../../utils/helpers';

type PinMode = 'setup' | 'confirm' | 'verify' | 'change-old' | 'change-new' | 'change-confirm';

interface PinScreenProps {
  mode: PinMode;
  onComplete: (pin: string) => void;
  onError?: () => void;
  existingHash?: string;
}

const titles: Record<PinMode, string> = {
  'setup': 'Create Your PIN',
  'confirm': 'Confirm Your PIN',
  'verify': 'Enter Your PIN',
  'change-old': 'Enter Current PIN',
  'change-new': 'Create New PIN',
  'change-confirm': 'Confirm New PIN',
};

const subtitles: Record<PinMode, string> = {
  'setup': 'Choose a 6-digit PIN to secure your app',
  'confirm': 'Enter the same PIN again to confirm',
  'verify': 'Unlock Inventory Pro',
  'change-old': 'Verify your identity',
  'change-new': 'Choose a new 6-digit PIN',
  'change-confirm': 'Enter the new PIN again',
};

export const PinScreen: React.FC<PinScreenProps> = ({ mode, onComplete, onError, existingHash }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockout, setLockout] = useState(0);

  useEffect(() => {
    if (lockout > 0) {
      const timer = setTimeout(() => setLockout(lockout - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [lockout]);

  const handleKey = (key: string) => {
    if (lockout > 0) return;
    if (key === 'backspace') {
      setPin(p => p.slice(0, -1));
      setError('');
      return;
    }
    if (pin.length >= 6) return;
    const newPin = pin + key;
    setPin(newPin);
    setError('');

    if (newPin.length === 6) {
      setTimeout(async () => {
        if (mode === 'verify' || mode === 'change-old') {
          const ok = existingHash ? await verifyPin(newPin, existingHash) : false;
          if (ok) {
            onComplete(newPin);
          } else {
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);
            if (newAttempts >= 5) {
              setLockout(30);
              setAttempts(0);
              setError('Too many attempts. Locked for 30s.');
            } else {
              setError(`Wrong PIN. ${5 - newAttempts} attempts left.`);
            }
            setPin('');
            onError?.();
          }
        } else {
          onComplete(newPin);
        }
      }, 200);
    }
  };

  return (
    <div className="pin-screen">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 bg-[var(--primary)]">
        <Lock size={28} color="white" />
      </div>
      <h1 className="text-xl font-semibold mb-2 text-[var(--text-main)]">{titles[mode]}</h1>
      <p className="text-sm mb-8 text-center text-[var(--text-sub)]">{subtitles[mode]}</p>
      
      <div className="pin-dots mb-4">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className={`pin-dot ${i < pin.length ? 'pin-dot--filled' : ''}`} />
        ))}
      </div>
      
      {error && <p className="text-xs mb-4 text-[var(--danger)]">{error}</p>}
      {lockout > 0 && <p className="text-xs mb-4 text-[var(--warning)]">Locked: {lockout}s</p>}
      
      <div className="pin-pad">
        {['1','2','3','4','5','6','7','8','9'].map(k => (
          <button key={k} className="pin-key" onClick={() => handleKey(k)} aria-label={`Key ${k}`}>{k}</button>
        ))}
        <button className="pin-key" aria-label="Biometric" style={{ fontSize: '20px' }}>🔓</button>
        <button className="pin-key" onClick={() => handleKey('0')} aria-label="Key 0">0</button>
        <button className="pin-key" onClick={() => handleKey('backspace')} aria-label="Backspace" style={{ fontSize: '20px' }}>⌫</button>
      </div>
    </div>
  );
};
