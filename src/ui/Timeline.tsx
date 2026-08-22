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

import { useMemo } from 'react';

import { countTimeline, totalCounts } from '../core/show.ts';
import { countToMeasureBeat, countToTime } from '../core/tempo.ts';
import { describePathScope, visiblePathPerformers } from '../core/pathVisibility.ts';
import { useAudio, useTempoIndex } from '../audio/AudioProvider.tsx';
import { useShowStore } from '../state/showStore.ts';

function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00.0';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
}

/**
 * The transport: scrub the whole show by count, with set markers on the rail
 * (FR-1.8). When audio is loaded the same control drives playback, so dragging
 * the playhead seeks the recording and pressing play walks the drill through
 * the music (FR-3.6).
 */
export function Timeline() {
  const show = useShowStore((state) => state.show);
  const playheadCount = useShowStore((state) => state.playheadCount);
  const seekToCount = useShowStore((state) => state.seekToCount);
  const setScrubbing = useShowStore((state) => state.setScrubbing);
  const goToSet = useShowStore((state) => state.goToSet);
  const currentSetIndex = useShowStore((state) => state.currentSetIndex);

  const paths = useShowStore((state) => state.view.paths);
  const updatePathVisibility = useShowStore((state) => state.updatePathVisibility);
  const selectedIds = useShowStore((state) => state.selectedPerformerIds);

  const audio = useAudio();
  const tempoIndex = useTempoIndex();

  const scopeLabel = describePathScope(
    paths,
    visiblePathPerformers(show.performers, paths, selectedIds).size,
    show.performers.length,
  );

  const total = Math.max(1, totalCounts(show));
  const marks = useMemo(() => countTimeline(show), [show]);
  const anchor = countToMeasureBeat(tempoIndex, playheadCount);
  const seconds = countToTime(tempoIndex, playheadCount);

  const scrubTo = (count: number) => {
    setScrubbing(true);
    // seekToCount moves the playhead and asks the audio layer to follow, so
    // scrubbing and set navigation take the same path.
    seekToCount(count);
  };

  return (
    <div className="timeline">
      <div className="timeline__transport">
        <button
          type="button"
          className="btn btn--icon"
          title="Previous set"
          aria-label="Previous set"
          onClick={() => {
            setScrubbing(false);
            goToSet(currentSetIndex - 1);
          }}
          disabled={currentSetIndex === 0}
        >
          ◀
        </button>
        <button
          type="button"
          className={`btn btn--icon${audio.playing ? ' btn--active' : ''}`}
          title={
            audio.loaded
              ? 'Play / pause'
              : audio.restoring
                ? 'Restoring the recording…'
                : audio.missing
                  ? `Re-import ${audio.missing.fileName} to play`
                  : 'Load audio to play'
          }
          aria-label={audio.playing ? 'Pause' : 'Play'}
          onClick={audio.toggle}
          disabled={!audio.loaded}
        >
          {audio.playing ? '❚❚' : '▶'}
        </button>
        <button
          type="button"
          className="btn btn--icon"
          title="Next set"
          aria-label="Next set"
          onClick={() => {
            setScrubbing(false);
            goToSet(currentSetIndex + 1);
          }}
          disabled={currentSetIndex >= show.sets.length - 1}
        >
          ▶
        </button>
        <button
          type="button"
          className="btn btn--icon"
          title="Snap back to the current set"
          aria-label="Snap to current set"
          onClick={() => {
            setScrubbing(false);
            goToSet(currentSetIndex);
          }}
        >
          ⤒
        </button>
        {/*
          Playback gets its own path switch, next to the transport rather than
          in the editing toolbar, because it answers a different question: not
          "where does this person go" but "can I see anything at all through
          250 lines". Off by default; scope is set in the Paths panel.
        */}
        <button
          type="button"
          className={`btn btn--icon${paths.whilePlaying ? ' btn--active' : ''}`}
          title={`Show movement paths during playback (Shift+P) — currently ${
            paths.whilePlaying ? `on, ${scopeLabel}` : 'off'
          }`}
          aria-pressed={paths.whilePlaying}
          aria-label="Show paths during playback"
          onClick={() => updatePathVisibility({ whilePlaying: !paths.whilePlaying })}
        >
          ⤳
        </button>

        {/*
          The disabled play button is where a user first notices the music is
          gone, so the explanation belongs right beside it rather than only in
          the Music panel, which may well be scrolled out of sight.
        */}
        {audio.missing && !audio.restoring && (
          <label className="timeline__audio-warning" title="The recording is not in this browser">
            <span aria-hidden="true">⚠</span>
            <span>
              Re-import <strong>{audio.missing.fileName}</strong>
            </span>
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
        )}
        {audio.restoring && (
          <span className="timeline__audio-warning timeline__audio-warning--calm">
            Restoring audio…
          </span>
        )}
      </div>

      <div className="timeline__track">
        <div className="timeline__rail" />
        {marks.map((count, index) => (
          <div
            key={show.sets[index].id}
            className="timeline__marker"
            style={{ left: `${(count / total) * 100}%` }}
          >
            {(index === 0 ||
              index === show.sets.length - 1 ||
              show.sets.length <= 16 ||
              index % Math.ceil(show.sets.length / 16) === 0) && (
              <span className="timeline__marker-label">{show.sets[index].label}</span>
            )}
          </div>
        ))}
        <div
          className="timeline__playhead"
          style={{ left: `${(Math.min(playheadCount, total) / total) * 100}%` }}
        />
        <input
          className="timeline__range"
          type="range"
          min={0}
          max={total}
          step={0.25}
          value={Math.min(playheadCount, total)}
          aria-label="Show position in counts"
          onChange={(event) => scrubTo(Number(event.target.value))}
        />
      </div>

      {/*
        Every value here is padded to a fixed width and the block itself has a
        fixed size, because this readout sits next to a flexible track: letting
        it grow by a character as the playhead moves would shrink the track and
        shake the whole bar sideways.
      */}
      <div className="timeline__readout" aria-live="off">
        <div className="timeline__readout-row">
          <span className="timeline__readout-label">Count</span>
          <span className="timeline__readout-value">
            {playheadCount.toFixed(1)} / {total}
          </span>
        </div>
        <div className="timeline__readout-row">
          <span className="timeline__readout-label">Measure</span>
          <span className="timeline__readout-value">
            {anchor.measure}, beat {Math.floor(anchor.beat)}
          </span>
        </div>
        <div className="timeline__readout-row">
          <span className="timeline__readout-label">Time</span>
          <span className="timeline__readout-value">
            {formatClock(seconds)}
            {audio.loaded ? ` / ${formatClock(audio.duration)}` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
