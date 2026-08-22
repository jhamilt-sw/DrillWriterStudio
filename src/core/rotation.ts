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
 * Angles for the on-canvas rotation handle.
 *
 * One increment does the work: the drag rounds to `stepDegrees`, which defaults
 * to **1°** and is a setting. A second, coarser step is available while the
 * modifier is held, for the common case of wanting a clean 5° or 15° without
 * aiming for it.
 *
 * This is the reverse of the obvious arrangement, and deliberately so. Snapping
 * hard by default and requiring a held key for precision means the precise
 * angle — the one a designer actually asked for — is the one that needs a
 * second hand and a discoverable modifier. Precision is the default; coarse
 * snapping is the shortcut.
 */

import type { DrillPoint } from './types.ts';

export interface RotationSettings {
  /** Step the drag rounds to normally. 0 means continuous. */
  stepDegrees: number;
  /** Step used while the coarse modifier (Shift) is held. 0 means continuous. */
  coarseStepDegrees: number;
}

export const DEFAULT_ROTATION: RotationSettings = {
  stepDegrees: 1,
  coarseStepDegrees: 5,
};

/** Largest increment worth offering — past a quarter turn a step isn't a step. */
export const MAX_ROTATION_STEP = 90;

/**
 * Clean a step a user typed.
 *
 * Anything unusable becomes 0, which the rest of the module reads as "don't
 * snap" — a blanked-out field should give continuous rotation, not silently
 * pin the form to 0°.
 */
export function normaliseStep(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(MAX_ROTATION_STEP, Math.round(value * 100) / 100);
}

/** Wrap any angle into 0–360. */
export function normaliseDegrees(degrees: number): number {
  const wrapped = degrees % 360;
  // `+ 0` collapses negative zero, which is not strictly equal to zero and
  // would leak "-0°" into readouts and comparisons.
  return (wrapped < 0 ? wrapped + 360 : wrapped) + 0;
}

/**
 * Round an angle to a step.
 *
 * A step of zero means "no snapping" and passes the angle through, so a user
 * who clears the setting gets continuous rotation rather than everything
 * collapsing to 0°.
 */
export function snapDegrees(degrees: number, stepDegrees: number): number {
  if (!Number.isFinite(stepDegrees) || stepDegrees <= 0) return normaliseDegrees(degrees);
  const snapped = Math.round(degrees / stepDegrees) * stepDegrees;
  // Kill float dust so 45.000000000000004 does not reach the UI.
  return normaliseDegrees(Math.round(snapped * 1e6) / 1e6);
}

/** Which step applies, given whether the coarse modifier is held. */
export function stepFor(settings: RotationSettings, coarse: boolean): number {
  return normaliseStep(coarse ? settings.coarseStepDegrees : settings.stepDegrees);
}

/**
 * The angle from a centre to a point, in degrees clockwise from straight up on
 * screen.
 *
 * Screen-up is +y in drill units, so "up" is `atan2(dx, dy)` rather than the
 * usual `atan2(dy, dx)` — the same orientation the shape library uses, so a
 * handle at the top of a selection reads as 0°.
 */
export function angleFromCenter(center: DrillPoint, point: DrillPoint): number {
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  if (dx === 0 && dy === 0) return 0;
  return normaliseDegrees((Math.atan2(dx, dy) * 180) / Math.PI);
}

/**
 * How far to turn, given where a rotation drag started and where it is now.
 *
 * Returned as a delta rather than an absolute angle so the caller can apply it
 * to the positions the drag started from — rotating from the original each
 * frame, rather than compounding rounding errors on every move.
 */
export function rotationDelta(
  center: DrillPoint,
  startPoint: DrillPoint,
  currentPoint: DrillPoint,
  stepDegrees: number,
): number {
  const from = angleFromCenter(center, startPoint);
  const to = angleFromCenter(center, currentPoint);
  const raw = to - from;
  // Take the short way round, so dragging past 0° does not spin the form 359°.
  const shortest = ((raw + 180) % 360) - 180;
  const wrapped = shortest < -180 ? shortest + 360 : shortest;
  if (!Number.isFinite(stepDegrees) || stepDegrees <= 0) return wrapped;
  const snapped = Math.round(wrapped / stepDegrees) * stepDegrees;
  return Math.round(snapped * 1e6) / 1e6;
}

/** A signed angle formatted for a readout: `+45°`, `-15°`, `0°`. */
export function formatDelta(degrees: number): string {
  const rounded = Math.round(degrees * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${rounded > 0 ? '+' : ''}${text}°`;
}

/** Where the on-canvas rotation handle sits, in drill units. */
export interface RotationRig {
  /** The point the selection turns about. */
  center: DrillPoint;
  /** Where the grip is drawn. */
  handle: DrillPoint;
  /** Distance from centre to grip — also the radius of the guide ring. */
  reach: number;
}

/** Clearance between the edge of a form and its rotation grip, in steps. */
const HANDLE_CLEARANCE_STEPS = 4;
/** Minimum half-extent, so a single performer's grip is not on top of them. */
const MIN_HALF_SPREAD_STEPS = 3;

/**
 * Place the rotation rig for a set of selected positions.
 *
 * Pure, and therefore testable: the failure this guards against is a handle
 * drawn inside the form it is meant to turn, where it is neither visible nor
 * grabbable. `null` for an empty selection means "draw nothing".
 *
 * The handle goes at +y from the centre, which is *up* the screen — drill y
 * grows from the front sideline and the front sideline is drawn at the bottom.
 */
export function rotationRigFor(points: DrillPoint[]): RotationRig | null {
  if (points.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let sumX = 0;
  let sumY = 0;
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
    sumX += point.x;
    sumY += point.y;
  }

  const center = { x: sumX / points.length, y: sumY / points.length };
  // Measure the reach from the *centre* to the furthest edge, not from half the
  // overall spread: a lopsided selection pulls its centroid off-centre, and
  // half-the-spread would then put the grip inside the form on the long side.
  const halfSpread = Math.max(
    maxX - center.x,
    center.x - minX,
    maxY - center.y,
    center.y - minY,
    MIN_HALF_SPREAD_STEPS,
  );
  const reach = halfSpread + HANDLE_CLEARANCE_STEPS;
  return { center, handle: { x: center.x, y: center.y + reach }, reach };
}
