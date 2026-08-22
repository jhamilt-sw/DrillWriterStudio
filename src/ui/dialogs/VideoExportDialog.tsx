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
 * Recording the show to a video file.
 *
 * The export plays the drill through in real time and records what is drawn.
 * That is a deliberate limit rather than an oversight: `MediaRecorder` captures
 * a live stream, and the audio has to be played to be captured at all, so a
 * four-minute show takes four minutes. The dialog says so before it starts,
 * because a designer who wanders off and closes the tab loses the export.
 *
 * The playhead is driven two different ways. With audio loaded the recording
 * plays it, and the audio clock moves the drill as it always does. Without
 * audio nothing would advance the playhead at all, so a clock is run here
 * instead — otherwise a silent show records four minutes of a stationary field.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { useAudio, useTempoIndex } from '../../audio/AudioProvider.tsx';
import { setContextAtCount } from '../../core/setContext.ts';
import { countToTime, timeToCount } from '../../core/tempo.ts';
import { showFileBaseName } from '../../core/schema.ts';
import { totalCounts } from '../../core/show.ts';
import {
  CAPTURE_HEIGHTS,
  DEFAULT_CAPTURE_HEIGHT,
  DEFAULT_FRAME_RATE,
  FRAME_RATES,
  chooseVideoFormat,
  describeUploadSupport,
  estimatedBytes,
  formatBytes,
  formatDuration,
  videoBitrate,
  videoFileName,
} from '../../core/videoExport.ts';
import {
  RecordingCancelled,
  canRecordVideo,
  downloadRecording,
  isRecordingTypeSupported,
  startRecording,
} from '../../io/videoRecorder.ts';
import { useShowStore } from '../../state/showStore.ts';
import {
  type CaptureSourceId,
  captureSourceReady,
  captureSources,
} from '../capture/captureTargets.ts';

type Phase = 'idle' | 'recording' | 'saving' | 'done' | 'error';

