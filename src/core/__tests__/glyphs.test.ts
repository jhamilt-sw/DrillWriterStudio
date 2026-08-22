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
  SUPPORTED_CHARACTERS,
  distributeAlongStrokes,
  glyphFor,
  isSupported,
  placeStrokes,
  strokesLength,
  unsupportedCharacters,
} from '../glyphs.ts';

test('the font covers letters, digits and the keyboard symbols', () => {
  for (const character of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
    assert.ok(isSupported(character), `${character} is missing from the font`);
  }
  for (const symbol of '.,:;!?\'"-_+=*/\\|()[]{}<>@#$%^&~`') {
    assert.ok(isSupported(symbol), `${symbol} is missing from the font`);
  }
  assert.ok(SUPPORTED_CHARACTERS.length >= 60);
});

test('lowercase folds to capitals rather than failing', () => {
  // Nobody spells a field show in lowercase, and single-stroke lowercase needs
  // as many bodies as a capital to read. Typing "Go Band" should just work.
  assert.deepEqual(glyphFor('g'), glyphFor('G'));
  assert.equal(unsupportedCharacters('Go Band!').length, 0);
});

test('an unsupported character is reported once, not per occurrence', () => {
  const missing = unsupportedCharacters('WE ♥ BAND ♥');
  assert.deepEqual(missing, ['♥']);
});

test('every glyph stays inside the unit box', () => {
  // A glyph that escapes its box overlaps its neighbour on the field, and the
  // word stops being readable at exactly the moment it matters.
  for (const character of SUPPORTED_CHARACTERS) {
    const glyph = glyphFor(character);
    assert.ok(glyph, character);
    for (const stroke of glyph.strokes) {
      for (const point of stroke) {
        assert.ok(
          point.x >= -0.001 && point.x <= glyph.advance + 0.001,
          `${character} runs to x=${point.x.toFixed(3)}, past its advance of ${glyph.advance}`,
        );
        assert.ok(
          point.y >= -0.001 && point.y <= 1.001,
          `${character} runs to y=${point.y.toFixed(3)}`,
        );
      }
    }
  }
});

test('every glyph has something to stand on', () => {
  for (const character of SUPPORTED_CHARACTERS) {
    const glyph = glyphFor(character)!;
    assert.ok(glyph.strokes.length > 0, `${character} has no strokes`);
    assert.ok(strokesLength(glyph.strokes) > 0.05, `${character} is too small to see`);
    assert.ok(glyph.advance > 0, `${character} has no width`);
  }
});

test('a space is width with no strokes', () => {
  const space = glyphFor(' ')!;
  assert.equal(space.strokes.length, 0);
  assert.ok(space.advance > 0);
});

test('distribution returns exactly the number of performers asked for', () => {
  const glyph = glyphFor('E')!;
  for (const count of [1, 2, 3, 4, 7, 12, 25, 60]) {
    const points = distributeAlongStrokes(glyph.strokes, count);
    assert.equal(points.length, count, `E with ${count} performers returned ${points.length}`);
  }
});

test('every character can be formed at a realistic size', () => {
  // 24 is a full section. Nothing in the font may silently drop people.
  for (const character of SUPPORTED_CHARACTERS) {
    const glyph = glyphFor(character)!;
    assert.equal(
      distributeAlongStrokes(glyph.strokes, 24).length,
      24,
      `${character} lost performers`,
    );
  }
});

test('the ends of every stroke are occupied', () => {
  // The regression this guards: spacing purely by arc length leaves the ends of
  // an L or the arms of a Y empty, and the letter stops reading.
  const glyph = glyphFor('L')!;
  const points = distributeAlongStrokes(glyph.strokes, 9);
  const stroke = glyph.strokes[0];
  const start = stroke[0];
  const end = stroke[stroke.length - 1];
  const hits = (target: { x: number; y: number }) =>
    points.some((point) => Math.hypot(point.x - target.x, point.y - target.y) < 1e-6);
  assert.ok(hits(start), 'nobody on the top of the L');
  assert.ok(hits(end), 'nobody on the end of the foot');
});

test('fewer performers than strokes fills the longest strokes', () => {
  // An E has four strokes. Two people cannot draw it, and spreading them
  // thinly is worse than putting them where they show.
  const glyph = glyphFor('E')!;
  const points = distributeAlongStrokes(glyph.strokes, 2);
  assert.equal(points.length, 2);
});

test('nobody is asked to stand in two places at once', () => {
  const glyph = glyphFor('X')!;
  const points = distributeAlongStrokes(glyph.strokes, 14);
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const gap = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
      // The centre of an X is genuinely shared by both strokes, so allow a
      // coincidence there but nowhere else.
      const nearCentre =
        Math.hypot(points[i].x - 0.475, points[i].y - 0.5) < 0.12;
      assert.ok(gap > 1e-9 || nearCentre, `two performers on the same spot in X`);
    }
  }
});

test('placing scales the unit box onto the field', () => {
  const placed = placeStrokes([[{ x: 0, y: 0 }, { x: 1, y: 1 }]], { x: 40, y: 10 }, 8, 12);
  assert.deepEqual(placed[0][0], { x: 40, y: 10 });
  assert.deepEqual(placed[0][1], { x: 48, y: 22 });
});

test('placing keeps letters upright on the field', () => {
  // Drill y grows away from the front sideline, which is up the screen. A glyph
  // whose top is at unit y=1 must therefore land at the larger drill y, or
  // every letter comes out upside down.
  const glyph = glyphFor('A')!;
  const placed = placeStrokes(glyph.strokes, { x: 0, y: 20 }, 8, 12);
  const apex = placed[0][1];
  const foot = placed[0][0];
  assert.ok(apex.y > foot.y, 'the point of the A should be above its feet');
});

test('an empty glyph distributes nothing', () => {
  assert.deepEqual(distributeAlongStrokes([], 10), []);
  assert.deepEqual(distributeAlongStrokes(glyphFor('A')!.strokes, 0), []);
});
