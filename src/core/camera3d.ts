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
 * The camera for the 3D playback view, and the mapping from drill coordinates
 * into a 3D world.
 *
 * Pure maths, no three.js: the renderer takes these numbers and sets a camera
 * with them. That keeps the part that is easy to get subtly wrong — which way
 * is up, where the stands are, what happens when you drag past the horizon —
 * testable without a GPU.
 *
 * **Units are feet, not steps.** Everywhere else in the app a position is
 * written in steps, because that is what a marcher counts. But step size is a
 * setting: at 6-to-5 a step is 30 inches, at 8-to-5 it is 22.5. If the 3D world
 * used steps, changing the step size would silently resize the stadium and turn
 * the marchers into giants. Feet are feet.
 *
 * **Axes** follow the three.js convention: Y is up, and the camera looks down
 * -Z by default. The field is centred on the origin, X runs Side 1 to Side 2,
 * and +Z is toward the audience — so the press box is at -Z looking back, and
 * the home stands are at +Z. That matches the 2D editor, which draws the front
 * sideline nearest the viewer.
 */

import { stepsToFeet } from './field.ts';
import type { FieldMetrics } from './field.ts';
import type { DrillPoint } from './types.ts';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/** Where the camera is and what it is pointed at, in feet. */
export interface CameraState {
  position: Vector3;
  target: Vector3;
  /** Vertical field of view in degrees. */
  fov: number;
}

/**
 * The camera as an orbit: a point it looks at, and a direction and distance to
 * sit at. Dragging changes the angles; the position is derived.
 *
 * Stored this way rather than as a free position because every control a user
 * expects — swing round the field, tilt up, zoom in — is a change to exactly
 * one of these numbers, and deriving the position from angles cannot drift.
 */
export interface OrbitState {
  target: Vector3;
  /** Distance from the target, in feet. */
  distance: number;
  /** Rotation about the vertical axis, in degrees. 0 looks from the audience. */
  azimuth: number;
  /** Angle above the horizontal, in degrees. 0 is eye-level, 90 is overhead. */
  elevation: number;
  fov: number;
}

/** How close and far the camera may sit, and how far it may tilt. */
export const CAMERA_LIMITS = {
  minDistance: 20,
  maxDistance: 1400,
  /**
   * Never quite level and never quite overhead. At exactly 0 the camera sits on
   * the turf; at exactly 90 the maths for a camera looking straight down has no
   * defined "which way is up" and the view snaps round unpredictably.
   */
  minElevation: 1.5,
  maxElevation: 88,
  minFov: 20,
  maxFov: 90,
  /** The camera never goes below this height, so it cannot end up underground. */
  minHeightFeet: 3,
} as const;

const DEG = Math.PI / 180;

export function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** Field dimensions in feet, derived from the show's own metrics. */
export interface FieldDimensions {
  /** Goal line to goal line. */
  lengthFeet: number;
  /** Sideline to sideline. */
  depthFeet: number;
  endZoneFeet: number;
  frontHashFeet: number;
  backHashFeet: number;
}

export function fieldDimensions(metrics: FieldMetrics): FieldDimensions {
  const spf = metrics.config.stepsPerFiveYards;
  return {
    lengthFeet: stepsToFeet(metrics.widthSteps, spf),
    depthFeet: stepsToFeet(metrics.depthSteps, spf),
    endZoneFeet: stepsToFeet(metrics.endZoneSteps, spf),
    frontHashFeet: stepsToFeet(metrics.frontHashY, spf),
    backHashFeet: stepsToFeet(metrics.backHashY, spf),
  };
}

/**
 * A drill position in world space.
 *
 * The 50 yard line at the front sideline is not the origin — the *centre of the
 * field* is, so orbiting feels like circling the field rather than swinging
 * around one corner.
 */
export function drillToWorld(
  point: DrillPoint,
  metrics: FieldMetrics,
  heightFeet = 0,
): Vector3 {
  const spf = metrics.config.stepsPerFiveYards;
  const dimensions = fieldDimensions(metrics);
  return {
    x: stepsToFeet(point.x, spf) - dimensions.lengthFeet / 2,
    y: heightFeet,
    // Drill y grows away from the front sideline; +Z is toward the audience,
    // which is on the front-sideline side. So the sign flips here, once.
    z: dimensions.depthFeet / 2 - stepsToFeet(point.y, spf),
  };
}

