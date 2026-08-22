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
 * The 3D view itself: renderer, scene, camera, and the frame loop.
 *
 * Framework-free on purpose. React owns *when* this exists and what data it is
 * given; it does not own the 60-times-a-second part. Re-rendering a component
 * tree every frame to move 250 marchers would spend more time in reconciliation
 * than in drawing, so the loop reads from a mutable handle instead.
 */

import * as THREE from 'three';

import {
  type CameraState,
  type FieldDimensions,
  type OrbitState,
  fieldDimensions,
  orbitToCamera,
} from '../core/camera3d.ts';
import type { FieldMetrics } from '../core/field.ts';
import type {
  DrillPoint,
  FieldAppearance,
  FieldLogo,
  Performer,
  Section,
} from '../core/types.ts';
import { DEFAULT_STADIUM, buildLighting, buildStadium, disposeObject } from './stadium.ts';
import { type MarcherField, buildMarchers } from './marchers.ts';
import { drawTurfTexture, loadLogoImages } from './turfTexture.ts';

export interface StadiumViewOptions {
  canvas: HTMLCanvasElement;
  metrics: FieldMetrics;
  appearance: FieldAppearance;
  performers: Performer[];
  sections: Section[];
  showEndZones: boolean;
  /** Painted into the turf, over the paint, exactly as the 2D editor draws them. */
  logos: FieldLogo[];
  /** Called once per frame with the seconds elapsed, before drawing. */
  onFrame?: (deltaSeconds: number) => void;
}

export interface StadiumView {
  /** The element a recorder captures. */
  canvas: HTMLCanvasElement;
  /**
   * Render at a fixed size until the returned function is called.
   *
   * Raising the drawing buffer gives a true 1080p or 4K capture without
   * touching the on-screen layout: the canvas keeps its CSS size, so the window
   * looks the same while the frames being encoded are larger. Resizing is
   * suspended meanwhile, or the next window resize would undo it mid-export.
   */
  beginCapture: (width: number, height: number) => () => void;
  setOrbit: (orbit: OrbitState) => void;
  setPositions: (positions: Record<string, DrillPoint>) => void;
  /** Repaint the field with a new set of logos. Throttled internally. */
  setLogos: (logos: FieldLogo[]) => void;
  resize: (width: number, height: number, pixelRatio: number) => void;
  dimensions: FieldDimensions;
  dispose: () => void;
}

