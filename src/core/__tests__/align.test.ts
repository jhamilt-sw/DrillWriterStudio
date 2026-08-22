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
  alignToEdge,
  anchorValue,
  distributeAlongAxis,
  fitGroupBetweenLandmarks,
  moveGroupToLandmark,
  moveGroupToNearestLandmark,
  snapEachToLandmarks,
} from '../align.ts';
import {
  DEFAULT_APPEARANCE,
  fieldMetrics,
  hashLandmarks,
  nearestLandmark,
  sidelineLandmarks,
  verticalLandmarks,
  yardLineLandmarks,
  yardLineX,
} from '../field.ts';
import { describePoint } from '../notation.ts';
import type { FieldConfig } from '../types.ts';

const HS: FieldConfig = { type: 'highSchool', stepsPerFiveYards: 8, showEndZones: true, appearance: DEFAULT_APPEARANCE };
const COLLEGE: FieldConfig = { ...HS, type: 'college' };
const hs = fieldMetrics(HS);
const college = fieldMetrics(COLLEGE);

const close = (actual: number, expected: number, tolerance = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};

test('the field exposes the landmarks worth aligning to', () => {
  const vertical = verticalLandmarks(hs);
  assert.deepEqual(
    vertical.map((landmark) => landmark.label),
    ['Front side line', 'Front Hash', 'Back Hash', 'Back side line'],
  );
  assert.equal(vertical[0].value, 0);
  close(vertical[3].value, hs.depthSteps);

  assert.equal(hashLandmarks(hs).length, 2);
  assert.equal(sidelineLandmarks(hs).length, 2);
  // 21 five-yard lines, goal line to goal line.
  assert.equal(yardLineLandmarks(hs).length, 21);
  assert.equal(yardLineLandmarks(hs)[10].label, '50 yd ln');
  assert.equal(yardLineLandmarks(hs)[7].label, 'Side 1 35 yd ln');
});

test('nearest landmark is stable on an exact tie', () => {
  const landmarks = yardLineLandmarks(hs);
  // x=52 is four steps from both the 30 (48) and the 35 (56).
  const first = nearestLandmark(52, landmarks);
  const second = nearestLandmark(52, landmarks);
  assert.equal(first.id, second.id, 'repeated snaps must not oscillate');
});

test('snapping each performer sends them to their own nearest yard line', () => {
  const points = [
    { x: 47, y: 10 }, // nearest the 30 at x=48
    { x: 57, y: 20 }, // nearest the 35 at x=56
    { x: 63, y: 30 }, // nearest the 40 at x=64
  ];
  const snapped = snapEachToLandmarks(points, yardLineLandmarks(hs));
  assert.deepEqual(
    snapped.map((point) => point.x),
    [48, 56, 64],
  );
  // Front-to-back positions are untouched.
  assert.deepEqual(
    snapped.map((point) => point.y),
    [10, 20, 30],
  );
});

test('snapping each performer to a hash leaves side-to-side alone', () => {
  const points = [
    { x: 20, y: 30 },
    { x: 40, y: 34 },
  ];
  const snapped = snapEachToLandmarks(points, hashLandmarks(college));
  // College front hash is at 32 steps; both are nearest it.
  assert.deepEqual(
    snapped.map((point) => point.y),
    [32, 32],
  );
  assert.deepEqual(
    snapped.map((point) => point.x),
    [20, 40],
  );
});

test('snapping each performer changes the shape; moving the group does not', () => {
  const points = [
    { x: 47, y: 10 },
    { x: 57, y: 10 },
  ];
  const landmarks = yardLineLandmarks(hs);

  const snapped = snapEachToLandmarks(points, landmarks);
  // They were 10 steps apart, now they are 8 — the form changed, as intended.
  close(snapped[1].x - snapped[0].x, 8);

  const moved = moveGroupToNearestLandmark(points, landmarks, 'centre');
  // Still 10 steps apart: a rigid translation.
  close(moved[1].x - moved[0].x, 10);
  // Centre was x=52, nearest yard line 48 or 56 — either way it lands on one.
  const centre = (moved[0].x + moved[1].x) / 2;
  assert.ok(
    landmarks.some((landmark) => Math.abs(landmark.value - centre) < 1e-9),
    `group centre ${centre} should sit on a yard line`,
  );
});

