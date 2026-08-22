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
 * Bulk formation tools (FR-1.6).
 *
 * Every function here is pure: it takes points in drill units and returns new
 * points. The store decides what to do with the result, which keeps these
 * testable and lets undo/redo treat a formation change like any other edit.
 */

import type { DrillPoint } from './types.ts';
import { clampToField, type FieldMetrics } from './field.ts';
import { assignByMinimalTravel } from './assignment.ts';

/** Snap a value to the nearest multiple of `grid` steps. */
export function snapValue(value: number, grid: number): number {
  if (grid <= 0) return value;
  return Math.round(value / grid) * grid;
}

export function snapPoint(point: DrillPoint, grid: number): DrillPoint {
  return { x: snapValue(point.x, grid), y: snapValue(point.y, grid) };
}

/** Evenly spaced points along the segment from `start` to `end`, inclusive. */
export function lineFormation(
  start: DrillPoint,
  end: DrillPoint,
  count: number,
): DrillPoint[] {
  if (count <= 0) return [];
  if (count === 1) return [{ ...start }];
  const out: DrillPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    out.push({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t });
  }
  return out;
}

/**
 * A rectangular block, filled row by row from `origin` (its front-left corner).
 * Any remainder lands in the final row, centred, which is how a block of 13 in
 * rows of 4 is normally drawn.
 */
export function blockFormation(
  origin: DrillPoint,
  count: number,
  columns: number,
  intervalSteps: number,
  spacingSteps: number,
): DrillPoint[] {
  if (count <= 0 || columns <= 0) return [];
  const out: DrillPoint[] = [];
  const fullRows = Math.floor(count / columns);
  const remainder = count % columns;
  for (let row = 0; row < fullRows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      out.push({
        x: origin.x + column * intervalSteps,
        y: origin.y + row * spacingSteps,
      });
    }
  }
  if (remainder > 0) {
    const indent = ((columns - remainder) * intervalSteps) / 2;
    for (let column = 0; column < remainder; column += 1) {
      out.push({
        x: origin.x + indent + column * intervalSteps,
        y: origin.y + fullRows * spacingSteps,
      });
    }
  }
  return out;
}

/**
 * Points along an arc. Angles are in degrees, measured clockwise from straight
 * up (toward the front sideline), which matches how a designer describes an arc
 * opening toward the audience.
 */
export function arcFormation(
  center: DrillPoint,
  radiusSteps: number,
  startAngleDeg: number,
  endAngleDeg: number,
  count: number,
): DrillPoint[] {
  if (count <= 0) return [];
  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  if (count === 1) {
    const angle = toRad((startAngleDeg + endAngleDeg) / 2);
    return [
      {
        x: center.x + radiusSteps * Math.cos(angle),
        y: center.y + radiusSteps * Math.sin(angle),
      },
    ];
  }
  const out: DrillPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const angle = toRad(startAngleDeg + (endAngleDeg - startAngleDeg) * t);
    out.push({
      x: center.x + radiusSteps * Math.cos(angle),
      y: center.y + radiusSteps * Math.sin(angle),
    });
  }
  return out;
}

/** A closed circle — an arc that does not repeat its first point at the end. */
export function circleFormation(
  center: DrillPoint,
  radiusSteps: number,
  count: number,
  startAngleDeg = 0,
): DrillPoint[] {
  if (count <= 0) return [];
  const out: DrillPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const deg = startAngleDeg + (360 * i) / count;
    const angle = ((deg - 90) * Math.PI) / 180;
    out.push({
      x: center.x + radiusSteps * Math.cos(angle),
      y: center.y + radiusSteps * Math.sin(angle),
    });
  }
  return out;
}

/** Reflect points across a vertical line (a yard line). */
export function mirrorVertical(points: DrillPoint[], axisX: number): DrillPoint[] {
  return points.map((point) => ({ x: 2 * axisX - point.x, y: point.y }));
}

/** Reflect points across a horizontal line (a hash or the 50-yard-line's mate). */
export function mirrorHorizontal(points: DrillPoint[], axisY: number): DrillPoint[] {
  return points.map((point) => ({ x: point.x, y: 2 * axisY - point.y }));
}

/**
 * Rotate points about a centre. **Positive degrees turn clockwise on screen.**
 *
 * The field is drawn with drill +y pointing up the screen, so a clockwise
 * screen turn is the *negative* direction in the usual maths convention. That
 * sign is applied once, here, because three separate things rotate — the shape
 * library's "Turn" field, the transform buttons, and the on-canvas handle — and
 * they have to agree or a form turns one way from one control and the other way
 * from the next.
 */