/** Turn an orbit into a concrete camera, honouring every limit. */
export function orbitToCamera(orbit: OrbitState): CameraState {
  const distance = clamp(orbit.distance, CAMERA_LIMITS.minDistance, CAMERA_LIMITS.maxDistance);
  const elevation = clamp(
    orbit.elevation,
    CAMERA_LIMITS.minElevation,
    CAMERA_LIMITS.maxElevation,
  );
  const azimuth = orbit.azimuth * DEG;
  const horizontal = distance * Math.cos(elevation * DEG);
  const position = {
    x: orbit.target.x + horizontal * Math.sin(azimuth),
    y: orbit.target.y + distance * Math.sin(elevation * DEG),
    z: orbit.target.z + horizontal * Math.cos(azimuth),
  };
  return {
    position: { ...position, y: Math.max(position.y, CAMERA_LIMITS.minHeightFeet) },
    target: orbit.target,
    fov: clamp(orbit.fov, CAMERA_LIMITS.minFov, CAMERA_LIMITS.maxFov),
  };
}

/** Swing and tilt. Positive `dx` swings right, positive `dy` tilts up. */
export function orbitBy(orbit: OrbitState, dx: number, dy: number): OrbitState {
  return {
    ...orbit,
    azimuth: wrapDegrees(orbit.azimuth + dx),
    elevation: clamp(
      orbit.elevation + dy,
      CAMERA_LIMITS.minElevation,
      CAMERA_LIMITS.maxElevation,
    ),
  };
}

/** Move toward or away from the target. `factor` above 1 pulls back. */
export function dollyBy(orbit: OrbitState, factor: number): OrbitState {
  if (!Number.isFinite(factor) || factor <= 0) return orbit;
  return {
    ...orbit,
    distance: clamp(
      orbit.distance * factor,
      CAMERA_LIMITS.minDistance,
      CAMERA_LIMITS.maxDistance,
    ),
  };
}

/**
 * Slide the point being looked at, in the camera's own frame: `dx` is right
 * across the screen and `dy` is up the screen, both in feet.
 *
 * Panning in the camera's frame rather than the world's is what makes a drag
 * feel like it is moving the picture. The target is kept at or above ground
 * level so the view cannot be pushed under the turf.
 */
export function panBy(orbit: OrbitState, dx: number, dy: number): OrbitState {
  const azimuth = orbit.azimuth * DEG;
  const elevation = orbit.elevation * DEG;
  // Right is perpendicular to the view direction, in the ground plane.
  const rightX = Math.cos(azimuth);
  const rightZ = -Math.sin(azimuth);
  // "Up the screen" moves away from the camera along the ground, foreshortened
  // by how steeply the camera is tilted: looking almost straight down, dragging
  // up should move a long way across the turf.
  const forwardX = -Math.sin(azimuth) * Math.sin(elevation);
  const forwardZ = -Math.cos(azimuth) * Math.sin(elevation);
  const forwardY = Math.cos(elevation);
  return {
    ...orbit,
    target: {
      x: orbit.target.x + rightX * dx + forwardX * dy,
      y: Math.max(0, orbit.target.y + forwardY * dy),
      z: orbit.target.z + rightZ * dx + forwardZ * dy,
    },
  };
}

/** Keep an angle in -180..180 so readouts and interpolation stay sane. */
export function wrapDegrees(degrees: number): number {
  const wrapped = ((degrees + 180) % 360 + 360) % 360 - 180;
  return wrapped + 0;
}

/**
 * Where the seating actually is.
 *
 * Declared here, in core, rather than in the code that builds the meshes —
 * because the camera presets need it too. When these numbers lived only in the
 * three.js layer, a preset could be placed at a distance that happened to fall
 * inside the grandstand, and nothing could catch it: the camera module had no
 * idea where the seats were. `isViewObstructed` below closes that hole, and it
 * can only do so because both sides read one definition.
 */
export const STAND_GEOMETRY = {
  /** Flat apron between the sideline and the first row of seats. */
  apronFeet: 30,
  rowCount: 26,
  rowDepthFeet: 2.9,
  rowRiseFeet: 1.5,
  /** End-zone stands are shallower — a full bowl boxes the view in. */
  endRowFraction: 0.55,
  /** Height of the press box floor above the top row. */
  pressBoxRiseFeet: 14,
} as const;

/**
 * The press box itself, over the home stands.
 *
 * Shared with the mesh builder so the camera can be put *in front of* the box
 * rather than inside it — a camera inside a box sees its back faces, which are
 * culled, so the failure looks like nothing at all until something flickers.
 */
export const PRESS_BOX = {
  widthFeet: 120,
  heightFeet: 18,
  depthFeet: 24,
  /** How far behind the last row of seats the box sits. */
  standOffsetFeet: 20,
} as const;

/** Ground distance from the field centre to the middle of the press box. */
export function pressBoxGroundFeet(halfDepthFeet: number): number {
  return (
    halfDepthFeet + STAND_GEOMETRY.apronFeet + standDepthFeet() + PRESS_BOX.standOffsetFeet
  );
}

/** Total depth of a side grandstand, first row to last. */
export function standDepthFeet(): number {
  return STAND_GEOMETRY.rowCount * STAND_GEOMETRY.rowDepthFeet;
}

