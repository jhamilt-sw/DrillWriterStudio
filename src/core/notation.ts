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
 * Turning a stored position into the written coordinate a marcher reads off a
 * coordinate sheet (FR-2.1).
 *
 * The wording follows the convention used across the marching activity:
 *
 *   Side 1: 2.0 steps inside 35 yd ln
 *   Side 2: On 45 yd ln
 *   12.0 steps behind Front side line
 *   2.5 steps in front of Back Hash
 *
 * "Inside" means toward the 50; "outside" means toward the nearer goal line.
 * "In front of" means toward the front sideline (where the audience sits).
 */

import type { DrillPoint, FieldSide } from './types.ts';
import {
  type FieldMetrics,
  type VerticalLandmarkName,
  type YardLine,
  FIELD_LENGTH_YARDS,
  nearestLandmark,
  stepsToYards,
  verticalLandmarks,
  yardLines,
} from './field.ts';

/** Positions closer than this to a landmark are reported as sitting "on" it. */
const ON_TOLERANCE_STEPS = 0.02;

export interface HorizontalCoordinate {
  side: FieldSide;
  /** Printed yard-line number the position is described against, 0–50. */
  yardLine: number;
  /** Steps away from that yard line. Always >= 0. */
  steps: number;
  direction: 'inside' | 'outside' | 'on';
  /**
   * True when the position sits on the 50 itself, where neither side applies.
   * `side` still carries a value so callers never have to handle a null, but
   * the written text drops the prefix.
   */
  onFiftyYardLine: boolean;
  text: string;
}

export interface VerticalCoordinate {
  reference: VerticalLandmarkName;
  steps: number;
  direction: 'in front of' | 'behind' | 'on';
  text: string;
}

export interface WrittenCoordinate {
  horizontal: HorizontalCoordinate;
  vertical: VerticalCoordinate;
  /** Both halves joined, as printed on a coordinate sheet row. */
  text: string;
}

export interface NotationOptions {
  /**
   * Rounding granularity in steps. Drill is conventionally written to the
   * quarter step; some designers prefer tenths.
   */
  precisionSteps?: number;
}

const DEFAULT_PRECISION = 0.25;

/** Round to the nearest multiple of `precision`, avoiding float fuzz. */
export function roundToPrecision(value: number, precision: number): number {
  if (precision <= 0) return value;
  const rounded = Math.round(value / precision) * precision;
  // Re-round to kill accumulated binary error (e.g. 4.250000000000001).
  return Math.round(rounded * 1e6) / 1e6;
}

/**
 * Format a step count the way coordinate sheets do: at least one decimal place,
 * more only when the value needs them.
 */
export function formatSteps(steps: number): string {
  const abs = Math.abs(steps);
  const twoPlaces = abs.toFixed(2);
  return twoPlaces.endsWith('0') ? abs.toFixed(1) : twoPlaces;
}

/** The five-yard line nearest a given x. */
export function nearestYardLine(x: number, metrics: FieldMetrics): YardLine {
  const lines = yardLines(metrics);
  let best = lines[0];
  let bestDistance = Math.abs(x - best.x);
  for (const line of lines) {
    const distance = Math.abs(x - line.x);
    if (distance < bestDistance) {
      best = line;
      bestDistance = distance;
    }
  }
  return best;
}

