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
  DEFAULT_APPEARANCE,
  DEFAULT_FIELD,
  HASH_MARK_LENGTH_FEET,
  HASH_MARK_WIDTH_FEET,
  DEFAULT_STEPS_PER_FIVE_YARDS,
  MAX_STEPS_PER_FIVE_YARDS,
  MIN_STEPS_PER_FIVE_YARDS,
  STEP_SIZE_PRESETS,
  clampToField,
  describeStepSize,
  feetToSteps,
  fieldMetrics,
  hashMarkXs,
  isValidStepSize,
  yardMarkXs,
  normaliseStepSize,
  stepLengthInches,
  stepsToFeet,
  stepsToYards,
  yardLineX,
  yardLines,
  YARD_TICK_LENGTH_FEET,
  yardTicks,
} from '../field.ts';
import type { FieldConfig } from '../types.ts';

const HS_8TO5: FieldConfig = {
  type: 'highSchool',
  stepsPerFiveYards: 8,
  showEndZones: true,
  appearance: DEFAULT_APPEARANCE,
};

const COLLEGE_8TO5: FieldConfig = { ...HS_8TO5, type: 'college' };

const close = (actual: number, expected: number, tolerance = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};

test('an 8-to-5 step is 22.5 inches', () => {
  close(stepLengthInches(8), 22.5);
  close(stepLengthInches(6), 30);
  close(stepLengthInches(12), 15);
});

test('8-to-5 is the default for a new field', () => {
  assert.equal(DEFAULT_STEPS_PER_FIVE_YARDS, 8);
  assert.equal(DEFAULT_FIELD.stepsPerFiveYards, 8);
  close(stepLengthInches(DEFAULT_FIELD.stepsPerFiveYards), 22.5);
  // The defining property of 8-to-5: a marcher lands on a yard line every two
  // steps, and on a five-yard line every eight.
  const metrics = fieldMetrics(DEFAULT_FIELD);
  close(metrics.stepsPerFiveYardLine, 8);
  close(yardLineX(45, 1, metrics) - yardLineX(40, 1, metrics), 8);
});

test('every named preset is a valid step size', () => {
  assert.ok(STEP_SIZE_PRESETS.length > 0);
  for (const preset of STEP_SIZE_PRESETS) {
    assert.ok(
      isValidStepSize(preset.stepsPerFiveYards),
      `${preset.label} should be a valid step size`,
    );
  }
  // The standard is among them.
  assert.ok(
    STEP_SIZE_PRESETS.some((preset) => preset.stepsPerFiveYards === 8),
    '8-to-5 must be offered as a preset',
  );
});

test('step size is a free value, not a fixed list', () => {
  // Anything in range is usable, including values between the presets.
  for (const size of [5, 7, 8.5, 9, 11, 13.25]) {
    assert.ok(isValidStepSize(size), `${size}-to-5 should be allowed`);
    assert.equal(normaliseStepSize(size), size);
    close(stepLengthInches(size), 180 / size);
  }
  // A 7-to-5 step is 180/7 inches.
  close(stepLengthInches(7), 25.714285, 1e-5);
});

test('an unusable step size falls back to the standard', () => {
  assert.equal(normaliseStepSize(0), 8);
  assert.equal(normaliseStepSize(-4), 8);
  assert.equal(normaliseStepSize(Number.NaN), 8);
  assert.equal(normaliseStepSize(Number.POSITIVE_INFINITY), 8);
  assert.equal(normaliseStepSize('eight'), 8);
  assert.equal(normaliseStepSize(undefined), 8);
  assert.equal(isValidStepSize(0), false);
  assert.equal(isValidStepSize('8'), false);
});

test('an out-of-range step size is clamped rather than rejected', () => {
  assert.equal(normaliseStepSize(1000), MAX_STEPS_PER_FIVE_YARDS);
  assert.equal(normaliseStepSize(0.5), MIN_STEPS_PER_FIVE_YARDS);
  // Hand-typed precision is kept to two decimals so it does not haunt every
  // coordinate downstream.
  assert.equal(normaliseStepSize(8.3333333), 8.33);
});