/** Height of the back of a side grandstand. */
export function standTopFeet(): number {
  return STAND_GEOMETRY.rowCount * STAND_GEOMETRY.rowRiseFeet;
}

/** Height of the press box floor, above the home stands. */
export function pressBoxFloorFeet(): number {
  return standTopFeet() + STAND_GEOMETRY.pressBoxRiseFeet;
}

/**
 * How high the seating rake stands, `distance` feet out from the sideline.
 *
 * Zero across the apron, then rising row by row, and flat at the top height
 * beyond the last row — because from further back the *back* of the stand is
 * still what a low camera would be looking through.
 */
export function rakeHeightAt(distanceFromSidelineFeet: number): number {
  const past = distanceFromSidelineFeet - STAND_GEOMETRY.apronFeet;
  if (past <= 0) return 0;
  const row = Math.ceil(past / STAND_GEOMETRY.rowDepthFeet);
  return Math.min(row, STAND_GEOMETRY.rowCount) * STAND_GEOMETRY.rowRiseFeet;
}

/**
 * Whether a camera at this point would be looking through the grandstand.
 *
 * The failure this describes is the one a user actually hit: a "sideline" view
 * placed by distance alone that landed behind the seats, so the drill was
 * watched through the back of a bleacher. Anything outside the apron has to
 * clear the rake at its own depth to see the field.
 */
export function isViewObstructed(
  position: Vector3,
  dimensions: FieldDimensions,
): boolean {
  const beyondSideline = Math.abs(position.z) - dimensions.depthFeet / 2;
  const beyondEndLine =
    Math.abs(position.x) - (dimensions.lengthFeet / 2 + dimensions.endZoneFeet);
  // Take whichever stand the camera is further into.
  const depth = Math.max(beyondSideline, beyondEndLine);
  if (depth <= STAND_GEOMETRY.apronFeet) return false;
  const rake =
    beyondSideline >= beyondEndLine
      ? rakeHeightAt(beyondSideline)
      : rakeHeightAt(beyondEndLine) * STAND_GEOMETRY.endRowFraction;
  // A seated eye is a few feet above the step it sits on.
  return position.y < rake + 2;
}

/**
 * Build an orbit from where the camera should physically stand, rather than
 * from an angle and a distance.
 *
 * Placing a camera "in row 18 of the home stands" is a statement about a point
 * in the stadium; expressing it as a distance and an elevation is arithmetic
 * nobody should do by hand, and doing it by hand is how a camera ends up
 * buried in the seats.
 */
export function orbitFromPlacement(placement: {
  target: Vector3;
  /** Degrees round the field: 0 is the home side, 180 the visitor side. */
  azimuth: number;
  /** Distance from the target along the ground. */
  groundFeet: number;
  /** Height above the turf. */
  heightFeet: number;
  fov: number;
}): OrbitState {
  const rise = placement.heightFeet - placement.target.y;
  return {
    target: placement.target,
    azimuth: placement.azimuth,
    distance: Math.hypot(placement.groundFeet, rise),
    elevation: (Math.atan2(rise, placement.groundFeet) * 180) / Math.PI,
    fov: placement.fov,
  };
}

export type CameraPresetId =
  | 'home-stands'
  | 'press-box'
  | 'visitor-stands'
  | 'corner'
  | 'end-zone'
  | 'sideline'
  | 'overhead';

export interface CameraPreset {
  id: CameraPresetId;
  label: string;
  description: string;
}

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'home-stands',
    label: 'Home stands',
    description: 'Partway up the home side at the 50 — where a judge sits.',
  },
  {
    id: 'press-box',
    label: 'Press box',
    description: 'Above the home stands: the angle drill is written for.',
  },
  {
    id: 'visitor-stands',
    label: 'Visitor stands',
    description: 'The far side, looking back — how the drill reads from behind.',
  },
  { id: 'corner', label: 'Corner', description: 'Raised, off the goal-line corner.' },
  { id: 'end-zone', label: 'End zone', description: 'Low, looking straight up the field.' },
  {
    id: 'sideline',
    label: 'Sideline',
    description: 'Standing on the front sideline, in front of the stands.',
  },
  { id: 'overhead', label: 'Overhead', description: 'Straight down, like the 2D chart.' },
];

/**
 * Where each preset puts the camera.
 *
 * Every one is written as a physical placement — this far out, this high — and
 * derived from the field's own size and the seating geometry above, so a show
 * at an unusual step size still frames properly and no angle ends up inside the
 * grandstand.
 *
 * **The press box is on the home side**, above the home stands, where it is in
 * a real stadium. The front sideline faces it, which is why the 2D editor draws
 * the front sideline nearest the viewer: the chart is already the press box's
 * view of the field.
 */
