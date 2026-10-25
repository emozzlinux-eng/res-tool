/** Minimal in-memory Storage implementation shared by tests and app fallback. */
export const createMemoryStorage = (): Storage => {
  let map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(String(k), String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => {
      map = new Map();
    },
    reset: () => {
      map = new Map();
    },
  } as Storage & { reset(): void };
};

export const memoryStorage = createMemoryStorage();
