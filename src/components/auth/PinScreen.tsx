import React, { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, Delete } from 'lucide-react';
import { verifyPin } from '../../utils/pin';
import {
  getFailedAttempts,
  setFailedAttempts,
  getLockRemainingSec,
  saveLockUntil,
  wipeAllData,
} from '../../utils/lockout';
import { vibrate } from '../../utils/device';
import { shuffle } from '../../utils/helpers';
import { isBiometricAvailable, hasBiometricEnrolled, verifyBiometric } from '../../utils/biometric';

type PinMode = 'verify' | 'change-old' | 'change-new' | 'change-confirm';

interface PinScreenProps {
  mode: PinMode;
  onComplete: (pin: string) => void;
  onError?: () => void;
  existingHash?: string;
  /** Security options — passed by App so users can harden sign-in. */
  scrambleKeypad?: boolean;
  panicWipeEnabled?: boolean;
  /** Called after a confirmed panic wipe so the app can reset to first-run state. */
  onPanicWipe?: () => void;
  /** Receives the key-press handler so App's window-level listener can drive the keypad. */
  onKeyHandler?: (handler: (key: string) => void) => void;
  /** Invoked after a successful WebAuthn assertion — App unlocks without a PIN. */
  onBiometricUnlock?: () => void;
}

const titles: Record<PinMode, string> = {
  'verify': 'Welcome back',
  'change-old': 'Enter Current PIN',
  'change-new': 'Create New PIN',
  'change-confirm': 'Confirm New PIN',
};

const subtitles: Record<PinMode, string> = {
  'verify': 'Enter your PIN to sign in',
  'change-old': 'Verify your identity first',
  'change-new': 'Choose a new 6-digit PIN',
  'change-confirm': 'Re-enter the new PIN',
};

/** Lockout schedule (seconds) after each consecutive block of failed attempts. */
const LOCK_STEPS = [15, 30, 60, 120, 300];

