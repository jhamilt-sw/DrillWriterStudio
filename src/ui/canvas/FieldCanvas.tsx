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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type Konva from 'konva';
import {
  Circle,
  Group,
  Layer,
  Line,
  Rect,
  RegularPolygon,
  Stage,
  Text,
} from 'react-konva';

import { APP_SHORT_NAME } from '../../core/app.ts';
import type { DrillPoint, Performer } from '../../core/types.ts';
import { clampToField } from '../../core/field.ts';
import { describePointShort } from '../../core/notation.ts';
import {
  type Viewport,
  deltaToDrill,
  fitFieldToBox,
  markerRadius,
  panBy,
  toDrill,
  toPixels,
  zoomAbout,
} from '../../core/transform.ts';
import { rotateAbout, snapPoint } from '../../core/formations.ts';
import {
  formatDelta,
  rotationDelta,
  rotationRigFor,
  stepFor,
} from '../../core/rotation.ts';
import {
  analyseSegment,
  frameAtCount,
  interpolatedPositions,
  pointAlongSegment,
  segmentsIntoSet,
} from '../../core/interpolate.ts';
import { pathsEnabled, visiblePathPerformers } from '../../core/pathVisibility.ts';
import { resolveSetPositions, totalCounts } from '../../core/show.ts';
import { useFieldMetrics, useShowStore } from '../../state/showStore.ts';
import { useAlignmentActions } from '../alignment/useAlignmentActions.ts';
import { useElementSize } from '../hooks/useElementSize.ts';
import { ContextMenu, type ContextMenuPosition } from './ContextMenu.tsx';
import { registerFieldStage } from '../capture/captureTargets.ts';
import { fieldInk } from './fieldInk.ts';
import { FieldGraphics } from './FieldGraphics.tsx';
import { LogoLayer, type LogoCorner } from './LogoLayer.tsx';

const ZOOM_LIMITS = { min: 1.2, max: 42 };
const CURVE_SAMPLES = 14;

interface DragState {
  anchorId: string;
  startPointer: { x: number; y: number };
  startPositions: Record<string, DrillPoint>;
  moved: boolean;
}

interface RotateState {
  /** Positions as they were when the drag began — rotation is always applied
   *  to these, never compounded, so dust cannot accumulate. */
  startPositions: Record<string, DrillPoint>;
  center: DrillPoint;
  startPoint: DrillPoint;
  degrees: number;
  /** The increment in force on the last move, so the badge can name it. */
  step: number;
  moved: boolean;
}

interface LogoDragState {
  logoId: string;
  corner: LogoCorner | null;
  startPointer: { x: number; y: number };
  startCenter: DrillPoint;
  startWidth: number;
  startHeight: number;
  lockAspect: boolean;
  moved: boolean;
}

interface MarqueeState {
  start: { x: number; y: number };
  current: { x: number; y: number };
  additive: boolean;
}