export function VideoExportDialog({
  onClose,
  fixedSource,
  onOpen3D,
}: {
  onClose: () => void;
  /**
   * Lock the dialog to one source and hide the picker.
   *
   * Set when the dialog is opened from inside the 3D view, which is the only
   * place the 3D view can be recorded from: it takes over the window, so there
   * is no "open it and come back here" — coming back closes it.
   */
  fixedSource?: CaptureSourceId;
  /** Take the user to the 3D view, for when they picked it from the editor. */
  onOpen3D?: () => void;
}) {
  const show = useShowStore((state) => state.show);
  const seekToCount = useShowStore((state) => state.seekToCount);
  const setPlayhead = useShowStore((state) => state.setPlayhead);
  const setScrubbing = useShowStore((state) => state.setScrubbing);
  const audio = useAudio();
  const tempoIndex = useTempoIndex();

  const [sourceId, setSourceId] = useState<CaptureSourceId>(fixedSource ?? 'field');
  const [burnOverlay, setBurnOverlay] = useState(true);
  const [fps, setFps] = useState<number>(DEFAULT_FRAME_RATE);
  const [height, setHeight] = useState<number>(DEFAULT_CAPTURE_HEIGHT);
  const [withAudio, setWithAudio] = useState(true);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [savedAs, setSavedAs] = useState<string | null>(null);

  const cancelRef = useRef<(() => void) | null>(null);

  const format = useMemo(() => chooseVideoFormat(isRecordingTypeSupported), []);
  const sources = useMemo(() => captureSources(), []);
  const source = sources.find((entry) => entry.id === sourceId) ?? sources[0];

  const counts = Math.max(1, totalCounts(show));
  const seconds = countToTime(tempoIndex, counts);
  const audible = withAudio && audio.loaded;
  const frameWidth = Math.round((height * 16) / 9);
  const estimate = estimatedBytes(
    seconds,
    videoBitrate(
      source.resizable ? frameWidth : 1280,
      source.resizable ? height : 720,
      fps,
    ),
    audible,
  );

  const ready = captureSourceReady(sourceId);
  const supported = canRecordVideo() && format !== null;

  // A recording in flight must not be abandoned by the dialog unmounting: the
  // stream would keep running with nothing listening for it.
  useEffect(() => () => cancelRef.current?.(), []);

  async function run(): Promise<void> {
    if (!format) return;
    setError(null);
    setSavedAs(null);
    setProgress(0);

    let prepared: ReturnType<typeof source.prepare> | null = null;
    let clock = 0;
    try {
      /*
       * The overlay is read at draw time, not captured now: it changes on every
       * frame, and the store is the only thing that knows where the playhead
       * has got to.
       */
      prepared = source.prepare({
        height,
        overlay: burnOverlay
          ? () => {
              const state = useShowStore.getState();
              return setContextAtCount(state.show, state.playheadCount);
            }
          : null,
      });

      // Start from the top of the show, and let the drill be drawn as though a
      // run-through were happening — which, from the canvas's point of view, is
      // exactly what it is.
      setScrubbing(true);
      seekToCount(0);
      if (audible) audio.seekSeconds(0);

      const recording = startRecording({
        canvas: prepared.canvas,
        fps,
        format,
        audioTrack: audible ? audio.engine.recordingTrack() : null,
      });
      cancelRef.current = () => recording.cancel();
      setPhase('recording');

      const startedAt = performance.now();
      const finish = () => {
        window.cancelAnimationFrame(clock);
        recording.stop();
      };

      const tick = () => {
        const elapsed = (performance.now() - startedAt) / 1000;
        // With audio the audio clock owns the playhead; without it, nothing
        // else would move, so it is advanced from wall time through the same
        // tempo map the timeline uses.
        if (!audible) setPlayhead(timeToCount(tempoIndex, elapsed));
        setProgress(Math.min(1, elapsed / seconds));
        if (elapsed >= seconds) {
          finish();
          return;
        }
        clock = window.requestAnimationFrame(tick);
      };

      if (audible) await audio.engine.play();
      clock = window.requestAnimationFrame(tick);

      const blob = await recording.done;
      setPhase('saving');
      const name = videoFileName(showFileBaseName(show), format, source.id);
      downloadRecording(blob, name);
      setSavedAs(`${name} · ${formatBytes(blob.size)}`);
      setPhase('done');
    } catch (cause) {
      if (cause instanceof RecordingCancelled) {
        setPhase('idle');
      } else {
        setError(cause instanceof Error ? cause.message : 'The export failed.');
        setPhase('error');
      }
    } finally {
      window.cancelAnimationFrame(clock);
      cancelRef.current = null;
      prepared?.release();
      // The engine is asked directly rather than through the `playing` flag:
      // that flag is React state captured when this function started, and by
      // now it is minutes old. Pausing an already-paused engine is harmless;
      // failing to pause a playing one leaves the show running after the
      // export has finished.
      audio.engine.pause();
      setScrubbing(false);
    }
  }

  const busy = phase === 'recording' || phase === 'saving';

  return (
    <div
      /*
       * While recording, the dialog gets out of the way: the run-through is the
       * thing the user needs to watch — it is being recorded, and if the camera
       * is wrong they want to know now rather than in four minutes. The panel
       * shrinks into a corner and the backdrop stops intercepting clicks.
       */
      className={`dialog-backdrop${busy ? ' dialog-backdrop--recording' : ''}`}
      role="dialog"
      aria-modal={!busy}
      aria-label="Export video"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="dialog dialog--narrow">
        <div className="dialog__header">
          <h2 className="dialog__title">Export video</h2>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="dialog__body">
          {!supported && (
            <div className="alert alert--error" role="alert">
              This browser cannot record video. Chrome, Edge, Firefox and Safari
              all can; a private window sometimes cannot.
            </div>
          )}

          {supported && (
            <>
              {!fixedSource && (
              <div className="field">
                <label className="field__label" htmlFor="video-source">
                  Record
                </label>
                <select
                  id="video-source"
                  className="select"
                  value={sourceId}
                  disabled={busy}
                  onChange={(event) =>
                    setSourceId(event.target.value as CaptureSourceId)
                  }
                >
                  {sources.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>
              )}

              {!ready && sourceId === 'stadium' && (
                <div className="alert alert--warning" role="alert">
                  <strong>The 3D view records from inside itself.</strong>
                  <div style={{ marginTop: 2 }}>
                    It takes over the window, so there is no coming back here
                    while it is open. Open it, frame the camera the way you want
                    the video to look, and press <strong>Record</strong> on its
                    own bar.
                  </div>
                  {onOpen3D && (
                    <button
                      type="button"
                      className="btn btn--sm"
                      style={{ marginTop: 6 }}
                      onClick={onOpen3D}
                    >
                      Open 3D playback
                    </button>
                  )}
                </div>
              )}

              <div className="grid-2">
                <div className="field">
                  <label className="field__label" htmlFor="video-fps">
                    Frame rate
                  </label>
                  <select
                    id="video-fps"
                    className="select"
                    value={fps}
                    disabled={busy}
                    onChange={(event) => setFps(Number(event.target.value))}
                  >
                    {FRAME_RATES.map((rate) => (
                      <option key={rate} value={rate}>
                        {rate} fps
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="video-height">
                    Resolution
                  </label>
                  <select
                    id="video-height"
                    className="select"
                    value={height}
                    disabled={busy || !source.resizable}
                    onChange={(event) => setHeight(Number(event.target.value))}
                  >
                    {CAPTURE_HEIGHTS.map((option) => (
                      <option key={option} value={option}>
                        {Math.round((option * 16) / 9)} × {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {!source.resizable && (
                <p className="hint" style={{ marginTop: 0 }}>
                  The 2D field records at the size it is on screen, since it
                  cannot be redrawn larger without disturbing the editor. Widen
                  the window, or hide a side panel, for a sharper file. The 3D
                  view has no such limit and records at any resolution.
                </p>
              )}

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={burnOverlay}
                  disabled={busy}
                  onChange={(event) => setBurnOverlay(event.target.checked)}
                />
                Show the set numbers in the video
              </label>
              <p className="hint" style={{ marginTop: 0 }}>
                Painted into the frames — the on-screen overlay is HTML and is
                not part of a canvas, so without this the video carries no set
                numbers at all.
              </p>

              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={withAudio}
                  disabled={busy || !audio.loaded}
                  onChange={(event) => setWithAudio(event.target.checked)}
                />
                Include the audio
              </label>
              {!audio.loaded && (
                <p className="hint" style={{ marginTop: 0 }}>
                  No recording is loaded, so the video will be silent. The drill
                  still runs for its full length, timed by the tempo map.
                </p>
              )}

              <div className="alert alert--info" role="status">
                <strong>
                  {formatDuration(seconds)} · {show.sets.length} sets ·{' '}
                  {counts} counts
                </strong>
                <div style={{ marginTop: 2 }}>
                  {format!.label} · about {formatBytes(estimate)}.{' '}
                  {describeUploadSupport(format!)}
                </div>
                <div style={{ marginTop: 2 }}>
                  Recording happens in real time, so this takes{' '}
                  {formatDuration(seconds)}. Leave this tab in front and do not
                  close it.
                </div>
              </div>

              {busy && (
                <div className="video-progress" aria-live="polite">
                  <div
                    className="video-progress__bar"
                    style={{ ['--progress' as string]: `${Math.round(progress * 100)}%` }}
                  >
                    <span />
                  </div>
                  <span>
                    {phase === 'saving'
                      ? 'Finishing the file…'
                      : `${formatDuration(progress * seconds)} of ${formatDuration(seconds)}`}
                  </span>
                </div>
              )}

              {phase === 'done' && savedAs && (
                <div className="alert alert--info" role="status">
                  <strong>Saved</strong>
                  <div style={{ marginTop: 2 }}>{savedAs}</div>
                </div>
              )}

              {error && (
                <div className="alert alert--error" role="alert">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div className="dialog__footer">
          {busy ? (
            <button
              type="button"
              className="btn"
              onClick={() => cancelRef.current?.()}
            >
              Cancel
            </button>
          ) : (
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          )}
          <button
            type="button"
            className="btn btn--primary"
            disabled={!supported || !ready || busy}
            onClick={() => void run()}
          >
            {phase === 'done' ? 'Record again' : 'Start recording'}
          </button>
        </div>
      </div>
    </div>
  );
}
