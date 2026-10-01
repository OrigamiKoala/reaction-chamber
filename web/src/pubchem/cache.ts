// IndexedDB Cache for PubChem imports and bench states
const DB_NAME = 'ReactionChamberDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;
let dbInstance: IDBDatabase | null = null;

// In-memory fallback caches if IndexedDB fails, is blocked, or closes
const memoryCompoundCache = new Map<string, any>();
const memoryUserOverrides = new Map<string, Record<string, any>>();
let memoryBenchState: any = null;

function resetDB() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch (_) {}
  }
  dbInstance = null;
  dbPromise = null;
}

function getDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB not available'));
  }
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('compounds')) {
          db.createObjectStore('compounds', { keyPath: 'inchi_key' });
        }
        if (!db.objectStoreNames.contains('bench_state')) {
          db.createObjectStore('bench_state', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('user_overrides')) {
          db.createObjectStore('user_overrides', { keyPath: 'inchi_key' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        dbInstance = db;

        db.onclose = () => {
          resetDB();
        };

        db.onversionchange = () => {
          resetDB();
        };

        resolve(db);
      };

      request.onerror = () => {
        const err = request.error || new Error('Failed to open IndexedDB');
        resetDB();
        reject(err);
      };

      request.onblocked = () => {
        console.warn('[IndexedDB] Database open blocked by another connection');
      };
    } catch (err) {
      resetDB();
      reject(err);
    }
  });

  return dbPromise;
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, tx: IDBTransaction) => Promise<T> | T,
  retried = false
): Promise<T> {
  const db = await getDB();

  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(storeName, mode);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (!retried && (msg.includes('closing') || msg.includes('closed') || err?.name === 'InvalidStateError')) {
        console.warn('[IndexedDB] Connection closing or invalid state. Reopening and retrying transaction...');
        resetDB();
        return resolve(withStore(storeName, mode, operation, true));
      }
      return reject(err);
    }

    const store = tx.objectStore(storeName);
    let result: any;

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => {
      const err = tx.error || new Error('IndexedDB transaction error');
      reject(err);
    };
    tx.onabort = () => {
      const err = tx.error || new Error('IndexedDB transaction aborted');
      reject(err);
    };

    try {
      const opResult = operation(store, tx);
      if (opResult && typeof (opResult as any).then === 'function') {
        (opResult as Promise<any>)
          .then((val) => {
            result = val;
          })
          .catch((err) => {
            try {
              tx.abort();
            } catch (_) {}
            reject(err);
          });
      } else {
        result = opResult;
      }
    } catch (err) {
      try {
        tx.abort();
      } catch (_) {}
      reject(err);
    }
  });
}

export async function cacheCompound(compound: any): Promise<void> {
  if (!compound || !compound.inchi_key) return;
  memoryCompoundCache.set(compound.inchi_key, compound);

  try {
    await withStore('compounds', 'readwrite', (store) => {
      store.put(compound);
    });
  } catch (err) {
    console.warn('[IndexedDB] Failed to cache compound in IndexedDB (using memory cache):', err);
  }
}

export async function getCachedCompound(inchiKey: string): Promise<any | null> {
  if (!inchiKey) return null;
  if (memoryCompoundCache.has(inchiKey)) {
    return memoryCompoundCache.get(inchiKey);
  }

  try {
    const record = await withStore('compounds', 'readonly', (store) => {
      return new Promise<any>((resolve, reject) => {
        const req = store.get(inchiKey);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    });
    if (record) {
      memoryCompoundCache.set(inchiKey, record);
    }
    return record;
  } catch (err) {
    console.warn('[IndexedDB] Failed to get cached compound from IndexedDB:', err);
    return memoryCompoundCache.get(inchiKey) || null;
  }
}

export async function saveUserOverride(inchiKey: string, overrides: Record<string, any>): Promise<void> {
  if (!inchiKey) return;
  memoryUserOverrides.set(inchiKey, overrides);

  try {
    await withStore('user_overrides', 'readwrite', (store) => {
      store.put({ inchi_key: inchiKey, overrides, updatedAt: Date.now() });
    });
  } catch (err) {
    console.warn('[IndexedDB] Failed to save user overrides in IndexedDB:', err);
  }
}

export async function getUserOverrides(inchiKey: string): Promise<Record<string, any> | null> {
  if (!inchiKey) return null;
  if (memoryUserOverrides.has(inchiKey)) {
    return memoryUserOverrides.get(inchiKey) || null;
  }

  try {
    const record = await withStore('user_overrides', 'readonly', (store) => {
      return new Promise<any>((resolve, reject) => {
        const req = store.get(inchiKey);
        req.onsuccess = () => resolve(req.result ? req.result.overrides : null);
        req.onerror = () => reject(req.error);
      });
    });
    if (record) {
      memoryUserOverrides.set(inchiKey, record);
    }
    return record;
  } catch (err) {
    console.warn('[IndexedDB] Failed to get user overrides from IndexedDB:', err);
    return memoryUserOverrides.get(inchiKey) || null;
  }
}

export async function saveBenchState(state: any): Promise<void> {
  memoryBenchState = state;
  try {
    await withStore('bench_state', 'readwrite', (store) => {
      store.put({ id: 'current_bench', state, savedAt: Date.now() });
    });
  } catch (err) {
    console.warn('[IndexedDB] Failed to save bench state to IndexedDB:', err);
  }
}

export async function loadBenchState(): Promise<any | null> {
  try {
    const state = await withStore('bench_state', 'readonly', (store) => {
      return new Promise<any>((resolve, reject) => {
        const req = store.get('current_bench');
        req.onsuccess = () => resolve(req.result ? req.result.state : null);
        req.onerror = () => reject(req.error);
      });
    });
    if (state) memoryBenchState = state;
    return state || memoryBenchState;
  } catch (err) {
    console.warn('[IndexedDB] Failed to load bench state from IndexedDB:', err);
    return memoryBenchState;
  }
}