export function presetOrbit(id: CameraPresetId, metrics: FieldMetrics): OrbitState {
  const dimensions = fieldDimensions(metrics);
  const halfDepth = dimensions.depthFeet / 2;
  const halfLength = dimensions.lengthFeet / 2 + dimensions.endZoneFeet;
  const centre = { x: 0, y: 0, z: 0 };

  /** Ground distance and height of a seat `row` rows up a side stand. */
  const seat = (row: number) => ({
    ground: halfDepth + STAND_GEOMETRY.apronFeet + row * STAND_GEOMETRY.rowDepthFeet,
    height: row * STAND_GEOMETRY.rowRiseFeet + 4,
  });

  switch (id) {
    case 'press-box': {
      // At the front window of the box, not in the middle of it: a camera
      // inside the mesh looks out through culled back faces and the stadium
      // silently loses a wall.
      const ground =
        pressBoxGroundFeet(halfDepth) - PRESS_BOX.depthFeet / 2 - 4;
      return orbitFromPlacement({
        target: centre,
        azimuth: 0,
        groundFeet: ground,
        heightFeet: pressBoxFloorFeet() + 6,
        fov: 44,
      });
    }
    case 'visitor-stands': {
      // Fewer rows opposite, and looking back across the field, so the forms
      // read reversed — worth checking before a show travels.
      const place = seat(Math.round(STAND_GEOMETRY.rowCount * 0.45));
      return orbitFromPlacement({
        target: centre,
        azimuth: 180,
        groundFeet: place.ground,
        heightFeet: place.height,
        fov: 50,
      });
    }
    case 'corner': {
      // Over the corner of the bowl, above the rake rather than in it — from a
      // corner the camera is deep into a stand's footprint on both axes at
      // once, so it has to clear the seating to see anything.
      return orbitFromPlacement({
        target: centre,
        azimuth: 38,
        groundFeet: Math.hypot(halfLength + 40, halfDepth + 60),
        heightFeet: standTopFeet() + 24,
        fov: 50,
      });
    }
    case 'end-zone': {
      // Just behind the end line on the apron, low — the drum major's view.
      return orbitFromPlacement({
        target: { x: 0, y: 4, z: 0 },
        azimuth: 90,
        groundFeet: halfLength + 18,
        heightFeet: 10,
        fov: 55,
      });
    }
    case 'sideline': {
      // Standing on the front sideline itself, *in front of* the seating, at
      // the height of someone's eyes. Anywhere further back and the drill is
      // watched through the bleachers.
      return orbitFromPlacement({
        target: { x: 0, y: 4, z: 0 },
        azimuth: 0,
        groundFeet: halfDepth + 6,
        heightFeet: 5.6,
        fov: 62,
      });
    }
    case 'overhead':
      return {
        target: centre,
        distance: dimensions.lengthFeet * 0.78,
        azimuth: 0,
        elevation: 88,
        fov: 46,
      };
    case 'home-stands':
    default: {
      // Around row 18: high enough to read a form, low enough to feel like a
      // seat rather than a drone.
      const place = seat(18);
      return orbitFromPlacement({
        target: centre,
        azimuth: 0,
        groundFeet: place.ground,
        heightFeet: place.height,
        fov: 50,
      });
    }
  }
}

/** Movement speeds for the free camera, in feet per second and degrees per pixel. */
export const CONTROL_RATES = {
  orbitDegreesPerPixel: 0.28,
  panFeetPerPixel: 0.22,
  dollyPerWheelNotch: 1.12,
  flySpeedFeetPerSecond: 90,
  flyBoostMultiplier: 3,
} as const;

/**
 * A step for the free-fly camera: WASD across the ground, Q/E for height.
 *
 * Moves the *target* — the camera position follows from the orbit, so flying
 * and orbiting compose instead of fighting each other.
 */
export function flyBy(
  orbit: OrbitState,
  input: { forward: number; right: number; up: number },
  seconds: number,
  boost = false,
): OrbitState {
  const speed =
    CONTROL_RATES.flySpeedFeetPerSecond *
    seconds *
    (boost ? CONTROL_RATES.flyBoostMultiplier : 1);
  if (speed <= 0) return orbit;
  const azimuth = orbit.azimuth * DEG;
  // Ground-plane heading only: flying forward should not fly into the turf just
  // because the camera happens to be tilted down.
  const forwardX = -Math.sin(azimuth);
  const forwardZ = -Math.cos(azimuth);
  const rightX = Math.cos(azimuth);
  const rightZ = -Math.sin(azimuth);
  return {
    ...orbit,
    target: {
      x: orbit.target.x + (forwardX * input.forward + rightX * input.right) * speed,
      y: Math.max(0, orbit.target.y + input.up * speed),
      z: orbit.target.z + (forwardZ * input.forward + rightZ * input.right) * speed,
    },
  };
}
