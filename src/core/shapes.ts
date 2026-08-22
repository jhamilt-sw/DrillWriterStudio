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
 * Pre-made drill shapes.
 *
 * Two ideas do all the work here:
 *
 *   1. **A shape is a list of vertices.** A star, a trapezoid and a chevron
 *      differ only in where their corners are, so each one is a handful of
 *      points in a unit box and everything else is shared.
 *   2. **Performers are distributed by arc length, with corners anchored.**
 *      Spacing points evenly around a perimeter is what makes a form look
 *      clean, but a star whose points have nobody standing on them does not
 *      read as a star. So corners get a performer first and the remainder fill
 *      the edges in proportion to their length.
 *
 * Orientation: shapes are defined so that "up" is up *on screen* — toward the
 * back sideline, since the field is drawn front-sideline-down. A shape with an
 * apex points away from the audience at 0°, and `rotationDegrees` turns it
 * clockwise on screen from there.
 */

import type { DrillPoint } from './types.ts';

export type ShapeKind =
  | 'square'
  | 'rectangle'
  | 'triangle'
  | 'trapezoid'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'octagon'
  | 'star'
  | 'cross'
  | 'chevron'
  | 'ellipse';

export interface ShapeDefinition {
  kind: ShapeKind;
  label: string;
  /** One-line description for a tooltip. */
  hint: string;
  /** Fewest performers the form needs to be recognisable. */
  minimumCount: number;
}

export const SHAPE_LIBRARY: ShapeDefinition[] = [
  { kind: 'square', label: 'Square', hint: 'Equal sides, corners anchored.', minimumCount: 4 },
  { kind: 'rectangle', label: 'Rectangle', hint: 'Width and depth set separately.', minimumCount: 4 },
  { kind: 'triangle', label: 'Triangle', hint: 'Apex upfield; rotate to point it anywhere.', minimumCount: 3 },
  { kind: 'trapezoid', label: 'Trapezoid', hint: 'Narrow top, wide base.', minimumCount: 4 },
  { kind: 'diamond', label: 'Diamond', hint: 'A square stood on its point.', minimumCount: 4 },
  { kind: 'pentagon', label: 'Pentagon', hint: 'Five equal sides.', minimumCount: 5 },
  { kind: 'hexagon', label: 'Hexagon', hint: 'Six equal sides.', minimumCount: 6 },
  { kind: 'octagon', label: 'Octagon', hint: 'Eight equal sides.', minimumCount: 8 },
  { kind: 'star', label: 'Star', hint: 'Five points by default; adjustable.', minimumCount: 10 },
  { kind: 'cross', label: 'Cross', hint: 'Plus sign with twelve corners.', minimumCount: 12 },
  { kind: 'chevron', label: 'Chevron', hint: 'A thick wedge, apex upfield.', minimumCount: 6 },
  { kind: 'ellipse', label: 'Ellipse', hint: 'A circle stretched to the box.', minimumCount: 4 },
];

export interface ShapeOptions {
  center: DrillPoint;
  /** Overall side-to-side size, in steps. */
  widthSteps: number;
  /** Overall front-to-back size, in steps. */
  heightSteps: number;
  /** Clockwise on screen. */
  rotationDegrees?: number;
  /** Star: number of points. */
  starPoints?: number;
  /** Star: inner radius as a fraction of the outer. */
  starInnerRatio?: number;
  /** Trapezoid: top width as a fraction of the base. */
  trapezoidTopRatio?: number;
  /** Cross: arm thickness as a fraction of the whole. */
  crossThickness?: number;
  /** Chevron: how deep the notch cuts back, as a fraction of the height. */
  chevronDepth?: number;
}

/** Points on a regular polygon inscribed in the unit circle, first vertex up. */
function regularPolygon(sides: number): DrillPoint[] {
  const out: DrillPoint[] = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    // Negated y: the unit shape is written screen-up, and screen-up is +y in
    // drill units, so the sine term flips once here rather than at every use.
    out.push({ x: Math.cos(angle), y: -Math.sin(angle) });
  }
  return out;
}

