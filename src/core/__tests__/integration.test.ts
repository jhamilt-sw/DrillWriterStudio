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

/**
 * End-to-end exercise of the pure core: build a show, place a form with the
 * bulk tools, move it, and read out the coordinates a marcher would be handed.
 *
 * These are the numbers a drill designer can check by eye against a real field,
 * which is what makes them worth pinning down.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { fieldMetrics, yardLineX } from '../field.ts';
import { blockFormation, lineFormation, mirrorVertical } from '../formations.ts';
import { analyseSegment, segmentsIntoSet } from '../interpolate.ts';
import { describePoint } from '../notation.ts';
import { deserialiseShow, serialiseShow } from '../schema.ts';
import { createEmptyShow, resolvePosition, totalCounts } from '../show.ts';
import { buildTempoIndex, countToTime } from '../tempo.ts';
import type { DrillPoint, Show } from '../types.ts';

function showWithPerformers(count: number): Show {
  const show = createEmptyShow('Integration Show');
  const sectionId = show.sections[0].id;
  show.performers = Array.from({ length: count }, (_, index) => ({
    id: `p${index}`,
    label: `TP${index + 1}`,
    name: '',
    sectionId,
    order: index,
  }));
  return show;
}

function place(show: Show, setIndex: number, points: DrillPoint[]): void {
  show.sets[setIndex].positions = Object.fromEntries(
    points.map((point, index) => [`p${index}`, point]),
  );
}

test('a block on the 50 reads back the way a designer would write it', () => {
  const show = showWithPerformers(9);
  const metrics = fieldMetrics(show.field);

  // Nine marchers at a two-step interval, centred on the 50, standing on the
  // front hash. That spans the 45 on Side 1 to the 45 on Side 2.
  const origin = { x: metrics.fiftyX - 8, y: metrics.frontHashY };
  place(show, 0, blockFormation(origin, 9, 9, 2, 2));

  const read = (id: string) => {
    const point = resolvePosition(show, id, 0);
    assert.ok(point, `${id} should be placed`);
    return describePoint(point, metrics);
  };

  // Coordinates are always written against the *nearest* five-yard line, which
  // is why the outside marchers reference the 45 rather than the 50.
  assert.equal(read('p0').horizontal.text, 'Side 1: On 45 yd ln');
  // Dead centre belongs to neither side, so the 50 is written without one.
  assert.equal(read('p4').horizontal.text, 'On 50 yd ln');
  assert.equal(read('p8').horizontal.text, 'Side 2: On 45 yd ln');

  // Two steps either side of the 50 is still measured off the 50.
  assert.equal(read('p3').horizontal.text, 'Side 1: 2.0 steps outside 50 yd ln');
  assert.equal(read('p5').horizontal.text, 'Side 2: 2.0 steps outside 50 yd ln');

  // Everybody is on the front hash.
  assert.equal(read('p0').vertical.text, 'On Front Hash');
});

test('mirroring a form across the 50 produces its mirror coordinate', () => {
  const show = showWithPerformers(3);
  const metrics = fieldMetrics(show.field);

  // Three marchers, on Side 1's 30, 35 and 40, twelve steps off the sideline.
  const points = [30, 35, 40].map((yard) => ({
    x: yardLineX(yard, 1, metrics),
    y: 12,
  }));
  place(show, 0, points);

  const mirrored = mirrorVertical(points, metrics.fiftyX);
  assert.equal(
    describePoint(mirrored[0], metrics).horizontal.text,
    'Side 2: On 30 yd ln',
  );
  assert.equal(
    describePoint(mirrored[2], metrics).horizontal.text,
    'Side 2: On 40 yd ln',
  );
});

test('a 16-count move across 16 steps is a clean 8-to-5 stride', () => {
  const show = showWithPerformers(4);
  const metrics = fieldMetrics(show.field);

  place(show, 0, lineFormation({ x: 40, y: 20 }, { x: 46, y: 20 }, 4));
  show.sets.push({
    id: 'set2',
    label: '2',
    counts: 16,
    positions: Object.fromEntries(
      lineFormation({ x: 56, y: 20 }, { x: 62, y: 20 }, 4).map((point, index) => [
        `p${index}`,
        point,
      ]),
    ),
  });

  assert.equal(totalCounts(show), 16);
  const analyses = segmentsIntoSet(show, 1).map((segment) =>
    analyseSegment(segment, metrics),
  );
  assert.equal(analyses.length, 4);
  for (const analysis of analyses) {
    assert.equal(analysis.distanceSteps, 16);
    assert.equal(analysis.stepsPerCount, 1);
    assert.equal(analysis.inchesPerStep, 22.5);
  }
});

test('the same move in 8 counts becomes an unmarchable stride', () => {
  const show = showWithPerformers(1);
  const metrics = fieldMetrics(show.field);
  place(show, 0, [{ x: 40, y: 20 }]);
  show.sets.push({
    id: 'set2',
    label: '2',
    counts: 8,
    positions: { p0: { x: 56, y: 20 } },
  });
  const [analysis] = segmentsIntoSet(show, 1).map((segment) =>
    analyseSegment(segment, metrics),
  );
  assert.equal(analysis.inchesPerStep, 45);
  assert.equal(analysis.effectiveStepsPerFiveYards, 4);
});

test('counts land where the tempo map says, and survive a save', () => {
  const show = showWithPerformers(2);
  place(show, 0, [
    { x: 40, y: 20 },
    { x: 44, y: 20 },
  ]);
  show.sets.push({
    id: 'set2',
    label: '2',
    counts: 16,
    music: { measure: 5, beat: 1 },
    positions: { p0: { x: 56, y: 20 }, p1: { x: 60, y: 20 } },
  });
  show.music.tempoMap.tempos = [{ measure: 1, bpm: 144 }];

  const index = buildTempoIndex(show.music.tempoMap, 32);
  // 16 counts at 144bpm is 16 * (60/144) seconds.
  assert.equal(Math.round(countToTime(index, 16) * 1000), Math.round((16 * 60) / 144 * 1000));

  const restored = deserialiseShow(serialiseShow(show));
  assert.deepEqual(restored.sets[1].music, { measure: 5, beat: 1 });
  assert.deepEqual(restored.sets[1].positions.p0, { x: 56, y: 20 });
  assert.equal(restored.music.tempoMap.tempos[0].bpm, 144);
});

test('a large show stays fast enough to edit', () => {
  // NFR-1: 250 performers, 40 sets. This guards the resolution path that every
  // canvas frame and every export row goes through.
  const show = showWithPerformers(250);
  const metrics = fieldMetrics(show.field);
  place(
    show,
    0,
    Array.from({ length: 250 }, (_, index) => ({
      x: 10 + (index % 50) * 2.5,
      y: 10 + Math.floor(index / 50) * 4,
    })),
  );
  for (let setIndex = 1; setIndex < 40; setIndex += 1) {
    show.sets.push({
      id: `set${setIndex}`,
      label: String(setIndex + 1),
      counts: 16,
      positions: Object.fromEntries(
        Array.from({ length: 250 }, (_, index) => [
          `p${index}`,
          { x: 10 + ((index + setIndex) % 50) * 2.5, y: 10 + Math.floor(index / 50) * 4 },
        ]),
      ),
    });
  }

  const started = performance.now();
  for (let setIndex = 1; setIndex < 40; setIndex += 1) {
    for (const segment of segmentsIntoSet(show, setIndex)) {
      analyseSegment(segment, metrics);
    }
  }
  const elapsed = performance.now() - started;

  assert.equal(show.sets.length, 40);
  assert.ok(
    elapsed < 1500,
    `analysing every move in a 250-performer, 40-set show took ${elapsed.toFixed(0)}ms`,
  );
});
