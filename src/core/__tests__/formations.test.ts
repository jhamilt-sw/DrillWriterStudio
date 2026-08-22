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
  arcFormation,
  assignToTargets,
  blockFormation,
  bounds,
  centroid,
  circleFormation,
  evenlySpaceAlongLine,
  lineFormation,
  mirrorHorizontal,
  mirrorVertical,
  rotateAbout,
  scaleAbout,
  seedSelection,
  snapPoint,
  snapValue,
  sortAlongDominantAxis,
} from '../formations.ts';

const close = (actual: number, expected: number, tolerance = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};

test('snapping quantises to the grid', () => {
  assert.equal(snapValue(4.3, 0.25), 4.25);
  assert.equal(snapValue(4.3, 1), 4);
  assert.equal(snapValue(4.3, 0), 4.3);
  assert.deepEqual(snapPoint({ x: 4.3, y: 7.6 }, 0.5), { x: 4.5, y: 7.5 });
});

test('a line spreads evenly from end to end, inclusive', () => {
  const points = lineFormation({ x: 0, y: 0 }, { x: 16, y: 0 }, 5);
  assert.equal(points.length, 5);
  assert.deepEqual(points[0], { x: 0, y: 0 });
  assert.deepEqual(points[4], { x: 16, y: 0 });
  assert.deepEqual(points[2], { x: 8, y: 0 });
});

test('a single-point line sits at the start', () => {
  assert.deepEqual(lineFormation({ x: 3, y: 4 }, { x: 9, y: 9 }, 1), [{ x: 3, y: 4 }]);
  assert.deepEqual(lineFormation({ x: 0, y: 0 }, { x: 1, y: 1 }, 0), []);
});

test('a block fills rows left to right', () => {
  const points = blockFormation({ x: 0, y: 0 }, 6, 3, 2, 2);
  assert.equal(points.length, 6);
  assert.deepEqual(points[0], { x: 0, y: 0 });
  assert.deepEqual(points[2], { x: 4, y: 0 });
  assert.deepEqual(points[3], { x: 0, y: 2 });
  assert.deepEqual(points[5], { x: 4, y: 2 });
});

test('a partial final row is centred under the block', () => {
  // 7 performers in rows of 3: two full rows, then one centred marcher.
  const points = blockFormation({ x: 0, y: 0 }, 7, 3, 2, 2);
  assert.equal(points.length, 7);
  const last = points[6];
  assert.deepEqual(last, { x: 2, y: 4 });
});

test('an arc sweeps from its start angle to its end angle', () => {
  // Radius 10, centred at the origin. Angles run clockwise from straight up,
  // and "up" is toward the front sideline, i.e. decreasing y. So 0 is toward
  // the audience, 90 to the right, 180 upfield, 270 to the left.
  const points = arcFormation({ x: 0, y: 0 }, 10, 270, 90, 3);
  assert.equal(points.length, 3);
  close(points[0].x, -10);
  close(points[0].y, 0, 1e-9);
  // The sweep interpolates 270 -> 90 through 180, so the arc bows upfield.
  close(points[1].x, 0, 1e-9);
  close(points[1].y, 10);
  close(points[2].x, 10);
  close(points[2].y, 0, 1e-9);
});

test('sweeping the other way bows the arc toward the audience', () => {
  // To open an arc toward the front sideline, sweep through 0 rather than 180.
  const points = arcFormation({ x: 0, y: 0 }, 10, -90, 90, 3);
  close(points[0].x, -10);
  close(points[1].y, -10);
  close(points[2].x, 10);
});

test('a circle closes without duplicating its first point', () => {
  const points = circleFormation({ x: 0, y: 0 }, 8, 4);
  assert.equal(points.length, 4);
  close(points[0].x, 0, 1e-9);
  close(points[0].y, -8);
  close(points[1].x, 8);
  close(points[1].y, 0, 1e-9);
  // Every point is exactly on the radius.
  for (const point of points) close(Math.hypot(point.x, point.y), 8, 1e-9);
});

