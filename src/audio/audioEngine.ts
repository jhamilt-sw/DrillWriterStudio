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
 * Audio playback and scrubbing (FR-3.3, FR-3.6).
 *
 * Built on the Web Audio API rather than an <audio> element, because the drill
 * timeline has to stay locked to the music: `AudioContext.currentTime` is a
 * high-resolution clock driven by the audio hardware, so a playhead derived
 * from it does not drift the way `HTMLMediaElement.currentTime` does, and a
 * seek is exact rather than approximate.
 *
 * An AudioBufferSourceNode can only be started once, so every play and every
 * seek creates a fresh source. Position is tracked as
 * `context.currentTime - startedAt + offset`.
 */

import { downmixToMono } from '../core/tempoDetection.ts';

export interface AudioLoadResult {
  buffer: AudioBuffer;
  durationSeconds: number;
}

export type PlaybackListener = (positionSeconds: number, playing: boolean) => void;

export class AudioEngine {
  private context: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  /** A second output, tapped for video recording. Null unless one was asked for. */
  private recordingTap: MediaStreamAudioDestinationNode | null = null;

  private startedAtContextTime = 0;
  private startOffset = 0;
  private playing = false;
  private rafHandle: number | null = null;
  private listeners = new Set<PlaybackListener>();

  private ensureContext(): AudioContext {
    if (!this.context) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) throw new Error('This browser does not support the Web Audio API.');
      this.context = new Ctor();
      this.gain = this.context.createGain();
      this.gain.connect(this.context.destination);
    }
    return this.context;
  }

  get isLoaded(): boolean {
    return this.buffer !== null;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  get duration(): number {
    return this.buffer?.duration ?? 0;
  }

  get audioBuffer(): AudioBuffer | null {
    return this.buffer;
  }

  /** Decode a file into memory. Rejects with a readable message on failure. */
  async load(data: ArrayBuffer): Promise<AudioLoadResult> {
    const context = this.ensureContext();
    this.stop();
    let decoded: AudioBuffer;
    try {
      // decodeAudioData detaches the buffer it is given, so hand it a copy —
      // otherwise a retry (or an embed-on-save) finds an empty ArrayBuffer.
      decoded = await context.decodeAudioData(data.slice(0));
    } catch {
      throw new Error(
        'That audio file could not be decoded. Try MP3, WAV, OGG or M4A — support varies by browser.',
      );
    }
    this.buffer = decoded;
    this.startOffset = 0;
    return { buffer: decoded, durationSeconds: decoded.duration };
  }

  unload(): void {
    this.stop();
    this.buffer = null;
    this.startOffset = 0;
    this.emit();
  }

  /**
   * An audio track carrying whatever the speakers are playing.
   *
   * Tapped in *parallel* with the normal output rather than in series: routing
   * playback through the recorder would mean the designer hears nothing while
   * a four-minute show records, and they need to hear it to know the export is
   * working.
   *
   * The node is kept and reused. Creating one per export leaks an audio node
   * per attempt, and a designer re-recording a show six times to get the camera
   * angle right would notice.
   */
  recordingTrack(): MediaStreamTrack | null {
    const context = this.ensureContext();
    if (typeof context.createMediaStreamDestination !== 'function') return null;
    if (!this.recordingTap) {
      this.recordingTap = context.createMediaStreamDestination();
      this.gain?.connect(this.recordingTap);
    }
    return this.recordingTap.stream.getAudioTracks()[0] ?? null;
  }

  /** Current playhead position in seconds. */
  position(): number {
    if (!this.playing || !this.context) return this.startOffset;
    const elapsed = this.context.currentTime - this.startedAtContextTime;
    return Math.min(this.startOffset + elapsed, this.duration);
  }

  async play(fromSeconds?: number): Promise<void> {
    if (!this.buffer) return;
    const context = this.ensureContext();
    // Browsers start the context suspended until a user gesture.
    if (context.state === 'suspended') await context.resume();

    this.stopSource();
    const offset = Math.max(0, Math.min(fromSeconds ?? this.position(), this.duration));

    const source = context.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.gain ?? context.destination);
    source.onended = () => {
      // Fires for a natural end and for our own stop(); only the natural end
      // should reset the transport.
      if (this.source === source) {
        this.playing = false;
        this.startOffset = this.duration;
        this.source = null;
        this.stopTicking();
        this.emit();
      }
    };
    source.start(0, offset);

    this.source = source;
    this.startOffset = offset;
    this.startedAtContextTime = context.currentTime;
    this.playing = true;
    this.startTicking();
    this.emit();
  }

  pause(): void {
    if (!this.playing) return;
    const position = this.position();
    this.stopSource();
    this.startOffset = position;
    this.playing = false;
    this.stopTicking();
    this.emit();
  }

  stop(): void {
    this.stopSource();
    this.playing = false;
    this.startOffset = 0;
    this.stopTicking();
    this.emit();
  }

  /** Move the playhead, continuing playback if it was already running. */
  seek(seconds: number): void {
    const target = Math.max(0, Math.min(seconds, this.duration));
    if (this.playing) {
      void this.play(target);
    } else {
      this.startOffset = target;
      this.emit();
    }
  }

  setVolume(value: number): void {
    if (this.gain) this.gain.gain.value = Math.max(0, Math.min(1, value));
  }

  subscribe(listener: PlaybackListener): () => void {
    this.listeners.add(listener);
    listener(this.position(), this.playing);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.stop();
    this.listeners.clear();
    void this.context?.close();
    this.context = null;
    this.gain = null;
    this.recordingTap?.disconnect();
    this.recordingTap = null;
    this.buffer = null;
  }

  private stopSource(): void {
    if (!this.source) return;
    const source = this.source;
    this.source = null;
    try {
      source.onended = null;
      source.stop();
    } catch {
      // Already stopped; nothing to unwind.
    }
    source.disconnect();
  }

  private startTicking(): void {
    if (this.rafHandle !== null) return;
    const tick = () => {
      this.emit();
      this.rafHandle = this.playing ? requestAnimationFrame(tick) : null;
    };
    this.rafHandle = requestAnimationFrame(tick);
  }

  private stopTicking(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  private emit(): void {
    const position = this.position();
    for (const listener of this.listeners) listener(position, this.playing);
  }
}

