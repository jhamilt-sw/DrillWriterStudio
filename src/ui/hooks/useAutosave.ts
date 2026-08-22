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

import { useEffect, useRef, useState } from 'react';

import { loadLatestAutosave, writeAutosave } from '../../io/autosave.ts';
import type { Show } from '../../core/types.ts';
import { useShowStore } from '../../state/showStore.ts';

const INTERVAL_MS = 30_000;

export interface RecoveredShow {
  show: Show;
  savedAt: number;
}

/**
 * Periodic autosave to IndexedDB (FR-6.4), plus recovery of the last snapshot
 * when the app starts.
 *
 * A snapshot is only written when the show has actually changed, so an idle
 * editor does not fill the store with identical copies.
 */
export function useAutosave(): {
  recovered: RecoveredShow | null;
  dismissRecovery: () => void;
  lastAutosaveAt: number | null;
} {
  const [recovered, setRecovered] = useState<RecoveredShow | null>(null);
  const [lastAutosaveAt, setLastAutosaveAt] = useState<number | null>(null);
  const lastSavedShow = useRef<Show | null>(null);

  // Offer to restore whatever was in progress when the tab last closed, but
  // only if this session has not already been touched.
  useEffect(() => {
    let cancelled = false;
    void loadLatestAutosave().then((result) => {
      if (cancelled || !result) return;
      const state = useShowStore.getState();
      const isUntouched =
        state.past.length === 0 && !state.dirty && state.show.performers.length === 0;
      const worthRestoring =
        result.show.performers.length > 0 || result.show.sets.length > 1;
      if (isUntouched && worthRestoring) setRecovered(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const state = useShowStore.getState();
      if (!state.dirty) return;
      if (state.show === lastSavedShow.current) return;
      const snapshot = state.show;
      void writeAutosave(snapshot).then((ok) => {
        if (!ok) return;
        lastSavedShow.current = snapshot;
        setLastAutosaveAt(Date.now());
      });
    }, INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  // A last-chance save when the tab goes away. `visibilitychange` is the only
  // event that fires reliably on mobile; `beforeunload` covers desktop closes.
  useEffect(() => {
    const flush = () => {
      const state = useShowStore.getState();
      if (state.dirty && state.show !== lastSavedShow.current) {
        void writeAutosave(state.show);
      }
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      flush();
      if (useShowStore.getState().dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', flush);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, []);

  return {
    recovered,
    dismissRecovery: () => setRecovered(null),
    lastAutosaveAt,
  };
}
