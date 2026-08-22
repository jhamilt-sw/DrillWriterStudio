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
 * Aligning a selection to the field's own landmarks.
 *
 * Drill design is full of "put this rank on the front hash" and "get that block
 * onto the 35". Doing it by dragging is fiddly and never lands exactly; doing it
 * here is exact by construction, and because the landmarks come from `field.ts`
 * the result is guaranteed to read as "On Front Hash" on the coordinate sheet
 * rather than "0.03 steps behind" it.
 *
 * Two distinct behaviours matter, and conflating them is the usual mistake:
 *
 *   * **snap each** — every performer moves independently to their own nearest
 *     landmark. Use it to clean a rank onto yard lines. It changes the shape.
 *   * **move group** — the whole selection translates as a rigid body until its
 *     anchor sits on one landmark. Use it to reposition a form. It preserves
 *     the shape exactly.
 *
 * Everything here is pure and works on plain points, so it is all testable
 * without a browser.
 */

import type { DrillPoint } from './types.ts';
import type { FieldLandmark } from './field.ts';
import { nearestLandmark } from './field.ts';
import { bounds, centroid } from './formations.ts';

/** Which part of the selection is placed onto the landmark. */
export type GroupAnchor = 'centre' | 'leading' | 'trailing';

/**
 * Move each point independently onto its nearest landmark.
 *
 * Only the landmarks' own axis is touched — snapping to yard lines never
 * changes anyone's front-to-back position, and vice versa.
 */
export function snapEachToLandmarks(
  points: DrillPoint[],
  landmarks: FieldLandmark[],
): DrillPoint[] {
  if (landmarks.length === 0) return points.map((point) => ({ ...point }));
  const axis = landmarks[0].axis;
  return points.map((point) => {
    const target = nearestLandmark(point[axis], landmarks);
    return axis === 'x'
      ? { x: target.value, y: point.y }
      : { x: point.x, y: target.value };
  });
}

/** The value that `anchor` refers to for a group of points on one axis. */
export function anchorValue(
  points: DrillPoint[],
  axis: 'x' | 'y',
  anchor: GroupAnchor,
): number {
  if (points.length === 0) return 0;
  if (anchor === 'centre') return centroid(points)[axis];
  const box = bounds(points);
  const min = axis === 'x' ? box.minX : box.minY;
  const max = axis === 'x' ? box.maxX : box.maxY;
  // "Leading" is the low-coordinate edge: Side 1 for x, the front sideline for
  // y — in both cases the edge a designer points at first.
  return anchor === 'leading' ? min : max;
}

/**
 * Translate the whole group so its anchor lands on `landmark`. The form is
 * preserved exactly: every point moves by the same delta.
 */
export function moveGroupToLandmark(
  points: DrillPoint[],
  landmark: FieldLandmark,
  anchor: GroupAnchor = 'centre',
): DrillPoint[] {
  if (points.length === 0) return [];
  const axis = landmark.axis;
  const delta = landmark.value - anchorValue(points, axis, anchor);
  return points.map((point) =>
    axis === 'x' ? { x: point.x + delta, y: point.y } : { x: point.x, y: point.y + delta },
  );
}

/** Translate the group onto whichever landmark its anchor is already nearest. */
export function moveGroupToNearestLandmark(
  points: DrillPoint[],
  landmarks: FieldLandmark[],
  anchor: GroupAnchor = 'centre',
): DrillPoint[] {
  if (points.length === 0 || landmarks.length === 0) {
    return points.map((point) => ({ ...point }));
  }
  const axis = landmarks[0].axis;
  const target = nearestLandmark(anchorValue(points, axis, anchor), landmarks);
  return moveGroupToLandmark(points, target, anchor);
}

/**
 * Which edge of the selection everyone lines up on.
 *
 * Named in field terms rather than screen terms: a designer says "dress the
 * rank to the front", not "align top".
 */
export type EdgeAlignment =
  | 'side1'
  | 'side2'
  | 'front'
  | 'back'
  | 'centreX'
  | 'centreY';

/**
 * Flatten the selection onto one of its own edges or centre lines — the
 * classic "dress the rank" operation. Unlike the landmark tools this does not
 * reference the field at all; it makes the selection agree with itself.
 */
export function alignToEdge(points: DrillPoint[], edge: EdgeAlignment): DrillPoint[] {
  if (points.length === 0) return [];
  const box = bounds(points);
  const middle = centroid(points);
  switch (edge) {
    case 'side1':
      return points.map((point) => ({ x: box.minX, y: point.y }));
    case 'side2':
      return points.map((point) => ({ x: box.maxX, y: point.y }));
    case 'front':
      return points.map((point) => ({ x: point.x, y: box.minY }));
    case 'back':
      return points.map((point) => ({ x: point.x, y: box.maxY }));
    case 'centreX':
      return points.map((point) => ({ x: middle.x, y: point.y }));
    case 'centreY':
      return points.map((point) => ({ x: point.x, y: middle.y }));
    default:
      return points.map((point) => ({ ...point }));
  }
}

/**
 * Even out intervals along one axis, holding the two outermost performers and
 * respacing everyone between them.
 *
 * The other coordinate is left alone, which is what separates this from
 * `evenlySpaceAlongLine`: this cleans up the spacing of a rank without pulling
 * it onto a straight line.
 */
export function distributeAlongAxis(
  points: DrillPoint[],
  axis: 'x' | 'y',
): DrillPoint[] {
  if (points.length < 3) return points.map((point) => ({ ...point }));

  // Work on indices so each point keeps its own other-axis value.
  const order = points
    .map((point, index) => ({ point, index }))
    .sort((a, b) => a.point[axis] - b.point[axis]);

  const first = order[0].point[axis];
  const last = order[order.length - 1].point[axis];
  const gap = (last - first) / (order.length - 1);

  const out = points.map((point) => ({ ...point }));
  order.forEach((entry, position) => {
    const value = first + gap * position;
    if (axis === 'x') out[entry.index].x = value;
    else out[entry.index].y = value;
  });
  return out;
}

/**
 * Spread the selection so its outermost members sit on landmarks — "stretch
 * this block from the 35 to the 45". Points in between scale proportionally,
 * so relative spacing is kept.
 */
export function fitGroupBetweenLandmarks(
  points: DrillPoint[],
  from: FieldLandmark,
  to: FieldLandmark,
): DrillPoint[] {
  if (points.length === 0 || from.axis !== to.axis) {
    return points.map((point) => ({ ...point }));
  }
  const axis = from.axis;
  const box = bounds(points);
  const min = axis === 'x' ? box.minX : box.minY;
  const max = axis === 'x' ? box.maxX : box.maxY;
  const span = max - min;
  const targetMin = Math.min(from.value, to.value);
  const targetMax = Math.max(from.value, to.value);

  // A group with no extent on this axis has nothing to stretch; put it on the
  // near landmark rather than dividing by zero.
  if (span <= 1e-9) {
    return moveGroupToLandmark(points, { ...from, value: targetMin }, 'centre');
  }

  const scale = (targetMax - targetMin) / span;
  return points.map((point) => {
    const value = axis === 'x' ? point.x : point.y;
    const scaled = targetMin + (value - min) * scale;
    return axis === 'x' ? { x: scaled, y: point.y } : { x: point.x, y: scaled };
  });
}
