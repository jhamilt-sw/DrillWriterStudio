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

import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';

import { extractPeaks } from '../../audio/audioEngine.ts';
import { useAudio, useTempoIndex } from '../../audio/AudioProvider.tsx';
import {
  MIN_TEMPO_TAPS,
  bpmFromTaps,
  countToTime,
  removeTempo,
  tempoAtMeasure,
  upsertMeter,
  upsertTempo,
} from '../../core/tempo.ts';
import { shiftTempoOctave } from '../../core/tempoDetection.ts';
import { countTimeline } from '../../core/show.ts';
import { useShowStore } from '../../state/showStore.ts';
import {
  editAudioSource,
  formatCitation,
  hasCitation,
  normaliseAudioSource,
  safeSourceUrl,
  sourceProvider,
} from '../../core/audioSource.ts';

/**
 * Music alignment (FR-3.3 – FR-3.5).
 *
 * Two ways to line drill up with music: import a recording and place the
 * downbeat against a waveform, or tap the tempo in by hand. Either way the
 * result is a tempo map, and the tempo map is what maps counts to seconds.
 */
export function MusicPanel() {
  const audio = useAudio();
  const show = useShowStore((state) => state.show);
  const updateMusic = useShowStore((state) => state.updateMusic);
  const tempoIndex = useTempoIndex();
  const tempoMap = show.music.tempoMap;
  const source = show.music.audioSource;
  const sourceUrl = safeSourceUrl(source?.url);

  /**
   * Patch one field of the citation as it is typed.
   *
   * No trimming here: trimming on every keystroke removes the space the user
   * just pressed, so they cannot type two words. Tidying happens on blur.
   */
  const editSource = (patch: Partial<NonNullable<typeof source>>) =>
    updateMusic({ audioSource: editAudioSource(source, patch) });

  /** Tidy a finished value: trim it, and drop a link that is not safe to open. */
  const tidySource = () =>
    updateMusic({ audioSource: normaliseAudioSource(source) });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [taps, setTaps] = useState<number[]>([]);
  const [tappedBpm, setTappedBpm] = useState<number | null>(null);

  // Draw the waveform, with set markers laid over it so a designer can see
  // where each form lands against the music.
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const styles = getComputedStyle(document.documentElement);
    const waveColor = styles.getPropertyValue('--fg-faint').trim() || '#888';
    const accent = styles.getPropertyValue('--accent').trim() || '#1f6feb';
    const markerColor = styles.getPropertyValue('--border-strong').trim() || '#aaa';

    if (audio.buffer) {
      const peaks = extractPeaks(audio.buffer, Math.floor(width));
      context.fillStyle = waveColor;
      const mid = height / 2;
      for (let column = 0; column < width; column += 1) {
        const min = peaks[column * 2] ?? 0;
        const max = peaks[column * 2 + 1] ?? 0;
        const top = mid - max * mid * 0.92;
        const bottom = mid - min * mid * 0.92;
        context.fillRect(column, top, 1, Math.max(1, bottom - top));
      }
    } else {
      context.fillStyle = waveColor;
      context.globalAlpha = 0.5;
      context.fillRect(0, height / 2 - 0.5, width, 1);
      context.globalAlpha = 1;
    }

    const duration = audio.duration || countToTime(tempoIndex, tempoIndex.totalCounts);
    if (duration > 0) {
      context.strokeStyle = markerColor;
      context.lineWidth = 1;
      countTimeline(show).forEach((count) => {
        const x = (countToTime(tempoIndex, count) / duration) * width;
        if (x < 0 || x > width) return;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, height);
        context.stroke();
      });

      context.strokeStyle = accent;
      context.lineWidth = 2;
      const playheadX = (audio.position / duration) * width;
      context.beginPath();
      context.moveTo(playheadX, 0);
      context.lineTo(playheadX, height);
      context.stroke();
    }
  }, [audio.buffer, audio.duration, audio.position, show, tempoIndex]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [draw]);

  const handleWaveformClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !audio.loaded) return;
    const rect = canvas.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / rect.width;
    audio.seekSeconds(Math.max(0, Math.min(1, fraction)) * audio.duration);
  };

  const handleTap = () => {
    const now = performance.now();
    // A long gap means the user is starting over rather than continuing.
    const next = taps.length > 0 && now - taps[taps.length - 1] > 2500 ? [now] : [...taps, now];
    setTaps(next);
    setTappedBpm(bpmFromTaps(next));
  };

  const meter = tempoMap.meters[0] ?? { measure: 1, beatsPerMeasure: 4, beatUnit: 4 };
  /** The marching tempo the show is actually running at, wherever it came from. */
  const currentBpm = tempoAtMeasure(tempoMap, 1);

  return (
    <div className="section">
      <div className="section__header">
        <h2 className="section__title">Music</h2>
        {audio.loaded && (
          <button type="button" className="btn btn--sm" onClick={audio.unload}>
            Remove
          </button>
        )}
      </div>

      <div className="section__body">
        {audio.error && (
          <div className="alert alert--error" role="alert">
            {audio.error}
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={audio.clearError}
            >
              Dismiss
            </button>
          </div>
        )}

        {/*
          The show remembers its recording; the browser may not still have it.
          Say which of those is true before the user wonders why nothing plays.
        */}
        {audio.restoring && (
          <div className="alert alert--info" role="status">
            Restoring the recording from this browser…
          </div>
        )}

        {audio.missing && !audio.restoring && (
          <div className="alert alert--warning" role="alert">
            <strong>Re-import “{audio.missing.fileName}” to play this show.</strong>
            <div style={{ marginTop: 2 }}>
              The drill remembers its music — tempo, downbeat and all{' '}
              {Math.round(audio.missing.durationSeconds)}s of it — but the
              recording itself is not saved inside the show file, and this
              browser no longer has a copy. Import the same file and everything
              lines up as it was.
            </div>
            {/*
              The citation earns its keep here above all: this is the moment
              somebody has the drill and not the music, and needs to know what
              the music was.
            */}
            {hasCitation(source) && (
              <div className="audio-citation" style={{ marginTop: 6 }}>
                <div>{formatCitation(source)}</div>
                {sourceUrl && (
                  <a
                    className="btn btn--sm"
                    style={{ marginTop: 4, display: 'inline-block' }}
                    href={sourceUrl}
                    target="_blank"
                    // noopener: the opened page must not get a handle on this
                    // one through window.opener, and the link comes from a file
                    // somebody else wrote.
                    rel="noreferrer noopener"
                  >
                    Get it from {sourceProvider(sourceUrl) ?? 'the source'} ↗
                  </a>
                )}
              </div>
            )}
            <label
              className="btn btn--sm"
              style={{ cursor: 'pointer', marginTop: 6, display: 'inline-block' }}
            >
              Re-import audio
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
                className="file-input"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void audio.loadFile(file);
                  event.target.value = '';
                }}
              />
            </label>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className="waveform"
          onClick={handleWaveformClick}
          aria-label="Audio waveform — click to seek"
        />

        <div className="row" style={{ margin: '8px 0' }}>
          <label className="btn btn--sm" style={{ cursor: 'pointer' }}>
            {audio.loaded ? 'Replace audio' : 'Import audio'}
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac"
              className="file-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void audio.loadFile(file);
                event.target.value = '';
              }}
            />
          </label>
          {audio.fileName && (
            <span className="roster-section__count" title={audio.fileName}>
              {audio.fileName}
            </span>
          )}
        </div>

        {/*
          Where the recording came from.
          
          Always available, loaded or not: the citation is most useful to
          somebody who has the file and not the music, and it has to be
          editable by whoever ends up in that position.
        */}
        <details className="audio-source" open={hasCitation(source)}>
          <summary>Source &amp; credit</summary>

          <div className="grid-2">
            <div className="field">
              <label className="field__label" htmlFor="source-title">
                Title
              </label>
              <input
                id="source-title"
                className="input"
                placeholder="The Stars and Stripes Forever"
                value={source?.title ?? ''}
                onChange={(event) => editSource({ title: event.target.value })}
                onBlur={tidySource}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="source-artist">
                Composer / artist
              </label>
              <input
                id="source-artist"
                className="input"
                placeholder="John Philip Sousa"
                value={source?.artist ?? ''}
                onChange={(event) => editSource({ artist: event.target.value })}
                onBlur={tidySource}
              />
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="source-url">
              Where to get it
            </label>
            <input
              id="source-url"
              className="input"
              type="url"
              placeholder="https://pixabay.com/music/…"
              value={source?.url ?? ''}
              onChange={(event) => editSource({ url: event.target.value })}
              onBlur={tidySource}
            />
            {source?.url && !sourceUrl && (
              <p className="hint" style={{ color: 'var(--warning)' }}>
                Only http and https links are saved — a show file travels
                between machines, and other kinds of link are not safe to open
                from one.
              </p>
            )}
          </div>

          <div className="field">
            <label className="field__label" htmlFor="source-license">
              License / terms
            </label>
            <input
              id="source-license"
              className="input"
              placeholder="Pixabay Content License"
              value={source?.license ?? ''}
              onChange={(event) => editSource({ license: event.target.value })}
              onBlur={tidySource}
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="source-notes">
              Notes
            </label>
            <input
              id="source-notes"
              className="input"
              placeholder="Trimmed 4s from the front; matches set 1."
              value={source?.notes ?? ''}
              onChange={(event) => editSource({ notes: event.target.value })}
              onBlur={tidySource}
            />
          </div>

          {hasCitation(source) ? (
            <>
              <div className="audio-citation">{formatCitation(source)}</div>
              <div className="row" style={{ marginTop: 4 }}>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => {
                    void navigator.clipboard?.writeText(formatCitation(source));
                  }}
                >
                  Copy credit
                </button>
                {sourceUrl && (
                  <a
                    className="btn btn--sm btn--ghost"
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Open ↗
                  </a>
                )}
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => updateMusic({ audioSource: undefined })}
                >
                  Clear
                </button>
              </div>
            </>
          ) : (
            <p className="hint" style={{ marginTop: 0 }}>
              Saved with the show, and shown to anyone who opens it without the
              recording. It is also the credit line for a programme.
            </p>
          )}
        </details>

        {audio.loaded && (
          <>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={audio.embedded}
                onChange={(event) => void audio.setEmbedded(event.target.checked)}
              />
              Save the recording inside the show file
            </label>
            <p className="hint" style={{ marginTop: 0 }}>
              {audio.embedded
                ? 'The show file carries the music, so it opens with sound on any machine. It will be roughly a third larger than the audio file itself.'
                : 'The show file stores the name and tempo only, and the recording is kept in this browser so it comes back on reload. Tick this to hand the show to someone else with the music included.'}
            </p>
          </>
        )}

        {audio.detecting && (
          <p className="hint" style={{ marginTop: 0 }}>
            Reading the tempo off the waveform…
          </p>
        )}

        {/*
          A restored recording has not been analysed — detection is skipped on
          restore so a hand-corrected tempo is not overwritten on every reload.
          Saying "no steady pulse found" there reports a failure that never
          happened, and sends the designer off tapping a tempo they already have.
        */}
        {audio.loaded && !audio.detecting && !audio.analysed && (
          <div className="alert alert--info" role="status">
            <strong>Tempo from the show file: {Math.round(currentBpm)} BPM</strong>
            <div style={{ marginTop: 2 }}>
              The recording was restored with the show, so it has not been
              analysed again — that way a tempo you corrected by hand survives a
              reload. Analyse it if you want the waveform checked afresh.
            </div>
            <button
              type="button"
              className="btn btn--sm"
              style={{ marginTop: 6 }}
              onClick={audio.redetectTempo}
            >
              Detect tempo from the waveform
            </button>
          </div>
        )}

        {audio.loaded && !audio.detecting && audio.analysed && (
          <div
            className={`alert ${
              audio.detected && audio.detected.confidence >= 0.35
                ? 'alert--info'
                : 'alert--warning'
            }`}
            role="status"
          >
            {audio.detected ? (
              <>
                <strong>
                  Detected {audio.detected.bpm} BPM
                  {audio.detected.confidence < 0.35 && ' (low confidence)'}
                </strong>
                <div style={{ marginTop: 2 }}>
                  Applied to the marching tempo, with the downbeat at{' '}
                  {audio.detected.firstBeatSeconds.toFixed(2)}s.
                </div>
                <div className="row row--wrap" style={{ marginTop: 6 }}>
                  <button
                    type="button"
                    className="btn btn--sm"
                    title="Halve the tempo — fixes the usual octave error"
                    onClick={() =>
                      audio.detected &&
                      audio.applyDetected(shiftTempoOctave(audio.detected, 0.5))
                    }
                  >
                    ÷2 → {Math.round(audio.detected.bpm / 2)}
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm"
                    title="Double the tempo"
                    onClick={() =>
                      audio.detected &&
                      audio.applyDetected(shiftTempoOctave(audio.detected, 2))
                    }
                  >
                    ×2 → {Math.round(audio.detected.bpm * 2)}
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={audio.redetectTempo}
                  >
                    Detect again
                  </button>
                </div>
              </>
            ) : (
              <>
                <strong>No steady pulse found</strong>
                <div style={{ marginTop: 2 }}>
                  Tap the tempo in below, or set it by hand. A rubato or very
                  quiet opening is the usual reason.
                </div>
              </>
            )}
          </div>
        )}

        <div className="grid-2">
          <div className="field">
            <label className="field__label" htmlFor="music-offset">
              Downbeat at (s)
            </label>
            <input
              id="music-offset"
              className="input"
              type="number"
              step={0.01}
              value={tempoMap.offsetSeconds}
              onChange={(event) =>
                updateMusic({
                  tempoMap: {
                    ...tempoMap,
                    offsetSeconds: Number(event.target.value) || 0,
                  },
                })
              }
            />
          </div>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <span className="field__label">&nbsp;</span>
            <button
              type="button"
              className="btn btn--sm"
              disabled={!audio.loaded}
              onClick={() =>
                updateMusic({
                  tempoMap: { ...tempoMap, offsetSeconds: audio.position },
                })
              }
              title="Set the downbeat to the current playhead position"
            >
              Set from playhead
            </button>
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label className="field__label" htmlFor="meter-beats">
              Beats / measure
            </label>
            <input
              id="meter-beats"
              className="input"
              type="number"
              min={1}
              max={16}
              value={meter.beatsPerMeasure}
              onChange={(event) =>
                updateMusic({
                  tempoMap: upsertMeter(tempoMap, {
                    measure: 1,
                    beatsPerMeasure: Math.max(1, Number(event.target.value) || 4),
                    beatUnit: meter.beatUnit,
                  }),
                })
              }
            />
          </div>
          <div className="field">
            <span className="field__label">Tap tempo</span>
            <div className="row">
              <button type="button" className="btn btn--sm" onClick={handleTap}>
                Tap
              </button>
              <button
                type="button"
                className="btn btn--sm"
                disabled={tappedBpm === null}
                onClick={() => {
                  if (tappedBpm === null) return;
                  updateMusic({
                    tempoMap: upsertTempo(tempoMap, { measure: 1, bpm: tappedBpm }),
                  });
                  // Both, or the button keeps offering a tempo already used.
                  setTaps([]);
                  setTappedBpm(null);
                }}
              >
                {tappedBpm ? `Use ${tappedBpm}` : 'Use'}
              </button>
              {taps.length > 0 && (
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => {
                    setTaps([]);
                    setTappedBpm(null);
                  }}
                >
                  Reset
                </button>
              )}
            </div>
            {/*
              Two taps produce no reading at all, and with no feedback the
              button looks broken — which is exactly how it was reported.
            */}
            <p className="hint" style={{ marginTop: 2 }}>
              {tappedBpm !== null
                ? `${tappedBpm} BPM from ${taps.length} taps — keep tapping to refine it.`
                : taps.length === 0
                  ? `Tap along with the music ${MIN_TEMPO_TAPS} times or more.`
                  : `${taps.length} tap${taps.length === 1 ? '' : 's'} — ${
                      MIN_TEMPO_TAPS - taps.length
                    } more before a reading.`}
            </p>
          </div>
        </div>

        <h3 className="section__title" style={{ margin: '8px 0 4px' }}>
          Tempo changes
        </h3>
        {tempoMap.tempos.map((tempo) => (
          <div className="tempo-row" key={`${tempo.measure}`}>
            <input
              className="input input--inline"
              type="number"
              min={1}
              value={tempo.measure}
              disabled={tempo.measure === 1}
              aria-label="Measure"
              onChange={(event) => {
                const measure = Math.max(2, Number(event.target.value) || 2);
                updateMusic({
                  tempoMap: upsertTempo(removeTempo(tempoMap, tempo.measure), {
                    measure,
                    bpm: tempo.bpm,
                  }),
                });
              }}
            />
            <input
              className="input input--inline"
              type="number"
              min={20}
              max={400}
              value={tempo.bpm}
              aria-label="Beats per minute"
              onChange={(event) =>
                updateMusic({
                  tempoMap: upsertTempo(tempoMap, {
                    measure: tempo.measure,
                    bpm: Math.max(20, Math.min(400, Number(event.target.value) || 120)),
                  }),
                })
              }
            />
            <button
              type="button"
              className="btn btn--sm btn--ghost btn--icon"
              disabled={tempo.measure === 1}
              aria-label={`Remove tempo change at measure ${tempo.measure}`}
              onClick={() =>
                updateMusic({ tempoMap: removeTempo(tempoMap, tempo.measure) })
              }
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => {
            const last = tempoMap.tempos[tempoMap.tempos.length - 1];
            updateMusic({
              tempoMap: upsertTempo(tempoMap, {
                measure: (last?.measure ?? 1) + 8,
                bpm: last?.bpm ?? 120,
              }),
            });
          }}
        >
          Add tempo change
        </button>

        <p className="hint">
          Counts follow the tempo map, so a change here moves every set&rsquo;s
          position in the music without touching the drill.
        </p>
      </div>
    </div>
  );
}
