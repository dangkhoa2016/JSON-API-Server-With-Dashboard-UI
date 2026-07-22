const MAX_MEM_ENTRIES = 10000;

export interface MemEntry {
  count: number;
  resetAt: number;
  violationCount: number;
}

export function createInMemoryStore() {
  const mem = new Map<string, MemEntry>();
  function touch(key: string) {
    const v = mem.get(key);
    if (!v) return;
    mem.delete(key);
    mem.set(key, v);
  }
  function ensureLimit() {
    while (mem.size > MAX_MEM_ENTRIES) {
      const firstKey = mem.keys().next().value!;
      mem.delete(firstKey);
    }
  }
  return {
    get: (k: string) => { touch(k); return mem.get(k); },
    set: (k: string, v: MemEntry) => { mem.set(k, v); ensureLimit(); },
    delete: (k: string) => mem.delete(k),
    entries: () => mem.entries(),
    size: () => mem.size,
    clear: () => mem.clear(),
  };
}

export type MemStore = ReturnType<typeof createInMemoryStore>;

export function triggerCleanup(memStore: MemStore): void {
  const now = Date.now();
  for (const [ip, entry] of memStore.entries()) {
    if (entry.resetAt <= now) memStore.delete(ip);
  }
}