/**
 * Reduce an AudioBuffer to min/max pairs per pixel column for waveform drawing.
 * Averaging would flatten transients — the very things a designer uses to find
 * a downbeat — so peaks are kept instead.
 */
export function extractPeaks(buffer: AudioBuffer, columns: number): Float32Array {
  const peaks = new Float32Array(columns * 2);
  const channel = buffer.getChannelData(0);
  const samplesPerColumn = Math.max(1, Math.floor(channel.length / columns));
  for (let column = 0; column < columns; column += 1) {
    const start = column * samplesPerColumn;
    const end = Math.min(start + samplesPerColumn, channel.length);
    let min = 0;
    let max = 0;
    for (let i = start; i < end; i += 1) {
      const value = channel[i];
      if (value < min) min = value;
      if (value > max) max = value;
    }
    peaks[column * 2] = min;
    peaks[column * 2 + 1] = max;
  }
  return peaks;
}

/**
 * All channels averaged into one array, for analysis.
 *
 * Tempo detection on a single channel misses anything panned to the other side
 * — a drum line hard-left would be invisible — so the mono sum is what gets
 * analysed even though playback uses the original buffer.
 */
export function monoSamples(buffer: AudioBuffer): Float32Array {
  const channels: Float32Array[] = [];
  for (let index = 0; index < buffer.numberOfChannels; index += 1) {
    channels.push(buffer.getChannelData(index));
  }
  return downmixToMono(channels, buffer.length);
}

/** Base64 for embedding audio in a save file, chunked to avoid stack limits. */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
