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
  FIELD_Y_DIRECTION,
  deltaToDrill,
  nudgeDelta,
  fitFieldToBox,
  markerRadius,
  pixelRect,
  toDrill,
  toPixels,
  zoomAbout,
} from '../transform.ts';
import type { FieldConfig } from '../types.ts';

const config: FieldConfig = {
  type: 'highSchool',
  stepsPerFiveYards: 8,
  showEndZones: false,
  appearance: DEFAULT_APPEARANCE,
};
const metrics = fieldMetrics(config);

const close = (actual: number, expected: number, tolerance = 1e-6) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};

test('fitting a field uses whichever dimension binds', () => {
  // 160 x 85.33 steps into 1000 x 400 px. Width alone would allow 6.25 px per
  // step, height only 4.69 — so height binds and the field is centred across.
  const tall = fitFieldToBox(metrics, 1000, 400, { padding: 0 });
  close(tall.scale, 400 / metrics.depthSteps);
  close(tall.offsetX, (1000 - metrics.widthSteps * tall.scale) / 2);
  // Front sideline at the bottom: drill y = 0 sits at the bottom edge.
  close(tall.offsetY, 400);

  const wide = fitFieldToBox(metrics, 800, 1000, { padding: 0 });
  close(wide.scale, 800 / metrics.widthSteps);
  close(wide.offsetX, 0);
  const renderedHeight = metrics.depthSteps * wide.scale;
  close(wide.offsetY, (1000 - renderedHeight) / 2 + renderedHeight);
});

test('the front sideline is drawn below the back sideline', () => {
  const viewport = fitFieldToBox(metrics, 1000, 400, { padding: 0 });
  const front = toPixels({ x: 80, y: 0 }, viewport);
  const frontHash = toPixels({ x: 80, y: metrics.frontHashY }, viewport);
  const backHash = toPixels({ x: 80, y: metrics.backHashY }, viewport);
  const back = toPixels({ x: 80, y: metrics.depthSteps }, viewport);

  // Larger screen y is further down the screen.
  assert.ok(front.y > frontHash.y, 'front sideline should sit below the front hash');
  assert.ok(frontHash.y > backHash.y, 'front hash should sit below the back hash');
  assert.ok(backHash.y > back.y, 'back hash should sit below the back sideline');
});

test('a drag delta accounts for the flip', () => {
  const viewport = fitFieldToBox(metrics, 1000, 400, { padding: 0 });
  // Dragging the cursor DOWN the screen must decrease drill y — toward the
  // front sideline — not increase it.
  const dragged = deltaToDrill(0, 10, viewport);
  assert.ok(dragged.y < 0, 'dragging down should move toward the front sideline');
  close(dragged.y, -10 / viewport.scale);
  close(deltaToDrill(10, 0, viewport).x, 10 / viewport.scale);
});

test('a pixel rectangle is normalised whichever way the field is drawn', () => {
  const viewport = fitFieldToBox(metrics, 1000, 400, { padding: 0 });
  const rect = pixelRect({ x: 10, y: 10 }, { x: 30, y: 40 }, viewport);
  assert.ok(rect.width > 0 && rect.height > 0);
  close(rect.width, 20 * viewport.scale);
  close(rect.height, 30 * viewport.scale);
});

test('the Side 1 goal line at the front sideline maps to the origin', () => {
  const viewport = fitFieldToBox(metrics, 1000, 400, { padding: 0 });
  const origin = toPixels({ x: 0, y: 0 }, viewport);
  close(origin.x, viewport.offsetX);
  close(origin.y, viewport.offsetY);
});

test('pixel and drill coordinates round-trip', () => {
  const viewport = fitFieldToBox(metrics, 1200, 600, { padding: 24 });
  for (const point of [
    { x: 0, y: 0 },
    { x: 80, y: 42.5 },
    { x: 160, y: 85 },
    { x: 56.25, y: 28.4444 },
  ]) {
    const roundTripped = toDrill(toPixels(point, viewport), viewport);
    close(roundTripped.x, point.x);
    close(roundTripped.y, point.y);
  }
});

test('the 50 yard line lands at the centre of a fitted field', () => {
  const viewport = fitFieldToBox(metrics, 1000, 400, { padding: 0 });
  close(toPixels({ x: metrics.fiftyX, y: 0 }, viewport).x, 500);
});

