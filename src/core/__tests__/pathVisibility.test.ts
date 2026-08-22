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
  DEFAULT_PATH_VISIBILITY,
  type PathVisibilitySettings,
  describePathScope,
  pathsEnabled,
  toggleId,
  visiblePathPerformers,
} from '../pathVisibility.ts';
import { frameAtCount, positionsAtCount } from '../interpolate.ts';
import { DEFAULT_APPEARANCE } from '../field.ts';
import type { Performer, Show } from '../types.ts';

const performers: Performer[] = [
  { id: 'tp1', label: 'TP1', name: '', sectionId: 'brass', order: 0 },
  { id: 'tp2', label: 'TP2', name: '', sectionId: 'brass', order: 1 },
  { id: 'sn1', label: 'SN1', name: '', sectionId: 'perc', order: 0 },
  { id: 'cg1', label: 'CG1', name: '', sectionId: 'guard', order: 0 },
];

const settings = (patch: Partial<PathVisibilitySettings>): PathVisibilitySettings => ({
  ...DEFAULT_PATH_VISIBILITY,
  ...patch,
});

test('paths are on while editing and off during playback by default', () => {
  assert.equal(DEFAULT_PATH_VISIBILITY.whileEditing, true);
  assert.equal(DEFAULT_PATH_VISIBILITY.whilePlaying, false);
  assert.equal(pathsEnabled(DEFAULT_PATH_VISIBILITY, false), true);
  assert.equal(pathsEnabled(DEFAULT_PATH_VISIBILITY, true), false);
});

test('the two switches are independent', () => {
  const playbackOnly = settings({ whileEditing: false, whilePlaying: true });
  assert.equal(pathsEnabled(playbackOnly, false), false);
  assert.equal(pathsEnabled(playbackOnly, true), true);
});

test('the "all" scope covers the whole roster', () => {
  const visible = visiblePathPerformers(performers, settings({ scope: 'all' }), []);
  assert.equal(visible.size, 4);
  assert.ok(visible.has('cg1'));
});

test('the "selected" scope follows the selection', () => {
  const visible = visiblePathPerformers(
    performers,
    settings({ scope: 'selected' }),
    ['tp1', 'sn1'],
  );
  assert.deepEqual([...visible].sort(), ['sn1', 'tp1']);
});

test('a stale selection cannot resurrect a deleted performer', () => {
  const visible = visiblePathPerformers(
    performers,
    settings({ scope: 'selected' }),
    ['tp1', 'ghost'],
  );
  assert.deepEqual([...visible], ['tp1']);
});

test('the "custom" scope takes whole sections', () => {
  const visible = visiblePathPerformers(
    performers,
    settings({ scope: 'custom', sectionIds: ['brass'] }),
    [],
  );
  assert.deepEqual([...visible].sort(), ['tp1', 'tp2']);
});

test('the "custom" scope takes individuals', () => {
  const visible = visiblePathPerformers(
    performers,
    settings({ scope: 'custom', performerIds: ['cg1'] }),
    [],
  );
  assert.deepEqual([...visible], ['cg1']);
});

test('sections and individuals combine without duplicating', () => {
  const visible = visiblePathPerformers(
    performers,
    // tp1 is named individually AND is in the chosen section.
    settings({ scope: 'custom', sectionIds: ['brass'], performerIds: ['tp1', 'sn1'] }),
    [],
  );
  assert.equal(visible.size, 3);
  assert.deepEqual([...visible].sort(), ['sn1', 'tp1', 'tp2']);
});

test('the custom scope ignores the selection entirely', () => {
  const visible = visiblePathPerformers(
    performers,
    settings({ scope: 'custom', sectionIds: ['perc'] }),
    ['tp1', 'tp2', 'cg1'],
  );
  assert.deepEqual([...visible], ['sn1']);
});

