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
  MIN_TEMPO_TAPS,
  bpmFromTaps,
  buildTempoIndex,
  countToMeasureBeat,
  countToTime,
  measureBeatToCount,
  meterAtMeasure,
  removeTempo,
  tempoAtMeasure,
  timeToCount,
  upsertMeter,
  upsertTempo,
} from '../tempo.ts';
import type { TempoMap } from '../types.ts';

const close = (actual: number, expected: number, tolerance = 1e-9) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
};

const steady: TempoMap = {
  tempos: [{ measure: 1, bpm: 120 }],
  meters: [{ measure: 1, beatsPerMeasure: 4, beatUnit: 4 }],
  offsetSeconds: 0,
};

test('at 120bpm a count is half a second', () => {
  const index = buildTempoIndex(steady, 32);
  close(countToTime(index, 0), 0);
  close(countToTime(index, 1), 0.5);
  close(countToTime(index, 8), 4);
  close(timeToCount(index, 4), 8);
});

test('count and time round-trip', () => {
  const index = buildTempoIndex(steady, 32);
  for (const count of [0, 3, 17.5, 64]) {
    close(timeToCount(index, countToTime(index, count)), count, 1e-9);
  }
});

test('an audio offset shifts the whole show without changing counts', () => {
  const index = buildTempoIndex({ ...steady, offsetSeconds: 2.5 }, 32);
  close(countToTime(index, 0), 2.5);
  close(countToTime(index, 8), 6.5);
  close(timeToCount(index, 2.5), 0);
  // Anything before the downbeat is count 0, not a negative count.
  close(timeToCount(index, 1), 0);
});

test('counts map to measures and beats in 4/4', () => {
  const index = buildTempoIndex(steady, 32);
  assert.deepEqual(countToMeasureBeat(index, 0), { measure: 1, beat: 1 });
  assert.deepEqual(countToMeasureBeat(index, 3), { measure: 1, beat: 4 });
  assert.deepEqual(countToMeasureBeat(index, 4), { measure: 2, beat: 1 });
  assert.deepEqual(countToMeasureBeat(index, 33), { measure: 9, beat: 2 });
  assert.equal(measureBeatToCount(index, { measure: 9, beat: 2 }), 33);
});

test('a tempo change partway through shifts everything after it', () => {
  const map: TempoMap = {
    ...steady,
    tempos: [
      { measure: 1, bpm: 120 },
      { measure: 5, bpm: 60 },
    ],
  };
  const index = buildTempoIndex(map, 32);
  // Measures 1-4 are 16 counts at 0.5s each.
  close(countToTime(index, 16), 8);
  // From measure 5 a count is a full second.
  close(countToTime(index, 20), 12);
  close(timeToCount(index, 12), 20);
  assert.equal(tempoAtMeasure(map, 4), 120);
  assert.equal(tempoAtMeasure(map, 5), 60);
  assert.equal(tempoAtMeasure(map, 99), 60);
});

test('a meter change alters how many counts a measure holds', () => {
  const map: TempoMap = {
    ...steady,
    meters: [
      { measure: 1, beatsPerMeasure: 4, beatUnit: 4 },
      { measure: 3, beatsPerMeasure: 3, beatUnit: 4 },
    ],
  };
  const index = buildTempoIndex(map, 8);
  // Measures 1-2 are 4 counts each, then measure 3 is 3.
  assert.deepEqual(countToMeasureBeat(index, 8), { measure: 3, beat: 1 });
  assert.deepEqual(countToMeasureBeat(index, 11), { measure: 4, beat: 1 });
  assert.equal(meterAtMeasure(map, 2).beatsPerMeasure, 4);
  assert.equal(meterAtMeasure(map, 3).beatsPerMeasure, 3);
});

test('tempo and meter changes compose', () => {
  const map: TempoMap = {
    tempos: [
      { measure: 1, bpm: 120 },
      { measure: 3, bpm: 180 },
    ],
    meters: [
      { measure: 1, beatsPerMeasure: 4, beatUnit: 4 },
      { measure: 3, beatsPerMeasure: 3, beatUnit: 4 },
    ],
    offsetSeconds: 0,
  };
  const index = buildTempoIndex(map, 8);
  // 8 counts of 4/4 at 120 = 4 seconds.
  close(countToTime(index, 8), 4);
  // Then 3 counts of 3/4 at 180bpm = 1 second.
  close(countToTime(index, 11), 5);
  close(timeToCount(index, 5), 11);
});

test('tap tempo recovers a steady pulse and ignores a slow first tap', () => {
  // A hesitant first interval, then a steady 120bpm (500ms).
  const taps = [0, 900, 1400, 1900, 2400, 2900];
  const bpm = bpmFromTaps(taps);
  assert.ok(bpm !== null);
  close(bpm as number, 120, 0.5);
});

test('tap tempo rejects too few taps', () => {
  assert.equal(bpmFromTaps([0, 500]), null);
  assert.equal(bpmFromTaps([]), null);
});

test('tap tempo shrugs off one wild outlier', () => {
  const taps = [0, 500, 1000, 1500, 5000, 5500, 6000, 6500];
  const bpm = bpmFromTaps(taps);
  assert.ok(bpm !== null);
  close(bpm as number, 120, 2);
});

test('editing the tempo map keeps it sorted and unique', () => {
  let map = upsertTempo(steady, { measure: 9, bpm: 144 });
  map = upsertTempo(map, { measure: 5, bpm: 96 });
  assert.deepEqual(
    map.tempos.map((tempo) => tempo.measure),
    [1, 5, 9],
  );
  map = upsertTempo(map, { measure: 5, bpm: 100 });
  assert.equal(map.tempos.length, 3);
  assert.equal(tempoAtMeasure(map, 5), 100);

  map = removeTempo(map, 5);
  assert.equal(map.tempos.length, 2);
  // The opening tempo cannot be removed — the maths needs a starting point.
  map = removeTempo(map, 1);
  assert.ok(map.tempos.some((tempo) => tempo.measure === 1));

  const withMeter = upsertMeter(steady, { measure: 4, beatsPerMeasure: 6, beatUnit: 8 });
  assert.equal(meterAtMeasure(withMeter, 4).beatsPerMeasure, 6);
});

test('a tap tempo needs enough taps to mean anything', () => {
  // Two taps give one interval, and one interval is a guess. The panel reads
  // MIN_TEMPO_TAPS to say how many more are needed — when it kept its own copy
  // of this number, tapping twice produced nothing and no explanation.
  assert.equal(MIN_TEMPO_TAPS, 3);
  assert.equal(bpmFromTaps([]), null);
  assert.equal(bpmFromTaps([0]), null);
  assert.equal(bpmFromTaps([0, 500]), null);
  assert.ok(bpmFromTaps([0, 500, 1000]) !== null);
});

test('tapping a steady 120 reads as 120', () => {
  const taps = [0, 500, 1000, 1500, 2000, 2500];
  assert.equal(bpmFromTaps(taps), 120);
});

test('one wild tap does not wreck the reading', () => {
  // A missed beat is normal; the median filter is there so it costs nothing.
  const taps = [0, 500, 1000, 2400, 2900, 3400, 3900];
  const bpm = bpmFromTaps(taps);
  assert.ok(bpm !== null && Math.abs(bpm - 120) < 6, `got ${bpm}`);
});