/**
 * The outline of a shape, as vertices in a unit box from -1 to 1.
 *
 * Kept separate from placement so the same corner list drives both the
 * distribution maths and anything that later wants to draw a preview.
 */
export function unitShape(kind: ShapeKind, options: ShapeOptions = {} as ShapeOptions): DrillPoint[] {
  switch (kind) {
    case 'square':
    case 'rectangle':
      return [
        { x: -1, y: 1 },
        { x: 1, y: 1 },
        { x: 1, y: -1 },
        { x: -1, y: -1 },
      ];

    case 'triangle':
      return [
        { x: 0, y: 1 },
        { x: 1, y: -1 },
        { x: -1, y: -1 },
      ];

    case 'trapezoid': {
      const top = Math.max(0.05, Math.min(1, options.trapezoidTopRatio ?? 0.5));
      return [
        { x: -top, y: 1 },
        { x: top, y: 1 },
        { x: 1, y: -1 },
        { x: -1, y: -1 },
      ];
    }

    case 'diamond':
      return [
        { x: 0, y: 1 },
        { x: 1, y: 0 },
        { x: 0, y: -1 },
        { x: -1, y: 0 },
      ];

    case 'pentagon':
      return regularPolygon(5);
    case 'hexagon':
      return regularPolygon(6);
    case 'octagon':
      return regularPolygon(8);

    case 'star': {
      const points = Math.max(3, Math.round(options.starPoints ?? 5));
      const inner = Math.max(0.1, Math.min(0.95, options.starInnerRatio ?? 0.4));
      const out: DrillPoint[] = [];
      for (let i = 0; i < points * 2; i += 1) {
        const radius = i % 2 === 0 ? 1 : inner;
        const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        out.push({ x: Math.cos(angle) * radius, y: -Math.sin(angle) * radius });
      }
      return out;
    }

    case 'cross': {
      const t = Math.max(0.1, Math.min(0.9, options.crossThickness ?? 0.34));
      return [
        { x: -t, y: 1 },
        { x: t, y: 1 },
        { x: t, y: t },
        { x: 1, y: t },
        { x: 1, y: -t },
        { x: t, y: -t },
        { x: t, y: -1 },
        { x: -t, y: -1 },
        { x: -t, y: -t },
        { x: -1, y: -t },
        { x: -1, y: t },
        { x: -t, y: t },
      ];
    }

    case 'chevron': {
      // A thick V: an outer wedge and an inner one offset behind it. The
      // thickness is a fraction of the full height, and every vertex stays
      // inside the unit box for any thickness in range — a chevron that
      // overflowed its box would break "fits the size you asked for".
      const thickness = Math.max(0.05, Math.min(0.95, options.chevronDepth ?? 0.35));
      const inset = thickness * 2;
      return [
        { x: -1, y: -1 },
        { x: 0, y: 1 },
        { x: 1, y: -1 },
        { x: 1, y: -1 + inset },
        { x: 0, y: 1 - inset },
        { x: -1, y: -1 + inset },
      ];
    }

    case 'ellipse': {
      // Sampled finely; the perimeter walk below spaces performers by arc
      // length, so a dense sample gives even spacing on a stretched ellipse
      // where equal angles would bunch at the ends.
      const samples = 240;
      const out: DrillPoint[] = [];
      for (let i = 0; i < samples; i += 1) {
        const angle = (i / samples) * Math.PI * 2 - Math.PI / 2;
        out.push({ x: Math.cos(angle), y: -Math.sin(angle) });
      }
      return out;
    }

    default:
      return regularPolygon(4);
  }
}

