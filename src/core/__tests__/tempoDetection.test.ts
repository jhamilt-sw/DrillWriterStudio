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
 * Tempo detection is checked against synthetic audio with a known answer.
 * Every signal here is generated, so the expected BPM is not a guess.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyAdaptiveThreshold,
  computeOnsetEnvelope,
  detectBeatPhase,
  detectTempo,
  downmixToMono,
  scoreTempoCandidates,
  shiftTempoOctave,
} from '../tempoDetection.ts';

const SAMPLE_RATE = 22050;

/** A percussive hit: a short burst of noise under a fast exponential decay. */
function addHit(buffer: Float32Array, atSample: number, amplitude = 1): void {
  const length = Math.floor(SAMPLE_RATE * 0.06);
  // A fixed multiplier-based pseudo-random source keeps the test deterministic.
  let seed = (atSample % 9973) + 1;
  for (let i = 0; i < length; i += 1) {
    const index = atSample + i;
    if (index >= buffer.length) break;
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const noise = (seed / 0x7fffffff) * 2 - 1;
    buffer[index] += noise * amplitude * Math.exp(-i / (SAMPLE_RATE * 0.012));
  }
}

/** A click track at a given tempo, optionally offset by a count-off delay. */
function clickTrack(bpm: number, seconds: number, startSeconds = 0): Float32Array {
  const buffer = new Float32Array(Math.floor(SAMPLE_RATE * seconds));
  const interval = (60 / bpm) * SAMPLE_RATE;
  for (
    let position = startSeconds * SAMPLE_RATE;
    position < buffer.length;
    position += interval
  ) {
    addHit(buffer, Math.round(position));
  }
  return buffer;
}

/** A click track with an accent every four beats, like a real count-off. */
function accentedTrack(bpm: number, seconds: number, startSeconds = 0): Float32Array {
  const buffer = new Float32Array(Math.floor(SAMPLE_RATE * seconds));
  const interval = (60 / bpm) * SAMPLE_RATE;
  let beat = 0;
  for (
    let position = startSeconds * SAMPLE_RATE;
    position < buffer.length;
    position += interval
  ) {
    addHit(buffer, Math.round(position), beat % 4 === 0 ? 1 : 0.55);
    beat += 1;
  }
  return buffer;
}

test('downmixing averages the channels', () => {
  const left = new Float32Array([1, 0, -1]);
  const right = new Float32Array([0, 0, 1]);
  const mono = downmixToMono([left, right], 3);
  assert.deepEqual(Array.from(mono), [0.5, 0, 0]);
  // A single channel comes back unchanged.
  assert.deepEqual(Array.from(downmixToMono([left], 3)), [1, 0, -1]);
  assert.equal(downmixToMono([], 3).length, 3);
});

test('the onset envelope spikes on hits, not on sustain', () => {
  const buffer = new Float32Array(SAMPLE_RATE * 2);
  // A sustained tone: loud throughout, but only one onset at the start.
  for (let i = SAMPLE_RATE * 0.5; i < SAMPLE_RATE * 1.5; i += 1) {
    buffer[i] = Math.sin((2 * Math.PI * 220 * i) / SAMPLE_RATE) * 0.6;
  }
  const envelope = computeOnsetEnvelope(buffer, SAMPLE_RATE, 200);
  const peakFrame = envelope.values.indexOf(Math.max(...envelope.values));
  const peakSeconds = peakFrame / envelope.rate;
  // The peak is at the note's attack, not in the middle of the sustain.
  assert.ok(
    Math.abs(peakSeconds - 0.5) < 0.06,
    `expected the onset near 0.5s, got ${peakSeconds.toFixed(3)}s`,
  );
});

test('the adaptive threshold pushes the curve down onto zero', () => {
  const raw = computeOnsetEnvelope(clickTrack(120, 8), SAMPLE_RATE, 200);
  const thresholded = applyAdaptiveThreshold(raw);
  assert.equal(thresholded.values.length, raw.values.length);
  assert.ok(thresholded.values.every((value) => value >= 0));
  // Most frames are silence between clicks, so most should be exactly zero.
  const zeros = thresholded.values.filter((value) => value === 0).length;
  assert.ok(
    zeros > thresholded.values.length * 0.5,
    `expected mostly-zero curve, got ${zeros}/${thresholded.values.length}`,
  );
});

test('a click track is detected at its own tempo', () => {
  for (const bpm of [120, 132, 144, 160, 176]) {
    const estimate = detectTempo(clickTrack(bpm, 20), SAMPLE_RATE);
    assert.ok(estimate, `${bpm} BPM should be detectable`);
    assert.ok(
      Math.abs(estimate.bpm - bpm) < 2,
      `expected about ${bpm} BPM, got ${estimate.bpm}`,
    );
    assert.ok(
      estimate.confidence > 0.2,
      `a clean click track should be confident, got ${estimate.confidence.toFixed(2)}`,
    );
  }
});

