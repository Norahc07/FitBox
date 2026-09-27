/**
 * Minimal promise wrapper around IndexedDB (no dependency).
 * Falls back to an in-memory store when IndexedDB is unavailable
 * (e.g. some private-browsing modes) so the game still runs.
 */
export const DB_NAME = 'fitbox';
export const DB_VERSION = 1;

export const STORES = {
  progress: { keyPath: 'levelNumber' },
  sessions: { keyPath: 'id' },
  settings: { keyPath: 'key' },
  syncQueue: { keyPath: 'id' },
  levels: { keyPath: 'id' },
  activeGames: { keyPath: 'levelId' },
  meta: { keyPath: 'key' },
};

let dbPromise = null;
let memory = null;

function createMemoryBackend() {
  const data = Object.fromEntries(Object.keys(STORES).map((name) => [name, new Map()]));
  return {
    async get(store, key) {
      return structuredClone(data[store].get(key));
    },
    async put(store, value) {
      data[store].set(value[STORES[store].keyPath], structuredClone(value));
      return value;
    },
    async delete(store, key) {
      data[store].delete(key);
    },
    async getAll(store) {
      return [...data[store].values()].map((v) => structuredClone(v));
    },
    async clear(store) {
      data[store].clear();
    },
  };
}

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const [name, options] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, options);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

async function backend() {
  if (memory) return memory;
  if (typeof indexedDB === 'undefined') {
    memory = createMemoryBackend();
    return memory;
  }
  if (!dbPromise) {
    dbPromise = openDatabase().catch((err) => {
      console.warn('IndexedDB unavailable, using in-memory storage.', err);
      memory = createMemoryBackend();
      return null;
    });
  }
  const db = await dbPromise;
  if (!db) return memory;
  const run = async (store, mode, fn) => {
    const tx = db.transaction(store, mode);
    const result = await promisify(fn(tx.objectStore(store)));
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return result;
  };
  return {
    get: (store, key) => run(store, 'readonly', (s) => s.get(key)),
    put: async (store, value) => {
      await run(store, 'readwrite', (s) => s.put(value));
      return value;
    },
    delete: (store, key) => run(store, 'readwrite', (s) => s.delete(key)),
    getAll: (store) => run(store, 'readonly', (s) => s.getAll()),
    clear: (store) => run(store, 'readwrite', (s) => s.clear()),
  };
}

export async function dbGet(store, key) {
  return (await backend()).get(store, key);
}
export async function dbPut(store, value) {
  return (await backend()).put(store, value);
}
export async function dbDelete(store, key) {
  return (await backend()).delete(store, key);
}
export async function dbGetAll(store) {
  return (await backend()).getAll(store);
}
export async function dbClear(store) {
  return (await backend()).clear(store);
}

export async function clearAllStores() {
  for (const name of Object.keys(STORES)) await dbClear(name);
}

/** Test helper: drop cached connections so each test starts clean. */
export async function resetDatabaseForTests() {
  if (dbPromise) {
    const db = await dbPromise;
    db?.close();
  }
  dbPromise = null;
  memory = null;
  if (typeof indexedDB !== 'undefined') {
    await new Promise((resolve) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = req.onerror = req.onblocked = () => resolve();
    });
  }
}