/** Scale, rotate and move a unit outline into drill units. */
export function placeShape(unit: DrillPoint[], options: ShapeOptions): DrillPoint[] {
  const halfWidth = options.widthSteps / 2;
  const halfHeight = options.heightSteps / 2;
  // Clockwise on screen. Screen-up is +y in drill units, so a clockwise turn on
  // screen is a positive rotation in this frame.
  const radians = ((options.rotationDegrees ?? 0) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return unit.map((point) => {
    const x = point.x * halfWidth;
    const y = point.y * halfHeight;
    return {
      x: options.center.x + x * cos + y * sin,
      y: options.center.y - x * sin + y * cos,
    };
  });
}

interface Edge {
  from: DrillPoint;
  to: DrillPoint;
  length: number;
}

function closedEdges(vertices: DrillPoint[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < vertices.length; i += 1) {
    const from = vertices[i];
    const to = vertices[(i + 1) % vertices.length];
    edges.push({ from, to, length: Math.hypot(to.x - from.x, to.y - from.y) });
  }
  return edges;
}

/**
 * Place `count` performers around a closed outline.
 *
 * With `anchorVertices`, every corner gets a performer and the rest are shared
 * between the edges in proportion to length — the difference between a star and
 * a vaguely star-shaped ring. Without it (or when there are fewer performers
 * than corners) they are spaced purely by arc length.
 */
export function distributeAroundPerimeter(
  vertices: DrillPoint[],
  count: number,
  anchorVertices = true,
): DrillPoint[] {
  if (count <= 0 || vertices.length === 0) return [];
  if (count === 1) return [{ ...vertices[0] }];

  const edges = closedEdges(vertices);
  const perimeter = edges.reduce((sum, edge) => sum + edge.length, 0);
  if (perimeter <= 0) return Array.from({ length: count }, () => ({ ...vertices[0] }));

  if (!anchorVertices || count < vertices.length) {
    // Even spacing by arc length, ignoring where the corners fall.
    const out: DrillPoint[] = [];
    const spacing = perimeter / count;
    let edgeIndex = 0;
    let travelled = 0;
    for (let i = 0; i < count; i += 1) {
      const target = i * spacing;
      while (
        edgeIndex < edges.length - 1 &&
        travelled + edges[edgeIndex].length < target
      ) {
        travelled += edges[edgeIndex].length;
        edgeIndex += 1;
      }
      const edge = edges[edgeIndex];
      const along = edge.length > 0 ? (target - travelled) / edge.length : 0;
      out.push({
        x: edge.from.x + (edge.to.x - edge.from.x) * along,
        y: edge.from.y + (edge.to.y - edge.from.y) * along,
      });
    }
    return out;
  }

  // Corners first, then share the remainder by edge length. Largest-remainder
  // apportionment, so the extra performers land on the longest edges rather
  // than all piling onto the first one.
  const spare = count - vertices.length;
  const quotas = edges.map((edge) => (spare * edge.length) / perimeter);
  const assigned = quotas.map((quota) => Math.floor(quota));
  let remaining = spare - assigned.reduce((sum, value) => sum + value, 0);
  const byRemainder = quotas
    .map((quota, index) => ({ index, remainder: quota - Math.floor(quota) }))
    .sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; remaining > 0; i += 1, remaining -= 1) {
    assigned[byRemainder[i % byRemainder.length].index] += 1;
  }

  const out: DrillPoint[] = [];
  edges.forEach((edge, index) => {
    out.push({ ...edge.from });
    const interior = assigned[index];
    for (let i = 1; i <= interior; i += 1) {
      const along = i / (interior + 1);
      out.push({
        x: edge.from.x + (edge.to.x - edge.from.x) * along,
        y: edge.from.y + (edge.to.y - edge.from.y) * along,
      });
    }
  });
  return out;
}

/**
 * A finished shape: `count` positions in drill units, ready to hand to the
 * assignment step.
 */
export function buildShape(
  kind: ShapeKind,
  count: number,
  options: ShapeOptions,
): DrillPoint[] {
  const outline = placeShape(unitShape(kind, options), options);
  // An ellipse has no meaningful corners — it is a sampled curve, and anchoring
  // its 240 sample points would be nonsense.
  return distributeAroundPerimeter(outline, count, kind !== 'ellipse');
}
