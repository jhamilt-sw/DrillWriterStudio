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
 * A local cache of imported audio, so a recording survives a refresh.
 *
 * The show file stores a *reference* to a recording — name, duration, content
 * hash — not the bytes, because a three-minute MP3 would quadruple the size of
 * every save and every autosave snapshot. That reference is enough to find the
 * file again here, which means reopening a show on the same machine restores
 * its music without the user hunting for the file a second time.
 *
 * Keyed by content hash, so the same recording used by three shows is stored
 * once and a re-import of a file already held costs nothing. Metadata lives in
 * its own store (see `db.ts`) so listing and eviction never have to load the
 * payloads they are measuring.
 *
 * Never leaves the browser (NFR-2).
 */

import {
  AUDIO_META_STORE,
  AUDIO_STORE,
  openDatabase,
  requestResult,
  transactionDone,
} from './db.ts';

/** How much audio to keep before evicting the least recently used. */
const CACHE_BUDGET_BYTES = 240 * 1024 * 1024;

/** What the cache knows about a recording without touching its bytes. */
export interface AudioMeta {
  hash: string;
  fileName: string;
  mimeType: string;
  durationSeconds: number;
  byteLength: number;
  /** Last time a show asked for this recording — drives eviction. */
  usedAt: number;
}

export interface CachedAudio extends AudioMeta {
  bytes: ArrayBuffer;
}

/**
 * Put a recording in the cache.
 *
 * Returns false when storage is unavailable or full. That is not an error the
 * user needs to see — it means they get the "re-import" prompt next time
 * instead of a silent restore, which the UI already explains.
 */
export async function putAudio(entry: {
  hash: string;
  fileName: string;
  mimeType: string;
  durationSeconds: number;
  bytes: ArrayBuffer;
}): Promise<boolean> {
  const db = await openDatabase();
  if (!db) return false;
  try {
    const tx = db.transaction([AUDIO_STORE, AUDIO_META_STORE], 'readwrite');
    tx.objectStore(AUDIO_STORE).put({ hash: entry.hash, bytes: entry.bytes });
    tx.objectStore(AUDIO_META_STORE).put({
      hash: entry.hash,
      fileName: entry.fileName,
      mimeType: entry.mimeType,
      durationSeconds: entry.durationSeconds,
      byteLength: entry.bytes.byteLength,
      usedAt: Date.now(),
    } satisfies AudioMeta);
    await transactionDone(tx);
    // Eviction runs separately: a full cache must not fail the write that just
    // succeeded.
    void evictBeyondBudget();
    return true;
  } catch {
    // QuotaExceededError lands here. Losing the cache is survivable.
    return false;
  }
}

/**
 * Fetch a recording by hash, marking it used so eviction takes the recordings
 * nobody opens rather than the one show someone works on daily.
 */
export async function getAudio(hash: string): Promise<CachedAudio | null> {
  const db = await openDatabase();
  if (!db) return null;
  try {
    const tx = db.transaction([AUDIO_STORE, AUDIO_META_STORE], 'readonly');
    const [payload, meta] = await Promise.all([
      requestResult<{ hash: string; bytes: ArrayBuffer } | undefined>(
        tx.objectStore(AUDIO_STORE).get(hash),
      ),
      requestResult<AudioMeta | undefined>(tx.objectStore(AUDIO_META_STORE).get(hash)),
    ]);
    if (!payload || !meta) return null;
    void touch(hash);
    return { ...meta, bytes: payload.bytes };
  } catch {
    return null;
  }
}

async function touch(hash: string): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  try {
    const tx = db.transaction(AUDIO_META_STORE, 'readwrite');
    const store = tx.objectStore(AUDIO_META_STORE);
    const meta = await requestResult<AudioMeta | undefined>(store.get(hash));
    if (meta) store.put({ ...meta, usedAt: Date.now() });
    await transactionDone(tx);
  } catch {
    // Best effort: a stale timestamp only affects eviction order.
  }
}

/** What the cache holds, most recently used first. Never reads a payload. */
export async function listAudio(): Promise<AudioMeta[]> {
  const db = await openDatabase();
  if (!db) return [];
  try {
    const tx = db.transaction(AUDIO_META_STORE, 'readonly');
    const all = await requestResult<AudioMeta[]>(tx.objectStore(AUDIO_META_STORE).getAll());
    return all.sort((a, b) => b.usedAt - a.usedAt);
  } catch {
    return [];
  }
}

/** Total bytes held, for showing the user what the cache is costing them. */
export async function cachedBytes(): Promise<number> {
  const entries = await listAudio();
  return entries.reduce((sum, entry) => sum + entry.byteLength, 0);
}

export async function removeAudio(hash: string): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  try {
    const tx = db.transaction([AUDIO_STORE, AUDIO_META_STORE], 'readwrite');
    tx.objectStore(AUDIO_STORE).delete(hash);
    tx.objectStore(AUDIO_META_STORE).delete(hash);
    await transactionDone(tx);
  } catch {
    // Nothing to do.
  }
}

export async function clearAudio(): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  try {
    const tx = db.transaction([AUDIO_STORE, AUDIO_META_STORE], 'readwrite');
    tx.objectStore(AUDIO_STORE).clear();
    tx.objectStore(AUDIO_META_STORE).clear();
    await transactionDone(tx);
  } catch {
    // Nothing to do.
  }
}

/**
 * Drop least-recently-used recordings until the cache fits the budget.
 *
 * Without this the cache grows with every recording ever imported and
 * eventually trips the browser's storage quota — which would take autosave
 * down with it, since they share a database.
 */
async function evictBeyondBudget(): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  try {
    const entries = await listAudio();
    let total = entries.reduce((sum, entry) => sum + entry.byteLength, 0);
    if (total <= CACHE_BUDGET_BYTES) return;
    const stale = [...entries].sort((a, b) => a.usedAt - b.usedAt);
    const tx = db.transaction([AUDIO_STORE, AUDIO_META_STORE], 'readwrite');
    const payloads = tx.objectStore(AUDIO_STORE);
    const meta = tx.objectStore(AUDIO_META_STORE);
    for (const entry of stale) {
      if (total <= CACHE_BUDGET_BYTES) break;
      payloads.delete(entry.hash);
      meta.delete(entry.hash);
      total -= entry.byteLength;
    }
    await transactionDone(tx);
  } catch {
    // Best effort.
  }
}