test('an empty custom scope shows nobody rather than everybody', () => {
  // The failure mode worth guarding: "nothing chosen" must not fall back to
  // "draw all 250".
  const visible = visiblePathPerformers(performers, settings({ scope: 'custom' }), []);
  assert.equal(visible.size, 0);
});

test('the scope describes itself for the status line', () => {
  assert.equal(describePathScope(settings({ scope: 'all' }), 4, 4), 'all 4');
  assert.equal(describePathScope(settings({ scope: 'selected' }), 2, 4), '2 selected');
  assert.equal(
    describePathScope(settings({ scope: 'selected' }), 0, 4),
    'selection (none selected)',
  );
  assert.equal(describePathScope(settings({ scope: 'custom' }), 3, 4), '3 chosen');
});

test('toggling an id adds then removes it', () => {
  assert.deepEqual(toggleId([], 'a'), ['a']);
  assert.deepEqual(toggleId(['a'], 'a'), []);
  assert.deepEqual(toggleId(['a', 'b'], 'c'), ['a', 'b', 'c']);
  // Non-mutating.
  const original = ['a'];
  toggleId(original, 'b');
  assert.deepEqual(original, ['a']);
});

// --- the frame that paths and positions must agree on ----------------------

function showWithSets(): Show {
  return {
    schemaVersion: 1,
    metadata: { title: '', ensemble: '', season: '', designer: '' },
    field: { type: 'highSchool', stepsPerFiveYards: 8, showEndZones: true, appearance: DEFAULT_APPEARANCE },
    sections: [
      { id: 'brass', name: 'Brass', abbreviation: 'BR', color: '#000', symbol: 'circle' },
    ],
    performers: [{ id: 'p1', label: 'B1', name: '', sectionId: 'brass', order: 0 }],
    sets: [
      { id: 's1', label: '1', counts: 0, positions: { p1: { x: 0, y: 0 } } },
      { id: 's2', label: '2', counts: 16, positions: { p1: { x: 16, y: 0 } } },
      { id: 's3', label: '3', counts: 8, positions: { p1: { x: 16, y: 8 } } },
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

test('the playback frame names the move in progress, not the one just finished', () => {
  const show = showWithSets();
  // Counts 0-16 are the move into set 2; 16-24 the move into set 3.
  assert.deepEqual(frameAtCount(show, 0), { setIndex: 1, t: 0 });
  assert.deepEqual(frameAtCount(show, 8), { setIndex: 1, t: 0.5 });
  assert.deepEqual(frameAtCount(show, 16), { setIndex: 1, t: 1 });
  // Regression: at count 20 the marcher is travelling INTO set 3. Drawing the
  // path for set 2 here is the bug that made paths and dots disagree.
  assert.deepEqual(frameAtCount(show, 20), { setIndex: 2, t: 0.5 });
  assert.deepEqual(frameAtCount(show, 24), { setIndex: 2, t: 1 });
});

test('the frame and the positions it produces stay consistent', () => {
  const show = showWithSets();
  for (const count of [0, 4, 16, 20, 24, 99]) {
    const frame = frameAtCount(show, count);
    const positions = positionsAtCount(show, count);
    assert.ok(frame.setIndex >= 0 && frame.setIndex < show.sets.length);
    assert.ok(frame.t >= 0 && frame.t <= 1);
    assert.ok(positions.p1, `expected a position at count ${count}`);
  }
  // Spot-check the geometry at the point the old code got wrong.
  assert.deepEqual(positionsAtCount(show, 20).p1, { x: 16, y: 4 });
});

test('a show past its end parks on the final set', () => {
  const show = showWithSets();
  assert.deepEqual(frameAtCount(show, 1000), { setIndex: 2, t: 1 });
});

test('a single-set show has nowhere to travel', () => {
  const show = showWithSets();
  show.sets = [show.sets[0]];
  assert.deepEqual(frameAtCount(show, 50), { setIndex: 0, t: 1 });
});