test('a group can be anchored by its centre or either edge', () => {
  const points = [
    { x: 10, y: 0 },
    { x: 20, y: 0 },
    { x: 30, y: 0 },
  ];
  assert.equal(anchorValue(points, 'x', 'centre'), 20);
  assert.equal(anchorValue(points, 'x', 'leading'), 10);
  assert.equal(anchorValue(points, 'x', 'trailing'), 30);

  const fifty = { id: 'yard-50', label: '50 yd ln', axis: 'x' as const, value: 80 };

  const byCentre = moveGroupToLandmark(points, fifty, 'centre');
  assert.deepEqual(
    byCentre.map((point) => point.x),
    [70, 80, 90],
  );

  const byLeading = moveGroupToLandmark(points, fifty, 'leading');
  assert.deepEqual(
    byLeading.map((point) => point.x),
    [80, 90, 100],
  );

  const byTrailing = moveGroupToLandmark(points, fifty, 'trailing');
  assert.deepEqual(
    byTrailing.map((point) => point.x),
    [60, 70, 80],
  );
});

test('moving a group to a hash preserves the form exactly', () => {
  const points = [
    { x: 40, y: 12 },
    { x: 44, y: 16 },
    { x: 48, y: 12 },
  ];
  const frontHash = verticalLandmarks(college).find((l) => l.id === 'frontHash');
  assert.ok(frontHash);
  const moved = moveGroupToLandmark(points, frontHash, 'centre');

  // Every relative offset is unchanged.
  for (let i = 1; i < points.length; i += 1) {
    close(moved[i].x - moved[0].x, points[i].x - points[0].x);
    close(moved[i].y - moved[0].y, points[i].y - points[0].y);
  }
  // And the centre is on the hash.
  const centreY = moved.reduce((sum, p) => sum + p.y, 0) / moved.length;
  close(centreY, college.frontHashY);
});

test('an aligned performer reads as "On" that landmark, not a hair off it', () => {
  // The whole point of sharing landmark definitions with the notation module.
  for (const metrics of [hs, college]) {
    for (const landmark of verticalLandmarks(metrics)) {
      const [snapped] = snapEachToLandmarks([{ x: 56, y: 41 }], [landmark]);
      const written = describePoint(snapped, metrics);
      assert.equal(
        written.vertical.text,
        `On ${landmark.label}`,
        `snapping to ${landmark.label} should read as being on it`,
      );
    }
  }
});

test('a yard-line snap reads as "On" that yard line', () => {
  const snapped = snapEachToLandmarks([{ x: 53, y: 20 }], yardLineLandmarks(hs));
  const written = describePoint(snapped[0], hs);
  assert.equal(written.horizontal.text, 'Side 1: On 35 yd ln');
  assert.equal(written.horizontal.direction, 'on');
});

test('edge alignment dresses the selection to one of its own edges', () => {
  const points = [
    { x: 10, y: 5 },
    { x: 14, y: 9 },
    { x: 18, y: 1 },
  ];
  assert.deepEqual(
    alignToEdge(points, 'side1').map((point) => point.x),
    [10, 10, 10],
  );
  assert.deepEqual(
    alignToEdge(points, 'side2').map((point) => point.x),
    [18, 18, 18],
  );
  // Front is the low-y edge, toward the audience.
  assert.deepEqual(
    alignToEdge(points, 'front').map((point) => point.y),
    [1, 1, 1],
  );
  assert.deepEqual(
    alignToEdge(points, 'back').map((point) => point.y),
    [9, 9, 9],
  );
  assert.deepEqual(
    alignToEdge(points, 'centreX').map((point) => point.x),
    [14, 14, 14],
  );
  // Aligning on one axis never disturbs the other.
  assert.deepEqual(
    alignToEdge(points, 'side1').map((point) => point.y),
    [5, 9, 1],
  );
});

