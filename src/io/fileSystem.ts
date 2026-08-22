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
 * File System Access API wrapper, with a download/upload fallback (FR-6.3).
 *
 * Chrome and Edge support real Save / Save As against a file on disk. Firefox
 * and Safari do not, so there the same calls fall back to a download for save
 * and a hidden file input for open. Callers do not need to know which happened
 * beyond the `handle` coming back null.
 *
 * The API's types are not in every TypeScript DOM lib yet, so the small surface
 * used here is declared locally rather than pulled in as a dependency.
 */

export interface FileSystemWritableStreamLike {
  write: (data: Blob | string) => Promise<void>;
  close: () => Promise<void>;
}

export interface FileHandleLike {
  readonly name: string;
  getFile: () => Promise<File>;
  createWritable: () => Promise<FileSystemWritableStreamLike>;
  queryPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<string>;
  requestPermission?: (descriptor: { mode: 'read' | 'readwrite' }) => Promise<string>;
}

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
  id?: string;
}

interface OpenFilePickerOptions {
  types?: FilePickerAcceptType[];
  multiple?: boolean;
  id?: string;
}

type PickerWindow = Window & {
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileHandleLike>;
  showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileHandleLike[]>;
};

/** True when the browser can save straight back to a file on disk. */
export function supportsFileSystemAccess(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as PickerWindow;
  return typeof w.showSaveFilePicker === 'function';
}

/** The user cancelled a picker — not an error worth surfacing. */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export interface SaveResult {
  handle: FileHandleLike | null;
  /** False when the user cancelled the picker. */
  saved: boolean;
}

/** Trigger a plain browser download. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke on the next frame so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Write to an existing handle. Returns false when permission was withdrawn, so
 * the caller can fall back to Save As.
 */
export async function writeToHandle(
  handle: FileHandleLike,
  blob: Blob,
): Promise<boolean> {
  if (handle.queryPermission) {
    const state = await handle.queryPermission({ mode: 'readwrite' });
    if (state !== 'granted') {
      const requested = await handle.requestPermission?.({ mode: 'readwrite' });
      if (requested !== 'granted') return false;
    }
  }
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
  return true;
}

/** Save As: picker where supported, download otherwise. */
export async function saveBlobAs(
  blob: Blob,
  suggestedName: string,
  accept: Record<string, string[]>,
  description: string,
): Promise<SaveResult> {
  const w = window as PickerWindow;
  if (w.showSaveFilePicker) {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName,
        types: [{ description, accept }],
      });
      const written = await writeToHandle(handle, blob);
      return { handle: written ? handle : null, saved: written };
    } catch (error) {
      if (isAbortError(error)) return { handle: null, saved: false };
      // Some environments (sandboxed iframes, older builds) reject for reasons
      // other than cancellation; a download still gets the file to the user.
      downloadBlob(blob, suggestedName);
      return { handle: null, saved: true };
    }
  }
  downloadBlob(blob, suggestedName);
  return { handle: null, saved: true };
}

export interface OpenResult {
  file: File;
  handle: FileHandleLike | null;
}

/** Open a file: picker where supported, hidden input otherwise. */
export async function openFile(
  accept: Record<string, string[]>,
  description: string,
): Promise<OpenResult | null> {
  const w = window as PickerWindow;
  if (w.showOpenFilePicker) {
    try {
      const [handle] = await w.showOpenFilePicker({
        types: [{ description, accept }],
        multiple: false,
      });
      if (!handle) return null;
      return { file: await handle.getFile(), handle };
    } catch (error) {
      if (isAbortError(error)) return null;
      // fall through to the input-element path
    }
  }
  const extensions = Object.values(accept).flat().join(',');
  const file = await pickFileWithInput(extensions);
  return file ? { file, handle: null } : null;
}

function pickFileWithInput(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    // `cancel` is not universally supported; the focus fallback catches the
    // rest so the promise never dangles.
    input.addEventListener('cancel', () => finish(null));
    window.addEventListener(
      'focus',
      () => setTimeout(() => finish(input.files?.[0] ?? null), 400),
      { once: true },
    );
    document.body.appendChild(input);
    input.click();
  });
}
