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

import { DEFAULT_APPEARANCE, fieldMetrics } from '../field.ts';
import {
  analyseSegment,
  distanceSteps,
  findDemandingMoves,
  interpolatedPositions,
  pointAlongSegment,
  positionsAtCount,
  segmentsIntoSet,
} from '../interpolate.ts';
import { countTimeline, countsAtSet, resolvePosition, totalCounts } from '../show.ts';
import type { Show } from '../types.ts';

const close = (actual: number, expected: number, tolerance = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};

function buildShow(): Show {
  return {
    schemaVersion: 1,
    metadata: { title: 'Test', ensemble: '', season: '', designer: '' },
    field: { type: 'highSchool', stepsPerFiveYards: 8, showEndZones: true, appearance: DEFAULT_APPEARANCE },
    sections: [
      { id: 'sec1', name: 'Trumpet', abbreviation: 'TP', color: '#4477AA', symbol: 'circle' },
    ],
    performers: [
      { id: 'p1', label: 'TP1', name: '', sectionId: 'sec1', order: 0 },
      { id: 'p2', label: 'TP2', name: '', sectionId: 'sec1', order: 1 },
    ],
    sets: [
      {
        id: 's1',
        label: '1',
        counts: 0,
        positions: { p1: { x: 0, y: 0 }, p2: { x: 10, y: 10 } },
      },
      { id: 's2', label: '2', counts: 16, positions: { p1: { x: 16, y: 0 } } },
      { id: 's3', label: '3', counts: 8, positions: { p1: { x: 16, y: 8 }, p2: { x: 20, y: 10 } } },
    ],
    music: {
      tempoMap: {
        tempos: [{ measure: 1, bpm: 120 }],
        meters: [{ measure: 1, beatsPerMeasure: 4, beatUnit: 4 }],
        offsetSeconds: 0,
      },
    },
    fieldLogos: [],
  };
}

test('a performer with no entry at a set inherits their last position', () => {
  const show = buildShow();
  // p2 is placed at set 1 and set 3, but not set 2.
  assert.deepEqual(resolvePosition(show, 'p2', 1), { x: 10, y: 10 });
  assert.deepEqual(resolvePosition(show, 'p2', 2), { x: 20, y: 10 });
});

test('an unplaced performer resolves to null', () => {
  const show = buildShow();
  show.performers.push({ id: 'p3', label: 'TP3', name: '', sectionId: 'sec1', order: 2 });
  assert.equal(resolvePosition(show, 'p3', 2), null);
});

test('counts accumulate across sets', () => {
  const show = buildShow();
  assert.equal(countsAtSet(show, 0), 0);
  assert.equal(countsAtSet(show, 1), 16);
  assert.equal(countsAtSet(show, 2), 24);
  assert.equal(totalCounts(show), 24);
  assert.deepEqual(countTimeline(show), [0, 16, 24]);
});

test('interpolation puts a performer halfway at t = 0.5', () => {
  const show = buildShow();
  const positions = interpolatedPositions(show, 1, 0.5);
  assert.deepEqual(positions.p1, { x: 8, y: 0 });
  // p2 holds still through set 2 because they inherit the same position.
  assert.deepEqual(positions.p2, { x: 10, y: 10 });
});

test('a hold delays departure without changing the arrival', () => {
  const segment = {
    performerId: 'p1',
    from: { x: 0, y: 0 },
    to: { x: 16, y: 0 },
    counts: 16,
    style: 'straight' as const,
    holdCounts: 8,
  };
  // Still at the start halfway through, because the first 8 counts are a hold.
  assert.deepEqual(pointAlongSegment(segment, 0.5), { x: 0, y: 0 });
  // Three quarters of the way through, half the movement is done.
  assert.deepEqual(pointAlongSegment(segment, 0.75), { x: 8, y: 0 });
  assert.deepEqual(pointAlongSegment(segment, 1), { x: 16, y: 0 });
});

test('a curved transition bows away from the straight line', () => {
  const segment = {
    performerId: 'p1',
    from: { x: 0, y: 0 },
    to: { x: 16, y: 0 },
    counts: 16,
    style: 'curve' as const,
    control: { x: 8, y: 8 },
    holdCounts: 0,
  };
  const mid = pointAlongSegment(segment, 0.5);
  close(mid.x, 8);
  close(mid.y, 4); // quadratic Bézier reaches half the control offset at t=0.5
  assert.deepEqual(pointAlongSegment(segment, 0), { x: 0, y: 0 });
  assert.deepEqual(pointAlongSegment(segment, 1), { x: 16, y: 0 });
});

test('positionsAtCount walks the whole show timeline', () => {
  const show = buildShow();
  assert.deepEqual(positionsAtCount(show, 0).p1, { x: 0, y: 0 });
  assert.deepEqual(positionsAtCount(show, 8).p1, { x: 8, y: 0 });
  assert.deepEqual(positionsAtCount(show, 16).p1, { x: 16, y: 0 });
  assert.deepEqual(positionsAtCount(show, 20).p1, { x: 16, y: 4 });
  assert.deepEqual(positionsAtCount(show, 24).p1, { x: 16, y: 8 });
  // Past the end, everyone sits in the final set.
  assert.deepEqual(positionsAtCount(show, 999).p1, { x: 16, y: 8 });
});

test('segments are only built for performers who exist at both ends', () => {
  const show = buildShow();
  const segments = segmentsIntoSet(show, 1);
  assert.equal(segments.length, 2);
  assert.equal(segmentsIntoSet(show, 0).length, 0);
});

test('step-size analysis reports the stride a move demands', () => {
  const metrics = fieldMetrics({
    type: 'highSchool',
    stepsPerFiveYards: 8,
    showEndZones: true,
  });
  // 16 steps in 16 counts is exactly an 8-to-5 stride: 22.5 inches.
  const even = analyseSegment(
    {
      performerId: 'p1',
      from: { x: 0, y: 0 },
      to: { x: 16, y: 0 },
      counts: 16,
      style: 'straight',
      holdCounts: 0,
    },
    metrics,
  );
  close(even.stepsPerCount, 1);
  close(even.effectiveStepsPerFiveYards, 8);
  close(even.inchesPerStep, 22.5);

  // 16 steps in 8 counts is a 4-to-5 stride: 45 inches. Not marchable.
  const rushed = analyseSegment(
    {
      performerId: 'p1',
      from: { x: 0, y: 0 },
      to: { x: 16, y: 0 },
      counts: 8,
      style: 'straight',
      holdCounts: 0,
    },
    metrics,
  );
  close(rushed.stepsPerCount, 2);
  close(rushed.effectiveStepsPerFiveYards, 4);
  close(rushed.inchesPerStep, 45);
});

test('demanding moves are flagged, comfortable ones are not', () => {
  const show = buildShow();
  const metrics = fieldMetrics(show.field);
  // p1 travels 16 steps in 16 counts into set 2 — a normal 8-to-5 move.
  assert.equal(findDemandingMoves(show, 1, metrics).length, 0);

  // Squeeze it into 4 counts and it becomes a 90-inch stride.
  show.sets[1].counts = 4;
  const flagged = findDemandingMoves(show, 1, metrics);
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].performerId, 'p1');
  close(flagged[0].inchesPerStep, 90);
});

test('distance is measured in steps, diagonally included', () => {
  close(distanceSteps({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});
