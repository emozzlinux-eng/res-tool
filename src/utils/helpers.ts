/**
 * Core generic utilities shared across the app.
 *
 * Domain-specific helpers live in focused modules and are re-exported here so
 * existing imports keep working:
 *   - utils/pin      — PIN hashing & verification (PBKDF2-SHA256)
 *   - utils/lockout  — failed-attempt counter & lockout persistence
 *   - utils/device   — haptics / sounds / system notifications
 *   - utils/biometric— WebAuthn quick unlock
 *   - utils/format   — date & money display formatting
 *   - utils/search   — fuzzy search scoring
 */

export * from './pin';
export * from './lockout';
export * from './device';
export * from './biometric';
export * from './format';
export * from './search';

/**
 * Clean free-text before storing it.
 *
 * NOTE: we deliberately do NOT HTML-escape here. React escapes everything it
 * renders, so escaping on the way in used to double-encode names ("A & B" →
 * "A &amp; B") and silently broke every name-keyed relationship (recipes,
 * supplier item lists, favorites). We only strip control characters, collapse
 * whitespace and cap the length.
 */
export const sanitize = (str: string, maxLen = 80): string =>
  str
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);

/**
 * Generate unique ID (collision-safe within the same millisecond)
 */
let idCounter = 0;
export const generateId = (): string => {
  idCounter = (idCounter + 1) % 46656; // 36^2
  return `id_${Date.now().toString(36)}_${idCounter.toString(36).padStart(2, '0')}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
};

/** Shuffle an array (used for optional keypad randomization). */
export const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