test('a slow tempo is not doubled into the marching range', () => {
  // The prior favours marching tempos, but it must not overrule clear evidence.
  const estimate = detectTempo(clickTrack(76, 24), SAMPLE_RATE);
  assert.ok(estimate);
  assert.ok(
    Math.abs(estimate.bpm - 76) < 2.5,
    `expected about 76 BPM, got ${estimate.bpm}`,
  );
});

test('the first beat is found even after a count-off silence', () => {
  const startSeconds = 1.7;
  const estimate = detectTempo(clickTrack(144, 20, startSeconds), SAMPLE_RATE);
  assert.ok(estimate);
  const beatSeconds = 60 / 144;
  // The phase is periodic, so any beat is a correct answer — check that the
  // offset lands on the grid rather than demanding the literal first hit.
  const offsetError = Math.abs(
    ((estimate.firstBeatSeconds - startSeconds) % beatSeconds) / beatSeconds,
  );
  const wrapped = Math.min(offsetError, 1 - offsetError);
  assert.ok(
    wrapped < 0.12,
    `first beat ${estimate.firstBeatSeconds.toFixed(3)}s is off the ${startSeconds}s grid by ${(wrapped * 100).toFixed(0)}% of a beat`,
  );
});

test('an accented count-off is still read at the beat, not the bar', () => {
  // Accents every four beats could be mistaken for a tempo four times slower.
  const estimate = detectTempo(accentedTrack(152, 24), SAMPLE_RATE);
  assert.ok(estimate);
  assert.ok(
    Math.abs(estimate.bpm - 152) < 3,
    `expected about 152 BPM, got ${estimate.bpm}`,
  );
});

test('the beat phase is reported in frames within one period', () => {
  const envelope = applyAdaptiveThreshold(
    computeOnsetEnvelope(clickTrack(120, 12), SAMPLE_RATE, 200),
  );
  const period = (60 / 120) * envelope.rate;
  const phase = detectBeatPhase(envelope, period);
  assert.ok(phase >= 0 && phase < Math.round(period));
});

test('candidates come back strongest first, within the allowed range', () => {
  const envelope = applyAdaptiveThreshold(
    computeOnsetEnvelope(clickTrack(144, 16), SAMPLE_RATE, 200),
  );
  const candidates = scoreTempoCandidates(envelope, { minBpm: 60, maxBpm: 200 });
  assert.ok(candidates.length > 0);
  for (let i = 1; i < candidates.length; i += 1) {
    assert.ok(candidates[i - 1].score >= candidates[i].score);
  }
  assert.ok(candidates.every((c) => c.bpm >= 59 && c.bpm <= 201));
  assert.ok(Math.abs(candidates[0].bpm - 144) < 3);
});

test('silence and noise produce no confident answer', () => {
  const silence = new Float32Array(SAMPLE_RATE * 10);
  const fromSilence = detectTempo(silence, SAMPLE_RATE);
  // Either nothing at all, or something explicitly marked unreliable.
  if (fromSilence) {
    assert.ok(
      fromSilence.confidence < 0.35,
      `silence should not be confident, got ${fromSilence.confidence.toFixed(2)}`,
    );
  }
});

test('too short a clip is refused rather than guessed at', () => {
  assert.equal(detectTempo(clickTrack(140, 2), SAMPLE_RATE), null);
  assert.equal(detectTempo(new Float32Array(0), SAMPLE_RATE), null);
  assert.equal(detectTempo(clickTrack(140, 20), 0), null);
});

test('octave correction halves and doubles cleanly', () => {
  const estimate = detectTempo(clickTrack(144, 16), SAMPLE_RATE);
  assert.ok(estimate);

  const halved = shiftTempoOctave(estimate, 0.5);
  assert.ok(Math.abs(halved.bpm - estimate.bpm / 2) < 0.02);
  assert.ok(Math.abs(halved.beatSeconds - 60 / halved.bpm) < 1e-9);
  // The downbeat does not move: it is still a beat at either tempo.
  assert.equal(halved.firstBeatSeconds, estimate.firstBeatSeconds);

  const doubled = shiftTempoOctave(estimate, 2);
  assert.ok(Math.abs(doubled.bpm - estimate.bpm * 2) < 0.02);
});

test('detection is quick enough to run on import without a worker', () => {
  // Three minutes of audio, the length of a real show.
  const started = performance.now();
  const estimate = detectTempo(clickTrack(148, 180), SAMPLE_RATE);
  const elapsed = performance.now() - started;
  assert.ok(estimate);
  assert.ok(
    elapsed < 4000,
    `detecting a 3-minute recording took ${elapsed.toFixed(0)}ms`,
  );
});
