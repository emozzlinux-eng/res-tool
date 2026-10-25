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

/**
 * Play the platform's built-in light notification sound (iOS/Android webviews
 * and some desktop browsers). Silent no-op where unsupported. Used as an
 * audible companion to low-stock alerts.
 */
export const playBeep = (): void => {
  try {
    if ('audio' in window && typeof (window as unknown as { audio: unknown }).audio === 'function') {
      (window as unknown as { audio: (s: string) => void }).audio('notification');
    }
  } catch {
    /* ignore */
  }
};

/**
 * Show an in-app system-style alert banner for critical stock warnings.
 * Uses the Notification API when permission was granted; otherwise callers
 * fall back to toasts/banners inside the app UI.
 */
export const showSystemNotification = async (title: string, body: string): Promise<boolean> => {
  if (!('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;
  try {
    await navigator.serviceWorker?.ready;
    new Notification(title, { body, icon: '/icons/icon-192.png', tag: 'inventory-pro' });
    return true;
  } catch {
    return false;
  }
};

export const notificationsSupported = (): boolean =>
  'Notification' in window && Notification.permission !== 'denied';

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!notificationsSupported()) return false;
  if (Notification.permission === 'granted') return true;
  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
};

/* ------------------------------------------------------------------ */
/* Biometric / WebAuthn PIN unlock                                     */
/* ------------------------------------------------------------------ */

const WEBAUTHN_ID_KEY = 'inventoryPro_webauthn_id';

/** Base64url helpers (WebAuthn works with ArrayBuffers). */
const b64urlFromBuf = (buf: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const bufFromB64url = (s: string): ArrayBuffer => {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

/** True when this device/browser can offer biometric unlock. */
export const isBiometricAvailable = async (): Promise<boolean> => {
  if (!('credentials' in navigator) || !window.PublicKeyCredential) return false;
  try {
    return (
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) === true
    );
  } catch {
    return false;
  }
};

/** Enroll the device biometric/PIN authenticator for quick unlock. */
export const enrollBiometric = async (): Promise<boolean> => {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Inventory Pro' },
        user: {
          id: userId,
          name: 'owner',
          displayName: 'Inventory Pro owner',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 30_000,
      },
    });
    if (!cred) return false;
    localStorage.setItem(WEBAUTHN_ID_KEY, b64urlFromBuf((cred.rawId as ArrayBuffer)));
    return true;
  } catch {
    return false;
  }
};

export const hasBiometricEnrolled = (): boolean => {
  try {
    return !!localStorage.getItem(WEBAUTHN_ID_KEY);
  } catch {
    return false;
  }
};

export const removeBiometric = (): void => {
  try {
    localStorage.removeItem(WEBAUTHN_ID_KEY);
  } catch {
    /* ignore */
  }
};

/** Verify with the enrolled authenticator. Resolves true on success. */
export const verifyBiometric = async (): Promise<boolean> => {
  try {
    const idB64 = localStorage.getItem(WEBAUTHN_ID_KEY);
    if (!idB64) return false;
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{ type: 'public-key', id: bufFromB64url(idB64) }],
        userVerification: 'required',
        timeout: 30_000,
      },
    });
    return !!assertion;
  } catch {
    return false;
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

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

/**
 * Lightweight subsequence fuzzy match. Returns a score (higher = better) or
 * -1 when there is no match. Prefers matches at word starts and consecutive
 * runs, so "fl r" still finds "Flour", and "crt" ranks "Croissant" above
 * "Carrot Cake".
 */
export const fuzzyScore = (text: string, query: string): number => {
  const t = text.toLowerCase();
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  // Exact substring match is the strongest signal
  if (t.includes(q)) return 1000 - t.indexOf(q);

  let score = 0;
  let ti = 0;
  let streak = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    if (ch === ' ') continue;
    const found = t.indexOf(ch, ti);
    if (found === -1) return -1;
    // Word-start bonus + streak bonus for consecutive characters
    const wordStart = found === 0 || /\s|[^\w]/.test(t[found - 1]);
    score += wordStart ? 30 : 5;
    streak = ti === found ? streak + 1 : 0;
    score += streak * 4;
    ti = found + 1;
  }
  // Penalise widely scattered matches
  score -= Math.max(0, ti - q.replace(/\s/g, '').length);
  return score > 0 ? score : -1;
};

/** Sort candidates by fuzzy relevance to the query (empty query → as-is). */
export const fuzzyFilter = <T>(items: T[], query: string, getName: (item: T) => string): T[] => {
  if (!query.trim()) return items;
  return items
    .map((item) => ({ item, score: fuzzyScore(getName(item), query) }))
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.item);
};

/* ------------------------------------------------------------------ */
/* Misc formatting                                                     */
/* ------------------------------------------------------------------ */

/** Format money with the shop currency symbol, e.g. "$12.50". */
export const fmtMoney = (currency: string, n: number): string =>
  `${currency}${n.toFixed(2)}`;

/** Day key in YYYY-MM-DD local time (spreadsheet & grouping friendly). */
export const dayKey = (d: Date | number): string =>
  new Date(d).toLocaleDateString('en-CA');
