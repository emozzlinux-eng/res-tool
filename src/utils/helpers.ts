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

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const fromHex = (hex: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(hex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));

/**
 * Hash a PIN with PBKDF2-SHA256 (100k iterations) and a random salt.
 * Format: "p2$<salt-hex>$<hash-hex>". Uses the browser's built-in WebCrypto.
 */
export const hashPin = async (pin: string): Promise<string> => {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    key,
    256
  );
  return `p2$${toHex(salt)}$${toHex(new Uint8Array(bits))}`;
};

/**
 * Verify a PIN against a stored hash. Supports the legacy homemade
 * "h_<checksum>" format so existing installs keep working; those hashes are
 * transparently upgraded on next successful unlock (see PinScreen).
 */
export const verifyPin = async (pin: string, storedHash: string): Promise<boolean> => {
  if (!storedHash) return false;
  if (storedHash.startsWith('h_')) {
    // Legacy checksum format — compare directly.
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
      const char = pin.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `h_${Math.abs(hash).toString(36)}_${pin.length}` === storedHash;
  }
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'p2') return false;
  try {
    const salt = fromHex(parts[1]);
    const expected = parts[2];
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, [
      'deriveBits',
    ]);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
      key,
      256
    );
    const actual = toHex(new Uint8Array(bits));
    // Constant-time-ish comparison
    if (actual.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < actual.length; i++) {
      diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
};

/** True when the stored hash uses the old weak format and should be upgraded. */
export const isLegacyPinHash = (storedHash: string): boolean =>
  storedHash.startsWith('h_');

/* ---------- Anti-theft / lockout helpers ---------- */

/** All localStorage keys owned by this app — never touch anything else. */
export const APP_STORAGE_KEYS = [
  'inventoryPro_state',
  'inventoryPro_failed',
  'inventoryPro_lockUntil',
] as const;

const FAILED_KEY = 'inventoryPro_failed';
const LOCK_KEY = 'inventoryPro_lockUntil';
const MAX_FAILED = 5;

export const getFailedAttempts = (): number => {
  try {
    return Number(localStorage.getItem(FAILED_KEY)) || 0;
  } catch {
    return 0;
  }
};

export const setFailedAttempts = (n: number): void => {
  try {
    if (n <= 0) localStorage.removeItem(FAILED_KEY);
    else localStorage.setItem(FAILED_KEY, String(n));
  } catch {
    /* ignore */
  }
};

/** Remaining lockout seconds (0 when not locked). Survives reloads. */
export const getLockRemainingSec = (): number => {
  try {
    const until = Number(localStorage.getItem(LOCK_KEY)) || 0;
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  } catch {
    return 0;
  }
};

export const saveLockUntil = (t: number): void => {
  try {
    if (t > 0) localStorage.setItem(LOCK_KEY, String(t));
    else localStorage.removeItem(LOCK_KEY);
  } catch {
    /* ignore */
  }
};

/**
 * Wipe every piece of app data this browser knows about (state + counters).
 * Used as the panic response after too many wrong PIN attempts. Only removes
 * our own keys — other sites' data on the device is left alone.
 */
export const wipeAllData = (): void => {
  try {
    for (const key of APP_STORAGE_KEYS) localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

/** Trigger a short haptic tick on supporting devices (safe no-op elsewhere). */
export const vibrate = (ms: number | number[] = 12): void => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
};

/** Shuffle an array (used for optional keypad randomization). */
export const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Format timestamp to "time ago" string
 */
export const formatTimeAgo = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

/**
 * Get greeting based on time of day
 */
export const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

/**
 * Get formatted date string
 */
export const getFormattedDate = (): string => {
  return new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

/**
 * Get current time string
 */
export const getCurrentTime = (): string => {
  return new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};