export function FieldCanvas() {
  const [hostRef, size] = useElementSize<HTMLDivElement>();
  const metrics = useFieldMetrics();
  const appearance = useShowStore((state) => state.show.field.appearance);
  const colors = useMemo(() => fieldInk(appearance), [appearance]);

  const show = useShowStore((state) => state.show);
  const currentSetIndex = useShowStore((state) => state.currentSetIndex);
  const selectedIds = useShowStore((state) => state.selectedPerformerIds);
  const view = useShowStore((state) => state.view);
  const playheadCount = useShowStore((state) => state.playheadCount);
  const isScrubbing = useShowStore((state) => state.isScrubbing);

  const select = useShowStore((state) => state.select);
  const clearSelection = useShowStore((state) => state.clearSelection);
  const setPositions = useShowStore((state) => state.setPositions);
  const beginInteraction = useShowStore((state) => state.beginInteraction);
  const endInteraction = useShowStore((state) => state.endInteraction);

  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [manualViewport, setManualViewport] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<DrillPoint | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [menuAt, setMenuAt] = useState<ContextMenuPosition | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const logoDragRef = useRef<LogoDragState | null>(null);
  const rotateRef = useRef<RotateState | null>(null);
  /*
   * The Konva stage, registered so the video exporter can find it.
   *
   * A registry rather than a prop: the export dialog lives at the top of the
   * tree and this canvas is three levels down, and the alternative is threading
   * a ref through every component in between for one feature's benefit.
   */
  const stageRef = useRef<Konva.Stage | null>(null);
  useEffect(() => {
    registerFieldStage(stageRef.current);
    return () => registerFieldStage(null);
  });

  const [rotateReadout, setRotateReadout] = useState<{
    angle: string;
    step: number;
  } | null>(null);
  const [dragReadout, setDragReadout] = useState<
    { x: number; y: number; text: string } | null
  >(null);

  const fieldLogos = useShowStore((state) => state.show.fieldLogos);
  const selectedLogoId = useShowStore((state) => state.selectedLogoId);
  const selectLogo = useShowStore((state) => state.selectLogo);
  const updateLogo = useShowStore((state) => state.updateLogo);

  const alignment = useAlignmentActions();

  // Refit whenever the container or the field changes, unless the user has
  // taken manual control of the viewport by panning or zooming.
  useEffect(() => {
    if (size.width < 10 || size.height < 10 || manualViewport) return;
    setViewport(fitFieldToBox(metrics, size.width, size.height, { padding: 28 }));
  }, [size.width, size.height, metrics, manualViewport]);

  const fitToScreen = useCallback(() => {
    if (size.width < 10 || size.height < 10) return;
    setManualViewport(false);
    setViewport(fitFieldToBox(metrics, size.width, size.height, { padding: 28 }));
  }, [metrics, size.width, size.height]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  /**
   * Where everyone stands right now. While the timeline is being scrubbed this
   * is an interpolated frame between two sets; otherwise it is the current set
   * exactly.
   */
  // While scrubbing or playing, the frame decides BOTH where everyone is drawn
  // and which transition the paths belong to. Deriving those separately is what
  // previously let the dots animate one move while the lines showed the one
  // before it.
  const frame = useMemo(
    () => (isScrubbing ? frameAtCount(show, playheadCount) : null),
    [show, isScrubbing, playheadCount],
  );

  /** The transition whose paths are relevant right now. */
  const pathSetIndex = frame ? frame.setIndex : currentSetIndex;

  const positions = useMemo(
    () =>
      frame
        ? interpolatedPositions(show, frame.setIndex, frame.t)
        : resolveSetPositions(show, currentSetIndex),
    [show, currentSetIndex, frame],
  );

  const previousPositions = useMemo(
    () =>
      view.showPreviousSet && currentSetIndex > 0 && !isScrubbing
        ? resolveSetPositions(show, currentSetIndex - 1)
        : null,
    [show, currentSetIndex, view.showPreviousSet, isScrubbing],
  );

  const nextPositions = useMemo(
    () =>
      view.showNextSet && currentSetIndex < show.sets.length - 1 && !isScrubbing
        ? resolveSetPositions(show, currentSetIndex + 1)
        : null,
    [show, currentSetIndex, view.showNextSet, isScrubbing],
  );

  /**
   * Movement paths, gated on the editing/playback switch and then narrowed to
   * whichever performers the path scope covers.
   */
  const segments = useMemo(() => {
    if (!pathsEnabled(view.paths, isScrubbing)) return [];
    const visible = visiblePathPerformers(show.performers, view.paths, selectedIds);
    if (visible.size === 0) return [];
    return segmentsIntoSet(show, pathSetIndex).filter((segment) =>
      visible.has(segment.performerId),
    );
  }, [show, pathSetIndex, view.paths, isScrubbing, selectedIds]);

  /** Performers whose move into this set demands an uncomfortable stride. */
  const strained = useMemo(() => {
    const flagged = new Set<string>();
    if (!view.showStrideWarnings) return flagged;
    for (const segment of segments) {
      if (analyseSegment(segment, metrics).inchesPerStep > view.strideWarningInches) {
        flagged.add(segment.performerId);
      }
    }
    return flagged;
  }, [segments, metrics, view.showStrideWarnings, view.strideWarningInches]);

  const sectionsById = useMemo(
    () => new Map(show.sections.map((section) => [section.id, section])),
    [show.sections],
  );

  const placed = useMemo(
    () =>
      show.performers
        .map((performer) => ({ performer, point: positions[performer.id] }))
        .filter(
          (entry): entry is { performer: Performer; point: DrillPoint } =>
            Boolean(entry.point),
        ),
    [show.performers, positions],
  );

  /**
   * Where the rotation handle sits: above the selection's bounding box, in
   * drill units, so it tracks the form as the view zooms and pans.
   */
  const rotationRig = useMemo(() => {
    if (isScrubbing || selectedIds.length === 0) return null;
    return rotationRigFor(
      placed
        .filter((entry) => selectedSet.has(entry.performer.id))
        .map((entry) => entry.point),
    );
  }, [isScrubbing, placed, selectedIds, selectedSet]);

  // ---------------------------------------------------------- interaction --

  const handlePerformerPointerDown = useCallback(
    (performerId: string, event: Konva.KonvaEventObject<PointerEvent>) => {
      event.cancelBubble = true;
      if (event.evt.button !== 0 || isScrubbing) return;

      const additive = event.evt.shiftKey || event.evt.metaKey || event.evt.ctrlKey;

      // Work out what the selection will be *after* this press, because the
      // drag that may follow has to move exactly that group.
      let workingSelection: string[];
      if (additive) {
        workingSelection = selectedSet.has(performerId)
          ? selectedIds.filter((id) => id !== performerId)
          : [...selectedIds, performerId];
        select([performerId], 'toggle');
      } else if (!selectedSet.has(performerId)) {
        workingSelection = [performerId];
        select([performerId], 'replace');
      } else {
        workingSelection = selectedIds;
      }

      const pointer = event.target.getStage()?.getPointerPosition();
      if (!pointer || !workingSelection.includes(performerId)) return;

      const startPositions: Record<string, DrillPoint> = {};
      for (const id of workingSelection) {
        const point = positions[id];
        if (point) startPositions[id] = { ...point };
      }
      if (!startPositions[performerId]) return;

      beginInteraction('Move performers');
      dragRef.current = {
        anchorId: performerId,
        startPointer: pointer,
        startPositions,
        moved: false,
      };
    },
    [beginInteraction, isScrubbing, positions, select, selectedIds, selectedSet],
  );


  // ------------------------------------------------------------ logo edit --

  const handleLogoPointerDown = useCallback(
    (logoId: string, event: Konva.KonvaEventObject<PointerEvent>) => {
      if (event.evt.button !== 0) return;
      const pointer = event.target.getStage()?.getPointerPosition();
      const logo = fieldLogos.find((candidate) => candidate.id === logoId);
      if (!pointer || !logo) return;
      beginInteraction('Move logo');
      logoDragRef.current = {
        logoId,
        corner: null,
        startPointer: pointer,
        startCenter: { ...logo.center },
        startWidth: logo.widthSteps,
        startHeight: logo.heightSteps,
        lockAspect: logo.lockAspect,
        moved: false,
      };
    },
    [beginInteraction, fieldLogos],
  );

  const handleLogoHandlePointerDown = useCallback(
    (
      logoId: string,
      corner: LogoCorner,
      event: Konva.KonvaEventObject<PointerEvent>,
    ) => {
      if (event.evt.button !== 0) return;
      const pointer = event.target.getStage()?.getPointerPosition();
      const logo = fieldLogos.find((candidate) => candidate.id === logoId);
      if (!pointer || !logo) return;
      beginInteraction('Resize logo');
      logoDragRef.current = {
        logoId,
        corner,
        startPointer: pointer,
        startCenter: { ...logo.center },
        startWidth: logo.widthSteps,
        startHeight: logo.heightSteps,
        lockAspect: logo.lockAspect,
        moved: false,
      };
    },
    [beginInteraction, fieldLogos],
  );

  /**
   * Resize about the opposite corner, so the corner being dragged follows the
   * cursor and the one across from it stays put — the behaviour every drawing
   * tool has, and the reason a logo does not swim while being sized.
   */
  const applyLogoDrag = useCallback(
    (pointer: { x: number; y: number }): void => {
      const drag = logoDragRef.current;
      if (!drag || !viewport) return;
      const delta = deltaToDrill(
        pointer.x - drag.startPointer.x,
        pointer.y - drag.startPointer.y,
        viewport,
      );
      drag.moved = true;

      if (!drag.corner) {
        updateLogo(drag.logoId, {
          center: {
            x: drag.startCenter.x + delta.x,
            y: drag.startCenter.y + delta.y,
          },
        });
        return;
      }

      const signX = drag.corner === 'se' || drag.corner === 'ne' ? 1 : -1;
      const signY = drag.corner === 'ne' || drag.corner === 'nw' ? 1 : -1;

      let width = Math.max(0.5, drag.startWidth + delta.x * signX);
      let height = Math.max(0.5, drag.startHeight + delta.y * signY);

      if (drag.lockAspect && drag.startWidth > 0 && drag.startHeight > 0) {
        // Follow whichever axis the cursor moved further along, so the drag
        // feels like it is tracking the corner rather than fighting it.
        const ratio = drag.startHeight / drag.startWidth;
        if (Math.abs(delta.x) >= Math.abs(delta.y)) height = width * ratio;
        else width = height / ratio;
      }

      // The opposite corner is the anchor, so the centre shifts by half the
      // size change in the direction being dragged.
      updateLogo(drag.logoId, {
        widthSteps: width,
        heightSteps: height,
        lockAspect: drag.lockAspect,
        center: {
          x: drag.startCenter.x + ((width - drag.startWidth) / 2) * signX,
          y: drag.startCenter.y + ((height - drag.startHeight) / 2) * signY,
        },
      });
    },
    [updateLogo, viewport],
  );

  const handleRotatePointerDown = useCallback(
    (event: Konva.KonvaEventObject<PointerEvent>) => {
      if (event.evt.button !== 0 || !viewport || !rotationRig) return;
      event.cancelBubble = true;
      const pointer = event.target.getStage()?.getPointerPosition();
      if (!pointer) return;

      const startPositions: Record<string, DrillPoint> = {};
      for (const id of selectedIds) {
        const point = positions[id];
        if (point) startPositions[id] = { ...point };
      }
      if (Object.keys(startPositions).length === 0) return;

      beginInteraction('Rotate selection');
      rotateRef.current = {
        startPositions,
        center: rotationRig.center,
        startPoint: toDrill(pointer, viewport),
        degrees: 0,
        step: stepFor(view.rotation, false),
        moved: false,
      };
      setRotateReadout({ angle: '0°', step: stepFor(view.rotation, false) });
    },
    [beginInteraction, positions, rotationRig, selectedIds, view.rotation, viewport],
  );

  /**
   * Turn the selection to follow the pointer.
   *
   * `coarse` is Shift, not Alt. Alt is already the pan modifier on this canvas,
   * and on Windows tapping it hands focus to the browser's menu bar — so a
   * modifier bound to Alt here is one the user cannot reliably hold.
   */
  const applyRotation = useCallback(
    (pointer: { x: number; y: number }, coarse: boolean): void => {
      const rotate = rotateRef.current;
      if (!rotate || !viewport) return;
      const step = stepFor(view.rotation, coarse);
      const degrees = rotationDelta(
        rotate.center,
        rotate.startPoint,
        toDrill(pointer, viewport),
        step,
      );
      // Only touch React state when something actually changed. A pointermove
      // fires far more often than the angle moves a whole step, and with 250
      // performers on the field a needless re-render per move is felt.
      if (degrees !== rotate.degrees || step !== rotate.step) {
        setRotateReadout({ angle: formatDelta(degrees), step });
      }
      rotate.step = step;
      if (degrees === rotate.degrees) return;
      rotate.degrees = degrees;
      rotate.moved = true;

      const ids = Object.keys(rotate.startPositions);
      const turned = rotateAbout(
        ids.map((id) => rotate.startPositions[id]),
        rotate.center,
        degrees,
      );
      const moved: Record<string, DrillPoint> = {};
      ids.forEach((id, index) => {
        moved[id] = clampToField(turned[index], metrics);
      });
      setPositions(moved, { skipHistory: true });
    },
    [metrics, setPositions, view.rotation, viewport],
  );

  const handleStagePointerDown = useCallback(
    (event: Konva.KonvaEventObject<PointerEvent>) => {
      const stage = event.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (!pointer) return;

      // Middle button or Alt-drag pans the field.
      if (event.evt.button === 1 || event.evt.altKey) {
        panRef.current = pointer;
        return;
      }
      if (event.evt.button !== 0) return;

      // Only the performer and logo layers listen, so a press that reaches the
      // stage landed on empty field: start a marquee.
      if (event.target === stage) {
        selectLogo(null);
        setMarquee({ start: pointer, current: pointer, additive: event.evt.shiftKey });
      }
    },
    [selectLogo],
  );

  const handleStagePointerMove = useCallback(
    (event: Konva.KonvaEventObject<PointerEvent>) => {
      const pointer = event.target.getStage()?.getPointerPosition();
      if (!pointer || !viewport) return;

      setHoverPoint(toDrill(pointer, viewport));

      if (rotateRef.current) {
        applyRotation(pointer, event.evt.shiftKey);
        return;
      }

      if (logoDragRef.current) {
        applyLogoDrag(pointer);
        return;
      }

      if (panRef.current) {
        const dx = pointer.x - panRef.current.x;
        const dy = pointer.y - panRef.current.y;
        panRef.current = pointer;
        setManualViewport(true);
        setViewport((current) => (current ? panBy(current, dx, dy) : current));
        return;
      }

      const drag = dragRef.current;
      if (drag) {
        const anchorStart = drag.startPositions[drag.anchorId];
        // Snap the performer under the cursor, then move everyone else by the
        // same delta. Snapping each performer independently would collapse the
        // form onto the grid and destroy the intervals between them.
        // deltaToDrill, not a bare divide: screen y runs opposite to drill y.
        const moved0 = deltaToDrill(
          pointer.x - drag.startPointer.x,
          pointer.y - drag.startPointer.y,
          viewport,
        );
        const anchorTarget = snapPoint(
          { x: anchorStart.x + moved0.x, y: anchorStart.y + moved0.y },
          view.snapSteps,
        );
        const dx = anchorTarget.x - anchorStart.x;
        const dy = anchorTarget.y - anchorStart.y;
        const moved: Record<string, DrillPoint> = {};
        for (const [id, start] of Object.entries(drag.startPositions)) {
          moved[id] = clampToField({ x: start.x + dx, y: start.y + dy }, metrics);
        }
        drag.moved = true;
        setPositions(moved, { skipHistory: true });
        // A live readout of how far the selection has travelled, pinned to the
        // cursor, so a drag says what it is doing rather than only showing it.
        setDragReadout({
          x: pointer.x,
          y: pointer.y,
          text: `${Object.keys(drag.startPositions).length} · ${formatOffset(dx, dy)}`,
        });
        return;
      }

      if (marquee) setMarquee({ ...marquee, current: pointer });
    },
    [applyLogoDrag, applyRotation, marquee, metrics, setPositions, view.snapSteps, viewport],
  );

  const finishGesture = useCallback(() => {
    panRef.current = null;
    setDragReadout(null);

    const rotate = rotateRef.current;
    if (rotate) {
      rotateRef.current = null;
      setRotateReadout(null);
      if (rotate.moved) endInteraction();
      else useShowStore.getState().cancelInteraction();
    }

    const logoDrag = logoDragRef.current;
    if (logoDrag) {
      logoDragRef.current = null;
      if (logoDrag.moved) endInteraction();
      else useShowStore.getState().cancelInteraction();
    }

    const drag = dragRef.current;
    if (drag) {
      dragRef.current = null;
      if (drag.moved) endInteraction();
      else useShowStore.getState().cancelInteraction();
    }

    if (marquee && viewport) {
      const dragged =
        Math.abs(marquee.current.x - marquee.start.x) > 3 ||
        Math.abs(marquee.current.y - marquee.start.y) > 3;
      if (dragged) {
        const a = toDrill(marquee.start, viewport);
        const b = toDrill(marquee.current, viewport);
        const minX = Math.min(a.x, b.x);
        const maxX = Math.max(a.x, b.x);
        const minY = Math.min(a.y, b.y);
        const maxY = Math.max(a.y, b.y);
        const hits = placed
          .filter(
            ({ point }) =>
              point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY,
          )
          .map(({ performer }) => performer.id);
        select(hits, marquee.additive ? 'add' : 'replace');
      } else if (!marquee.additive) {
        clearSelection();
      }
      setMarquee(null);
    }
  }, [clearSelection, endInteraction, marquee, placed, select, viewport]);

  /**
   * Right-click opens the align menu. If the click lands on a performer who is
   * not already selected, that performer becomes the selection first — the same
   * behaviour every drawing tool has, and it stops a right-click from silently
   * acting on something off-screen.
   */
  const handleContextMenu = useCallback(
    (event: Konva.KonvaEventObject<PointerEvent>) => {
      event.evt.preventDefault();

      const stage = event.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (!pointer || !viewport) return;

      // Cancel any gesture in flight so the menu does not act mid-drag.
      if (dragRef.current) {
        const wasMoved = dragRef.current.moved;
        dragRef.current = null;
        if (wasMoved) endInteraction();
        else useShowStore.getState().cancelInteraction();
      }
      panRef.current = null;
      setMarquee(null);

      const drillPoint = toDrill(pointer, viewport);
      const hit = nearestPerformerWithin(
        placed,
        drillPoint,
        markerRadius(viewport, appearance.performerSize) / viewport.scale + 0.6,
      );

      if (hit && !selectedSet.has(hit)) select([hit], 'replace');

      setMenuAt({ x: event.evt.clientX, y: event.evt.clientY });
    },
    [appearance.performerSize, endInteraction, placed, select, selectedSet, viewport],
  );

  const handleWheel = useCallback((event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const pointer = event.target.getStage()?.getPointerPosition();
    if (!pointer) return;
    const factor = event.evt.deltaY < 0 ? 1.12 : 1 / 1.12;
    setManualViewport(true);
    setViewport((current) =>
      current ? zoomAbout(current, pointer, factor, ZOOM_LIMITS) : current,
    );
  }, []);

  // A pointer released outside the canvas, or a lost window focus, must not
  // strand a drag with history half-recorded. The handler is reached through a
  // ref so a marquee drag does not re-register two window listeners per frame.
  const finishRef = useRef(finishGesture);
  finishRef.current = finishGesture;
  useEffect(() => {
    const handler = () => finishRef.current();
    window.addEventListener('pointerup', handler);
    window.addEventListener('blur', handler);
    return () => {
      window.removeEventListener('pointerup', handler);
      window.removeEventListener('blur', handler);
    };
  }, []);

  const radius = viewport ? markerRadius(viewport, appearance.performerSize) : 4;
  const labelSize = Math.max(7, Math.min(12, radius * 1.7));
  const currentSet = show.sets[currentSetIndex];

  return (
    <div
      className={`canvas-host${dragReadout || rotateReadout ? ' canvas-host--grabbing' : ''}`}
      ref={hostRef}
    >
      {viewport && size.width > 0 && size.height > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          onPointerDown={handleStagePointerDown}
          onPointerMove={handleStagePointerMove}
          onPointerUp={finishGesture}
          onContextMenu={handleContextMenu}
          onWheel={handleWheel}
        >
          <Layer listening={false}>
            <FieldGraphics
              metrics={metrics}
              viewport={viewport}
              appearance={appearance}
              showStepGrid={view.snapSteps > 0}
            />
          </Layer>

          {/*
            Logos sit above the field graphics — paint included — the way a
            midfield crest is repainted over the yard lines rather than having
            them run across it. The 3D view's turf texture draws them in this
            same order, because the two views disagreeing about where a crest
            sits is worse than either choice.

            Editing is disabled during playback so a stray click cannot nudge a
            crest mid-run.
          */}
          <Layer listening={!isScrubbing}>
            <LogoLayer
              logos={fieldLogos}
              viewport={viewport}
              selectedLogoId={selectedLogoId}
              interactive={!isScrubbing}
              onSelect={selectLogo}
              onPointerDownBody={handleLogoPointerDown}
              onPointerDownHandle={handleLogoHandlePointerDown}
            />
          </Layer>

          {/* Ghosts, paths and the marquee: informational, never interactive. */}
          <Layer listening={false}>
            {previousPositions &&
              Object.entries(previousPositions).map(([id, point]) => {
                const pixel = toPixels(point, viewport);
                return (
                  <Circle
                    key={`prev-${id}`}
                    x={pixel.x}
                    y={pixel.y}
                    radius={radius}
                    stroke={colors.pathStrong}
                    strokeWidth={1}
                    opacity={0.4}
                    perfectDrawEnabled={false}
                  />
                );
              })}

            {nextPositions &&
              Object.entries(nextPositions).map(([id, point]) => {
                const pixel = toPixels(point, viewport);
                return (
                  <Circle
                    key={`next-${id}`}
                    x={pixel.x}
                    y={pixel.y}
                    radius={radius}
                    stroke={colors.path}
                    strokeWidth={1}
                    dash={[3, 3]}
                    opacity={0.45}
                    perfectDrawEnabled={false}
                  />
                );
              })}

            {segments.map((segment) => {
              const from = toPixels(segment.from, viewport);
              const to = toPixels(segment.to, viewport);
              if (Math.hypot(to.x - from.x, to.y - from.y) < 1) return null;
              const isSelected = selectedSet.has(segment.performerId);
              const isStrained = strained.has(segment.performerId);

              // Curves are sampled rather than handed to Konva as a Bézier so
              // the drawn path matches pointAlongSegment exactly — what the
              // designer sees is the path the marcher will be told to walk.
              let points: number[];
              if (segment.style === 'curve' && segment.control) {
                points = [];
                for (let i = 0; i <= CURVE_SAMPLES; i += 1) {
                  const sampled = pointAlongSegment(
                    { ...segment, holdCounts: 0 },
                    i / CURVE_SAMPLES,
                  );
                  const pixel = toPixels(sampled, viewport);
                  points.push(pixel.x, pixel.y);
                }
              } else {
                points = [from.x, from.y, to.x, to.y];
              }

              return (
                <Line
                  key={`path-${segment.performerId}`}
                  points={points}
                  stroke={
                    isStrained ? colors.strain : isSelected ? colors.pathStrong : colors.path
                  }
                  strokeWidth={isSelected || isStrained ? 1.7 : 0.9}
                  opacity={isSelected || isStrained ? 0.95 : 0.5}
                  dash={isStrained ? [5, 3] : undefined}
                  perfectDrawEnabled={false}
                />
              );
            })}

            {marquee && (
              <Rect
                x={Math.min(marquee.start.x, marquee.current.x)}
                y={Math.min(marquee.start.y, marquee.current.y)}
                width={Math.abs(marquee.current.x - marquee.start.x)}
                height={Math.abs(marquee.current.y - marquee.start.y)}
                fill="rgba(31, 111, 235, 0.12)"
                stroke="#1f6feb"
                strokeWidth={1}
                perfectDrawEnabled={false}
              />
            )}
          </Layer>

          {/*
            Performers and the rotation rig. Not interactive while the playhead
            is between sets: the positions on screen are interpolated, and
            dragging one would commit a halfway coordinate into the set.
          */}
          <Layer listening={!isScrubbing}>
            {placed.map(({ performer, point }) => {
              const pixel = toPixels(point, viewport);
              const section = sectionsById.get(performer.sectionId);
              const isSelected = selectedSet.has(performer.id);
              const symbol = section?.symbol ?? 'circle';
              const marker = {
                x: pixel.x,
                y: pixel.y,
                fill: section?.color ?? '#4477AA',
                stroke: isSelected ? '#1f6feb' : 'rgba(0,0,0,0.5)',
                strokeWidth: isSelected ? 2.4 : 0.8,
                perfectDrawEnabled: false,
                shadowForStrokeEnabled: false,
                onPointerDown: (event: Konva.KonvaEventObject<PointerEvent>) =>
                  handlePerformerPointerDown(performer.id, event),
              };
              return (
                <Group key={performer.id}>
                  {symbol === 'circle' && <Circle {...marker} radius={radius} />}
                  {symbol === 'square' && (
                    <Rect
                      {...marker}
                      width={radius * 1.9}
                      height={radius * 1.9}
                      offsetX={radius * 0.95}
                      offsetY={radius * 0.95}
                    />
                  )}
                  {symbol === 'triangle' && (
                    <RegularPolygon {...marker} sides={3} radius={radius * 1.25} />
                  )}
                  {symbol === 'diamond' && (
                    <RegularPolygon {...marker} sides={4} radius={radius * 1.3} />
                  )}
                  {view.showLabels && radius >= 5 && (
                    <Text
                      x={pixel.x - radius * 3}
                      y={pixel.y - radius - labelSize - 1}
                      width={radius * 6}
                      align="center"
                      text={performer.label}
                      fontSize={labelSize}
                      fill={colors.label}
                      listening={false}
                      perfectDrawEnabled={false}
                    />
                  )}
                </Group>
              );
            })}
            {/*
              The rotation rig: a dashed reach circle and a handle above the
              selection. Drawn above the performers so the handle is always
              grabbable, even over a dense form.
            */}
            {rotationRig && (
              <Group>
                <Circle
                  x={toPixels(rotationRig.center, viewport).x}
                  y={toPixels(rotationRig.center, viewport).y}
                  radius={rotationRig.reach * viewport.scale}
                  stroke="#1f6feb"
                  strokeWidth={1}
                  dash={[4, 5]}
                  opacity={0.5}
                  listening={false}
                  perfectDrawEnabled={false}
                />
                <Line
                  points={[
                    toPixels(rotationRig.center, viewport).x,
                    toPixels(rotationRig.center, viewport).y,
                    toPixels(rotationRig.handle, viewport).x,
                    toPixels(rotationRig.handle, viewport).y,
                  ]}
                  stroke="#1f6feb"
                  strokeWidth={1}
                  opacity={0.55}
                  listening={false}
                  perfectDrawEnabled={false}
                />
                <Circle
                  x={toPixels(rotationRig.center, viewport).x}
                  y={toPixels(rotationRig.center, viewport).y}
                  radius={2.5}
                  fill="#1f6feb"
                  listening={false}
                  perfectDrawEnabled={false}
                />
                <Circle
                  x={toPixels(rotationRig.handle, viewport).x}
                  y={toPixels(rotationRig.handle, viewport).y}
                  radius={7}
                  fill="#ffffff"
                  stroke="#1f6feb"
                  strokeWidth={2}
                  perfectDrawEnabled={false}
                  onPointerDown={handleRotatePointerDown}
                />
                <Text
                  x={toPixels(rotationRig.handle, viewport).x - 7}
                  y={toPixels(rotationRig.handle, viewport).y - 5.5}
                  width={14}
                  align="center"
                  text="⟳"
                  fontSize={11}
                  fill="#1f6feb"
                  listening={false}
                  perfectDrawEnabled={false}
                />
              </Group>
            )}
          </Layer>
        </Stage>
      )}

      {placed.length === 0 && (
        <div className="canvas-empty">
          <h2>Nobody is on the field yet</h2>
          <ol>
            <li>
              Add performers to a section in the <strong>Roster</strong> panel — the
              <strong> + 8</strong> button adds eight and selects them.
            </li>
            <li>
              In <strong>Formation tools</strong>, pick a shape:{' '}
              <strong>Line</strong>, <strong>Block</strong>, <strong>Arc</strong>,{' '}
              <strong>Circle</strong>. They land on the 50, on the front hash.
            </li>
            <li>
              Drag them where you want, then <strong>Add set</strong> and move them
              again — {APP_SHORT_NAME} fills in the path between.
            </li>
          </ol>
        </div>
      )}

      {/*
        Say so when the canvas is showing a moment between sets. Editing is off
        in that mode, and silently ignoring drags reads as the app being broken.
      */}
      {isScrubbing && (
        <div className="canvas-playback-note" role="status">
          Playback view — click a set to edit
        </div>
      )}

      <div className="canvas-badge">
        {hoverPoint
          ? describePointShort(hoverPoint, metrics)
          : `Set ${currentSet?.label ?? '—'} · ${show.performers.length} performers · ${totalCounts(show)} counts`}
      </div>

      <div className="canvas-overlay">
        <button
          type="button"
          className="btn btn--sm"
          onClick={fitToScreen}
          title="Fit the field to the window"
        >
          Fit
        </button>
      </div>

      {dragReadout && (
        <div
          className="drag-badge"
          style={{ left: dragReadout.x + 16, top: dragReadout.y + 16 }}
          role="status"
        >
          <span aria-hidden="true">✥</span> {dragReadout.text}
        </div>
      )}

      {rotateReadout && rotationRig && viewport && (
        <div
          className="drag-badge drag-badge--rotate"
          style={{
            left: toPixels(rotationRig.handle, viewport).x + 14,
            top: toPixels(rotationRig.handle, viewport).y - 26,
          }}
          role="status"
        >
          <span aria-hidden="true">⟳</span> {rotateReadout.angle}
          <span className="drag-badge__step">
            {rotateReadout.step > 0 ? `${rotateReadout.step}° steps` : 'free'}
          </span>
        </div>
      )}

      {menuAt && (
        <ContextMenu
          position={menuAt}
          groups={alignment.groups}
          selectedCount={alignment.selectedCount}
          placedCount={alignment.placedCount}
          onClose={() => setMenuAt(null)}
        />
      )}
    </div>
  );
}

/** A drag offset written the way the field reads: side-to-side, then depth. */
function formatOffset(dx: number, dy: number): string {
  const round = (value: number) => (Math.round(value * 100) / 100).toFixed(2).replace(/\.00$/, '');
  const across = dx === 0 ? '' : `${dx > 0 ? '→' : '←'} ${round(Math.abs(dx))}`;
  const depth = dy === 0 ? '' : `${dy > 0 ? '↑' : '↓'} ${round(Math.abs(dy))}`;
  const parts = [across, depth].filter(Boolean);
  return parts.length ? `${parts.join('  ')} steps` : 'no move';
}

/**
 * The performer nearest a point, within a tolerance in drill units. Konva's own
 * hit testing is not used here because a right-click can land on bare field
 * next to a marker and should still pick it up.
 */
function nearestPerformerWithin(
  candidates: { performer: Performer; point: DrillPoint }[],
  target: DrillPoint,
  toleranceSteps: number,
): string | null {
  let best: string | null = null;
  let bestDistance = toleranceSteps;
  for (const { performer, point } of candidates) {
    const distance = Math.hypot(point.x - target.x, point.y - target.y);
    if (distance <= bestDistance) {
      best = performer.id;
      bestDistance = distance;
    }
  }
  return best;
}