test('a step size reads the way a designer says it', () => {
  assert.equal(describeStepSize(8), '8-to-5 (22.5")');
  assert.equal(describeStepSize(6), '6-to-5 (30")');
  assert.equal(describeStepSize(16), '16-to-5 (11.25")');
});

test('an arbitrary step size still produces a correctly sized field', () => {
  // 7-to-5 is unusual but legal: the field is still 100 yards long.
  const metrics = fieldMetrics({ ...HS_8TO5, stepsPerFiveYards: 7 });
  close(metrics.widthSteps, (100 / 5) * 7);
  close(metrics.widthSteps * stepLengthInches(7), 100 * 36);
  // And still 160 feet wide.
  close(metrics.depthSteps * stepLengthInches(7), 160 * 12);
});

test('the field is exactly 160 steps goal line to goal line at 8-to-5', () => {
  const metrics = fieldMetrics(HS_8TO5);
  close(metrics.widthSteps, 160);
  close(metrics.fiftyX, 80);
  close(metrics.stepsPerFiveYardLine, 8);
});

test('the field is 85.33 steps deep at 8-to-5', () => {
  const metrics = fieldMetrics(HS_8TO5);
  close(metrics.depthSteps, 160 / 1.875);
  close(metrics.depthSteps, 85.3333333, 1e-5);
});

test('college hashes sit exactly 32 steps off each sideline', () => {
  const metrics = fieldMetrics(COLLEGE_8TO5);
  close(metrics.frontHashY, 32);
  close(metrics.backHashY, metrics.depthSteps - 32);
  // NCAA hashes are 40 feet apart.
  close(metrics.backHashY - metrics.frontHashY, feetToSteps(40, 8));
});

test('high school hashes sit 53 feet 4 inches off each sideline', () => {
  const metrics = fieldMetrics(HS_8TO5);
  close(metrics.frontHashY, feetToSteps(53 + 4 / 12, 8));
  close(metrics.frontHashY, 28.4444444, 1e-5);
  // NFHS hashes are also 53'4" apart, i.e. the field splits into thirds.
  close(metrics.backHashY - metrics.frontHashY, feetToSteps(53 + 4 / 12, 8), 1e-9);
});

test('pro hashes are 18 feet 6 inches apart', () => {
  const metrics = fieldMetrics({ ...HS_8TO5, type: 'pro' });
  close(metrics.backHashY - metrics.frontHashY, feetToSteps(18.5, 8), 1e-9);
});

test('yard lines map to the right x on both sides', () => {
  const metrics = fieldMetrics(HS_8TO5);
  close(yardLineX(0, 1, metrics), 0);
  close(yardLineX(50, 1, metrics), 80);
  close(yardLineX(50, 2, metrics), 80);
  close(yardLineX(0, 2, metrics), 160);
});

test('yard line x is measured from the side 1 goal line', () => {
  const metrics = fieldMetrics(HS_8TO5);
  // Side 1's 35 sits 35 yards from the Side 1 goal line.
  close(yardLineX(35, 1, metrics), (35 / 5) * 8);
  // Side 2's 35 sits 65 yards from the Side 1 goal line.
  close(yardLineX(35, 2, metrics), (65 / 5) * 8);
});

test('there are 21 five-yard lines, numbered 0..50..0', () => {
  const metrics = fieldMetrics(HS_8TO5);
  const lines = yardLines(metrics);
  assert.equal(lines.length, 21);
  assert.equal(lines[0].number, 0);
  assert.equal(lines[10].number, 50);
  assert.equal(lines[20].number, 0);
  assert.equal(lines[10].x, 80);
  // Numbered lines are the tens; goal lines carry no printed number.
  assert.equal(lines[0].isNumbered, false);
  assert.equal(lines[2].number, 10);
  assert.equal(lines[2].isNumbered, true);
  assert.equal(lines[1].isNumbered, false);
});

