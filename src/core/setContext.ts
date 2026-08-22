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
 * What set the show is on, what it just left, and what is coming — the reading
 * behind the 3D overlay.
 *
 * A drill designer watching a run-through wants the same three things a
 * director calls out: where we are, how far into the move, and what's next. The
 * arithmetic is small but easy to get half-right, and getting it half-right
 * produces an overlay that disagrees with the timeline, so it lives here with
 * tests rather than inside a render loop.
 */

import { frameAtCount } from './interpolate.ts';
import { countsAtSet } from './show.ts';
import type { DrillSet, Show } from './types.ts';

export interface SetSummary {
  index: number;
  /** The label a designer wrote, e.g. "12" or "12A". */
  label: string;
  /** Counts spent moving *into* this set. */
  counts: number;
  /** Count at the top of the show when this set is reached. */
  countAtArrival: number;
  measure: number | null;
  beat: number | null;
  notes: string | null;
}

export interface SetContext {
  previous: SetSummary | null;
  /**
   * The set being moved into — the one the ensemble is heading for, which is
   * what "current" means during a run. Parked at the top of the show, it is the
   * opening set.
   */
  current: SetSummary;
  next: SetSummary | null;
  /** Counts elapsed within the current move, rounded down to a whole count. */
  countsIn: number;
  /** Counts left before arrival, rounded up so "1" means one more count. */
  countsRemaining: number;
  /** Progress through the current move, 0 to 1. */
  progress: number;
  /** True once the ensemble has arrived and is not yet moving again. */
  arrived: boolean;
}

function summarise(show: Show, index: number): SetSummary | null {
  const set: DrillSet | undefined = show.sets[index];
  if (!set) return null;
  return {
    index,
    label: set.label,
    counts: Math.max(0, set.counts),
    countAtArrival: countsAtSet(show, index),
    measure: set.music?.measure ?? null,
    beat: set.music?.beat ?? null,
    notes: set.notes ?? null,
  };
}

/**
 * Read the show at a playhead position.
 *
 * `previous` and `next` are null at the ends rather than clamped to the same
 * set twice — an overlay that shows "Set 1 → Set 1 → Set 2" reads as a bug, and
 * a null says plainly "nothing before this".
 */
export function setContextAtCount(show: Show, count: number): SetContext {
  const frame = frameAtCount(show, count);
  const current = summarise(show, frame.setIndex) ?? {
    index: 0,
    label: '1',
    counts: 0,
    countAtArrival: 0,
    measure: null,
    beat: null,
    notes: null,
  };
  const progress = Math.min(1, Math.max(0, frame.t));
  const elapsed = current.counts * progress;
  return {
    previous: summarise(show, frame.setIndex - 1),
    current,
    next: summarise(show, frame.setIndex + 1),
    countsIn: Math.min(current.counts, Math.floor(elapsed + 1e-9)),
    // Ceil, so a fraction of a count left still reads as one count to go and
    // "0 to go" only ever means arrived.
    countsRemaining: Math.max(0, Math.ceil(current.counts - elapsed - 1e-9)),
    progress,
    arrived: progress >= 1,
  };
}

/** `m. 12 b. 3`, or null when a set is not pinned to the music. */
export function describeMusicPosition(summary: SetSummary): string | null {
  if (summary.measure === null) return null;
  return `m. ${summary.measure}${summary.beat !== null ? ` b. ${summary.beat}` : ''}`;
}
