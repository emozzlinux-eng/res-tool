import '@testing-library/jest-dom/vitest';
import { vi, afterEach } from 'vitest';
import { memoryStorage } from './memoryStorage';

// jsdom's localStorage is flaky across vitest versions — always use ours.
Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, configurable: true });

afterEach(() => {
  memoryStorage.reset();
});

// WebCrypto is missing in jsdom; PIN hashing tests need it.
if (typeof globalThis.crypto?.subtle === 'undefined') {
  const { webcrypto } = await import('node:crypto');
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}

// matchMedia is used by the theme logic; jsdom lacks it.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