export function describeHorizontal(
  x: number,
  metrics: FieldMetrics,
  options: NotationOptions = {},
): HorizontalCoordinate {
  const precision = options.precisionSteps ?? DEFAULT_PRECISION;
  const line = nearestYardLine(x, metrics);
  const offset = roundToPrecision(x - line.x, precision);
  const steps = Math.abs(offset);

  // Which side of the field the marcher is standing on. A performer sitting
  // exactly on the 50 belongs to neither half, so fall back to the yard line's
  // own side; otherwise use the actual position, which matters for someone
  // just across the 50 from the line they're measured against.
  const side: FieldSide = x < metrics.fiftyX ? 1 : x > metrics.fiftyX ? 2 : line.side;

  let direction: HorizontalCoordinate['direction'];
  if (steps <= ON_TOLERANCE_STEPS) {
    direction = 'on';
  } else {
    // Moving toward the 50 is "inside". On Side 1 the 50 is to the right
    // (larger x); on Side 2 it is to the left (smaller x).
    const towardFifty = side === 1 ? offset > 0 : offset < 0;
    direction = towardFifty ? 'inside' : 'outside';
  }

  // A marcher standing on the 50 belongs to neither side, so the coordinate
  // reads "On 50 yd ln" with no side prefix — which is how it is called on the
  // field, and avoids arbitrarily assigning them to Side 2 by a rounding error.
  const onFiftyYardLine = direction === 'on' && line.number === 50;

  const sideLabel = `Side ${side}`;
  const text = onFiftyYardLine
    ? 'On 50 yd ln'
    : direction === 'on'
      ? `${sideLabel}: On ${line.number} yd ln`
      : `${sideLabel}: ${formatSteps(steps)} steps ${direction} ${line.number} yd ln`;

  return { side, yardLine: line.number, steps, direction, onFiftyYardLine, text };
}

export function describeVertical(
  y: number,
  metrics: FieldMetrics,
  options: NotationOptions = {},
): VerticalCoordinate {
  const precision = options.precisionSteps ?? DEFAULT_PRECISION;
  // The same landmark definitions the alignment tools snap to, so a performer
  // aligned to the front hash is guaranteed to read "On Front Hash".
  const best = nearestLandmark(y, verticalLandmarks(metrics));

  const offset = roundToPrecision(y - best.value, precision);
  const steps = Math.abs(offset);

  let direction: VerticalCoordinate['direction'];
  if (steps <= ON_TOLERANCE_STEPS) {
    direction = 'on';
  } else {
    // Larger y is further from the audience, i.e. "behind".
    direction = offset > 0 ? 'behind' : 'in front of';
  }

  const text =
    direction === 'on'
      ? `On ${best.label}`
      : `${formatSteps(steps)} steps ${direction} ${best.label}`;

  return { reference: best.label, steps, direction, text };
}

export function describePoint(
  point: DrillPoint,
  metrics: FieldMetrics,
  options: NotationOptions = {},
): WrittenCoordinate {
  const horizontal = describeHorizontal(point.x, metrics, options);
  const vertical = describeVertical(point.y, metrics, options);
  return { horizontal, vertical, text: `${horizontal.text} | ${vertical.text}` };
}

/**
 * A compact readout for the editor's status bar — the same information, on one
 * short line.
 */
export function describePointShort(point: DrillPoint, metrics: FieldMetrics): string {
  const { horizontal, vertical } = describePoint(point, metrics);
  const h = horizontal.onFiftyYardLine
    ? 'On 50'
    : horizontal.direction === 'on'
      ? `S${horizontal.side} ${horizontal.yardLine}`
      : `S${horizontal.side} ${formatSteps(horizontal.steps)} ${
          horizontal.direction === 'inside' ? 'in' : 'out'
        } ${horizontal.yardLine}`;
  const v =
    vertical.direction === 'on'
      ? `on ${vertical.reference}`
      : `${formatSteps(vertical.steps)} ${
          vertical.direction === 'behind' ? 'bhd' : 'ifo'
        } ${vertical.reference}`;
  return `${h} · ${v}`;
}

/** Yards from the Side 1 goal line — used by chart tooling and tests. */
export function pointYards(point: DrillPoint, metrics: FieldMetrics): number {
  return stepsToYards(point.x, metrics.config.stepsPerFiveYards);
}

/** Printed yard-line number for a distance from the Side 1 goal line. */
export function yardNumberFor(yardsFromSide1: number): number {
  return yardsFromSide1 <= 50 ? yardsFromSide1 : FIELD_LENGTH_YARDS - yardsFromSide1;
}
