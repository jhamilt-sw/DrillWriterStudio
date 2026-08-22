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
  assignByMinimalTravel,
  findCrossings,
  optimalAssignment,
  segmentsProperlyCross,
  totalTravel,
} from '../assignment.ts';
import { assignToTargets } from '../formations.ts';
import { buildShape } from '../shapes.ts';
import type { DrillPoint } from '../types.ts';

/** Deterministic pseudo-random source, so failures reproduce exactly. */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function costMatrix(from: DrillPoint[], to: DrillPoint[]): number[][] {
  return from.map((a) => to.map((b) => Math.hypot(b.x - a.x, b.y - a.y)));
}

/** Exhaustive optimum, for checking the solver on small inputs. */
function bruteForce(cost: number[][]): number {
  const n = cost.length;
  const m = cost[0].length;
  let best = Infinity;
  const used = new Array<boolean>(m).fill(false);
  const walk = (row: number, total: number): void => {
    if (total >= best) return;
    if (row === n) {
      best = Math.min(best, total);
      return;
    }
    for (let column = 0; column < m; column += 1) {
      if (used[column]) continue;
      used[column] = true;
      walk(row + 1, total + cost[row][column]);
      used[column] = false;
    }
  };
  walk(0, 0);
  return best;
}

test('a trivial assignment picks the obvious pairing', () => {
  const assignment = optimalAssignment([
    [1, 9],
    [9, 1],
  ]);
  assert.deepEqual(assignment, [0, 1]);
});

test('the solver beats the obvious greedy choice when greed is a trap', () => {
  // Greedy takes the single cheapest pair first and is then forced into a very
  // expensive one; the optimum accepts a worse first pair for a better total.
  const cost = [
    [1, 2],
    [2, 100],
  ];
  const assignment = optimalAssignment(cost);
  const total = assignment.reduce((sum, column, row) => sum + cost[row][column], 0);
  assert.equal(total, 4, 'expected 2 + 2, not 1 + 100');
});

test('the solver matches brute force on random small problems', () => {
  const random = makeRandom(20260821);
  for (let trial = 0; trial < 40; trial += 1) {
    const size = 2 + Math.floor(random() * 5);
    const cost = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => Math.round(random() * 100)),
    );
    const assignment = optimalAssignment(cost);
    const total = assignment.reduce((sum, column, row) => sum + cost[row][column], 0);
    assert.equal(total, bruteForce(cost), `trial ${trial} (size ${size})`);
  }
});

test('a proper crossing is detected; a shared endpoint is not', () => {
  const cross = segmentsProperlyCross(
    { x: 0, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
    { x: 10, y: 0 },
  );
  assert.equal(cross, true);

  // Two paths converging on the same slot touch but do not cross.
  const touching = segmentsProperlyCross(
    { x: 0, y: 0 },
    { x: 5, y: 5 },
    { x: 10, y: 0 },
    { x: 5, y: 5 },
  );
  assert.equal(touching, false);

  const apart = segmentsProperlyCross(
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 5 },
    { x: 1, y: 5 },
  );
  assert.equal(apart, false);
});

test('an optimal assignment produces no crossing paths', () => {
  // The headline guarantee. Random scatter into random targets, many times.
  const random = makeRandom(97531);
  for (let trial = 0; trial < 30; trial += 1) {
    const size = 6 + Math.floor(random() * 10);
    const current = Array.from({ length: size }, (_, index) => ({
      id: `p${index}`,
      point: { x: random() * 100, y: random() * 60 },
    }));
    const targets = Array.from({ length: size }, () => ({
      x: random() * 100,
      y: random() * 60,
    }));

    const assigned = assignByMinimalTravel(current, targets);
    const paths = current.map((entry) => ({
      id: entry.id,
      from: entry.point,
      to: assigned[entry.id],
    }));
    const crossings = findCrossings(paths);
    assert.equal(
      crossings.length,
      0,
      `trial ${trial}: ${crossings.length} crossing(s) survived the optimum`,
    );
  }
});

