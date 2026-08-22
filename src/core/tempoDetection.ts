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
 * Estimating tempo and the first beat from an audio waveform (FR-3.5).
 *
 * The pipeline is the standard one, kept deliberately small so it runs in a
 * fraction of a second on a whole show recording without a worker:
 *
 *   1. **Onset envelope** — reduce the waveform to a low-rate curve that spikes
 *      when something is struck. Loudness alone would peak in the middle of a
 *      sustained note, so the curve is the *rise* in log energy, not the energy.
 *   2. **Adaptive threshold** — subtract a local mean. Without this the
 *      autocorrelation is dominated by the envelope's DC offset and every lag
 *      scores about the same.
 *   3. **Autocorrelation** — a periodic pulse train correlates with itself at
 *      its own period. Normalised per lag, otherwise short lags always win
 *      simply for having more overlapping samples.
 *   4. **Tempo prior** — the same music is equally periodic at 70, 140 and 280
 *      BPM, so autocorrelation alone cannot resolve the octave. A log-normal
 *      prior centred on a marching tempo breaks the tie the way a human would.
 *   5. **Phase** — with the period known, slide a pulse train over the envelope
 *      and take the offset that lands the most energy on beats. That offset is
 *      where the count-off starts.
 *
 * Everything takes plain arrays and returns plain data, so it is all testable
 * against synthetic click tracks without a browser or an audio file.
 */

export interface OnsetEnvelope {
  values: Float32Array;
  /** Frames per second. */
  rate: number;
}

export interface TempoCandidate {
  bpm: number;
  /** Raw periodicity strength, before the tempo prior. */
  strength: number;
  /** Strength after the prior — what the winner is chosen by. */
  score: number;
}

export interface TempoEstimate {
  bpm: number;
  /**
   * Roughly how much the winner stood out, 0–1. Below about 0.3 the estimate
   * is a guess and the UI should say so rather than silently applying it.
   */
  confidence: number;
  /** Seconds from the start of the file to the first detected beat. */
  firstBeatSeconds: number;
  /** Seconds per beat at the detected tempo. */
  beatSeconds: number;
  /** The runners-up, strongest first — useful for an octave-correction UI. */
  candidates: TempoCandidate[];
}

export interface TempoDetectionOptions {
  minBpm?: number;
  maxBpm?: number;
  /** Centre of the log-normal tempo prior, in BPM. */
  priorCentreBpm?: number;
  /** Width of that prior, in octaves. Larger trusts the audio more. */
  priorWidthOctaves?: number;
  /** Onset envelope sample rate, in frames per second. */
  envelopeRate?: number;
}

const DEFAULTS = {
  minBpm: 50,
  maxBpm: 220,
  // Marching band shows live between roughly 120 and 180; centring here is what
  // stops a 144 BPM chart being reported as 72.
  priorCentreBpm: 140,
  priorWidthOctaves: 0.55,
  envelopeRate: 200,
} as const;

/** Average all channels into one array. */
export function downmixToMono(
  channels: ArrayLike<number>[],
  length: number,
): Float32Array {
  const mono = new Float32Array(length);
  if (channels.length === 0) return mono;
  for (const channel of channels) {
    const limit = Math.min(length, channel.length);
    for (let i = 0; i < limit; i += 1) mono[i] += channel[i];
  }
  const scale = 1 / channels.length;
  for (let i = 0; i < length; i += 1) mono[i] *= scale;
  return mono;
}

/**
 * Reduce a waveform to an onset-strength curve.
 *
 * Uses the rise in log energy between frames. Log compression matters: without
 * it a loud passage produces bigger onsets than a quiet one and the
 * autocorrelation follows the dynamics instead of the pulse.
 */
export function computeOnsetEnvelope(
  samples: ArrayLike<number>,
  sampleRate: number,
  envelopeRate: number = DEFAULTS.envelopeRate,
): OnsetEnvelope {
  const hop = Math.max(1, Math.round(sampleRate / envelopeRate));
  const frameCount = Math.floor(samples.length / hop);
  if (frameCount < 2) return { values: new Float32Array(0), rate: envelopeRate };

  const energy = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * hop;
    const end = start + hop;
    let sum = 0;
    for (let i = start; i < end; i += 1) {
      const value = samples[i];
      sum += value * value;
    }
    energy[frame] = Math.log1p(1000 * Math.sqrt(sum / hop));
  }

  // Half-wave rectified difference: onsets are rises, and a decay is not an
  // onset, so negative differences contribute nothing.
  const flux = new Float32Array(frameCount);
  for (let frame = 1; frame < frameCount; frame += 1) {
    const delta = energy[frame] - energy[frame - 1];
    flux[frame] = delta > 0 ? delta : 0;
  }

  return { values: flux, rate: sampleRate / hop };
}

/**
 * Subtract a running mean and rectify, so the curve sits on zero and only
 * genuine local peaks survive.
 */