test('end zones are reserved outside the goal lines', () => {
  const withEndZones = fieldMetrics({ ...config, showEndZones: true });
  const viewport = fitFieldToBox(withEndZones, 1000, 400, { padding: 0 });

  // The back of the near end zone sits at x = -endZoneSteps in drill units.
  const backOfEndZone = toPixels({ x: -withEndZones.endZoneSteps, y: 0 }, viewport);
  // Fitting 192 steps of content into 1000px at 4.6875 px/step leaves 50px of
  // slack either side, so the end zone's outer edge lands there, not at 0.
  close(backOfEndZone.x, 50);
  assert.ok(backOfEndZone.x >= 0, 'end zone must not fall off the left edge');

  // The 50 stays dead centre whether or not end zones are drawn.
  close(toPixels({ x: withEndZones.fiftyX, y: 0 }, viewport).x, 500);
});

test('zooming keeps the point under the cursor fixed', () => {
  const viewport = fitFieldToBox(metrics, 1000, 400, { padding: 0 });
  const cursor = { x: 321, y: 210 };
  const before = toDrill(cursor, viewport);
  const zoomed = zoomAbout(viewport, cursor, 2.5, { min: 0.5, max: 100 });
  const after = toDrill(cursor, zoomed);
  close(after.x, before.x, 1e-9);
  close(after.y, before.y, 1e-9);
  close(zoomed.scale, viewport.scale * 2.5);
});

test('zoom respects its limits and still keeps the cursor fixed', () => {
  const viewport = fitFieldToBox(metrics, 1000, 400, { padding: 0 });
  const cursor = { x: 100, y: 100 };
  const before = toDrill(cursor, viewport);
  const clamped = zoomAbout(viewport, cursor, 1000, { min: 0.5, max: 20 });
  assert.equal(clamped.scale, 20);
  const after = toDrill(cursor, clamped);
  close(after.x, before.x, 1e-9);
  close(after.y, before.y, 1e-9);
});

test('markers stay within a legible size range', () => {
  assert.ok(markerRadius({ scale: 0.5, offsetX: 0, offsetY: 0, yDirection: -1 }) >= 2.5);
  assert.ok(markerRadius({ scale: 500, offsetX: 0, offsetY: 0, yDirection: -1 }) <= 9);
});

test('marker size can be scaled past the zoom ceiling', () => {
  const zoomedIn = { scale: 500, offsetX: 0, offsetY: 0, yDirection: -1 as const };
  const base = markerRadius(zoomedIn);
  assert.equal(base, 9, 'the base is clamped so a full-field view stays readable');
  // The multiplier applies on top of the clamp, so "bigger" always works.
  close(markerRadius(zoomedIn, 2), 18);
  close(markerRadius(zoomedIn, 0.5), 4.5);
});

test('marker size multipliers are bounded', () => {
  const viewport = { scale: 10, offsetX: 0, offsetY: 0, yDirection: -1 as const };
  const base = markerRadius(viewport);
  assert.equal(markerRadius(viewport, 99), base * 3);
  assert.equal(markerRadius(viewport, 0), base * 0.4);
  assert.equal(markerRadius(viewport, -5), base * 0.4);
});

test('arrow keys nudge the way the screen looks, not the way drill y counts', () => {
  // Regression: the field is drawn front-sideline-down, so screen-up is an
  // INCREASE in drill y. The naive mapping inverted the vertical arrows.
  assert.deepEqual(nudgeDelta('up', 1), { dx: 0, dy: 1 });
  assert.deepEqual(nudgeDelta('down', 1), { dx: 0, dy: -1 });
  assert.deepEqual(nudgeDelta('left', 1), { dx: -1, dy: 0 });
  assert.deepEqual(nudgeDelta('right', 1), { dx: 1, dy: 0 });
});

test('a nudge agrees with a mouse drag in the same screen direction', () => {
  // The two paths must not disagree: dragging up and pressing Up should move a
  // performer the same way.
  const viewport = fitFieldToBox(metrics, 1000, 400, { padding: 0 });
  const draggedUp = deltaToDrill(0, -20, viewport);
  const nudgedUp = nudgeDelta('up', 1);
  assert.ok(
    Math.sign(draggedUp.y) === Math.sign(nudgedUp.dy),
    'dragging up and nudging up must move the same way',
  );
});

test('the nudge mapping follows the orientation constant', () => {
  // If the convention were ever flipped, the arrows follow rather than invert.
  assert.deepEqual(nudgeDelta('up', 2, 1), { dx: 0, dy: -2 });
  assert.deepEqual(nudgeDelta('up', 2, -1), { dx: 0, dy: 2 });
  assert.equal(FIELD_Y_DIRECTION, -1);
});