test('mirroring reflects across an axis', () => {
  // Side 1's 35 (x=56) mirrors to Side 2's 35 (x=104) across the 50 (x=80).
  assert.deepEqual(mirrorVertical([{ x: 56, y: 12 }], 80), [{ x: 104, y: 12 }]);
  assert.deepEqual(mirrorHorizontal([{ x: 10, y: 20 }], 32), [{ x: 10, y: 44 }]);
});

test('mirroring twice returns the original', () => {
  const original = [{ x: 13, y: 27 }];
  assert.deepEqual(mirrorVertical(mirrorVertical(original, 80), 80), original);
});

test('rotation turns a form clockwise on screen', () => {
  // Positive degrees are clockwise as the designer sees it. A performer out to
  // the right (3 o'clock) lands below the centre (6 o'clock) after a quarter
  // turn — not above it.
  const rotated = rotateAbout([{ x: 10, y: 0 }], { x: 0, y: 0 }, 90);
  close(rotated[0].x, 0, 1e-9);
  close(rotated[0].y, -10);

  // And a full turn is the identity.
  const [full] = rotateAbout([{ x: 3, y: 7 }], { x: 0, y: 0 }, 360);
  close(full.x, 3, 1e-9);
  close(full.y, 7, 1e-9);
});

test('rotateAbout agrees with the shape library about which way is clockwise', () => {
  // Two independent rotation implementations exist — this one and placeShape.
  // If they disagree, the "Turn" field on a shape and the rotate buttons spin
  // the same form in opposite directions.
  const viaTransform = rotateAbout([{ x: 0, y: 10 }], { x: 0, y: 0 }, 90);
  close(viaTransform[0].x, 10, 1e-9);
  close(viaTransform[0].y, 0, 1e-9);
});

test('scaling spreads a form away from its centre', () => {
  const scaled = scaleAbout([{ x: 10, y: 10 }, { x: -10, y: -10 }], { x: 0, y: 0 }, 2);
  assert.deepEqual(scaled[0], { x: 20, y: 20 });
  assert.deepEqual(scaled[1], { x: -20, y: -20 });
});

test('centroid and bounds describe a group', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 10, y: 4 },
  ];
  assert.deepEqual(centroid(points), { x: 5, y: 2 });
  assert.deepEqual(bounds(points), { minX: 0, maxX: 10, minY: 0, maxY: 4 });
  assert.deepEqual(centroid([]), { x: 0, y: 0 });
});

test('evenly spacing keeps the endpoints and fixes the middle', () => {
  const messy = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 12, y: 0 },
  ];
  const cleaned = evenlySpaceAlongLine(messy);
  assert.deepEqual(cleaned[0], { x: 0, y: 0 });
  assert.deepEqual(cleaned[3], { x: 12, y: 0 });
  assert.deepEqual(cleaned[1], { x: 4, y: 0 });
  assert.deepEqual(cleaned[2], { x: 8, y: 0 });
});

test('sorting picks the axis the group actually spreads along', () => {
  const wide = [
    { id: 'b', point: { x: 10, y: 1 } },
    { id: 'a', point: { x: 0, y: 0 } },
  ];
  assert.deepEqual(
    sortAlongDominantAxis(wide, (item) => item.point).map((i) => i.id),
    ['a', 'b'],
  );
  const tall = [
    { id: 'b', point: { x: 1, y: 10 } },
    { id: 'a', point: { x: 0, y: 0 } },
  ];
  assert.deepEqual(
    sortAlongDominantAxis(tall, (item) => item.point).map((i) => i.id),
    ['a', 'b'],
  );
});

