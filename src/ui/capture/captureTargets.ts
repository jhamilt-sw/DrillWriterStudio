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
 * The two things a video can be recorded from, and how to get a canvas out of
 * each.
 *
 * A registry rather than a prop chain. The editor canvas and the 3D view are in
 * different parts of the tree — and the 3D view may be in a different *window*
 * — so threading a ref from either to the export dialog would mean plumbing
 * through half the app. Each view registers itself while it is mounted and
 * unregisters on the way out, and the exporter asks what is available.
 */

import type Konva from 'konva';

import type { SetContext } from '../../core/setContext.ts';
import { evenDimensions, frameForSource, letterbox } from '../../core/videoExport.ts';
import type { StadiumView } from '../../three/stadiumView.ts';
import { paintSetOverlay } from './overlayPainter.ts';

export type CaptureSourceId = 'field' | 'stadium';

export interface PreparedCapture {
  /** The canvas to hand to MediaRecorder. */
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** Stop compositing and put anything that was changed back. */
  release: () => void;
}

/**
 * Read the set overlay for the frame being drawn, or null to leave it off.
 *
 * A function rather than a value: the compositor runs sixty times a second and
 * the reading changes on every frame, so it has to be pulled at draw time
 * rather than captured when the recording started.
 */
export type OverlayReader = (() => SetContext | null) | null;

export interface CaptureOptions {
  /** Height in pixels, where the source can be rendered at a chosen size. */
  height: number;
  overlay: OverlayReader;
}

export interface CaptureSource {
  id: CaptureSourceId;
  label: string;
  /**
   * Whether the frame size can be chosen. The 3D view renders at any size on
   * demand; the 2D field is whatever is on screen.
   */
  resizable: boolean;
  prepare: (options: CaptureOptions) => PreparedCapture;
}

let stage: Konva.Stage | null = null;
let stadium: StadiumView | null = null;

/** Called by the field canvas as it mounts and unmounts. */
export function registerFieldStage(next: Konva.Stage | null): void {
  stage = next;
}

/** Called by the 3D viewport as it mounts and unmounts. */
export function registerStadiumView(next: StadiumView | null): void {
  stadium = next;
}

/**
 * Konva draws each layer to its own canvas, so there is no single element to
 * capture — the visible field is several stacked canvases. Recording one of
 * them would produce a video of the turf with no performers on it.
 */
function layerCanvases(target: Konva.Stage): HTMLCanvasElement[] {
  return target
    .getLayers()
    .map((layer) => {
      const withAccessor = layer as unknown as {
        getNativeCanvasElement?: () => HTMLCanvasElement;
        getCanvas?: () => { _canvas?: HTMLCanvasElement };
      };
      return (
        withAccessor.getNativeCanvasElement?.() ?? withAccessor.getCanvas?.()?._canvas ?? null
      );
    })
    .filter((canvas): canvas is HTMLCanvasElement => canvas !== null);
}

function prepareField(overlay: OverlayReader): PreparedCapture {
  const source = stage;
  if (!source) throw new Error('The field canvas is not available to record.');

  const sourceWidth = Math.max(1, source.width());
  const sourceHeight = Math.max(1, source.height());
  const frame = frameForSource(sourceWidth, sourceHeight);

  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext('2d');

  const box = letterbox(sourceWidth, sourceHeight, frame.width, frame.height);
  let running = true;

  const draw = () => {
    if (!running || !context) return;
    // Bars first. Black rather than the turf colour: a video service will show
    // this frame as-is, and a green border reads as part of the picture.
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    for (const layer of layerCanvases(source)) {
      context.drawImage(layer, box.x, box.y, box.width, box.height);
    }
    const reading = overlay?.();
    if (reading) paintSetOverlay(context, frame, reading);
    handle = requestAnimationFrame(draw);
  };
  let handle = requestAnimationFrame(draw);

  return {
    canvas,
    width: frame.width,
    height: frame.height,
    release: () => {
      running = false;
      cancelAnimationFrame(handle);
    },
  };
}

function prepareStadium(requestedHeight: number, overlay: OverlayReader): PreparedCapture {
  const view = stadium;
  if (!view) throw new Error('Open the 3D playback view before recording from it.');

  const frame = evenDimensions(Math.round((requestedHeight * 16) / 9), requestedHeight);
  // The 3D view can render at any size: raising the drawing buffer gives a true
  // 1080p (or 4K) capture without touching the on-screen layout, because the
  // canvas keeps its CSS size either way.
  const restore = view.beginCapture(frame.width, frame.height);

  // With no overlay the WebGL canvas is recorded directly — one less copy of
  // every frame, which at 4K is worth having.
  if (!overlay) {
    return { canvas: view.canvas, width: frame.width, height: frame.height, release: restore };
  }

  /*
   * With an overlay the frames are composited.
   *
   * The on-screen set readout is HTML, and HTML is not part of a canvas, so
   * recording the WebGL surface alone would silently drop it — and a
   * run-through video with no set numbers is much less use to the staff member
   * it gets sent to. Reading the 3D canvas back like this is what
   * `preserveDrawingBuffer` on the renderer is for.
   */
  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  const context = canvas.getContext('2d');
  let running = true;

  const draw = () => {
    if (!running || !context) return;
    context.drawImage(view.canvas, 0, 0, canvas.width, canvas.height);
    const reading = overlay();
    if (reading) paintSetOverlay(context, frame, reading);
    handle = requestAnimationFrame(draw);
  };
  let handle = requestAnimationFrame(draw);

  return {
    canvas,
    width: frame.width,
    height: frame.height,
    release: () => {
      running = false;
      cancelAnimationFrame(handle);
      restore();
    },
  };
}

export function captureSources(): CaptureSource[] {
  return [
    {
      id: 'field',
      label: '2D field',
      resizable: false,
      prepare: (options) => prepareField(options.overlay),
    },
    {
      id: 'stadium',
      label: '3D stadium',
      resizable: true,
      prepare: (options) => prepareStadium(options.height, options.overlay),
    },
  ];
}

/** Whether a source is on screen and ready to be recorded. */
export function captureSourceReady(id: CaptureSourceId): boolean {
  return id === 'field' ? stage !== null : stadium !== null;
}