export function createStadiumView(options: StadiumViewOptions): StadiumView {
  const { canvas, metrics, appearance, performers, sections } = options;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    // The 3D window may be screenshotted or projected; keeping the buffer lets
    // toDataURL work without re-rendering.
    preserveDrawingBuffer: true,
  });
  renderer.setClearColor(new THREE.Color(DEFAULT_STADIUM.sky));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(DEFAULT_STADIUM.sky);
  // Fog gives the far end of the stadium some depth and hides where the ground
  // plane ends, which is otherwise a hard line across the horizon.
  scene.fog = new THREE.Fog(DEFAULT_STADIUM.sky, 500, 2600);

  const dimensions = fieldDimensions(metrics);

  const camera = new THREE.PerspectiveCamera(50, 1, 1, 6000);
  scene.add(buildLighting(dimensions));
  const stadium = buildStadium(dimensions, DEFAULT_STADIUM);
  scene.add(stadium);

  /*
   * The painted field, as a single textured plane.
   *
   * Drawn immediately without logos so the stadium appears at once, then
   * repainted when the logo images have decoded. Waiting for images before
   * showing anything would leave a blank window on every open.
   */
  let logos = options.logos;
  const logoImages = new Map<string, HTMLImageElement>();
  const turf = drawTurfTexture(metrics, appearance, {
    includeEndZones: options.showEndZones,
    logos,
    logoImages,
  });
  const texture = new THREE.CanvasTexture(turf.canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const turfMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(turf.widthFeet, turf.depthFeet),
    new THREE.MeshLambertMaterial({ map: texture }),
  );
  turfMesh.rotation.x = -Math.PI / 2;
  turfMesh.name = 'turf';
  scene.add(turfMesh);

  const marchers: MarcherField = buildMarchers(performers, sections, metrics, {
    scale: appearance.performerSize,
  });
  scene.add(marchers.group);

  const applyCamera = (state: CameraState) => {
    camera.position.set(state.position.x, state.position.y, state.position.z);
    camera.lookAt(state.target.x, state.target.y, state.target.z);
    if (camera.fov !== state.fov) {
      camera.fov = state.fov;
      camera.updateProjectionMatrix();
    }
  };

  /*
   * Drive the loop from the window the canvas actually lives in.
   *
   * When this view is popped out, the canvas belongs to the child window's
   * document while this code runs in the parent's context. Browsers throttle
   * animation frames for windows they think nobody is looking at — so a
   * stadium on a projector, driven by the editor window sitting occluded behind
   * it, would stutter down to a few frames a second. Asking the child window
   * for its own frames ties the loop to the window being watched.
   */
  const hostWindow = canvas.ownerDocument.defaultView ?? window;

  /*
   * Repainting the turf is expensive — a 2880x1280 canvas redrawn and then
   * re-uploaded to the GPU. Dragging a logo in the editor with this window open
   * would ask for that sixty times a second, so a repaint is requested rather
   * than performed, and the loop honours at most one every `TURF_REDRAW_MS`.
   * A logo a fifth of a second behind while it is being dragged is invisible;
   * a fourteen-megabyte upload per frame is not.
   */
  const TURF_REDRAW_MS = 200;
  let turfDirty = false;
  let lastTurfDraw = -Infinity;

  const repaintTurf = () => {
    drawTurfTexture(metrics, appearance, {
      includeEndZones: options.showEndZones,
      logos,
      logoImages,
      canvas: turf.canvas,
    });
    texture.needsUpdate = true;
  };

  /** Decode anything new, then ask for a repaint. */
  const refreshLogoImages = () => {
    void loadLogoImages(logos, logoImages).then(() => {
      turfDirty = true;
    });
  };
  refreshLogoImages();

  let running = true;
  let lastTime = 0;
  let frameHandle = 0;
  const loop = (time: number) => {
    if (!running) return;
    // A frame longer than a tenth of a second means the tab was backgrounded;
    // treating it as real would teleport a flying camera across the field.
    const delta = lastTime === 0 ? 0 : Math.min(0.1, (time - lastTime) / 1000);
    lastTime = time;
    if (turfDirty && time - lastTurfDraw >= TURF_REDRAW_MS) {
      turfDirty = false;
      lastTurfDraw = time;
      repaintTurf();
    }
    options.onFrame?.(delta);
    renderer.render(scene, camera);
    frameHandle = hostWindow.requestAnimationFrame(loop);
  };
  frameHandle = hostWindow.requestAnimationFrame(loop);

  let capturing = false;

  return {
    canvas,
    beginCapture: (width, height) => {
      capturing = true;
      const previous = {
        width: renderer.domElement.width,
        height: renderer.domElement.height,
        pixelRatio: renderer.getPixelRatio(),
      };
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      return () => {
        capturing = false;
        renderer.setPixelRatio(previous.pixelRatio);
        renderer.setSize(
          previous.width / previous.pixelRatio,
          previous.height / previous.pixelRatio,
          false,
        );
        camera.aspect = previous.width / Math.max(1, previous.height);
        camera.updateProjectionMatrix();
      };
    },
    dimensions,
    setOrbit: (orbit) => applyCamera(orbitToCamera(orbit)),
    setPositions: (positions) => marchers.update(positions),
    setLogos: (next) => {
      logos = next;
      // Load first: a repaint before the image decodes would drop the logo,
      // and the repaint that follows decoding puts it back with a visible blink.
      refreshLogoImages();
      turfDirty = true;
    },
    resize: (width, height, pixelRatio) => {
      // Ignored while capturing: a stray resize mid-export would drop the
      // frame size back to the panel's and corrupt the recording.
      if (capturing) return;
      // Cap the pixel ratio: a 3x phone display would otherwise render nine
      // times the pixels for no visible gain and a third of the frame rate.
      renderer.setPixelRatio(Math.min(pixelRatio, 2));
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    },
    dispose: () => {
      running = false;
      hostWindow.cancelAnimationFrame(frameHandle);
      marchers.dispose();
      disposeObject(stadium);
      disposeObject(turfMesh);
      texture.dispose();
      renderer.dispose();
    },
  };
}