export const PinScreen: React.FC<PinScreenProps> = ({
  mode,
  onComplete,
  onError,
  existingHash,
  scrambleKeypad = false,
  panicWipeEnabled = false,
  onPanicWipe,
  onKeyHandler,
  onBiometricUnlock,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(getFailedAttempts);
  const [lockRemaining, setLockRemaining] = useState(getLockRemainingSec);
  const [verifying, setVerifying] = useState(false);
  const [panicArmed, setPanicArmed] = useState(false);
  // Biometric quick-unlock (WebAuthn) — only offered on the verify screen when
  // the device supports a platform authenticator AND the user enrolled one.
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  useEffect(() => {
    if (mode !== 'verify' || !onBiometricUnlock || !hasBiometricEnrolled()) return;
    let alive = true;
    isBiometricAvailable().then((ok) => {
      if (alive) setBioAvailable(ok);
    });
    return () => {
      alive = false;
    };
  }, [mode, onBiometricUnlock]);

  const handleBiometric = async () => {
    if (!onBiometricUnlock || bioBusy) return;
    setBioBusy(true);
    try {
      const ok = await verifyBiometric();
      if (ok) {
        setFailedAttempts(0);
        saveLockUntil(0);
        setAttempts(0);
        onBiometricUnlock();
      } else {
        setError('Biometric check failed — use your PIN.');
      }
    } finally {
      setBioBusy(false);
    }
  };
  // Guards against double-submitting the last digit before verification settles
  const busyRef = React.useRef(false);

  // Scrambled keypad layout (changes every time the screen opens)
  const keyOrder = useMemo(
    () => (scrambleKeypad && mode === 'verify' ? shuffle(['1','2','3','4','5','6','7','8','9','0']) : null),
    [scrambleKeypad, mode]
  );

  // Persistent countdown — survives page reloads (anti brute-force).
  // Derived from the wall-clock `until` timestamp instead of decrementing a
  // counter per tick: setTimeout chains drift when the tab is throttled
  // (backgrounded PWA), so the displayed seconds could lag behind the real
  // lockout. Interval only runs while locked, and stops itself at zero.
  useEffect(() => {
    if (lockRemaining <= 0) return;
    const timer = setInterval(() => {
      const s = getLockRemainingSec();
      setLockRemaining(s);
      if (s <= 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [lockRemaining > 0]);

  const applyLockout = (seconds: number) => {
    saveLockUntil(Date.now() + seconds * 1000);
    setLockRemaining(seconds);
  };

  const handleKey = (key: string) => {
    if (lockRemaining > 0 || verifying || panicArmed || busyRef.current) return;
    if (key === 'backspace') {
      setPin((p) => p.slice(0, -1));
      setError('');
      return;
    }
    if (pin.length >= 6) return;
    const newPin = pin + key;
    setPin(newPin);
    setError('');
    vibrate(8);

    if (newPin.length === 6) {
      busyRef.current = true;
      setVerifying(true);
      setTimeout(async () => {
        try {
          if (mode === 'verify' || mode === 'change-old') {
            const ok = existingHash ? await verifyPin(newPin, existingHash) : false;
            if (ok) {
              setFailedAttempts(0);
              saveLockUntil(0);
              setAttempts(0);
              onComplete(newPin);
            } else {
              vibrate([40, 60, 40]);
              const newAttempts = attempts + 1;
              setAttempts(newAttempts);
              setFailedAttempts(newAttempts);
              setPin('');
              setError('');
              if (panicWipeEnabled && newAttempts >= 5) {
                setPanicArmed(true);
              } else if (newAttempts >= 5) {
                applyLockout(LOCK_STEPS[Math.min(newAttempts - 5, LOCK_STEPS.length - 1)]);
                setFailedAttempts(0);
                setAttempts(0);
              } else {
                setError(`Incorrect PIN. ${5 - newAttempts} attempt${5 - newAttempts === 1 ? '' : 's'} left.`);
              }
              onError?.();
            }
          } else {
            onComplete(newPin);
          }
        } finally {
          setVerifying(false);
          busyRef.current = false;
        }
      }, 200);
    }
  };

  const confirmPanicWipe = async () => {
    // Require the CURRENT PIN to erase — an attacker who doesn't know it can't trigger the wipe.
    const input = window.prompt(
      'Enter your correct PIN to erase all data now (or press Cancel to go back and wait for the lockout):'
    );
    if (input === null) {
      setPanicArmed(false);
      return;
    }
    if (/^\d{6}$/.test(input) && existingHash && (await verifyPin(input, existingHash))) {
      wipeAllData();
      onPanicWipe?.();
    } else {
      setError('Wrong PIN — data was NOT erased.');
      setPanicArmed(false);
    }
  };

  // Physical keyboard support (desktop / external keyboards)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (/^[0-9]$/.test(e.key)) handleKey(e.key);
    else if (e.key === 'Backspace') handleKey('backspace');
  };

  // Expose the keypad handler to App's window-level listener, which is more
  // reliable on Android where soft-keyboard events can miss a focused div.
  useEffect(() => {
    onKeyHandler?.(handleKey);
  });

  const isVerify = mode === 'verify' || mode === 'change-old';
  const disabled = lockRemaining > 0 || panicArmed;

  return (
    <div className="login-screen" tabIndex={0} onKeyDown={handleKeyDown} autoFocus>
      {/* Brand header */}
      <div className="login-brand">
        <div className="login-brand__logo">
          <ShieldCheck size={26} color="#fff" strokeWidth={2.2} />
        </div>
        <div>
          <div className="login-brand__name">Inventory Pro</div>
          <div className="login-brand__tag">Production &amp; stock control</div>
        </div>
      </div>

      {/* Titles */}
      <div className="login-heading">
        <h1 className="login-heading__title">{titles[mode]}</h1>
        <p className="login-heading__sub">{subtitles[mode]}</p>
      </div>

      {/* PIN dots */}
      <div
        className={`pin-dots mb-4 ${verifying ? 'pin-dots--busy' : ''}`}
        aria-live="polite"
        aria-label={`${pin.length} of 6 digits entered`}
      >
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`pin-dot ${i < pin.length ? 'pin-dot--filled' : ''} ${error ? 'pin-dot--error' : ''}`}
          />
        ))}
      </div>

      {error && <p className="login-msg login-msg--error" role="alert">{error}</p>}
      {lockRemaining > 0 && (
        <p className="login-msg login-msg--warn" role="status">
          Locked — try again in {lockRemaining}s
        </p>
      )}
      {panicArmed && (
        <div className="login-panic" role="alert">
          <p className="text-xs font-medium mb-2">
            5 wrong attempts reached. You can erase all data on this device now — a thief gets nothing.
          </p>
          <button className="btn btn--danger btn--sm" onClick={confirmPanicWipe}>
            Erase all data
          </button>
        </div>
      )}
      {!error && lockRemaining === 0 && !panicArmed && (
        <p className="login-msg login-msg--ghost">&nbsp;</p>
      )}

      {/* Keypad */}
      <div className="pin-pad">
        {keyOrder ? (
          <>
            {keyOrder.map((k) => (
              <button key={k} className="pin-key" onClick={() => handleKey(k)} aria-label={`Key ${k}`} disabled={disabled}>
                {k}
              </button>
            ))}
            <span className="pin-key pin-key--spacer" aria-hidden="true" />
            <button className="pin-key pin-key--action" onClick={() => handleKey('backspace')} aria-label="Delete last digit" disabled={disabled}>
              <Delete size={22} />
            </button>
          </>
        ) : (
          <>
            {['1','2','3','4','5','6','7','8','9'].map((k) => (
              <button key={k} className="pin-key" onClick={() => handleKey(k)} aria-label={`Key ${k}`} disabled={disabled}>
                {k}
              </button>
            ))}
            <span className="pin-key pin-key--spacer" aria-hidden="true" />
            <button className="pin-key" onClick={() => handleKey('0')} aria-label="Key 0" disabled={disabled}>
              0
            </button>
            <button className="pin-key pin-key--action" onClick={() => handleKey('backspace')} aria-label="Delete last digit" disabled={disabled}>
              <Delete size={22} />
            </button>
          </>
        )}
      </div>

      {/* Biometric quick-unlock — appears only when the device offers a
          platform authenticator and the user enrolled one in Profile. */}
      {mode === 'verify' && bioAvailable && onBiometricUnlock && (
        <button
          className="btn btn--ghost btn--sm mt-4 self-center"
          onClick={handleBiometric}
          disabled={bioBusy || lockRemaining > 0}
        >
          {bioBusy ? 'Checking…' : '🔓 Unlock with Face / Touch ID'}
        </button>
      )}

      {/* Footer note */}
      <p className="login-footer">
        {!existingHash
          ? 'Default PIN is 000000 — change it in Profile → Change PIN.'
          : isVerify
            ? 'Your data stays on this device — nothing leaves the browser.'
            : 'This PIN protects the data stored on this device.'}
      </p>
    </div>
  );
};