export function applyAdaptiveThreshold(
  envelope: OnsetEnvelope,
  windowSeconds = 0.35,
): OnsetEnvelope {
  const { values, rate } = envelope;
  const half = Math.max(1, Math.round((windowSeconds * rate) / 2));
  const out = new Float32Array(values.length);
  if (values.length === 0) return { values: out, rate };

  // Prefix sums make the running mean O(n) rather than O(n * window).
  const prefix = new Float64Array(values.length + 1);
  for (let i = 0; i < values.length; i += 1) prefix[i + 1] = prefix[i] + values[i];

  for (let i = 0; i < values.length; i += 1) {
    const start = Math.max(0, i - half);
    const end = Math.min(values.length, i + half + 1);
    const mean = (prefix[end] - prefix[start]) / (end - start);
    const value = values[i] - mean;
    out[i] = value > 0 ? value : 0;
  }
  return { values: out, rate };
}

/** Log-normal prior over tempo, peaking at `centre`. */
function tempoPrior(bpm: number, centre: number, widthOctaves: number): number {
  const octaves = Math.log2(bpm / centre);
  return Math.exp(-0.5 * (octaves / widthOctaves) ** 2);
}

/**
 * Score every plausible beat period by autocorrelation, with the tempo prior
 * applied. Returned strongest-first.
 */
export function scoreTempoCandidates(
  envelope: OnsetEnvelope,
  options: TempoDetectionOptions = {},
): TempoCandidate[] {
  const minBpm = options.minBpm ?? DEFAULTS.minBpm;
  const maxBpm = options.maxBpm ?? DEFAULTS.maxBpm;
  const centre = options.priorCentreBpm ?? DEFAULTS.priorCentreBpm;
  const width = options.priorWidthOctaves ?? DEFAULTS.priorWidthOctaves;

  const { values, rate } = envelope;
  if (values.length < 8) return [];

  const minLag = Math.max(2, Math.floor((60 / maxBpm) * rate));
  const maxLag = Math.min(values.length - 1, Math.ceil((60 / minBpm) * rate));
  if (maxLag <= minLag) return [];

  const candidates: TempoCandidate[] = [];
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let sum = 0;
    const limit = values.length - lag;
    for (let i = 0; i < limit; i += 1) sum += values[i] * values[i + lag];
    // Normalise by overlap, or short lags win for having more terms.
    const strength = sum / limit;
    const bpm = (60 * rate) / lag;
    candidates.push({
      bpm,
      strength,
      score: strength * tempoPrior(bpm, centre, width),
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

/**
 * Where the beat grid starts.
 *
 * Slides a pulse train of the given period across the envelope and returns the
 * offset that captures the most onset energy.
 */
export function detectBeatPhase(envelope: OnsetEnvelope, periodFrames: number): number {
  const { values } = envelope;
  const period = Math.max(1, Math.round(periodFrames));
  if (values.length === 0) return 0;

  let bestOffset = 0;
  let bestScore = -Infinity;
  for (let offset = 0; offset < period; offset += 1) {
    let sum = 0;
    for (let i = offset; i < values.length; i += period) sum += values[i];
    if (sum > bestScore) {
      bestScore = sum;
      bestOffset = offset;
    }
  }
  return bestOffset;
}

/**
 * Estimate the tempo and downbeat of a decoded recording.
 *
 * Returns null when there is not enough audio to say anything — a couple of
 * seconds of sound cannot establish a pulse, and guessing from it would be
 * worse than admitting so.
 */
export function detectTempo(
  samples: ArrayLike<number>,
  sampleRate: number,
  options: TempoDetectionOptions = {},
): TempoEstimate | null {
  if (sampleRate <= 0) return null;
  // Under about four seconds there is no room for enough beats to correlate.
  if (samples.length < sampleRate * 4) return null;

  const raw = computeOnsetEnvelope(
    samples,
    sampleRate,
    options.envelopeRate ?? DEFAULTS.envelopeRate,
  );
  const envelope = applyAdaptiveThreshold(raw);

  const candidates = scoreTempoCandidates(envelope, options);
  if (candidates.length === 0) return null;

  const best = candidates[0];
  if (!(best.score > 0)) return null;

  // Confidence: how far the winner stands above the typical candidate. A flat
  // score profile means the audio has no clear pulse.
  const meanScore =
    candidates.reduce((sum, candidate) => sum + candidate.score, 0) / candidates.length;
  const confidence =
    meanScore > 0 ? Math.max(0, Math.min(1, (best.score / meanScore - 1) / 2)) : 0;

  const periodFrames = (60 / best.bpm) * envelope.rate;
  const phaseFrames = detectBeatPhase(envelope, periodFrames);

  return {
    // Two decimals: a show recording is rarely at an exact integer tempo, and
    // rounding to a whole number accumulates drift across a three-minute chart.
    bpm: Math.round(best.bpm * 100) / 100,
    confidence,
    firstBeatSeconds: phaseFrames / envelope.rate,
    beatSeconds: 60 / best.bpm,
    candidates: candidates.slice(0, 6),
  };
}

/**
 * Halve or double an estimate, keeping the beat grid aligned.
 *
 * Octave errors are the one mistake automatic tempo detection reliably makes,
 * so correcting one should be a single click rather than a re-detection.
 */
export function shiftTempoOctave(
  estimate: TempoEstimate,
  factor: 0.5 | 2,
): TempoEstimate {
  const bpm = Math.round(estimate.bpm * factor * 100) / 100;
  return {
    ...estimate,
    bpm,
    beatSeconds: 60 / bpm,
    // The first beat is still a beat at either tempo, so the phase holds.
    firstBeatSeconds: estimate.firstBeatSeconds,
  };
}
