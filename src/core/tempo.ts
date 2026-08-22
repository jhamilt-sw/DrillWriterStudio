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
 * Music time <-> drill counts (FR-3.4, FR-3.5).
 *
 * One drill count is one notated beat. A show's tempo map is a list of tempo
 * and meter changes keyed to measure numbers; everything else — where count 96
 * falls in seconds, which measure the audio playhead is sitting in, how far the
 * drill has travelled at 41.2 s — is derived by walking that map.
 *
 * Tempo and meter changes take effect at measure boundaries. Mid-measure tempo
 * changes are rare in marching arrangements and are approximated by splitting
 * the measure in the score import rather than complicating this model.
 */

import type { MeterMarking, MusicAnchor, TempoMap, TempoMarking } from './types.ts';

export interface MeasureEntry {
  measure: number;
  beatsPerMeasure: number;
  beatUnit: number;
  bpm: number;
  /** Counts elapsed before this measure begins. */
  startCount: number;
  /** Seconds elapsed (from measure 1 beat 1) before this measure begins. */
  startSeconds: number;
  secondsPerBeat: number;
}

export interface TempoIndex {
  measures: MeasureEntry[];
  totalCounts: number;
  totalSeconds: number;
  offsetSeconds: number;
}

function sortByMeasure<T extends { measure: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.measure - b.measure);
}

export function tempoAtMeasure(map: TempoMap, measure: number): number {
  const sorted = sortByMeasure(map.tempos);
  let bpm = sorted[0]?.bpm ?? 120;
  for (const marking of sorted) {
    if (marking.measure <= measure) bpm = marking.bpm;
    else break;
  }
  return bpm;
}

export function meterAtMeasure(map: TempoMap, measure: number): MeterMarking {
  const sorted = sortByMeasure(map.meters);
  let meter: MeterMarking = sorted[0] ?? { measure: 1, beatsPerMeasure: 4, beatUnit: 4 };
  for (const marking of sorted) {
    if (marking.measure <= measure) meter = marking;
    else break;
  }
  return meter;
}

/**
 * Precompute per-measure counts and start times. `measureCount` bounds the
 * table; callers pass however many measures the show needs.
 */
export function buildTempoIndex(map: TempoMap, measureCount: number): TempoIndex {
  const measures: MeasureEntry[] = [];
  let startCount = 0;
  let startSeconds = 0;
  const total = Math.max(1, Math.floor(measureCount));
  for (let measure = 1; measure <= total; measure += 1) {
    const meter = meterAtMeasure(map, measure);
    const bpm = tempoAtMeasure(map, measure);
    // bpm is expressed in the meter's own beat unit, so a beat is 60/bpm
    // seconds regardless of whether that beat is a quarter or a dotted quarter.
    const secondsPerBeat = 60 / (bpm > 0 ? bpm : 120);
    measures.push({
      measure,
      beatsPerMeasure: meter.beatsPerMeasure,
      beatUnit: meter.beatUnit,
      bpm,
      startCount,
      startSeconds,
      secondsPerBeat,
    });
    startCount += meter.beatsPerMeasure;
    startSeconds += meter.beatsPerMeasure * secondsPerBeat;
  }
  return {
    measures,
    totalCounts: startCount,
    totalSeconds: startSeconds,
    offsetSeconds: map.offsetSeconds,
  };
}

function entryForCount(index: TempoIndex, count: number): MeasureEntry {
  const { measures } = index;
  if (measures.length === 0) {
    throw new Error('Tempo index is empty');
  }
  if (count <= 0) return measures[0];
  let low = 0;
  let high = measures.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measures[mid].startCount <= count) low = mid;
    else high = mid - 1;
  }
  return measures[low];
}

function entryForSeconds(index: TempoIndex, seconds: number): MeasureEntry {
  const { measures } = index;
  if (measures.length === 0) throw new Error('Tempo index is empty');
  if (seconds <= 0) return measures[0];
  let low = 0;
  let high = measures.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measures[mid].startSeconds <= seconds) low = mid;
    else high = mid - 1;
  }
  return measures[low];
}

