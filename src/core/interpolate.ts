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
 * Movement between sets (FR-1.5, FR-1.8).
 *
 * The model stores only the endpoints of each move. Everything in between —
 * the path drawn on the canvas, the ghosted preview while scrubbing, the
 * step-size analysis a designer uses to judge whether a move is marchable — is
 * derived here.
 */

import type { DrillPoint, Show, TransitionOverride } from './types.ts';
import { resolvePosition } from './show.ts';
import { stepsToFeet, type FieldMetrics } from './field.ts';

export interface Segment {
  performerId: string;
  from: DrillPoint;
  to: DrillPoint;
  counts: number;
  style: 'straight' | 'curve';
  control?: DrillPoint;
  holdCounts: number;
}

/** Distance between two points, in steps. */
export function distanceSteps(a: DrillPoint, b: DrillPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Linear interpolation between two points. */
export function lerpPoint(a: DrillPoint, b: DrillPoint, t: number): DrillPoint {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Quadratic Bézier, used for curved transitions. */
export function quadraticPoint(
  a: DrillPoint,
  control: DrillPoint,
  b: DrillPoint,
  t: number,
): DrillPoint {
  const inv = 1 - t;
  return {
    x: inv * inv * a.x + 2 * inv * t * control.x + t * t * b.x,
    y: inv * inv * a.y + 2 * inv * t * control.y + t * t * b.y,
  };
}

/**
 * Position part-way through a segment.
 *
 * `t` is normalised over the *whole* segment including any hold, so a segment
 * with a 4-count hold out of 16 counts stays put until t = 0.25.
 */
export function pointAlongSegment(segment: Segment, t: number): DrillPoint {
  const clamped = Math.min(Math.max(t, 0), 1);
  const holdFraction =
    segment.counts > 0 ? Math.min(segment.holdCounts / segment.counts, 1) : 0;
  if (clamped <= holdFraction) return { ...segment.from };
  const moving =
    holdFraction >= 1 ? 1 : (clamped - holdFraction) / (1 - holdFraction);
  if (segment.style === 'curve' && segment.control) {
    return quadraticPoint(segment.from, segment.control, segment.to, moving);
  }
  return lerpPoint(segment.from, segment.to, moving);
}

/**
 * Build the segments a set of performers travel to arrive at `setIndex`.
 * Returns an empty list for set 0, which nobody moves into.
 */
export function segmentsIntoSet(show: Show, setIndex: number): Segment[] {
  if (setIndex <= 0 || setIndex >= show.sets.length) return [];
  const set = show.sets[setIndex];
  const segments: Segment[] = [];
  for (const performer of show.performers) {
    const from = resolvePosition(show, performer.id, setIndex - 1);
    const to = resolvePosition(show, performer.id, setIndex);
    if (!from || !to) continue;
    const override: TransitionOverride | undefined = set.transitions?.[performer.id];
    segments.push({
      performerId: performer.id,
      from,
      to,
      counts: Math.max(0, set.counts),
      style: override?.style ?? 'straight',
      control: override?.control,
      holdCounts: Math.max(0, Math.min(override?.holdCounts ?? 0, set.counts)),
    });
  }
  return segments;
}

/**
 * Every performer's position at a fractional point between two sets. `t` of 0
 * is the earlier set, 1 the later one.
 */
export function interpolatedPositions(
  show: Show,
  setIndex: number,
  t: number,
): Record<string, DrillPoint> {
  const out: Record<string, DrillPoint> = {};
  if (setIndex <= 0) {
    for (const performer of show.performers) {
      const point = resolvePosition(show, performer.id, 0);
      if (point) out[performer.id] = point;
    }
    return out;
  }
  for (const segment of segmentsIntoSet(show, setIndex)) {
    out[segment.performerId] = pointAlongSegment(segment, t);
  }
  return out;
}

/**
 * Which transition the show is in the middle of at a given count.
 *
 * `setIndex` is the set being moved *into* — the move currently happening, not
 * the one just finished. Every consumer of a playback frame must agree on this:
 * animating positions from one transition while drawing paths from another is
 * exactly the kind of mismatch that looks like a rendering glitch and is really
 * two copies of this walk disagreeing.
 */
export interface PlaybackFrame {
  /** The set being moved into. 0 when the show is parked on its opening set. */
  setIndex: number;
  /** Progress through that move, 0 at the previous set and 1 on arrival. */
  t: number;
}

export function frameAtCount(show: Show, count: number): PlaybackFrame {
  const clamped = Math.max(0, count);
  let elapsed = 0;
  for (let index = 1; index < show.sets.length; index += 1) {
    const counts = Math.max(0, show.sets[index].counts);
    if (clamped <= elapsed + counts || counts === 0) {
      return { setIndex: index, t: counts === 0 ? 1 : (clamped - elapsed) / counts };
    }
    elapsed += counts;
  }
  return { setIndex: Math.max(0, show.sets.length - 1), t: 1 };
}

/**
 * Positions at an arbitrary count offset from the top of the show — the thing
 * the timeline scrubber and music-synced playhead both need.
 */
export function positionsAtCount(show: Show, count: number): Record<string, DrillPoint> {
  const frame = frameAtCount(show, count);
  return interpolatedPositions(show, frame.setIndex, frame.t);
}

export interface StepSizeAnalysis {
  performerId: string;
  distanceSteps: number;
  counts: number;
  /** Steps travelled per count. 1.0 is the show's nominal step size. */
  stepsPerCount: number;
  /**
   * The equivalent "N-to-5" step size actually required, e.g. 5.6 means the
   * move demands 5.6-to-5 steps — bigger than an 8-to-5 stride.
   */
  effectiveStepsPerFiveYards: number;
  /** Inches per step the move requires. */
  inchesPerStep: number;
}

/**
 * How big a stride each move demands. A designer uses this to catch moves that
 * cannot physically be marched before a rehearsal does it for them.
 */
export function analyseSegment(
  segment: Segment,
  metrics: FieldMetrics,
): StepSizeAnalysis {
  const distance = distanceSteps(segment.from, segment.to);
  const movingCounts = Math.max(0, segment.counts - segment.holdCounts);
  const stepsPerCount = movingCounts > 0 ? distance / movingCounts : 0;
  const nominal = metrics.config.stepsPerFiveYards;
  const feetPerStepTaken = stepsToFeet(stepsPerCount, nominal);
  return {
    performerId: segment.performerId,
    distanceSteps: distance,
    counts: segment.counts,
    stepsPerCount,
    effectiveStepsPerFiveYards: stepsPerCount > 0 ? nominal / stepsPerCount : Infinity,
    inchesPerStep: feetPerStepTaken * 12,
  };
}

/**
 * Moves that ask for a stride outside a comfortable range. Defaults flag
 * anything larger than a 6-to-5 stride (30 inches), which is about where a
 * forward march stops being sustainable for most ensembles.
 */
export function findDemandingMoves(
  show: Show,
  setIndex: number,
  metrics: FieldMetrics,
  maxInchesPerStep = 30,
): StepSizeAnalysis[] {
  return segmentsIntoSet(show, setIndex)
    .map((segment) => analyseSegment(segment, metrics))
    .filter((analysis) => analysis.inchesPerStep > maxInchesPerStep)
    .sort((a, b) => b.inchesPerStep - a.inchesPerStep);
}
