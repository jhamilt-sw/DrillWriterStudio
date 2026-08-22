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

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SHAPE_LIBRARY,
  type ShapeKind,
  buildShape,
  distributeAroundPerimeter,
  placeShape,
  unitShape,
} from '../shapes.ts';
import { bounds, centroid } from '../formations.ts';
import type { DrillPoint } from '../types.ts';

const close = (actual: number, expected: number, tolerance = 1e-6) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};

const options = (patch: Record<string, unknown> = {}) => ({
  center: { x: 80, y: 40 },
  widthSteps: 40,
  heightSteps: 40,
  ...patch,
}) as Parameters<typeof buildShape>[2];

const ALL_KINDS = SHAPE_LIBRARY.map((entry) => entry.kind);

test('every shape in the library builds the number of performers asked for', () => {
  for (const kind of ALL_KINDS) {
    for (const count of [4, 12, 13, 40]) {
      const points = buildShape(kind, count, options());
      assert.equal(points.length, count, `${kind} with ${count} performers`);
      assert.ok(
        points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
        `${kind} produced a non-finite coordinate`,
      );
    }
  }
});

test('every shape stays inside the box it was given', () => {
  for (const kind of ALL_KINDS) {
    const points = buildShape(kind, 30, options({ widthSteps: 40, heightSteps: 24 }));
    const box = bounds(points);
    assert.ok(box.minX >= 60 - 1e-6, `${kind} overflowed to the left`);
    assert.ok(box.maxX <= 100 + 1e-6, `${kind} overflowed to the right`);
    assert.ok(box.minY >= 28 - 1e-6, `${kind} overflowed downfield`);
    assert.ok(box.maxY <= 52 + 1e-6, `${kind} overflowed upfield`);
  }
});

test('a shape is centred where it was asked to be', () => {
  // Symmetric shapes should balance about the requested centre.
  for (const kind of ['square', 'rectangle', 'diamond', 'cross', 'ellipse'] as ShapeKind[]) {
    const points = buildShape(kind, 24, options());
    const middle = centroid(points);
    close(middle.x, 80, 0.5);
    close(middle.y, 40, 0.5);
  }
});

test('a square with four performers puts one on each corner', () => {
  const points = buildShape('square', 4, options({ widthSteps: 20, heightSteps: 20 }));
  const corners = points.map((point) => `${point.x},${point.y}`).sort();
  assert.deepEqual(corners, ['70,30', '70,50', '90,30', '90,50'].sort());
});

test('a square with eight performers adds the edge midpoints', () => {
  const points = buildShape('square', 8, options({ widthSteps: 20, heightSteps: 20 }));
  assert.equal(points.length, 8);
  // Four corners plus four midpoints, one per edge.
  const midpoints = points.filter(
    (point) =>
      (point.x === 80 && (point.y === 30 || point.y === 50)) ||
      (point.y === 40 && (point.x === 70 || point.x === 90)),
  );
  assert.equal(midpoints.length, 4);
});

test('a star puts somebody on every point', () => {
  // A star whose points are empty does not read as a star — this is the whole
  // reason corners are anchored before the edges are filled.
  const points = buildShape('star', 10, options({ widthSteps: 40, heightSteps: 40 }));
  const middle = { x: 80, y: 40 };
  const radii = points
    .map((point) => Math.hypot(point.x - middle.x, point.y - middle.y))
    .sort((a, b) => b - a);
  // Five performers out at the full radius, five in at the inner radius.
  for (let i = 0; i < 5; i += 1) close(radii[i], 20, 1e-6);
  for (let i = 5; i < 10; i += 1) close(radii[i], 8, 1e-6);
});

test('a star can have a different number of points', () => {
  const six = buildShape('star', 12, options({ starPoints: 6 }));
  assert.equal(six.length, 12);
  const middle = { x: 80, y: 40 };
  const outer = six.filter(
    (point) => Math.abs(Math.hypot(point.x - middle.x, point.y - middle.y) - 20) < 1e-6,
  );
  assert.equal(outer.length, 6);
});

