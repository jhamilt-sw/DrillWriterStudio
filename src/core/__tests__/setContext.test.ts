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

import { describeMusicPosition, setContextAtCount } from '../setContext.ts';
import { createEmptyShow } from '../show.ts';
import type { Show } from '../types.ts';

/** A show of `count` sets, each 16 counts after the opener. */
function showWithSets(count: number): Show {
  const show = createEmptyShow('Run-through');
  show.sets = Array.from({ length: count }, (_, index) => ({
    id: `s${index}`,
    label: String(index + 1),
    counts: index === 0 ? 0 : 16,
    positions: {},
  }));
  return show;
}

test('at the top of the show there is nothing before the opening set', () => {
  const show = showWithSets(3);
  const context = setContextAtCount(show, 0);
  // Not "Set 1 → Set 1": a null reads as "nothing before this", where a
  // duplicate would read as a bug.
  assert.equal(context.previous?.label, '1');
  assert.equal(context.current.label, '2');
  assert.equal(context.next?.label, '3');
});

test('the current set is the one being moved into', () => {
  // Mid-move between set 2 and set 3, a director calls "moving to 3".
  const show = showWithSets(4);
  const context = setContextAtCount(show, 20);
  assert.equal(context.previous?.label, '2');
  assert.equal(context.current.label, '3');
  assert.equal(context.next?.label, '4');
});

test('counts in and counts remaining always add up to the move', () => {
  const show = showWithSets(3);
  for (const count of [0, 1, 5, 8, 15, 16]) {
    const context = setContextAtCount(show, count);
    assert.equal(
      context.countsIn + context.countsRemaining,
      context.current.counts,
      `at count ${count} the readout did not add up`,
    );
  }
});

test('a fraction of a count left still reads as one to go', () => {
  const show = showWithSets(2);
  const context = setContextAtCount(show, 15.5);
  assert.equal(context.countsRemaining, 1);
  assert.equal(context.arrived, false);
  // And zero to go only ever means arrived.
  const done = setContextAtCount(show, 16);
  assert.equal(done.countsRemaining, 0);
  assert.equal(done.arrived, true);
});

test('the end of the show has nothing after it', () => {
  const show = showWithSets(3);
  const context = setContextAtCount(show, 1000);
  assert.equal(context.current.label, '3');
  assert.equal(context.next, null);
  assert.equal(context.arrived, true);
});

test('arrival counts are cumulative, so the overlay agrees with the timeline', () => {
  const show = showWithSets(4);
  const context = setContextAtCount(show, 40);
  assert.equal(context.current.label, '4');
  assert.equal(context.current.countAtArrival, 48);
  assert.equal(context.previous?.countAtArrival, 32);
});

test('a set with no counts does not divide by zero', () => {
  // A zero-count set is a legitimate thing to write — two forms on the same
  // beat — and the naive progress calculation is 0/0.
  const show = showWithSets(3);
  show.sets[1].counts = 0;
  const context = setContextAtCount(show, 0);
  assert.equal(context.current.label, '2');
  assert.ok(Number.isFinite(context.progress), 'progress was not a number');
  assert.equal(context.progress, 1);
  assert.equal(context.countsIn, 0);
  assert.equal(context.countsRemaining, 0);
  assert.equal(context.arrived, true);
});

test('arriving at a set is not the same as moving into the next one', () => {
  // On the beat of arrival the overlay should still name the set just reached,
  // not jump ahead — a director calling "and… 3" is on 3, not on 4.
  const show = showWithSets(4);
  const context = setContextAtCount(show, 16);
  assert.equal(context.current.label, '2');
  assert.equal(context.arrived, true);
  assert.equal(context.next?.label, '3');
});

test('a negative playhead is treated as the top of the show', () => {
  const show = showWithSets(3);
  assert.deepEqual(setContextAtCount(show, -50), setContextAtCount(show, 0));
});

test('music position is written the way it appears on a sheet', () => {
  const show = showWithSets(2);
  show.sets[1].music = { measure: 12, beat: 3 };
  const context = setContextAtCount(show, 4);
  assert.equal(describeMusicPosition(context.current), 'm. 12 b. 3');
  // A set with no music anchor says nothing rather than inventing a measure.
  assert.equal(describeMusicPosition(context.previous!), null);
});
