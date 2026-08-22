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
 * The 3D canvas, its camera controls, and the transport that drives it.
 *
 * Reads the same store and the same audio clock as the editor, so this is a
 * second view of one show rather than a copy of it: scrub the timeline in the
 * editor and the stadium moves, press play here and the editor's playhead
 * follows.
 */

import { useEffect, useMemo, useRef, useState } from 'react';

import { useAudio } from '../../audio/AudioProvider.tsx';
import { CAMERA_PRESETS, type CameraPresetId, presetOrbit } from '../../core/camera3d.ts';
import { positionsAtCount } from '../../core/interpolate.ts';
import { setContextAtCount } from '../../core/setContext.ts';
import { totalCounts } from '../../core/show.ts';
import { useFieldMetrics, useShowStore } from '../../state/showStore.ts';
import { createStadiumView, type StadiumView } from '../../three/stadiumView.ts';
import { registerStadiumView } from '../capture/captureTargets.ts';
import { VideoExportDialog } from '../dialogs/VideoExportDialog.tsx';
import { SetOverlay } from './SetOverlay.tsx';
import { useCameraControls } from './useCameraControls.ts';

export function StadiumViewport({
  onClose,
  onPopOut,
  poppedOut,
}: {
  onClose: () => void;
  onPopOut?: () => void;
  poppedOut: boolean;
}) {
  const show = useShowStore((state) => state.show);
  const playheadCount = useShowStore((state) => state.playheadCount);
  const seekToCount = useShowStore((state) => state.seekToCount);
  const metrics = useFieldMetrics();
  const audio = useAudio();

  const [preset, setPreset] = useState<CameraPresetId>('home-stands');
  const [showOverlay, setShowOverlay] = useState(true);
  const [recording, setRecording] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<StadiumView | null>(null);

  const controls = useCameraControls(useMemo(() => presetOrbit('home-stands', metrics), []));

  // The frame loop needs the current show and playhead without being rebuilt
  // every time either changes — a rebuilt scene would flash and lose the camera.
  const liveRef = useRef({ show, playheadCount });
  liveRef.current = { show, playheadCount };

  /*
   * Build the scene once per roster/field change.
   *
   * Deliberately NOT keyed on the show object: dragging one performer in the
   * editor produces a new show every frame, and tearing down a WebGL context
   * that often would be catastrophic. Only the things the scene is actually
   * built from belong in the dependency list.
   */
  const sceneKey = useMemo(
    () =>
      [
        show.performers.map((performer) => `${performer.id}:${performer.sectionId}`).join(','),
        show.sections.map((section) => `${section.id}:${section.color}`).join(','),
        JSON.stringify(show.field),
      ].join('|'),
    [show.performers, show.sections, show.field],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let view: StadiumView;
    try {
      view = createStadiumView({
        canvas,
        metrics,
        appearance: show.field.appearance,
        performers: show.performers,
        sections: show.sections,
        showEndZones: show.field.showEndZones,
        logos: show.fieldLogos,
        onFrame: (delta) => {
          controls.stepFly(delta);
          view.setOrbit(controls.orbitRef.current);
          const live = liveRef.current;
          view.setPositions(positionsAtCount(live.show, live.playheadCount));
        },
      });
    } catch (cause) {
      // WebGL can be unavailable: old hardware, a blocked context, or a browser
      // with it switched off. Say so rather than showing a black rectangle.
      setFailure(
        cause instanceof Error
          ? `3D playback could not start: ${cause.message}`
          : '3D playback could not start on this device.',
      );
      return;
    }

    viewRef.current = view;
    registerStadiumView(view);
    setFailure(null);

    const resize = () => {
      const host = hostRef.current;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      view.resize(
        Math.max(1, Math.floor(rect.width)),
        Math.max(1, Math.floor(rect.height)),
        canvas.ownerDocument.defaultView?.devicePixelRatio ?? 1,
      );
    };
    resize();

    const observer = new ResizeObserver(resize);
    if (hostRef.current) observer.observe(hostRef.current);

    return () => {
      observer.disconnect();
      registerStadiumView(null);
      view.dispose();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);

  /*
   * Logos repaint the field without rebuilding the scene.
   *
   * They are deliberately absent from `sceneKey`: a logo being dragged in the
   * editor changes on every pointer move, and tearing down the WebGL context
   * that often would be ruinous. The view redraws just the turf texture, and
   * throttles that internally.
   */
  const logoKey = useMemo(
    () =>
      show.fieldLogos
        .map(
          (logo) =>
            `${logo.id}:${logo.visible}:${logo.opacity}:${logo.rotationDegrees}:` +
            `${logo.center.x},${logo.center.y}:${logo.widthSteps}x${logo.heightSteps}:` +
            // The URL itself is a whole embedded image; its length is enough to
            // notice a swap without putting megabytes into a dependency key.
            `${logo.dataUrl.length}`,
        )
        .join('|'),
    [show.fieldLogos],
  );

  useEffect(() => {
    viewRef.current?.setLogos(show.fieldLogos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoKey]);

  // Changing preset re-aims the camera; free flying from there is expected, so
  // this sets the orbit rather than locking it.
  useEffect(() => {
    controls.orbitRef.current = presetOrbit(preset, metrics);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const context = setContextAtCount(show, playheadCount);
  const total = Math.max(1, totalCounts(show));

  return (
    <div className="stadium">
      <div className="stadium__stage" ref={hostRef}>
        <canvas
          ref={canvasRef}
          className="stadium__canvas"
          {...controls.handlers}
          aria-label="3D playback view"
        />
        {failure && <div className="stadium__failure">{failure}</div>}
        {showOverlay && !failure && <SetOverlay context={context} />}
      </div>

      <div className="stadium__bar">
        <button
          type="button"
          className="btn btn--icon"
          title={audio.loaded ? 'Play / pause' : 'Load audio in the editor to play'}
          aria-label={audio.playing ? 'Pause' : 'Play'}
          onClick={audio.toggle}
          disabled={!audio.loaded}
        >
          {audio.playing ? '❚❚' : '▶'}
        </button>

        <input
          className="stadium__scrub"
          type="range"
          min={0}
          max={total}
          step={0.25}
          value={Math.min(playheadCount, total)}
          aria-label="Playhead"
          onChange={(event) => seekToCount(Number(event.target.value))}
        />

        <span className="stadium__readout">
          Set {context.current.label} · {context.countsRemaining} to go
        </span>

        <select
          className="select select--sm"
          value={preset}
          aria-label="Camera angle"
          onChange={(event) => setPreset(event.target.value as CameraPresetId)}
        >
          {CAMERA_PRESETS.map((option) => (
            <option key={option.id} value={option.id} title={option.description}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={`btn btn--sm${showOverlay ? ' btn--active' : ''}`}
          aria-pressed={showOverlay}
          onClick={() => setShowOverlay((on) => !on)}
          title="Show the previous, current and next set over the field"
        >
          Set overlay
        </button>

        {/*
          Recording lives here, not in the editor's export dialog: this view
          takes over the window, so "open it and come back" is not a thing a
          user can do. It is also the right place — the camera has to be framed
          before the recording starts, and that happens here.
        */}
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => setRecording(true)}
          title="Record this view as a video file"
        >
          ⏺ Record
        </button>

        {onPopOut && !poppedOut && (
          <button type="button" className="btn btn--sm" onClick={onPopOut}>
            Pop out ↗
          </button>
        )}

        <button type="button" className="btn btn--sm" onClick={onClose}>
          {poppedOut ? 'Close window' : 'Back to editing'}
        </button>
      </div>

      {recording && (
        <VideoExportDialog fixedSource="stadium" onClose={() => setRecording(false)} />
      )}

      <p className="stadium__hint">
        Drag to swing the camera · right-drag to slide · scroll to zoom ·{' '}
        <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> to fly, <kbd>Q</kbd>{' '}
        <kbd>E</kbd> for height, <kbd>Shift</kbd> to move faster
      </p>
    </div>
  );
}
