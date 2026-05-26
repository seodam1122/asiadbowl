const DB_NAME = 'redsun-kiosk-media';
const STORE_NAME = 'media';
const DB_VERSION = 1;

export const LOCAL_MEDIA_PREFIX = 'local-media:';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = fn(store);

        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
        request.onsuccess = () => resolve(request.result as T);

        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      })
  );
}

export const localMediaStore = {
  async set(key: string, dataUrl: string): Promise<void> {
    await runTransaction('readwrite', (store) => store.put(dataUrl, key));
  },

  async get(key: string): Promise<string | null> {
    const value = await runTransaction<string | undefined>('readonly', (store) => store.get(key));
    return value ?? null;
  },

  async remove(key: string): Promise<void> {
    await runTransaction('readwrite', (store) => store.delete(key));
  },
};

export function isDataUrl(url: string): boolean {
  return url.startsWith('data:');
}

export function isLocalMediaRef(url: string): boolean {
  return url.startsWith(LOCAL_MEDIA_PREFIX);
}

export function localMediaKeyFromRef(ref: string): string {
  return ref.slice(LOCAL_MEDIA_PREFIX.length);
}

export function toLocalMediaRef(key: string): string {
  return `${LOCAL_MEDIA_PREFIX}${key}`;
}