test('the optimal assignment travels no further than the greedy one', () => {
  const random = makeRandom(24680);
  let improvedAtLeastOnce = false;

  for (let trial = 0; trial < 25; trial += 1) {
    const size = 8 + Math.floor(random() * 8);
    const current = Array.from({ length: size }, (_, index) => ({
      id: `p${index}`,
      point: { x: random() * 100, y: random() * 60 },
    }));
    const targets = Array.from({ length: size }, () => ({
      x: random() * 100,
      y: random() * 60,
    }));

    const cost = costMatrix(current.map((entry) => entry.point), targets);
    const optimal = totalTravel(current, targets, optimalAssignment(cost));

    // Reproduce the old greedy nearest-pair strategy for comparison.
    const pairs: { row: number; column: number; distance: number }[] = [];
    current.forEach((entry, row) =>
      targets.forEach((target, column) =>
        pairs.push({ row, column, distance: cost[row][column] }),
      ),
    );
    pairs.sort((a, b) => a.distance - b.distance);
    const usedRows = new Set<number>();
    const usedColumns = new Set<number>();
    const greedy = new Array<number>(size).fill(-1);
    for (const pair of pairs) {
      if (usedRows.has(pair.row) || usedColumns.has(pair.column)) continue;
      usedRows.add(pair.row);
      usedColumns.add(pair.column);
      greedy[pair.row] = pair.column;
    }
    const greedyTravel = totalTravel(current, targets, greedy);

    assert.ok(
      optimal <= greedyTravel + 1e-9,
      `trial ${trial}: optimal ${optimal.toFixed(2)} should not exceed greedy ${greedyTravel.toFixed(2)}`,
    );
    if (optimal < greedyTravel - 1e-6) improvedAtLeastOnce = true;
  }

  assert.ok(
    improvedAtLeastOnce,
    'greedy should be strictly worse somewhere, or this test proves nothing',
  );
});

test('forming a shape from a scattered block leaves no crossings', () => {
  // The case that prompted this: a block of performers becomes a star.
  const random = makeRandom(13579);
  const current = Array.from({ length: 24 }, (_, index) => ({
    id: `p${index}`,
    point: { x: 60 + (index % 6) * 4, y: 30 + Math.floor(index / 6) * 4 },
  }));
  // A little jitter so the block is not perfectly symmetric.
  current.forEach((entry) => {
    entry.point.x += random() * 0.4;
    entry.point.y += random() * 0.4;
  });

  const targets = buildShape('star', 24, {
    center: { x: 80, y: 42 },
    widthSteps: 44,
    heightSteps: 44,
  });

  const assigned = assignByMinimalTravel(current, targets);
  assert.equal(Object.keys(assigned).length, 24);
  const crossings = findCrossings(
    current.map((entry) => ({ id: entry.id, from: entry.point, to: assigned[entry.id] })),
  );
  assert.equal(crossings.length, 0, `${crossings.length} paths crossed forming a star`);
});

test('surplus performers are left where they stand, not stacked', () => {
  const current = [
    { id: 'a', point: { x: 0, y: 0 } },
    { id: 'b', point: { x: 1, y: 0 } },
    { id: 'c', point: { x: 50, y: 0 } },
  ];
  const assigned = assignByMinimalTravel(current, [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ]);
  assert.equal(Object.keys(assigned).length, 2);
  // The far-away performer is the one left out.
  assert.equal(assigned.c, undefined);
});

test('more slots than performers fills the nearest ones', () => {
  const assigned = assignByMinimalTravel(
    [{ id: 'a', point: { x: 0, y: 0 } }],
    [
      { x: 40, y: 0 },
      { x: 1, y: 0 },
    ],
  );
  assert.deepEqual(assigned.a, { x: 1, y: 0 });
});

test('the public formation helper now uses the optimal solver', () => {
  // assignToTargets is what the formation tools call; it must inherit the
  // no-crossing guarantee rather than keeping the old greedy behaviour.
  const current = [
    { id: 'a', point: { x: 0, y: 0 } },
    { id: 'b', point: { x: 0, y: 10 } },
  ];
  const targets = [
    { x: 10, y: 10 },
    { x: 10, y: 0 },
  ];
  const assigned = assignToTargets(current, targets);
  assert.deepEqual(assigned.a, { x: 10, y: 0 });
  assert.deepEqual(assigned.b, { x: 10, y: 10 });
});

test('empty input is handled', () => {
  assert.deepEqual(assignByMinimalTravel([], [{ x: 0, y: 0 }]), {});
  assert.deepEqual(assignByMinimalTravel([{ id: 'a', point: { x: 0, y: 0 } }], []), {});
  assert.deepEqual(optimalAssignment([]), []);
  assert.deepEqual(findCrossings([]), []);
});

test('a full-size show assigns fast enough to feel instant', () => {
  const random = makeRandom(11111);
  const current = Array.from({ length: 250 }, (_, index) => ({
    id: `p${index}`,
    point: { x: random() * 160, y: random() * 85 },
  }));
  const targets = Array.from({ length: 250 }, () => ({
    x: random() * 160,
    y: random() * 85,
  }));

  const started = performance.now();
  const assigned = assignByMinimalTravel(current, targets);
  const elapsed = performance.now() - started;

  assert.equal(Object.keys(assigned).length, 250);
  assert.ok(elapsed < 4000, `250 performers took ${elapsed.toFixed(0)}ms to assign`);
});
