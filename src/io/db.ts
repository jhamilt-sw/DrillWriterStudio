/*
 * DrillWriter Studio
 * Author: Jasper Hamilton
 * AI assistance: Portions of this code and its documentation were generated
 *   or refined using AI tools under human direction.
 * Attribution: Credit to the original author in derivative works is
 *   appreciated as a courtesy. It is not required by the license; see NOTICE.
 * Created: 2026-08-21  ·  Last modified: 2026-08-22
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * The one IndexedDB connection, and the one place that knows its schema.
 *
 * Two features store things locally — autosave snapshots and imported audio —
 * and IndexedDB gives a database a single version number and a single upgrade
 * moment. Two modules each calling `indexedDB.open` with their own version is
 * how you get one of them permanently failing to find its store on a machine
 * that opened the other first. So the stores are declared together here and
 * every feature asks this module for the handle.
 *
 * Everything stays on the machine (NFR-2); nothing here talks to a network.
 */

/*
 * Deliberately still 'drill-writer' after the rename to DrillWriter Studio.
 *
 * This string is the key to every autosave snapshot and every cached recording
 * already on a user's machine. Renaming it does not migrate that data — it
 * orphans it, silently, and the first symptom is somebody's recovered work not
 * being offered back after a crash.
 */
const DB_NAME = 'drill-writer';

/**
 * Bump this when adding a store, and add the store to `upgrade` below.
 * v1: autosave. v2: audio payloads and their metadata.
 */
const DB_VERSION = 2;

export const AUTOSAVE_STORE = 'autosave';
/** Payloads: one record per recording, `{ hash, bytes }` and nothing else. */
export const AUDIO_STORE = 'audio';
/**
 * Metadata: name, size, duration, last use — everything *except* the bytes.
 *
 * Split from the payloads on purpose. Listing the cache and deciding what to
 * evict needs sizes and timestamps, and IndexedDB has no way to read part of a
 * record: `getAll` on a combined store would pull every cached recording into
 * memory to answer "how much am I holding". Reading a small metadata store
 * costs nothing.
 */
export const AUDIO_META_STORE = 'audio-meta';

function upgrade(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(AUTOSAVE_STORE)) {
    const store = db.createObjectStore(AUTOSAVE_STORE, {
      keyPath: 'id',
      autoIncrement: true,
    });
    store.createIndex('savedAt', 'savedAt');
  }
  // Both keyed by content hash, so importing the same recording twice — or
  // opening two shows that use it — stores one copy.
  if (!db.objectStoreNames.contains(AUDIO_STORE)) {
    db.createObjectStore(AUDIO_STORE, { keyPath: 'hash' });
  }
  if (!db.objectStoreNames.contains(AUDIO_META_STORE)) {
    const store = db.createObjectStore(AUDIO_META_STORE, { keyPath: 'hash' });
    store.createIndex('usedAt', 'usedAt');
  }
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

/**
 * The database, or null where it is unavailable.
 *
 * Private windows and storage-blocking settings reject the open. Both autosave
 * and the audio cache are conveniences, so a null here degrades a feature
 * rather than breaking the app — every caller handles it.
 */
export function openDatabase(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => upgrade(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

/** Resolves when a transaction commits, rejects if it fails or aborts. */
export function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Promisify a request, since IndexedDB predates promises. */
export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
