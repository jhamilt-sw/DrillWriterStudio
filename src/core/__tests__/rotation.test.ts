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
  DEFAULT_ROTATION,
  MAX_ROTATION_STEP,
  angleFromCenter,
  formatDelta,
  normaliseDegrees,
  normaliseStep,
  rotationDelta,
  rotationRigFor,
  snapDegrees,
  stepFor,
} from '../rotation.ts';
import { rotateAbout } from '../formations.ts';

test('a plain drag turns in 1 degree increments', () => {
  // Regression: the handle used to snap to 5 degrees unless a modifier was
  // held, so single degrees were unreachable in practice. Precision is the
  // default now; the coarse step is the thing you opt into.
  assert.equal(DEFAULT_ROTATION.stepDegrees, 1);
  assert.equal(stepFor(DEFAULT_ROTATION, false), 1);
  assert.equal(DEFAULT_ROTATION.coarseStepDegrees, 5);
  assert.equal(stepFor(DEFAULT_ROTATION, true), 5);
});

test('an odd angle survives a default drag', () => {
  // 37 degrees is reachable without holding anything down.
  const center = { x: 0, y: 0 };
  const start = { x: 0, y: 10 };
  const angle = (37 * Math.PI) / 180;
  const current = { x: 10 * Math.sin(angle), y: 10 * Math.cos(angle) };
  assert.equal(
    rotationDelta(center, start, current, stepFor(DEFAULT_ROTATION, false)),
    37,
  );
  // The same drag with Shift held lands on the nearest multiple of five.
  assert.equal(
    rotationDelta(center, start, current, stepFor(DEFAULT_ROTATION, true)),
    35,
  );
});

test('both increments are adjustable, and unusable values mean continuous', () => {
  const custom = { stepDegrees: 0.5, coarseStepDegrees: 15 };
  assert.equal(stepFor(custom, false), 0.5);
  assert.equal(stepFor(custom, true), 15);

  // A blanked-out or nonsense field must give free rotation, never a form
  // pinned to 0 degrees.
  assert.equal(normaliseStep(0), 0);
  assert.equal(normaliseStep(-3), 0);
  assert.equal(normaliseStep(Number.NaN), 0);
  assert.equal(stepFor({ stepDegrees: 0, coarseStepDegrees: 5 }, false), 0);
  assert.equal(rotationDelta({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 0 }, 0), 90);

  // And nothing silly gets through.
  assert.equal(normaliseStep(4000), MAX_ROTATION_STEP);
  assert.equal(normaliseStep(1.006), 1.01);
});

test('angles wrap into 0-360', () => {
  assert.equal(normaliseDegrees(370), 10);
  assert.equal(normaliseDegrees(-10), 350);
  assert.equal(normaliseDegrees(0), 0);
  assert.equal(normaliseDegrees(360), 0);
});

test('snapping rounds to the nearest step', () => {
  assert.equal(snapDegrees(37, 5), 35);
  assert.equal(snapDegrees(38, 5), 40);
  assert.equal(snapDegrees(37.4, 1), 37);
  assert.equal(snapDegrees(-2, 5), 0);
});

test('a step of zero disables snapping instead of collapsing to zero', () => {
  // Clearing the setting should give continuous rotation, not freeze the form.
  assert.equal(snapDegrees(37.4, 0), 37.4);
  assert.equal(snapDegrees(37.4, -5), 37.4);
});

test('snapping leaves no float dust', () => {
  const snapped = snapDegrees(44.9999, 45);
  assert.equal(snapped, 45);
  assert.equal(String(snapped), '45');
});

test('the handle reads zero degrees at the top of the selection', () => {
  // Screen-up is +y in drill units, so a handle above the centre is 0 degrees.
  const centre = { x: 0, y: 0 };
  assert.equal(angleFromCenter(centre, { x: 0, y: 10 }), 0);
  assert.equal(angleFromCenter(centre, { x: 10, y: 0 }), 90);
  assert.equal(angleFromCenter(centre, { x: 0, y: -10 }), 180);
  assert.equal(angleFromCenter(centre, { x: -10, y: 0 }), 270);
});

test('a degenerate handle position does not produce NaN', () => {
  assert.equal(angleFromCenter({ x: 5, y: 5 }, { x: 5, y: 5 }), 0);
});

