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
 * Autosave to IndexedDB (FR-6.4).
 *
 * Nothing here ever leaves the browser (NFR-2). The store keeps one "current"
 * snapshot plus a short rolling history, so a crash or an accidental tab close
 * costs at most the autosave interval, and a bad edit that was saved over can
 * still be recovered from a slightly older snapshot.
 *
 * The connection and the schema live in `db.ts` — audio shares this database.
 */

import type { Show } from '../core/types.ts';
import { parseShow } from '../core/schema.ts';
import { withoutEmbeddedAudio } from '../core/show.ts';
import { AUTOSAVE_STORE as STORE, openDatabase, transactionDone } from './db.ts';

const HISTORY_LIMIT = 10;

export interface AutosaveRecord {
  id: number;
  savedAt: number;
  title: string;
  show: unknown;
}

/** Write a snapshot, trimming the oldest entries past the history limit. */
export async function writeAutosave(show: Show): Promise<boolean> {
  const db = await openDatabase();
  if (!db) return false;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    store.add({
      savedAt: Date.now(),
      title: show.metadata.title,
      // Never snapshot an embedded recording: ten copies of a five-megabyte
      // track would blow the storage quota and take autosave down with it. The
      // bytes live in the audio cache and are restored from there by hash.
      show: withoutEmbeddedAudio(show),
    });
    // Trim from the front; the keys are auto-incrementing so lowest is oldest.
    const keysRequest = store.getAllKeys();
    keysRequest.onsuccess = () => {
      const keys = keysRequest.result;
      if (keys.length > HISTORY_LIMIT) {
        for (const key of keys.slice(0, keys.length - HISTORY_LIMIT)) {
          store.delete(key);
        }
      }
    };
    await transactionDone(tx);
    return true;
  } catch {
    return false;
  }
}

/** Every stored snapshot, newest first. */
export async function listAutosaves(): Promise<AutosaveRecord[]> {
  const db = await openDatabase();
  if (!db) return [];
  try {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).getAll();
    const records = await new Promise<AutosaveRecord[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as AutosaveRecord[]);
      request.onerror = () => reject(request.error);
    });
    return records.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

/** The most recent snapshot, parsed and validated, or null. */
export async function loadLatestAutosave(): Promise<{
  show: Show;
  savedAt: number;
} | null> {
  const [latest] = await listAutosaves();
  if (!latest) return null;
  try {
    return { show: parseShow(latest.show), savedAt: latest.savedAt };
  } catch {
    return null;
  }
}

export async function clearAutosaves(): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    await transactionDone(tx);
  } catch {
    // Nothing to do — the snapshot store is best-effort by design.
  }
}