test('a triangle points upfield, away from the audience', () => {
  const points = buildShape('triangle', 3, options({ widthSteps: 20, heightSteps: 20 }));
  const box = bounds(points);
  const apex = points.filter((point) => Math.abs(point.y - box.maxY) < 1e-6);
  assert.equal(apex.length, 1, 'exactly one performer at the apex');
  close(apex[0].x, 80);
  // The base sits toward the front sideline, the low-y edge.
  assert.equal(points.filter((point) => Math.abs(point.y - box.minY) < 1e-6).length, 2);
});

test('a trapezoid is narrow at the top and wide at the base', () => {
  const points = buildShape('trapezoid', 4, options({ trapezoidTopRatio: 0.4 }));
  const box = bounds(points);
  const top = points.filter((point) => Math.abs(point.y - box.maxY) < 1e-6);
  const base = points.filter((point) => Math.abs(point.y - box.minY) < 1e-6);
  const width = (row: DrillPoint[]) =>
    Math.max(...row.map((p) => p.x)) - Math.min(...row.map((p) => p.x));
  assert.ok(width(top) < width(base), 'the top edge should be the narrow one');
  close(width(top) / width(base), 0.4, 1e-6);
});

test('rotation turns the shape clockwise on screen', () => {
  // A triangle's apex is up at 0 degrees; a quarter turn clockwise puts it to
  // the right, at Side 2.
  const turned = buildShape('triangle', 3, options({ rotationDegrees: 90 }));
  const box = bounds(turned);
  const rightmost = turned.filter((point) => Math.abs(point.x - box.maxX) < 1e-6);
  assert.equal(rightmost.length, 1);
  close(rightmost[0].y, 40, 1e-6);
});

test('rotating all the way round returns the original', () => {
  const start = buildShape('pentagon', 10, options());
  const turned = buildShape('pentagon', 10, options({ rotationDegrees: 360 }));
  start.forEach((point, index) => {
    close(turned[index].x, point.x, 1e-6);
    close(turned[index].y, point.y, 1e-6);
  });
});

test('an ellipse spaces performers by arc length, not by angle', () => {
  // Equal angles bunch at the ends of a stretched ellipse; equal arc length is
  // what makes the form look evenly spaced on the field.
  const points = buildShape('ellipse', 24, options({ widthSteps: 80, heightSteps: 20 }));
  const gaps: number[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length];
    gaps.push(Math.hypot(next.x - points[i].x, next.y - points[i].y));
  }
  const min = Math.min(...gaps);
  const max = Math.max(...gaps);
  assert.ok(max / min < 1.35, `spacing varied too much: ${min.toFixed(2)}–${max.toFixed(2)}`);
});

test('fewer performers than corners falls back to even spacing', () => {
  // Three people cannot stand on twelve corners; the form should still be a
  // recognisable ring rather than three points crammed onto one edge.
  const points = buildShape('cross', 3, options());
  assert.equal(points.length, 3);
  const middle = centroid(points);
  close(middle.x, 80, 6);
});

test('the perimeter walk never duplicates the closing point', () => {
  const square = placeShape(unitShape('square'), options({ widthSteps: 20, heightSteps: 20 }));
  const points = distributeAroundPerimeter(square, 12, false);
  assert.equal(points.length, 12);
  const first = points[0];
  const last = points[points.length - 1];
  assert.ok(
    Math.hypot(last.x - first.x, last.y - first.y) > 1e-6,
    'the last performer must not sit on top of the first',
  );
});

test('degenerate input is handled rather than dividing by zero', () => {
  assert.deepEqual(distributeAroundPerimeter([], 5), []);
  assert.deepEqual(buildShape('square', 0, options()), []);
  const collapsed = distributeAroundPerimeter(
    [
      { x: 5, y: 5 },
      { x: 5, y: 5 },
    ],
    3,
  );
  assert.equal(collapsed.length, 3);
  assert.ok(collapsed.every((point) => Number.isFinite(point.x)));
});

test('the library advertises a sensible minimum for each shape', () => {
  for (const entry of SHAPE_LIBRARY) {
    const corners = unitShape(entry.kind, options()).length;
    if (entry.kind === 'ellipse') continue; // sampled, not cornered
    assert.equal(
      entry.minimumCount,
      corners,
      `${entry.label} should advertise its corner count`,
    );
  }
});