/** Counts (from the top of the show) -> seconds into the audio file. */
export function countToTime(index: TempoIndex, count: number): number {
  const entry = entryForCount(index, count);
  const beatsIn = count - entry.startCount;
  return index.offsetSeconds + entry.startSeconds + beatsIn * entry.secondsPerBeat;
}

/** Seconds into the audio file -> counts from the top of the show. */
export function timeToCount(index: TempoIndex, seconds: number): number {
  const musical = seconds - index.offsetSeconds;
  if (musical <= 0) return 0;
  const entry = entryForSeconds(index, musical);
  const secondsIn = musical - entry.startSeconds;
  return entry.startCount + secondsIn / entry.secondsPerBeat;
}

/** Counts -> measure and beat, both 1-based. */
export function countToMeasureBeat(index: TempoIndex, count: number): MusicAnchor {
  const entry = entryForCount(index, count);
  const beatsIn = Math.max(0, count - entry.startCount);
  return { measure: entry.measure, beat: beatsIn + 1 };
}

/** Measure and beat (both 1-based) -> counts from the top of the show. */
export function measureBeatToCount(index: TempoIndex, anchor: MusicAnchor): number {
  const measure = Math.max(1, Math.floor(anchor.measure));
  const entry =
    index.measures[Math.min(measure, index.measures.length) - 1] ?? index.measures[0];
  return entry.startCount + Math.max(0, anchor.beat - 1);
}

/** Seconds -> measure and beat, for the playhead readout. */
export function timeToMeasureBeat(index: TempoIndex, seconds: number): MusicAnchor {
  return countToMeasureBeat(index, timeToCount(index, seconds));
}

/**
 * Average bpm from a series of tap times (FR-3.5's manual mapping tool).
 * Drops the first interval, which is usually long while the user finds the
 * pulse, and rejects outliers more than 40% off the median.
 */
/**
 * How many taps are needed before an average means anything.
 *
 * Two taps give one interval, and one interval is a guess rather than a tempo.
 * Exported because the panel has to tell the user how many more to go — when it
 * hard-coded its own copy of this number, tapping twice produced no reading and
 * no explanation, and the button looked broken.
 */
export const MIN_TEMPO_TAPS = 3;

export function bpmFromTaps(tapTimesMs: number[]): number | null {
  if (tapTimesMs.length < MIN_TEMPO_TAPS) return null;
  const intervals: number[] = [];
  for (let i = 1; i < tapTimesMs.length; i += 1) {
    intervals.push(tapTimesMs[i] - tapTimesMs[i - 1]);
  }
  const usable = intervals.length > 2 ? intervals.slice(1) : intervals;
  const sorted = [...usable].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const kept = usable.filter(
    (interval) => Math.abs(interval - median) <= median * 0.4 && interval > 0,
  );
  if (kept.length === 0) return null;
  const mean = kept.reduce((sum, value) => sum + value, 0) / kept.length;
  return Math.round((60000 / mean) * 10) / 10;
}

/** Insert or replace a tempo marking, keeping the list sorted and unique. */
export function upsertTempo(map: TempoMap, marking: TempoMarking): TempoMap {
  const others = map.tempos.filter((tempo) => tempo.measure !== marking.measure);
  return { ...map, tempos: sortByMeasure([...others, marking]) };
}

export function upsertMeter(map: TempoMap, marking: MeterMarking): TempoMap {
  const others = map.meters.filter((meter) => meter.measure !== marking.measure);
  return { ...map, meters: sortByMeasure([...others, marking]) };
}

export function removeTempo(map: TempoMap, measure: number): TempoMap {
  if (measure === 1) return map; // the opening tempo is required
  return { ...map, tempos: map.tempos.filter((tempo) => tempo.measure !== measure) };
}

export function removeMeter(map: TempoMap, measure: number): TempoMap {
  if (measure === 1) return map;
  return { ...map, meters: map.meters.filter((meter) => meter.measure !== measure) };
}

/** Enough measures to cover a given count total, with headroom. */
export function measuresNeededForCounts(map: TempoMap, counts: number): number {
  const meter = meterAtMeasure(map, 1);
  const estimate = Math.ceil(counts / Math.max(1, meter.beatsPerMeasure)) + 8;
  return Math.max(32, estimate);
}