export function rotateAbout(
  points: DrillPoint[],
  center: DrillPoint,
  degrees: number,
): DrillPoint[] {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return points.map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
      x: center.x + dx * cos + dy * sin,
      y: center.y - dx * sin + dy * cos,
    };
  });
}

/** Scale points away from or toward a centre. */
export function scaleAbout(
  points: DrillPoint[],
  center: DrillPoint,
  factorX: number,
  factorY = factorX,
): DrillPoint[] {
  return points.map((point) => ({
    x: center.x + (point.x - center.x) * factorX,
    y: center.y + (point.y - center.y) * factorY,
  }));
}

export function translate(points: DrillPoint[], dx: number, dy: number): DrillPoint[] {
  return points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
}

/** Centroid of a set of points. */
export function centroid(points: DrillPoint[]): DrillPoint {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/** Axis-aligned bounds of a set of points. */
export function bounds(points: DrillPoint[]) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

/**
 * Redistribute points evenly between the two that are furthest apart, keeping
 * the order they arrive in. This is the "clean up my line" tool — the form is
 * roughly right, the intervals are not.
 */
export function evenlySpaceAlongLine(points: DrillPoint[]): DrillPoint[] {
  if (points.length < 3) return points.map((point) => ({ ...point }));
  const first = points[0];
  const last = points[points.length - 1];
  return lineFormation(first, last, points.length);
}

/**
 * Sort points along the dominant axis of the group, so "evenly space" and
 * "assign to a form" do not shuffle marchers past one another.
 */
export function sortAlongDominantAxis<T>(
  items: T[],
  getPoint: (item: T) => DrillPoint,
): T[] {
  const points = items.map(getPoint);
  if (points.length === 0) return items;
  const box = bounds(points);
  const horizontal = box.maxX - box.minX >= box.maxY - box.minY;
  return [...items].sort((a, b) => {
    const pa = getPoint(a);
    const pb = getPoint(b);
    return horizontal ? pa.x - pb.x || pa.y - pb.y : pa.y - pb.y || pa.x - pb.x;
  });
}

/**
 * Assign performers to target slots so the ensemble walks the least distance
 * and no two paths cross.
 *
 * Delegates to the minimum-cost solver in `assignment.ts`. This was once a
 * greedy nearest-pair pass, which is fine for well-separated forms and visibly
 * wrong the moment a block turns into a star — greedy takes the cheapest pair
 * first and then has to accept whatever is left, which is exactly how paths end
 * up crossing.
 */
export function assignToTargets(
  current: { id: string; point: DrillPoint }[],
  targets: DrillPoint[],
): Record<string, DrillPoint> {
  return assignByMinimalTravel(current, targets);
}

/** Keep a whole formation on the playing surface. */
export function clampAll(points: DrillPoint[], metrics: FieldMetrics): DrillPoint[] {
  return points.map((point) => clampToField(point, metrics));
}

export interface SelectionEntry {
  id: string;
  point: DrillPoint;
  /** False when this position was invented because the performer was unplaced. */
  placed: boolean;
}

/**
 * Give every selected performer a working position, including those who have
 * never been placed on the field.
 *
 * Without this a freshly typed-in roster cannot be placed at all: an unplaced
 * performer has no position, so they have no centroid, no spatial order and
 * nothing for a formation tool to transform — every tool silently does nothing.
 * Seeding them turns "select eight trumpets, press Block" into a working first
 * action.
 *
 * Newcomers joining a selection that already has placed members are seeded at
 * that group's centre, so adding one marcher to a form does not drag the whole
 * form's centroid across the field. A selection with nobody placed falls back
 * to `fallback` — in the editor, the 50 on the front hash.
 */
export function seedSelection(
  entries: { id: string; point: DrillPoint | null }[],
  fallback: DrillPoint,
  intervalSteps: number,
): SelectionEntry[] {
  const alreadyPlaced = entries
    .map((entry) => entry.point)
    .filter((point): point is DrillPoint => Boolean(point));
  const seed = alreadyPlaced.length > 0 ? centroid(alreadyPlaced) : fallback;

  return entries.map((entry, index) => {
    if (entry.point) return { id: entry.id, point: entry.point, placed: true };
    // Fan the newcomers out rather than stacking them, so the spatial sort
    // that follows has something meaningful to order them by.
    const offset = (index - (entries.length - 1) / 2) * intervalSteps;
    return {
      id: entry.id,
      point: { x: seed.x + offset, y: seed.y },
      placed: false,
    };
  });
}
