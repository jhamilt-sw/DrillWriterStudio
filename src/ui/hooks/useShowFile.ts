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

import { useCallback, useRef, useState } from 'react';

import { ShowFileError } from '../../core/schema.ts';
import type { FileHandleLike } from '../../io/fileSystem.ts';
import { openShow, saveShow, saveShowAs } from '../../io/showFile.ts';
import { useShowStore } from '../../state/showStore.ts';

/**
 * File operations, plus the handle of whatever file the show came from so a
 * second Save writes straight back to it rather than asking again (FR-6.3).
 */
export function useShowFile() {
  const handleRef = useRef<FileHandleLike | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markSaved = useShowStore((state) => state.markSaved);
  const replaceShow = useShowStore((state) => state.replaceShow);

  const save = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const show = useShowStore.getState().show;
      const outcome = await saveShow(show, handleRef.current);
      if (outcome.saved) {
        handleRef.current = outcome.handle;
        if (outcome.handle) setFileName(outcome.handle.name);
        markSaved();
      }
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setBusy(false);
    }
  }, [markSaved]);

  const saveAs = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const outcome = await saveShowAs(useShowStore.getState().show);
      if (outcome.saved) {
        handleRef.current = outcome.handle;
        if (outcome.handle) setFileName(outcome.handle.name);
        markSaved();
      }
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setBusy(false);
    }
  }, [markSaved]);

  const open = useCallback(async () => {
    if (!confirmDiscard()) return;
    setBusy(true);
    setError(null);
    try {
      const outcome = await openShow();
      if (!outcome) return;
      replaceShow(outcome.show, { markSaved: true });
      handleRef.current = outcome.handle;
      setFileName(outcome.fileName);
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setBusy(false);
    }
  }, [replaceShow]);

  const startNew = useCallback(() => {
    if (!confirmDiscard()) return;
    useShowStore.getState().newShow();
    handleRef.current = null;
    setFileName(null);
    setError(null);
  }, []);

  return {
    save,
    saveAs,
    open,
    startNew,
    fileName,
    busy,
    error,
    clearError: () => setError(null),
    hasHandle: handleRef.current !== null,
  };
}

function describe(cause: unknown): string {
  if (cause instanceof ShowFileError) return cause.message;
  if (cause instanceof Error) return cause.message;
  return 'Something went wrong with that file.';
}

function confirmDiscard(): boolean {
  if (!useShowStore.getState().dirty) return true;
  return window.confirm('This show has unsaved changes. Discard them?');
}
