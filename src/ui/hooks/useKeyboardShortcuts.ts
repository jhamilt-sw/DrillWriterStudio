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

import { useEffect, useRef } from 'react';

import { useShowStore } from '../../state/showStore.ts';
import { type NudgeDirection, nudgeDelta } from '../../core/transform.ts';

const ARROW_DIRECTIONS: Record<string, NudgeDirection | undefined> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
  );
}

export interface ShortcutHandlers {
  onSave: () => void;
  onOpen: () => void;
  onTogglePlay: () => void;
}

/**
 * Keyboard access to the core editing actions (NFR-3).
 *
 * Shortcuts are suppressed while the user is typing in a field, so editing a
 * set label never triggers a nudge or an undo.
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  // Handlers are read through a ref so the listener is attached once rather
  // than being torn down and rebuilt on every render.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const store = useShowStore.getState();
      const handlers = handlersRef.current;
      const accel = event.metaKey || event.ctrlKey;

      if (accel && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handlers.onSave();
        return;
      }
      if (accel && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        handlers.onOpen();
        return;
      }

      if (isTextEntry(event.target)) return;

      if (accel && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (accel && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        store.redo();
        return;
      }
      if (accel && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        store.selectAll();
        return;
      }
      if (accel && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        store.duplicateSet(store.currentSetIndex);
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown': {
          if (store.selectedPerformerIds.length === 0) {
            // With nothing selected, the arrows walk the show instead.
            if (event.key === 'ArrowLeft') store.goToSet(store.currentSetIndex - 1);
            if (event.key === 'ArrowRight') store.goToSet(store.currentSetIndex + 1);
            return;
          }
          event.preventDefault();
          const step = event.shiftKey ? 1 : store.view.snapSteps || 0.25;
          // nudgeDelta resolves screen direction against the same constant the
          // renderers use, so "up" is up on screen rather than up in drill y.
          const direction = ARROW_DIRECTIONS[event.key];
          if (!direction) return;
          const { dx, dy } = nudgeDelta(direction, step);
          store.nudgeSelection(dx, dy);
          return;
        }
        case 'Escape':
          store.clearSelection();
          return;
        case ' ':
          event.preventDefault();
          handlers.onTogglePlay();
          return;
        case 'Delete':
        case 'Backspace':
          if (store.selectedPerformerIds.length > 0) {
            event.preventDefault();
            store.clearPositionsAtSet(store.selectedPerformerIds);
          }
          return;
        case 'n':
        case 'N':
          store.addSet();
          return;
        case 'p':
          // Paths while editing.
          store.updatePathVisibility({ whileEditing: !store.view.paths.whileEditing });
          return;
        case 'P':
          // Shift+P: paths while the show is playing or being scrubbed.
          store.updatePathVisibility({ whilePlaying: !store.view.paths.whilePlaying });
          return;
        case 'g':
        case 'G':
          store.updateView({ showPreviousSet: !store.view.showPreviousSet });
          return;
        case 'l':
        case 'L':
          store.updateView({ showLabels: !store.view.showLabels });
          return;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
