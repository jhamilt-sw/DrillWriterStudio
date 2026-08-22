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

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { AudioEngine, monoSamples } from './audioEngine.ts';
import {
  buildTempoIndex,
  countToTime,
  measuresNeededForCounts,
  timeToCount,
  upsertTempo,
} from '../core/tempo.ts';
import { type TempoEstimate, detectTempo } from '../core/tempoDetection.ts';
import { hashBytes } from '../core/hash.ts';
import { totalCounts } from '../core/show.ts';
import type { AudioReference } from '../core/types.ts';
import { base64ToBytes, bytesToBase64 } from '../io/base64.ts';
import { getAudio, putAudio } from '../io/audioStore.ts';
import { useShowStore } from '../state/showStore.ts';

interface AudioContextValue {
  engine: AudioEngine;
  /** Playback position in seconds. */
  position: number;
  playing: boolean;
  loaded: boolean;
  duration: number;
  fileName: string | null;
  /** Peaks for waveform drawing, computed once per loaded file. */
  buffer: AudioBuffer | null;
  loadFile: (file: File) => Promise<void>;
  unload: () => void;
  /** Pulling a recording back out of the local cache after a reload. */
  restoring: boolean;
  /**
   * The show expects a recording that is not loaded and could not be found on
   * this machine. Non-null is the cue to tell the user to re-import it.
   */
  missing: AudioReference | null;
  /** Whether the recording travels inside the .drillshow file. */
  embedded: boolean;
  /** Turn embedding on or off for this show. */
  setEmbedded: (embed: boolean) => Promise<void>;
  toggle: () => void;
  seekSeconds: (seconds: number) => void;
  seekCount: (count: number) => void;
  error: string | null;
  clearError: () => void;
  /** The tempo read out of the waveform, or null if none could be found. */
  detected: TempoEstimate | null;
  detecting: boolean;
  /**
   * Whether the loaded recording has actually been analysed in this session.
   *
   * False after a restore, where detection is deliberately skipped. Without it
   * the panel cannot tell "we looked and found no pulse" from "we never
   * looked", and it reported the second as the first.
   */
  analysed: boolean;
  /** Re-run detection over the loaded file. */
  redetectTempo: () => void;
  /** Write an estimate (possibly octave-corrected) into the show. */
  applyDetected: (estimate: TempoEstimate) => void;
}

const AudioPlaybackContext = createContext<AudioContextValue | null>(null);

/**
 * Write an estimate into the show's tempo map: the marching pulse becomes the
 * detected BPM, and the count-off offset becomes the detected first beat, so
 * count 0 sits exactly on the downbeat of the recording.
 */
function applyEstimate(estimate: TempoEstimate): void {
  const { tempoMap } = useShowStore.getState().show.music;
  useShowStore.getState().updateMusic({
    tempoMap: {
      ...upsertTempo(tempoMap, { measure: 1, bpm: estimate.bpm }),
      offsetSeconds: Math.round(estimate.firstBeatSeconds * 1000) / 1000,
    },
  });
}

/**
 * Owns the single AudioEngine instance and keeps the drill playhead locked to
 * the audio playhead through the show's tempo map (FR-3.4, FR-3.6).
 *
 * The binding runs one way while audio plays — audio drives drill — and the
 * other way when the user scrubs the timeline, which seeks the audio.
 */
