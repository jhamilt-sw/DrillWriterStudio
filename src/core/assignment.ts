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
 * Deciding who goes where when a form changes.
 *
 * Handing performers to slots badly is what produces drill where the trumpets
 * walk through the tubas: the form is right, the assignment is not. This module
 * solves it properly, as a minimum-cost assignment.
 *
 * **Why the cost is plain distance, not squared distance.** Squared cost is the
 * usual default and it is wrong here. If two paths cross at a point P, dividing
 * them into lengths p, q and r, s, swapping the endpoints changes the squared
 * total by 2(p − r)(q − s) — which can be negative, meaning a crossing can be
 * *optimal* under squared cost. Under plain Euclidean distance the triangle
 * inequality makes the swap a strict improvement every time, so an optimal
 * assignment provably has no crossing paths. Since eliminating crossings is the
 * point, the cost is Euclidean distance.
 */

import type { DrillPoint } from './types.ts';

/**
 * Minimum-cost assignment of rows to columns (the Hungarian algorithm, via
 * shortest augmenting paths).
 *
 * Returns, for each row, the column it was assigned, or -1 when there are fewer
 * columns than rows and it went unmatched. O(n²m) — about 16 million operations
 * for a 250-performer show, which runs in well under a second and only happens
 * on an explicit command, never per frame.
 */
export function optimalAssignment(cost: number[][]): number[] {
  const n = cost.length;
  if (n === 0) return [];
  const m = cost[0]?.length ?? 0;
  if (m === 0) return new Array<number>(n).fill(-1);

  // The algorithm needs rows <= columns. With more performers than slots, solve
  // the transpose and invert, so the surplus performers are the ones left out.
  if (n > m) {
    const transposed: number[][] = Array.from({ length: m }, (_, j) =>
      Array.from({ length: n }, (_, i) => cost[i][j]),
    );
    const columnToRow = optimalAssignment(transposed);
    const result = new Array<number>(n).fill(-1);
    columnToRow.forEach((row, column) => {
      if (row >= 0) result[row] = column;
    });
    return result;
  }

  const u = new Float64Array(n + 1);
  const v = new Float64Array(m + 1);
  /** p[j] is the 1-based row matched to column j; 0 means unmatched. */
  const p = new Int32Array(m + 1);
  const way = new Int32Array(m + 1);

  for (let i = 1; i <= n; i += 1) {
    p[0] = i;
    let j0 = 0;
    const minv = new Float64Array(m + 1).fill(Infinity);
    const used = new Uint8Array(m + 1);

    do {
      used[j0] = 1;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;

      for (let j = 1; j <= m; j += 1) {
        if (used[j]) continue;
        const current = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (current < minv[j]) {
          minv[j] = current;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }

      // No reachable column: the cost matrix has an unusable row. Bail rather
      // than spinning, leaving the remaining rows unassigned.
      if (!Number.isFinite(delta)) break;

      for (let j = 0; j <= m; j += 1) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);

    // Walk the augmenting path back, flipping the matching as we go.
    while (j0 !== 0) {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    }
  }

  const assignment = new Array<number>(n).fill(-1);
  for (let j = 1; j <= m; j += 1) {
    if (p[j] > 0) assignment[p[j] - 1] = j - 1;
  }
  return assignment;
}

/** Total distance travelled by an assignment — used to compare strategies. */
export function totalTravel(
  current: { point: DrillPoint }[],
  targets: DrillPoint[],
  assignment: number[],
): number {
  let total = 0;
  assignment.forEach((target, index) => {
    if (target < 0) return;
    total += Math.hypot(
      targets[target].x - current[index].point.x,
      targets[target].y - current[index].point.y,
    );
  });
  return total;
}

/**
 * Match performers to slots so the ensemble walks the least distance overall
 * and no two paths cross.
 *
 * With more performers than slots the surplus keep their current position —
 * the solver chooses which, so the ones left standing are the ones furthest
 * from any opening.
 */
export function assignByMinimalTravel(
  current: { id: string; point: DrillPoint }[],
  targets: DrillPoint[],
): Record<string, DrillPoint> {
  const result: Record<string, DrillPoint> = {};
  if (current.length === 0 || targets.length === 0) return result;

  const cost = current.map((entry) =>
    targets.map((target) => Math.hypot(target.x - entry.point.x, target.y - entry.point.y)),
  );
  const assignment = optimalAssignment(cost);
  assignment.forEach((target, index) => {
    if (target >= 0) result[current[index].id] = { ...targets[target] };
  });
  return result;
}

/**
 * Whether two segments properly cross — intersecting at a point interior to
 * both, rather than merely touching at a shared endpoint.
 *
 * Shared endpoints are not crossings: two marchers converging on neighbouring
 * slots often pass close by, and flagging that would make the count useless.
 */
export function segmentsProperlyCross(
  a1: DrillPoint,
  a2: DrillPoint,
  b1: DrillPoint,
  b2: DrillPoint,
): boolean {
  const cross = (o: DrillPoint, a: DrillPoint, b: DrillPoint): number =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const d1 = cross(b1, b2, a1);
  const d2 = cross(b1, b2, a2);
  const d3 = cross(a1, a2, b1);
  const d4 = cross(a1, a2, b2);

  const EPSILON = 1e-9;
  const strictlyOpposite = (p: number, q: number): boolean =>
    (p > EPSILON && q < -EPSILON) || (p < -EPSILON && q > EPSILON);

  return strictlyOpposite(d1, d2) && strictlyOpposite(d3, d4);
}

export interface CrossingPair {
  first: string;
  second: string;
}

/**
 * Every pair of paths that cross.
 *
 * O(n²) — about 31,000 pairs for a 250-performer show, fast enough to run
 * whenever a set changes and report to the designer.
 */
export function findCrossings(
  paths: { id: string; from: DrillPoint; to: DrillPoint }[],
): CrossingPair[] {
  const out: CrossingPair[] = [];
  for (let i = 0; i < paths.length; i += 1) {
    for (let j = i + 1; j < paths.length; j += 1) {
      if (
        segmentsProperlyCross(paths[i].from, paths[i].to, paths[j].from, paths[j].to)
      ) {
        out.push({ first: paths[i].id, second: paths[j].id });
      }
    }
  }
  return out;
}
