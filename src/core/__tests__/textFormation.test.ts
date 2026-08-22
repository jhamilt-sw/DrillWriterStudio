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
  DEFAULT_TEXT_OPTIONS,
  MAX_TEXT_HEIGHT,
  MIN_TEXT_HEIGHT,
  allocatePerformers,
  buildTextFormation,
  layoutText,
  measureText,
  planText,
} from '../textFormation.ts';
import { findCrossings } from '../assignment.ts';

const options = { ...DEFAULT_TEXT_OPTIONS, center: { x: 80, y: 28 } };

test('a word is centred on the point it was asked for', () => {
  const layout = layoutText('BAND', options);
  const xs = layout.glyphs.flatMap((glyph) => [glyph.origin.x, glyph.origin.x + glyph.widthSteps]);
  const middle = (Math.min(...xs) + Math.max(...xs)) / 2;
  assert.ok(Math.abs(middle - 80) < 1e-9, `word centred at ${middle}`);
  // Vertically too: the cap height straddles the centre.
  assert.ok(Math.abs(layout.glyphs[0].origin.y + layout.heightSteps / 2 - 28) < 1e-9);
});

test('letters are laid out left to right without overlapping', () => {
  const layout = layoutText('ABC', options);
  assert.deepEqual(layout.glyphs.map((glyph) => glyph.character), ['A', 'B', 'C']);
  for (let i = 1; i < layout.glyphs.length; i += 1) {
    const previous = layout.glyphs[i - 1];
    const current = layout.glyphs[i];
    assert.ok(
      current.origin.x >= previous.origin.x + previous.widthSteps,
      `${current.character} starts before ${previous.character} ends`,
    );
  }
});

test('a space takes up room but holds nobody', () => {
  const withSpace = measureText('GO BAND', options);
  const without = measureText('GOBAND', options);
  assert.ok(withSpace > without, 'the space should widen the word');
  const allocation = allocatePerformers(layoutText('GO BAND', options).glyphs, 60);
  const space = allocation.find((entry) => entry.character === ' ');
  assert.equal(space?.count, 0);
});

test('every performer is placed, and only once', () => {
  for (const count of [7, 24, 60, 137, 250]) {
    const points = buildTextFormation('GO BAND', count, options);
    assert.equal(points.length, count, `${count} performers produced ${points.length} spots`);
  }
});

test('wider letters get more performers than narrow ones', () => {
  // A W has far more line to stand on than an I. Splitting evenly would leave
  // the W as a sketch and the I as a queue.
  const allocation = allocatePerformers(layoutText('WI', options).glyphs, 40);
  const w = allocation.find((entry) => entry.character === 'W')!.count;
  const i = allocation.find((entry) => entry.character === 'I')!.count;
  assert.ok(w > i, `W got ${w} and I got ${i}`);
});

test('the whole selection is used, never rounded away', () => {
  // Largest-remainder apportionment: the fractions have to go somewhere, and
  // dropping them would quietly leave performers standing where they were.
  for (const count of [11, 23, 47, 91]) {
    const allocation = allocatePerformers(layoutText('DRILL', options).glyphs, count);
    const total = allocation.reduce((sum, entry) => sum + entry.count, 0);
    assert.equal(total, count);
  }
});

test('every letter gets somebody before any letter gets a crowd', () => {
  // A word with a letter missing is a different word.
  const allocation = allocatePerformers(layoutText('BAND', options).glyphs, 5);
  assert.ok(allocation.every((entry) => entry.count >= 1));
});

test('too few performers is reported rather than hidden', () => {
  const plan = planText(
    [{ id: 'a', point: { x: 0, y: 0 } }, { id: 'b', point: { x: 1, y: 0 } }],
    'BAND',
    options,
  );
  // Four letters, two people: the caller needs to be able to say so.
  assert.equal(plan.shortfall, 2);
});

test('characters the font cannot draw are named', () => {
  const plan = planText([{ id: 'a', point: { x: 0, y: 0 } }], 'A♥B', options);
  assert.deepEqual(plan.unsupported, ['♥']);
  // And the rest of the word still forms.
  assert.equal(Object.keys(plan.targets).length, 1);
});

test('spelling a word never crosses two performers over each other', () => {
  // The same guarantee the shape tools have, and it matters more here: a naive
  // assignment sends the last person in the roster to the far end of the field.
  const current = Array.from({ length: 40 }, (_, index) => ({
    id: `p${index}`,
    point: { x: 60 + (index % 10) * 4, y: 12 + Math.floor(index / 10) * 3 },
  }));
  const plan = planText(current, 'GO', options);
  const paths = current
    .filter((performer) => plan.targets[performer.id])
    .map((performer) => ({
      id: performer.id,
      from: performer.point,
      to: plan.targets[performer.id],
    }));
  assert.equal(paths.length, current.length);
  assert.deepEqual(findCrossings(paths), []);
});

test('the height is clamped to something a field can hold', () => {
  assert.equal(layoutText('A', { ...options, heightSteps: 1000 }).heightSteps, MAX_TEXT_HEIGHT);
  assert.equal(layoutText('A', { ...options, heightSteps: 0 }).heightSteps, MIN_TEXT_HEIGHT);
});

test('a taller word is a wider word, in proportion', () => {
  const small = measureText('BAND', { ...options, heightSteps: 8, letterSpacingSteps: 0 });
  const large = measureText('BAND', { ...options, heightSteps: 16, letterSpacingSteps: 0 });
  assert.ok(Math.abs(large - small * 2) < 1e-9);
});

test('empty and blank text produce nothing rather than a pile at the centre', () => {
  assert.deepEqual(buildTextFormation('', 20, options), []);
  assert.deepEqual(buildTextFormation('   ', 20, options), []);
  assert.equal(measureText('', options), 0);
  const plan = planText([{ id: 'a', point: { x: 0, y: 0 } }], '', options);
  assert.deepEqual(plan.targets, {});
});

test('lowercase input spells the same word as uppercase', () => {
  assert.equal(measureText('band', options), measureText('BAND', options));
});
