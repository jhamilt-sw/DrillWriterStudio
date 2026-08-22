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
  describeHorizontal,
  describePoint,
  describeVertical,
  formatSteps,
  nearestYardLine,
  roundToPrecision,
} from '../notation.ts';
import type { FieldConfig } from '../types.ts';

const HS: FieldConfig = { type: 'highSchool', stepsPerFiveYards: 8, showEndZones: true, appearance: DEFAULT_APPEARANCE };
const COLLEGE: FieldConfig = { ...HS, type: 'college' };

const hs = fieldMetrics(HS);
const college = fieldMetrics(COLLEGE);

test('formatSteps prints tenths, and quarters when needed', () => {
  assert.equal(formatSteps(4), '4.0');
  assert.equal(formatSteps(4.25), '4.25');
  assert.equal(formatSteps(4.5), '4.5');
  assert.equal(formatSteps(4.75), '4.75');
  assert.equal(formatSteps(0), '0.0');
});

test('roundToPrecision snaps to quarter steps without float fuzz', () => {
  assert.equal(roundToPrecision(4.3, 0.25), 4.25);
  assert.equal(roundToPrecision(4.4, 0.25), 4.5);
  assert.equal(roundToPrecision(-2.1, 0.25), -2);
  assert.equal(roundToPrecision(1.7, 0.25), 1.75);
});

test('nearestYardLine picks the closer of two lines', () => {
  // Eight steps between five-yard lines: Side 1's 30 sits at x=48, its 35 at 56.
  assert.equal(nearestYardLine(48, hs).number, 30);
  assert.equal(nearestYardLine(51, hs).number, 30);
  assert.equal(nearestYardLine(53, hs).number, 35);
  assert.equal(nearestYardLine(56, hs).number, 35);
});

test('a performer standing on a yard line reads "On"', () => {
  // Side 1's 35 is 56 steps from the Side 1 goal line.
  const coordinate = describeHorizontal(56, hs);
  assert.equal(coordinate.text, 'Side 1: On 35 yd ln');
  assert.equal(coordinate.side, 1);
  assert.equal(coordinate.yardLine, 35);
  assert.equal(coordinate.direction, 'on');
});

test('"inside" means toward the 50 on Side 1', () => {
  // Two steps toward the 50 from Side 1's 35.
  const coordinate = describeHorizontal(58, hs);
  assert.equal(coordinate.text, 'Side 1: 2.0 steps inside 35 yd ln');
  assert.equal(coordinate.direction, 'inside');
});

test('"outside" means toward the near goal line on Side 1', () => {
  const coordinate = describeHorizontal(54, hs);
  assert.equal(coordinate.text, 'Side 1: 2.0 steps outside 35 yd ln');
});

test('inside and outside flip on Side 2', () => {
  // Side 2's 35 is 65 yards from the Side 1 goal line -> 104 steps.
  assert.equal(describeHorizontal(104, hs).text, 'Side 2: On 35 yd ln');
  // Toward the 50 from Side 2's 35 means *smaller* x.
  assert.equal(describeHorizontal(102, hs).text, 'Side 2: 2.0 steps inside 35 yd ln');
  assert.equal(describeHorizontal(106, hs).text, 'Side 2: 2.0 steps outside 35 yd ln');
});

test('the 50 yard line reads as the 50 from either approach', () => {
  assert.equal(describeHorizontal(80, hs).yardLine, 50);
  assert.match(describeHorizontal(78, hs).text, /Side 1: 2\.0 steps outside 50 yd ln/);
  assert.match(describeHorizontal(82, hs).text, /Side 2: 2\.0 steps outside 50 yd ln/);
});

test('standing on the 50 is written without a side', () => {
  const coordinate = describeHorizontal(80, hs);
  assert.equal(coordinate.text, 'On 50 yd ln');
  assert.equal(coordinate.onFiftyYardLine, true);
  // Every other yard line keeps its side, including the ones next to the 50.
  assert.equal(describeHorizontal(72, hs).text, 'Side 1: On 45 yd ln');
  assert.equal(describeHorizontal(88, hs).text, 'Side 2: On 45 yd ln');
  assert.equal(describeHorizontal(78, hs).onFiftyYardLine, false);
});

test('vertical positions read against the nearest landmark', () => {
  assert.equal(describeVertical(0, hs).text, 'On Front side line');
  assert.equal(describeVertical(4, hs).text, '4.0 steps behind Front side line');
  assert.equal(describeVertical(college.frontHashY, college).text, 'On Front Hash');
  assert.equal(
    describeVertical(college.frontHashY - 2, college).text,
    '2.0 steps in front of Front Hash',
  );
  assert.equal(
    describeVertical(college.frontHashY + 2, college).text,
    '2.0 steps behind Front Hash',
  );
});

test('back sideline and back hash are usable references', () => {
  assert.equal(describeVertical(college.depthSteps, college).text, 'On Back side line');
  assert.equal(describeVertical(college.backHashY, college).text, 'On Back Hash');
  assert.equal(
    describeVertical(college.backHashY + 3, college).text,
    '3.0 steps behind Back Hash',
  );
});

test('a midfield performer measures off the hash, not the sideline', () => {
  // 30 steps back on a college field is nearer the front hash (32) than the
  // front sideline (0), so the coordinate should say so.
  const coordinate = describeVertical(30, college);
  assert.equal(coordinate.reference, 'Front Hash');
  assert.equal(coordinate.text, '2.0 steps in front of Front Hash');
});

test('high school hashes produce non-integer offsets, rounded to quarters', () => {
  // HS front hash sits at 28.444 steps; a performer at 28 steps is 0.44 in
  // front of it, which rounds to a half step.
  const coordinate = describeVertical(28, hs);
  assert.equal(coordinate.reference, 'Front Hash');
  assert.equal(coordinate.text, '0.5 steps in front of Front Hash');
});

test('describePoint joins both halves the way a coordinate sheet prints them', () => {
  const written = describePoint({ x: 58, y: 4 }, hs);
  assert.equal(
    written.text,
    'Side 1: 2.0 steps inside 35 yd ln | 4.0 steps behind Front side line',
  );
});

test('precision is configurable for designers who work in tenths', () => {
  const quarter = describeHorizontal(56.3, hs, { precisionSteps: 0.25 });
  assert.equal(quarter.text, 'Side 1: 0.25 steps inside 35 yd ln');
  const tenth = describeHorizontal(56.3, hs, { precisionSteps: 0.1 });
  assert.equal(tenth.text, 'Side 1: 0.3 steps inside 35 yd ln');
});

test('a position a hair off a yard line still reads as "On"', () => {
  assert.equal(describeHorizontal(56.005, hs).direction, 'on');
});
