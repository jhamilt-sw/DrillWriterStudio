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
 * Whose movement paths are drawn, and when.
 *
 * Paths are indispensable while writing drill and actively harmful while
 * watching it: 250 lines over a moving field is noise, and the thing you are
 * trying to see — whether the form arrives clean — is the first thing they
 * hide. So editing and playback carry separate switches, and playback defaults
 * to off.
 *
 * When paths *are* wanted during playback it is almost never for everybody. It
 * is "show me the trumpets through this transition" or "follow these four".
 * Hence a scope, resolved here rather than in the renderer so the rule is one
 * pure function with tests rather than a condition buried in a component.
 */

import type { Performer } from './types.ts';

export type PathScope = 'all' | 'selected' | 'custom';

export interface PathVisibilitySettings {
  /** Draw paths while editing — the normal design view. */
  whileEditing: boolean;
  /** Draw paths while playing or scrubbing. Off by default, deliberately. */
  whilePlaying: boolean;
  /** Whose paths to draw, whenever paths are drawn at all. */
  scope: PathScope;
  /** Sections opted in under the 'custom' scope. */
  sectionIds: string[];
  /** Individual performers opted in under the 'custom' scope. */
  performerIds: string[];
}

export const DEFAULT_PATH_VISIBILITY: PathVisibilitySettings = {
  whileEditing: true,
  whilePlaying: false,
  scope: 'all',
  sectionIds: [],
  performerIds: [],
};

/**
 * Whether paths are drawn at all right now.
 *
 * `playing` covers scrubbing as well as playback: dragging the timeline is
 * watching the show, not editing it, and wants the same treatment.
 */
export function pathsEnabled(
  settings: PathVisibilitySettings,
  playing: boolean,
): boolean {
  return playing ? settings.whilePlaying : settings.whileEditing;
}

/**
 * The performers whose paths should be drawn, given the scope.
 *
 * Returns a set for O(1) lookup while rendering — this is consulted once per
 * performer per frame.
 */
export function visiblePathPerformers(
  performers: Performer[],
  settings: PathVisibilitySettings,
  selectedIds: readonly string[],
): Set<string> {
  switch (settings.scope) {
    case 'all':
      return new Set(performers.map((performer) => performer.id));

    case 'selected':
      // Intersected with the real roster so a stale selection cannot resurrect
      // a deleted performer's path.
      return new Set(
        performers
          .filter((performer) => selectedIds.includes(performer.id))
          .map((performer) => performer.id),
      );

    case 'custom': {
      const sections = new Set(settings.sectionIds);
      const explicit = new Set(settings.performerIds);
      return new Set(
        performers
          .filter(
            (performer) =>
              sections.has(performer.sectionId) || explicit.has(performer.id),
          )
          .map((performer) => performer.id),
      );
    }

    default:
      return new Set<string>();
  }
}

/** A short description of the current scope, for a status line or tooltip. */
export function describePathScope(
  settings: PathVisibilitySettings,
  visibleCount: number,
  totalCount: number,
): string {
  switch (settings.scope) {
    case 'all':
      return `all ${totalCount}`;
    case 'selected':
      return visibleCount === 0 ? 'selection (none selected)' : `${visibleCount} selected`;
    case 'custom':
      return `${visibleCount} chosen`;
    default:
      return 'none';
  }
}

/** Add or remove one id, returning a new array. */
export function toggleId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
}