test('clamping keeps a point on the playing surface', () => {
  const metrics = fieldMetrics(HS_8TO5);
  assert.deepEqual(clampToField({ x: -5, y: -2 }, metrics), { x: 0, y: 0 });
  const clamped = clampToField({ x: 999, y: 999 }, metrics);
  close(clamped.x, metrics.widthSteps);
  close(clamped.y, metrics.depthSteps);
});

test('step size scales the field grid but not its physical size', () => {
  const eight = fieldMetrics(HS_8TO5);
  const six = fieldMetrics({ ...HS_8TO5, stepsPerFiveYards: 6 });
  close(six.widthSteps, 120);
  // Same physical field: 160 steps at 8-to-5 == 120 steps at 6-to-5.
  close(eight.widthSteps * 1.875, six.widthSteps * 2.5);
});

test('hash marks bisect the five-yard lines', () => {
  // The lining specifications put a hash mark on each five-yard line, centred
  // so it runs a foot either side of it. The hash is a reference tied to the
  // numbered lines, not a texture spread down the whole field.
  const metrics = fieldMetrics(DEFAULT_FIELD);
  const xs = hashMarkXs(metrics);
  const spf = metrics.config.stepsPerFiveYards;
  assert.equal(xs.length, 21, 'goal line to goal line, every five yards');
  for (const x of xs) {
    assert.ok(
      Math.abs(x % spf) < 1e-9,
      `a hash mark missed its five-yard line at x=${x}`,
    );
    assert.ok(x >= 0 && x <= metrics.widthSteps, `hash mark at ${x} is off the field`);
  }
});

test('hash marks are the right size, and the size is a real-world length', () => {
  // 4 inches by 24 inches. Not a fraction of a step: step size is a setting,
  // and a mark defined in steps would grow when a designer switched to 6-to-5.
  assert.equal(HASH_MARK_LENGTH_FEET, 2);
  assert.equal(Math.round(HASH_MARK_WIDTH_FEET * 12), 4);

  const eightToFive = fieldMetrics(DEFAULT_FIELD);
  const sixToFive = fieldMetrics({ ...DEFAULT_FIELD, stepsPerFiveYards: 6 });
  assert.equal(
    stepsToFeet(feetToSteps(HASH_MARK_LENGTH_FEET, 8), 8),
    stepsToFeet(feetToSteps(HASH_MARK_LENGTH_FEET, 6), 6),
  );
  // And the marks land on the same physical yards either way.
  assert.equal(hashMarkXs(eightToFive).length, hashMarkXs(sixToFive).length);
});

test('hash marks are five yards apart on the ground', () => {
  const metrics = fieldMetrics(DEFAULT_FIELD);
  const xs = hashMarkXs(metrics);
  const gaps = xs.slice(1).map((x, index) => stepsToYards(x - xs[index], 8));
  for (const gap of gaps) {
    assert.ok(Math.abs(gap - 5) < 1e-9, `unexpected gap of ${gap} yards`);
  }
});

test('yard markers stay between the five-yard lines, clear of the hash marks', () => {
  // These are two different lists on purpose. They were one call once, and
  // moving the hash marks silently moved the yard markers with them.
  const metrics = fieldMetrics(DEFAULT_FIELD);
  const marks = hashMarkXs(metrics);
  const yards = yardMarkXs(metrics);
  assert.equal(yards.length, 80, 'four markers per five yards, twenty times over');
  for (const x of yards) {
    assert.ok(
      !marks.some((mark) => Math.abs(mark - x) < 1e-9),
      `a yard marker landed on a hash mark at x=${x}`,
    );
  }
});