test('a rotation drag reports the turn it made', () => {
  const centre = { x: 0, y: 0 };
  // From straight up to straight right is a quarter turn clockwise.
  assert.equal(rotationDelta(centre, { x: 0, y: 10 }, { x: 10, y: 0 }, 5), 90);
  assert.equal(rotationDelta(centre, { x: 10, y: 0 }, { x: 0, y: 10 }, 5), -90);
});

test('a drag past zero takes the short way round', () => {
  // Dragging from just clockwise of the top to just anticlockwise of it is a
  // small negative turn, not a 350 degree spin.
  const centre = { x: 0, y: 0 };
  const start = { x: 1, y: 10 };   // a few degrees clockwise of up
  const end = { x: -1, y: 10 };    // a few degrees anticlockwise of up
  const delta = rotationDelta(centre, start, end, 0);
  assert.ok(delta < 0 && delta > -30, `expected a small negative turn, got ${delta}`);
});

test('a rotation drag snaps to the chosen step', () => {
  const centre = { x: 0, y: 0 };
  const start = { x: 0, y: 10 };
  // 37 degrees clockwise of up.
  const radians = (37 * Math.PI) / 180;
  const end = { x: Math.sin(radians) * 10, y: Math.cos(radians) * 10 };

  assert.equal(rotationDelta(centre, start, end, 5), 35);
  assert.equal(rotationDelta(centre, start, end, 1), 37);
  // No snapping at all keeps the raw angle.
  const raw = rotationDelta(centre, start, end, 0);
  assert.ok(Math.abs(raw - 37) < 1e-6);
});

test('the delta feeds rotateAbout to give the turned form', () => {
  // The handle and the existing rotate tool must agree about direction:
  // a positive delta is clockwise on screen, which is -y from +x.
  const centre = { x: 0, y: 0 };
  const delta = rotationDelta(centre, { x: 0, y: 10 }, { x: 10, y: 0 }, 5);
  const [turned] = rotateAbout([{ x: 0, y: 10 }], centre, delta);
  assert.ok(Math.abs(turned.x - 10) < 1e-6, `expected x=10, got ${turned.x}`);
  assert.ok(Math.abs(turned.y) < 1e-6, `expected y=0, got ${turned.y}`);
});

test('deltas format with a sign for the readout', () => {
  assert.equal(formatDelta(45), '+45°');
  assert.equal(formatDelta(-15), '-15°');
  assert.equal(formatDelta(0), '0°');
  assert.equal(formatDelta(37.45), '+37.5°');
});

test('the rig puts its grip clear of the form, above it on screen', () => {
  const rig = rotationRigFor([
    { x: 70, y: 20 },
    { x: 90, y: 28 },
  ]);
  assert.ok(rig);
  assert.deepEqual(rig.center, { x: 80, y: 24 });
  // Up the screen is +y: drill y grows away from the front sideline, which is
  // drawn along the bottom.
  assert.ok(rig.handle.y > rig.center.y);
  assert.equal(rig.handle.x, rig.center.x);
  // And clear of the widest point of the form.
  assert.ok(rig.reach > 90 - rig.center.x);
});

test('a lopsided selection still gets its grip outside the form', () => {
  // Regression guard: half of the overall spread is not enough when the
  // centroid is dragged toward a cluster, because the far edge is then further
  // from the centre than half the spread.
  const points = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
    { x: 40, y: 0 },
  ];
  const rig = rotationRigFor(points);
  assert.ok(rig);
  const furthest = Math.max(...points.map((p) => Math.abs(p.x - rig.center.x)));
  assert.ok(
    rig.reach > furthest,
    `grip at ${rig.reach} would sit inside a form reaching ${furthest}`,
  );
});

test('a single performer gets a grip they can actually see', () => {
  const rig = rotationRigFor([{ x: 40, y: 12 }]);
  assert.ok(rig);
  assert.deepEqual(rig.center, { x: 40, y: 12 });
  assert.ok(rig.reach >= 7, 'a lone marker still needs the handle held off it');
});

test('nothing selected draws no rig, and junk positions draw none either', () => {
  assert.equal(rotationRigFor([]), null);
  assert.equal(rotationRigFor([{ x: Number.NaN, y: 3 }]), null);
});
