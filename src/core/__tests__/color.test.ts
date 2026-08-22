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
  contrastRatio,
  darken,
  isValidHex,
  lighten,
  parseHex,
  readableInkOn,
  relativeLuminance,
  shade,
  toHex,
} from '../color.ts';
import { DEFAULT_APPEARANCE } from '../field.ts';

test('hex parses in both short and long form', () => {
  assert.deepEqual(parseHex('#ffffff'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseHex('#fff'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseHex('3d7a3f'), { r: 0x3d, g: 0x7a, b: 0x3f });
  assert.equal(parseHex('chartreuse'), null);
  assert.equal(parseHex('#12345'), null);
  assert.equal(parseHex(''), null);
});

test('round-tripping a colour is lossless', () => {
  for (const hex of ['#000000', '#ffffff', '#3d7a3f', '#1f6feb']) {
    assert.equal(toHex(parseHex(hex)!), hex);
  }
});

test('shading moves toward white or black and clamps at the ends', () => {
  assert.equal(shade('#000000', 1), '#ffffff');
  assert.equal(shade('#ffffff', -1), '#000000');
  assert.equal(shade('#808080', 0), '#808080');
  // Lighten and darken are the signed halves of the same operation.
  assert.equal(lighten('#404040', 0.5), shade('#404040', 0.5));
  assert.equal(darken('#404040', 0.5), shade('#404040', -0.5));
});

test('an invalid colour is passed through rather than becoming black', () => {
  // Turf that failed to parse must not silently paint the field a solid slab.
  assert.equal(shade('not-a-colour', 0.2), 'not-a-colour');
});

test('mowing stripes stay close to the turf they came from', () => {
  const turf = DEFAULT_APPEARANCE.turfColor;
  const stripe = lighten(turf, 0.06);
  assert.notEqual(stripe, turf);
  // Visible, but nothing like a different colour: a mown band, not a stripe of paint.
  assert.ok(contrastRatio(turf, stripe) < 1.3, 'stripes should be a subtle shift');
});

test('white paint reads clearly on the default grass', () => {
  const { turfColor, lineColor } = DEFAULT_APPEARANCE;
  assert.ok(
    contrastRatio(turfColor, lineColor) > 4.5,
    `white lines on grass should clear AA, got ${contrastRatio(turfColor, lineColor).toFixed(2)}`,
  );
});

test('ink colour flips at the right point', () => {
  assert.equal(readableInkOn('#ffffff'), '#111111');
  assert.equal(readableInkOn('#000000'), '#FFFFFF');
  assert.equal(readableInkOn(DEFAULT_APPEARANCE.turfColor), '#FFFFFF');
});

test('luminance and contrast follow the WCAG definition', () => {
  assert.ok(Math.abs(relativeLuminance('#ffffff') - 1) < 1e-9);
  assert.ok(Math.abs(relativeLuminance('#000000')) < 1e-9);
  assert.ok(Math.abs(contrastRatio('#ffffff', '#000000') - 21) < 1e-9);
});

test('validity check matches the parser', () => {
  assert.equal(isValidHex('#3d7a3f'), true);
  assert.equal(isValidHex('rgb(1,2,3)'), false);
});
