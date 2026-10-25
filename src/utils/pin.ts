/**
 * PIN hashing & verification (PBKDF2-SHA256 via WebCrypto).
 *
 * Stored format: "p2$<salt-hex>$<hash-hex>". The legacy homemade "h_<checksum>"
 * format is still accepted for verification so existing installs keep working;
 * those hashes are transparently upgraded on next successful unlock (PinScreen).
 */

const PBKDF2_ITERATIONS = 100_000;
const HASH_BITS = 256;
const SALT_BYTES = 16;

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const fromHex = (hex: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(hex.match(/.{2}/g)!.map((h) => parseInt(h, 16)));

/** Derive the PBKDF2 bits for `pin` with `salt`, shared by hash & verify. */
const deriveBits = async (pin: string, salt: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    HASH_BITS
  );
};

/** Hash a PIN with PBKDF2-SHA256 (100k iterations) and a random salt. */
export const hashPin = async (pin: string): Promise<string> => {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const bits = await deriveBits(pin, salt);
  return `p2$${toHex(salt)}$${toHex(new Uint8Array(bits))}`;
};

/** Recompute the legacy "h_<checksum>_<len>" hash of a PIN (weak, read-only). */
const legacyHash = (pin: string): string => {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `h_${Math.abs(hash).toString(36)}_${pin.length}`;
};

/** Constant-time-ish string comparison (length leak only). */
const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

/** Verify a PIN against a stored hash (supports the legacy "h_" format). */
export const verifyPin = async (pin: string, storedHash: string): Promise<boolean> => {
  if (!storedHash) return false;
  if (isLegacyPinHash(storedHash)) return legacyHash(pin) === storedHash;

  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'p2') return false;
  try {
    const bits = await deriveBits(pin, fromHex(parts[1]));
    return timingSafeEqual(toHex(new Uint8Array(bits)), parts[2]);
  } catch {
    return false;
  }
};

/** True when the stored hash uses the old weak format and should be upgraded. */
export const isLegacyPinHash = (storedHash: string): boolean => storedHash.startsWith('h_');