export function AudioProvider({ children }: { children: ReactNode }) {
  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) engineRef.current = new AudioEngine();
  const engine = engineRef.current;

  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [duration, setDuration] = useState(0);
  const [buffer, setBuffer] = useState<AudioBuffer | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detected, setDetected] = useState<TempoEstimate | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [analysed, setAnalysed] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [missing, setMissing] = useState<AudioReference | null>(null);
  /**
   * Which recording the engine currently holds. Compared against the show's
   * reference to decide whether a restore is needed — without it, every store
   * update would look like a new recording to load.
   */
  const loadedHashRef = useRef<string | null>(null);
  /** The bytes as imported, kept so embedding on save does not re-read a file. */
  const rawBytesRef = useRef<ArrayBuffer | null>(null);

  const tempoMap = useShowStore((state) => state.show.music.tempoMap);
  const show = useShowStore((state) => state.show);
  const setPlayhead = useShowStore((state) => state.setPlayhead);
  const setScrubbing = useShowStore((state) => state.setScrubbing);

  const tempoIndex = useMemo(
    () => buildTempoIndex(tempoMap, measuresNeededForCounts(tempoMap, totalCounts(show))),
    [tempoMap, show],
  );

  // Audio is the clock while it plays: every frame moves the drill playhead.
  // `scrubbing` is latched rather than set every frame — it is a mode, and
  // re-announcing it sixty times a second would wake every subscriber for
  // nothing.
  const scrubLatch = useRef(false);
  useEffect(() => {
    return engine.subscribe((nextPosition, isPlaying) => {
      setPosition(nextPosition);
      setPlaying(isPlaying);
      if (isPlaying) {
        if (!scrubLatch.current) {
          scrubLatch.current = true;
          setScrubbing(true);
        }
        setPlayhead(timeToCount(tempoIndex, nextPosition));
      } else if (scrubLatch.current) {
        // Playback stopped — including when the recording simply runs out,
        // which no button press announces. Whatever stopped it, editing is
        // available again, so drop out of scrub mode rather than leaving the
        // canvas in playback dress with no way back except the transport.
        scrubLatch.current = false;
        setScrubbing(false);
      }
    });
  }, [engine, setPlayhead, setScrubbing, tempoIndex]);

  useEffect(() => () => engine.dispose(), [engine]);

  /*
   * Navigation drives the recording.
   *
   * Stepping back to set 1 and pressing play should start the music at set 1,
   * not wherever the last playback happened to stop. The store bumps
   * `seekNonce` whenever the user moves the playhead — never when audio moves
   * it — so this can seek without chasing its own tail sixty times a second.
   */
  const seekNonce = useShowStore((state) => state.seekNonce);
  const playheadCount = useShowStore((state) => state.playheadCount);
  const playheadRef = useRef(playheadCount);
  playheadRef.current = playheadCount;

  useEffect(() => {
    if (seekNonce === 0) return;
    if (!engine.isLoaded) return;
    engine.seek(countToTime(tempoIndex, playheadRef.current));
    // tempoIndex is intentionally excluded: editing the tempo map should
    // re-map the timeline, not yank the recording to a new position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekNonce, engine]);

  /**
   * Read the tempo out of a decoded buffer and write it into the show, so the
   * drill's counts line up with the recording without anyone tapping it in.
   *
   * Applied automatically because that is the useful default, but it lands in
   * undo history like any other edit and the Music panel offers halve/double
   * and a manual override for the cases detection gets wrong.
   */
  const analyseTempo = useCallback((decoded: AudioBuffer) => {
    setDetecting(true);
    try {
      const estimate = detectTempo(monoSamples(decoded), decoded.sampleRate);
      setDetected(estimate);
      setAnalysed(true);
      if (estimate) applyEstimate(estimate);
      return estimate;
    } finally {
      setDetecting(false);
    }
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const data = await file.arrayBuffer();
        const hash = hashBytes(new Uint8Array(data));
        const result = await engine.load(data);
        loadedHashRef.current = hash;
        rawBytesRef.current = data;
        setLoaded(true);
        setDuration(result.durationSeconds);
        setBuffer(result.buffer);
        setFileName(file.name);
        setMissing(null);

        const mimeType = file.type || 'audio/mpeg';
        // Cache the bytes before touching the show, so that by the time the
        // reference exists there is already something for it to point at.
        await putAudio({
          hash,
          fileName: file.name,
          mimeType,
          durationSeconds: result.durationSeconds,
          bytes: data,
        });

        const existing = useShowStore.getState().show.music.audio;
        useShowStore.getState().updateMusic({
          audio: {
            fileName: file.name,
            mimeType,
            durationSeconds: result.durationSeconds,
            hash,
            // Replacing a recording keeps whatever the show chose about
            // travelling with the file; the payload is rebuilt below.
            storage: existing?.storage === 'embedded' ? 'embedded' : 'reference',
            ...(existing?.storage === 'embedded'
              ? { data: bytesToBase64(new Uint8Array(data)) }
              : {}),
          },
        });
        /*
         * Seed the citation's title from the file name, once.
         *
         * Only when there is nothing there — a designer who has written a
         * proper credit must not have it overwritten by "track_03_final.mp3"
         * the next time they swap the file.
         */
        if (!useShowStore.getState().show.music.audioSource) {
          const guess = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
          if (guess) useShowStore.getState().updateMusic({ audioSource: { title: guess } });
        }

        // Yield a frame first so the waveform paints before the main thread
        // goes away to analyse a three-minute recording.
        window.setTimeout(() => analyseTempo(result.buffer), 0);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load that audio.');
      }
    },
    [analyseTempo, engine],
  );

  /**
   * Put the recording back after a reload.
   *
   * A show stores a reference, not the bytes, so on open the engine is empty
   * while the show still believes it has music. This looks for those bytes —
   * in the file itself if the show was saved with them, otherwise in this
   * browser's cache by content hash — and either restores them silently or
   * says plainly that the file has to be re-imported.
   *
   * Tempo detection is deliberately NOT re-run on a restore. The show already
   * carries the tempo map, quite possibly one the user corrected by hand, and
   * re-analysing would overwrite that on every refresh.
   */
  const audioReference = useShowStore((state) => state.show.music.audio);

  useEffect(() => {
    let cancelled = false;

    if (!audioReference) {
      setMissing(null);
      // Starting a new show, or opening one with no music, must not leave the
      // previous show's recording playable under it.
      if (loadedHashRef.current !== null || engine.isLoaded) {
        engine.unload();
        loadedHashRef.current = null;
        rawBytesRef.current = null;
        setLoaded(false);
        setBuffer(null);
        setDuration(0);
        setFileName(null);
        setDetected(null);
        setAnalysed(false);
      }
      return;
    }
    // Already holding this recording — nothing to do. Covers the store update
    // that a fresh import triggers.
    if (loadedHashRef.current && loadedHashRef.current === audioReference.hash) {
      setMissing(null);
      return;
    }

    const adopt = async (bytes: ArrayBuffer, name: string, hash: string | null) => {
      const result = await engine.load(bytes);
      if (cancelled) return;
      loadedHashRef.current = hash;
      rawBytesRef.current = bytes;
      setLoaded(true);
      setDuration(result.durationSeconds);
      setBuffer(result.buffer);
      setFileName(name);
      setMissing(null);
      // Restored, not analysed: the tempo on screen came from the show file,
      // and re-running detection here would overwrite a tempo the designer may
      // have corrected by hand.
      setDetected(null);
      setAnalysed(false);
    };

    void (async () => {
      setRestoring(true);
      try {
        // Saved with the recording inside it: nothing to look up.
        if (audioReference.storage === 'embedded' && audioReference.data) {
          const bytes = base64ToBytes(audioReference.data);
          const hash = audioReference.hash ?? hashBytes(bytes);
          await adopt(bytes.buffer as ArrayBuffer, audioReference.fileName, hash);
          // Fill the cache too, so the show still opens with music if it is
          // later saved as a plain reference.
          void putAudio({
            hash,
            fileName: audioReference.fileName,
            mimeType: audioReference.mimeType,
            durationSeconds: audioReference.durationSeconds,
            bytes: bytes.buffer as ArrayBuffer,
          });
          return;
        }

        // Written before hashes existed: nothing identifies the file.
        if (!audioReference.hash) {
          if (!cancelled) setMissing(audioReference);
          return;
        }

        const found = await getAudio(audioReference.hash);
        if (cancelled) return;
        if (!found) {
          setMissing(audioReference);
          return;
        }
        await adopt(found.bytes, found.fileName, found.hash);
        // A show that asked to carry its recording, restored from a source
        // that strips the payload (an autosave snapshot), gets it put back —
        // otherwise the next save would silently downgrade it to a reference.
        if (audioReference.storage === 'embedded' && !audioReference.data) {
          useShowStore.getState().updateMusic({
            audio: {
              ...audioReference,
              data: bytesToBase64(new Uint8Array(found.bytes)),
            },
          });
        }
      } catch {
        // A cached file that will not decode is no better than a missing one.
        if (!cancelled) setMissing(audioReference);
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audioReference, engine]);

  const redetectTempo = useCallback(() => {
    const decoded = engine.audioBuffer;
    if (decoded) analyseTempo(decoded);
  }, [analyseTempo, engine]);

  const applyDetected = useCallback((estimate: TempoEstimate) => {
    setDetected(estimate);
    applyEstimate(estimate);
  }, []);

  const unload = useCallback(() => {
    engine.unload();
    setLoaded(false);
    setBuffer(null);
    setDuration(0);
    setFileName(null);
    setDetected(null);
    setAnalysed(false);
    setMissing(null);
    loadedHashRef.current = null;
    rawBytesRef.current = null;
    // The cached bytes are left alone: another show may use the same
    // recording, and the cache evicts by least-recent use on its own.
    useShowStore.getState().updateMusic({ audio: undefined });
  }, [engine]);

  /**
   * Choose whether the recording travels inside the .drillshow file.
   *
   * Off by default. On, the show is portable — hand the file to an assistant
   * and the music comes with it — at the cost of roughly a third more file
   * size than the recording itself, since base64 is bulkier than bytes.
   */
  const setEmbedded = useCallback(async (embed: boolean) => {
    const current = useShowStore.getState().show.music.audio;
    if (!current) return;
    if (!embed) {
      const { data: _data, ...rest } = current;
      useShowStore.getState().updateMusic({
        audio: { ...rest, storage: 'reference' },
      });
      return;
    }
    let bytes = rawBytesRef.current;
    if (!bytes && current.hash) {
      const found = await getAudio(current.hash);
      bytes = found?.bytes ?? null;
    }
    if (!bytes) return;
    useShowStore.getState().updateMusic({
      audio: {
        ...current,
        storage: 'embedded',
        data: bytesToBase64(new Uint8Array(bytes)),
      },
    });
  }, []);

  const toggle = useCallback(() => {
    if (!engine.isLoaded) return;
    if (engine.isPlaying) {
      engine.pause();
      setScrubbing(false);
    } else {
      void engine.play();
    }
  }, [engine, setScrubbing]);

  const seekSeconds = useCallback(
    (seconds: number) => {
      engine.seek(seconds);
      setPlayhead(timeToCount(tempoIndex, seconds));
    },
    [engine, setPlayhead, tempoIndex],
  );

  const seekCount = useCallback(
    (count: number) => {
      if (engine.isLoaded) engine.seek(countToTime(tempoIndex, count));
    },
    [engine, tempoIndex],
  );

  const value = useMemo<AudioContextValue>(
    () => ({
      engine,
      position,
      playing,
      loaded,
      duration,
      buffer,
      fileName,
      loadFile,
      unload,
      restoring,
      missing,
      embedded: audioReference?.storage === 'embedded',
      setEmbedded,
      toggle,
      seekSeconds,
      seekCount,
      error,
      clearError: () => setError(null),
      detected,
      detecting,
      analysed,
      redetectTempo,
      applyDetected,
    }),
    [
      engine,
      position,
      playing,
      loaded,
      duration,
      buffer,
      fileName,
      loadFile,
      unload,
      restoring,
      missing,
      audioReference,
      setEmbedded,
      toggle,
      seekSeconds,
      seekCount,
      error,
      detected,
      detecting,
      analysed,
      redetectTempo,
      applyDetected,
    ],
  );

  return (
    <AudioPlaybackContext.Provider value={value}>
      {children}
    </AudioPlaybackContext.Provider>
  );
}

export function useAudio(): AudioContextValue {
  const value = useContext(AudioPlaybackContext);
  if (!value) throw new Error('useAudio must be used inside an AudioProvider');
  return value;
}

/** The tempo index for the current show — shared by the timeline and music panel. */
export function useTempoIndex() {
  const tempoMap = useShowStore((state) => state.show.music.tempoMap);
  const show = useShowStore((state) => state.show);
  return useMemo(
    () => buildTempoIndex(tempoMap, measuresNeededForCounts(tempoMap, totalCounts(show))),
    [tempoMap, show],
  );
}
