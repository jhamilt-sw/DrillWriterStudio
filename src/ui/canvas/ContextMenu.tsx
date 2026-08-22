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

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { AlignGroup } from '../alignment/useAlignmentActions.ts';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface ContextMenuProps {
  position: ContextMenuPosition;
  groups: AlignGroup[];
  selectedCount: number;
  placedCount: number;
  onClose: () => void;
}

const MARGIN = 8;

/**
 * The right-click menu over the field.
 *
 * Positioned against the viewport and flipped when it would run off an edge, so
 * a right-click near the bottom of the window still shows the whole menu.
 * Arrow keys walk it and Escape closes it — the same commands are also in the
 * Align panel, so nothing here is reachable only by mouse.
 */
export function ContextMenu({
  position,
  groups,
  selectedCount,
  placedCount,
  onClose,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<ContextMenuPosition>(position);

  useLayoutEffect(() => {
    const node = menuRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - MARGIN;
    const maxY = window.innerHeight - rect.height - MARGIN;
    setPlacement({
      x: Math.max(MARGIN, Math.min(position.x, maxX)),
      y: Math.max(MARGIN, Math.min(position.y, maxY)),
    });
  }, [position]);

  // Focus the first enabled item so the keyboard can take over immediately.
  useEffect(() => {
    const first = menuRef.current?.querySelector<HTMLButtonElement>(
      'button:not([disabled])',
    );
    first?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>(
          'button:not([disabled])',
        ) ?? [],
      );
      if (items.length === 0) return;
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const next =
        event.key === 'ArrowDown'
          ? items[(index + 1 + items.length) % items.length]
          : items[(index - 1 + items.length) % items.length];
      next?.focus();
    };
    // Capture, so the editor's global shortcuts do not also act on these keys.
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    // Defer by a frame so the pointerup that opened the menu does not close it.
    const timer = window.setTimeout(() => {
      window.addEventListener('pointerdown', onPointerDown);
    }, 0);
    window.addEventListener('blur', onClose);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  const unplaced = selectedCount - placedCount;

  return (
    <div
      ref={menuRef}
      className="context-menu"
      role="menu"
      aria-label="Align selection"
      style={{ left: placement.x, top: placement.y }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="context-menu__header">
        {placedCount} performer{placedCount === 1 ? '' : 's'} selected
        {unplaced > 0 && (
          <span className="context-menu__note">
            {unplaced} not on the field — alignment skips them
          </span>
        )}
      </div>

      {placedCount === 0 ? (
        <div className="context-menu__empty">
          Nothing to align. Select performers who are on the field in this set.
        </div>
      ) : (
        groups.map((group) => (
          <div className="context-menu__group" key={group.id}>
            <div className="context-menu__group-label">{group.label}</div>
            {group.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                role="menuitem"
                className="context-menu__item"
                disabled={action.disabled}
                title={action.hint}
                onClick={() => {
                  action.run();
                  onClose();
                }}
              >
                <span>{action.label}</span>
                {action.hint && (
                  <span className="context-menu__hint">{action.hint}</span>
                )}
              </button>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