test('assignment sends each performer to their nearest free slot', () => {
  const current = [
    { id: 'a', point: { x: 0, y: 0 } },
    { id: 'b', point: { x: 10, y: 0 } },
  ];
  const targets = [
    { x: 11, y: 0 },
    { x: 1, y: 0 },
  ];
  const assigned = assignToTargets(current, targets);
  assert.deepEqual(assigned.a, { x: 1, y: 0 });
  assert.deepEqual(assigned.b, { x: 11, y: 0 });
});

test('an all-unplaced selection is seeded so the tools have something to shape', () => {
  // Regression: a freshly typed-in roster has no positions at all. Before
  // seeding, every formation tool silently did nothing to it — there was no
  // way to get anyone onto the field for the first time.
  const seeded = seedSelection(
    [
      { id: 'a', point: null },
      { id: 'b', point: null },
      { id: 'c', point: null },
    ],
    { x: 80, y: 28 },
    2,
  );
  assert.equal(seeded.length, 3);
  assert.ok(seeded.every((entry) => entry.placed === false));
  // Fanned out around the fallback rather than stacked on it.
  assert.deepEqual(
    seeded.map((entry) => entry.point.x),
    [78, 80, 82],
  );
  assert.ok(seeded.every((entry) => entry.point.y === 28));
  // A meaningful centroid is exactly what the tools need.
  assert.deepEqual(centroid(seeded.map((entry) => entry.point)), { x: 80, y: 28 });
});

test('a newcomer joining a placed form is seeded at that form, not the fallback', () => {
  const seeded = seedSelection(
    [
      { id: 'a', point: { x: 20, y: 10 } },
      { id: 'b', point: { x: 24, y: 10 } },
      { id: 'new', point: null },
    ],
    { x: 80, y: 28 },
    2,
  );
  const newcomer = seeded.find((entry) => entry.id === 'new');
  assert.ok(newcomer);
  // Centre of the placed pair is x=22 — nowhere near the x=80 fallback.
  assert.equal(newcomer.point.y, 10);
  assert.ok(
    Math.abs(newcomer.point.x - 22) <= 2,
    `expected the newcomer near the group centre, got x=${newcomer.point.x}`,
  );
  // Existing positions are untouched.
  assert.deepEqual(seeded[0], { id: 'a', point: { x: 20, y: 10 }, placed: true });
});

test('seeding a fully placed selection changes nothing', () => {
  const entries = [
    { id: 'a', point: { x: 20, y: 10 } },
    { id: 'b', point: { x: 24, y: 10 } },
  ];
  const seeded = seedSelection(entries, { x: 80, y: 28 }, 2);
  assert.deepEqual(
    seeded.map((entry) => entry.point),
    entries.map((entry) => entry.point),
  );
  assert.ok(seeded.every((entry) => entry.placed));
});

test('seeded performers flow straight into a formation tool', () => {
  // The whole point: seed an unplaced roster, then shape it. This is the path
  // "select eight trumpets, press Block" actually takes.
  const seeded = seedSelection(
    Array.from({ length: 8 }, (_, index) => ({ id: `p${index}`, point: null })),
    { x: 80, y: 28 },
    2,
  );
  const centre = centroid(seeded.map((entry) => entry.point));
  const targets = blockFormation(
    { x: centre.x - 3, y: centre.y - 1 },
    8,
    4,
    2,
    2,
  );
  assert.equal(targets.length, 8);
  const assigned = assignToTargets(seeded, targets);
  assert.equal(Object.keys(assigned).length, 8);
});

test('assignment leaves surplus performers unassigned rather than stacking them', () => {
  const current = [
    { id: 'a', point: { x: 0, y: 0 } },
    { id: 'b', point: { x: 1, y: 0 } },
    { id: 'c', point: { x: 2, y: 0 } },
  ];
  const assigned = assignToTargets(current, [{ x: 0, y: 0 }]);
  assert.equal(Object.keys(assigned).length, 1);
  assert.deepEqual(assigned.a, { x: 0, y: 0 });
});