test('the hashes are where the rule book puts them', () => {
  // High school: 53'4" in from each sideline. College: 60'. NFL: 70'9".
  const highSchool = fieldMetrics(DEFAULT_FIELD);
  assert.ok(Math.abs(stepsToFeet(highSchool.frontHashY, 8) - 160 / 3) < 1e-9);
  const college = fieldMetrics({ ...DEFAULT_FIELD, type: 'college' });
  assert.ok(Math.abs(stepsToFeet(college.frontHashY, 8) - 60) < 1e-9);
  const professional = fieldMetrics({ ...DEFAULT_FIELD, type: 'pro' });
  assert.ok(Math.abs(stepsToFeet(professional.frontHashY, 8) - 70.75) < 1e-9);
});

test('yard markers come in four rows: both sidelines and both hashes', () => {
  const metrics = fieldMetrics(DEFAULT_FIELD);
  const ticks = yardTicks(metrics);
  assert.equal(ticks.length, yardMarkXs(metrics).length * 4);
  // Every yard that has a hash mark has a full set of markers.
  const perX = new Map<number, number>();
  for (const tick of ticks) perX.set(tick.x, (perX.get(tick.x) ?? 0) + 1);
  assert.ok([...perX.values()].every((n) => n === 4));
});

test('a yard marker is two feet long whatever the step size', () => {
  for (const spf of [6, 8, 12]) {
    const metrics = fieldMetrics({ ...DEFAULT_FIELD, stepsPerFiveYards: spf });
    for (const tick of yardTicks(metrics)) {
      assert.ok(
        Math.abs(stepsToFeet(Math.abs(tick.toY - tick.fromY), spf) - YARD_TICK_LENGTH_FEET) <
          1e-9,
        `a marker at ${spf}-to-5 was the wrong length`,
      );
    }
  }
});

test('sideline markers point into the field, not off it', () => {
  const metrics = fieldMetrics(DEFAULT_FIELD);
  const ticks = yardTicks(metrics);
  const front = ticks.filter((tick) => tick.fromY === 0);
  const back = ticks.filter((tick) => tick.fromY === metrics.depthSteps);
  assert.ok(front.length > 0 && back.length > 0);
  assert.ok(front.every((tick) => tick.toY > 0), 'a front marker ran off the field');
  assert.ok(
    back.every((tick) => tick.toY < metrics.depthSteps),
    'a back marker ran off the field',
  );
});

test('hash markers start clear of the hash mark and run outward', () => {
  // The regression: a marker centred on the hash swamps the hash mark sharing
  // that spot, and the hashes stop being readable. Each one starts at the edge
  // of the mark and runs away from the middle of the field, toward the
  // sideline whose numbers it belongs to.
  const metrics = fieldMetrics(DEFAULT_FIELD);
  const middle = metrics.depthSteps / 2;
  for (const hashY of [metrics.frontHashY, metrics.backHashY]) {
    const outward = hashY < middle ? -1 : 1;
    const row = yardTicks(metrics).filter(
      (tick) => Math.abs(tick.fromY - hashY) < feetToSteps(0.5, 8),
    );
    assert.ok(row.length > 0, `no markers found at the hash at y=${hashY}`);
    for (const tick of row) {
      // Clear of the 4-inch mark.
      assert.ok(
        Math.abs(tick.fromY - hashY) >= feetToSteps(HASH_MARK_WIDTH_FEET / 2, 8) - 1e-9,
        'a marker started on top of the hash mark',
      );
      assert.equal(
        Math.sign(tick.toY - tick.fromY),
        outward,
        'a marker ran toward the middle of the field instead of outward',
      );
      // And never crosses the hash itself.
      assert.ok(
        Math.sign(tick.toY - hashY) === outward,
        'a marker crossed the hash line',
      );
    }
  }
});

test('yard markers sit on the yards between the five-yard lines', () => {
  const metrics = fieldMetrics(DEFAULT_FIELD);
  const yards = new Set(yardMarkXs(metrics));
  assert.ok(yardTicks(metrics).every((tick) => yards.has(tick.x)));
});
