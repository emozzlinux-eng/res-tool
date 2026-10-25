/**
 * Biometric quick-unlock via WebAuthn platform authenticators (Face ID,
 * Touch ID, Windows Hello, Android biometric/PIN). The credential id is kept
 * in localStorage; verification simply asks the authenticator to assert.
 */

const WEBAUTHN_ID_KEY = 'inventoryPro_webauthn_id';
const TIMEOUT_MS = 30_000;

/** Base64url helpers (WebAuthn works with ArrayBuffers). */
const b64urlFromBuf = (buf: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const bufFromB64url = (s: string): Uint8Array<ArrayBuffer> => {
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
    // CredentialType is missing from TS's lib.dom — cast to the WebAuthn
    // subtype so we can read `rawId`.
    const cred = (await navigator.credentials.create({
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
        timeout: TIMEOUT_MS,
      },
    })) as PublicKeyCredential | null;
    if (!cred) return false;
    localStorage.setItem(WEBAUTHN_ID_KEY, b64urlFromBuf(cred.rawId as ArrayBuffer));
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
        timeout: TIMEOUT_MS,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
};
