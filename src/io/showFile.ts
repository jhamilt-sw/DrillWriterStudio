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
 * Saving and opening a show (FR-6.1, FR-6.2, FR-6.3).
 *
 * The file is plain JSON with a `.drillshow` extension — readable, diffable,
 * and versioned. Audio can either be embedded (self-contained file, larger) or
 * referenced by name (small file, needs re-linking on open); the choice is the
 * user's, and the header records which was used so opening can explain itself.
 */

import type { Show } from '../core/types.ts';
import { APP_NAME } from '../core/app.ts';
import {
  SHOW_FILE_EXTENSION,
  ShowFileError,
  deserialiseShow,
  serialiseShow,
  showFileBaseName,
} from '../core/schema.ts';
import {
  type FileHandleLike,
  downloadBlob,
  openFile,
  saveBlobAs,
  writeToHandle,
} from './fileSystem.ts';

const ACCEPT = { 'application/json': [SHOW_FILE_EXTENSION, '.json'] };
const DESCRIPTION = `${APP_NAME} show`;

export interface SaveOutcome {
  saved: boolean;
  handle: FileHandleLike | null;
}

function showBlob(show: Show): Blob {
  return new Blob([serialiseShow(show)], { type: 'application/json' });
}

export function suggestedFileName(show: Show): string {
  return `${showFileBaseName(show)}${SHOW_FILE_EXTENSION}`;
}

/** Save to a known handle, or fall back to Save As when there isn't one. */
export async function saveShow(
  show: Show,
  handle: FileHandleLike | null,
): Promise<SaveOutcome> {
  const blob = showBlob(show);
  if (handle) {
    const written = await writeToHandle(handle, blob);
    if (written) return { saved: true, handle };
  }
  return saveShowAs(show);
}

export async function saveShowAs(show: Show): Promise<SaveOutcome> {
  const result = await saveBlobAs(
    showBlob(show),
    suggestedFileName(show),
    ACCEPT,
    DESCRIPTION,
  );
  return { saved: result.saved, handle: result.handle };
}

/** Download a copy without touching the current file handle. */
export function downloadShow(show: Show): void {
  downloadBlob(showBlob(show), suggestedFileName(show));
}

export interface OpenOutcome {
  show: Show;
  handle: FileHandleLike | null;
  fileName: string;
}

export async function openShow(): Promise<OpenOutcome | null> {
  const picked = await openFile(ACCEPT, DESCRIPTION);
  if (!picked) return null;
  const text = await picked.file.text();
  return {
    show: deserialiseShow(text),
    handle: picked.handle,
    fileName: picked.file.name,
  };
}

/** Read a show from a dropped file, for drag-and-drop onto the canvas. */
export async function readShowFile(file: File): Promise<Show> {
  if (file.size > 200 * 1024 * 1024) {
    throw new ShowFileError('That file is too large to be a drill show.');
  }
  return deserialiseShow(await file.text());
}