test('distributing evens out intervals without straightening the rank', () => {
  const points = [
    { x: 0, y: 3 },
    { x: 1, y: 7 },
    { x: 2, y: 1 },
    { x: 12, y: 5 },
  ];
  const spread = distributeAlongAxis(points, 'x');
  assert.deepEqual(
    spread.map((point) => point.x),
    [0, 4, 8, 12],
  );
  // Front-to-back scatter is deliberately preserved — this is not "make a line".
  assert.deepEqual(
    spread.map((point) => point.y),
    [3, 7, 1, 5],
  );
});

test('distributing keeps each performer with their own coordinate', () => {
  // Points given out of order must not have their other axis shuffled.
  const points = [
    { x: 12, y: 100 },
    { x: 0, y: 200 },
    { x: 1, y: 300 },
  ];
  const spread = distributeAlongAxis(points, 'x');
  assert.deepEqual(spread[0], { x: 12, y: 100 });
  assert.deepEqual(spread[1], { x: 0, y: 200 });
  assert.deepEqual(spread[2], { x: 6, y: 300 });
});

test('distributing needs at least three points to mean anything', () => {
  const pair = [
    { x: 0, y: 0 },
    { x: 9, y: 0 },
  ];
  assert.deepEqual(distributeAlongAxis(pair, 'x'), pair);
});

test('a group can be stretched to span two landmarks', () => {
  const points = [
    { x: 50, y: 0 },
    { x: 52, y: 0 },
    { x: 54, y: 0 },
  ];
  const thirtyFive = { id: 'a', label: '35', axis: 'x' as const, value: yardLineX(35, 1, hs) };
  const fortyFive = { id: 'b', label: '45', axis: 'x' as const, value: yardLineX(45, 1, hs) };

  const fitted = fitGroupBetweenLandmarks(points, thirtyFive, fortyFive);
  close(fitted[0].x, 56); // Side 1's 35
  close(fitted[2].x, 72); // Side 1's 45
  // Proportional spacing preserved: the middle performer stays in the middle.
  close(fitted[1].x, 64);
});

test('stretching a group with no extent places it rather than dividing by zero', () => {
  const stacked = [
    { x: 40, y: 0 },
    { x: 40, y: 4 },
  ];
  const from = { id: 'a', label: '35', axis: 'x' as const, value: 56 };
  const to = { id: 'b', label: '45', axis: 'x' as const, value: 72 };
  const fitted = fitGroupBetweenLandmarks(stacked, from, to);
  assert.ok(fitted.every((point) => Number.isFinite(point.x)));
  assert.deepEqual(
    fitted.map((point) => point.x),
    [56, 56],
  );
});

test('alignment operations tolerate an empty selection', () => {
  assert.deepEqual(snapEachToLandmarks([], yardLineLandmarks(hs)), []);
  assert.deepEqual(moveGroupToNearestLandmark([], yardLineLandmarks(hs)), []);
  assert.deepEqual(alignToEdge([], 'front'), []);
  assert.deepEqual(distributeAlongAxis([], 'x'), []);
  assert.deepEqual(fitGroupBetweenLandmarks([], yardLineLandmarks(hs)[0], yardLineLandmarks(hs)[1]), []);
});

test('a single performer is a valid selection for the group tools', () => {
  const one = [{ x: 53, y: 41 }];
  const moved = moveGroupToNearestLandmark(one, yardLineLandmarks(hs), 'centre');
  assert.equal(moved.length, 1);
  assert.equal(moved[0].x, 56);
  assert.equal(moved[0].y, 41);
});
