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

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CAMERA_LIMITS,
  CAMERA_PRESETS,
  PRESS_BOX,
  STAND_GEOMETRY,
  isViewObstructed,
  orbitFromPlacement,
  pressBoxFloorFeet,
  pressBoxGroundFeet,
  rakeHeightAt,
  standTopFeet,
  clamp,
  dollyBy,
  drillToWorld,
  fieldDimensions,
  flyBy,
  orbitBy,
  orbitToCamera,
  panBy,
  presetOrbit,
  wrapDegrees,
} from '../camera3d.ts';
import { DEFAULT_FIELD, fieldMetrics } from '../field.ts';

const metrics = fieldMetrics(DEFAULT_FIELD);

const close = (actual: number, expected: number, tolerance = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );

test('the field is a real football field, in feet', () => {
  const dimensions = fieldDimensions(metrics);
  // Goal line to goal line is 100 yards; sideline to sideline is 160 feet.
  close(dimensions.lengthFeet, 300, 1e-6);
  close(dimensions.depthFeet, 160, 1e-6);
  close(dimensions.endZoneFeet, 30, 1e-6);
  // High school hashes are 53'4" in from each sideline.
  close(dimensions.frontHashFeet, 160 / 3, 1e-6);
});

test('the world is measured in feet whatever the step size', () => {
  // The point of using feet: changing step size rewrites coordinates but must
  // not resize the stadium or turn the marchers into giants.
  const sixToFive = fieldMetrics({ ...DEFAULT_FIELD, stepsPerFiveYards: 6 });
  close(fieldDimensions(sixToFive).lengthFeet, 300, 1e-6);
  close(fieldDimensions(sixToFive).depthFeet, 160, 1e-6);
});

test('the centre of the field is the origin', () => {
  const centre = drillToWorld({ x: metrics.fiftyX, y: metrics.depthSteps / 2 }, metrics);
  close(centre.x, 0, 1e-6);
  close(centre.z, 0, 1e-6);
  close(centre.y, 0, 1e-6);
});

test('the front sideline is toward the audience, the back sideline away', () => {
  // +Z is the audience side, matching the 2D editor drawing the front sideline
  // nearest the viewer. Getting this backwards would put the press box in the
  // front row.
  const front = drillToWorld({ x: metrics.fiftyX, y: 0 }, metrics);
  const back = drillToWorld({ x: metrics.fiftyX, y: metrics.depthSteps }, metrics);
  assert.ok(front.z > 0, 'front sideline should be on the audience side');
  assert.ok(back.z < 0, 'back sideline should be away from the audience');
  close(front.z, 80, 1e-6);
  close(back.z, -80, 1e-6);
});

test('Side 1 is negative X and Side 2 positive', () => {
  const side1 = drillToWorld({ x: 0, y: 0 }, metrics);
  const side2 = drillToWorld({ x: metrics.widthSteps, y: 0 }, metrics);
  close(side1.x, -150, 1e-6);
  close(side2.x, 150, 1e-6);
});

test('a camera looking from the audience sits on the +Z side', () => {
  const camera = orbitToCamera({
    target: { x: 0, y: 0, z: 0 },
    distance: 200,
    azimuth: 0,
    elevation: 30,
    fov: 50,
  });
  assert.ok(camera.position.z > 0, 'azimuth 0 should look from the audience side');
  close(camera.position.x, 0, 1e-6);
  close(camera.position.y, 200 * Math.sin((30 * Math.PI) / 180), 1e-6);
});

test('the press box is on the home side, above the home stands', () => {
  // A real press box sits over the home stands, and the front sideline faces
  // it — the 2D chart is already the press box's view of the field. Putting it
  // opposite would mean writing the drill from one side and watching it from
  // the other.
  const camera = orbitToCamera(presetOrbit('press-box', metrics));
  assert.ok(camera.position.z > 0, 'the press box should be on the home side');
  assert.ok(
    camera.position.y > standTopFeet(),
    `expected the press box above the stand, got ${camera.position.y}`,
  );
});

test('the home stands and the press box look from the same side', () => {
  const home = orbitToCamera(presetOrbit('home-stands', metrics));
  const press = orbitToCamera(presetOrbit('press-box', metrics));
  assert.ok(Math.sign(home.position.z) === Math.sign(press.position.z));
  // And the press box is the higher of the two.
  assert.ok(press.position.y > home.position.y);
});

test('the visitor stands look back from the opposite side', () => {
  const home = orbitToCamera(presetOrbit('home-stands', metrics));
  const visitor = orbitToCamera(presetOrbit('visitor-stands', metrics));
  assert.ok(visitor.position.z < 0, 'the visitor side is opposite the home side');
  assert.ok(Math.sign(visitor.position.z) !== Math.sign(home.position.z));
  // Lower than the home side: fewer rows opposite.
  assert.ok(visitor.position.y < orbitToCamera(presetOrbit('press-box', metrics)).position.y);
});

test('the rake describes the seating, flat on the apron and rising past it', () => {
  assert.equal(rakeHeightAt(0), 0);
  assert.equal(rakeHeightAt(STAND_GEOMETRY.apronFeet), 0);
  // One row in.
  assert.equal(
    rakeHeightAt(STAND_GEOMETRY.apronFeet + 0.5),
    STAND_GEOMETRY.rowRiseFeet,
  );
  // Beyond the last row it stays at the full height — the back of the stand is
  // still in the way of a camera behind it.
  assert.equal(rakeHeightAt(10_000), standTopFeet());
});

test('no camera preset watches the drill through the bleachers', () => {
  // The regression this exists for: the sideline view was placed by distance
  // alone, landed behind the seats, and the field was hidden behind the back of
  // a grandstand. Every preset now has to clear the rake at its own depth.
  for (const preset of CAMERA_PRESETS) {
    const camera = orbitToCamera(presetOrbit(preset.id, metrics));
    assert.equal(
      isViewObstructed(camera.position, fieldDimensions(metrics)),
      false,
      `${preset.id} put the camera inside the seating at ${Math.round(
        camera.position.y,
      )} feet up, ${Math.round(camera.position.z)} feet out`,
    );
  }
});

test('the obstruction check catches a camera buried in the seats', () => {
  // Guard against the test above passing because the check always says false.
  const dimensions = fieldDimensions(metrics);
  const buried = {
    x: 0,
    y: 4,
    z: dimensions.depthFeet / 2 + STAND_GEOMETRY.apronFeet + 40,
  };
  assert.equal(isViewObstructed(buried, dimensions), true);
  // The same spot, above the rake, is fine.
  assert.equal(isViewObstructed({ ...buried, y: standTopFeet() + 20 }, dimensions), false);
  // And the apron in front of the seats is always clear.
  assert.equal(
    isViewObstructed({ x: 0, y: 5, z: dimensions.depthFeet / 2 + 6 }, dimensions),
    false,
  );
});

test('the sideline view stands in front of the seating, at eye height', () => {
  const dimensions = fieldDimensions(metrics);
  const camera = orbitToCamera(presetOrbit('sideline', metrics));
  const beyond = Math.abs(camera.position.z) - dimensions.depthFeet / 2;
  assert.ok(beyond > 0, 'it should be off the field, not standing on it');
  assert.ok(
    beyond < STAND_GEOMETRY.apronFeet,
    `expected a spot on the apron, got ${Math.round(beyond)} feet out`,
  );
  assert.ok(
    camera.position.y < 9,
    `a person on the sideline is not ${Math.round(camera.position.y)} feet tall`,
  );
});

test('a placement becomes the orbit that reproduces it', () => {
  // Presets are written as "this far out, this high"; the round trip has to be
  // exact or a camera lands somewhere other than where it was described.
  const orbit = orbitFromPlacement({
    target: { x: 0, y: 0, z: 0 },
    azimuth: 0,
    groundFeet: 120,
    heightFeet: 34,
    fov: 50,
  });
  const camera = orbitToCamera(orbit);
  close(camera.position.z, 120, 1e-6);
  close(camera.position.y, 34, 1e-6);
  close(camera.position.x, 0, 1e-6);
});

test('the press box floor clears the top row of the stand', () => {
  assert.ok(pressBoxFloorFeet() > standTopFeet());
});

test('the press box camera is at the window, not inside the box', () => {
  // A camera inside the mesh looks out through back faces, which are culled —
  // so the stadium silently loses a wall instead of failing visibly.
  const dimensions = fieldDimensions(metrics);
  const camera = orbitToCamera(presetOrbit('press-box', metrics));
  const boxCentre = pressBoxGroundFeet(dimensions.depthFeet / 2);
  const boxFrontFace = boxCentre - PRESS_BOX.depthFeet / 2;
  assert.ok(
    camera.position.z < boxFrontFace,
    `camera at ${Math.round(camera.position.z)} is not in front of the box face at ${Math.round(boxFrontFace)}`,
  );
  // But still close enough to be looking out of it rather than hovering.
  assert.ok(boxFrontFace - camera.position.z < 20);
});

test('every preset keeps the camera above ground and pointed at the field', () => {
  for (const preset of CAMERA_PRESETS) {
    const camera = orbitToCamera(presetOrbit(preset.id, metrics));
    assert.ok(
      camera.position.y >= CAMERA_LIMITS.minHeightFeet,
      `${preset.id} put the camera at ${camera.position.y} feet`,
    );
    // Close enough that the field fills the view rather than being a speck.
    const distance = Math.hypot(
      camera.position.x - camera.target.x,
      camera.position.y - camera.target.y,
      camera.position.z - camera.target.z,
    );
    assert.ok(
      distance > 40 && distance < 700,
      `${preset.id} framed the field from ${Math.round(distance)} feet`,
    );
  }
});

test('tilting stops short of level and of straight overhead', () => {
  const base = presetOrbit('home-stands', metrics);
  // Past the horizon would put the camera underground.
  assert.equal(orbitBy(base, 0, -500).elevation, CAMERA_LIMITS.minElevation);
  // Straight down has no defined "up", and the view snaps round if you reach it.
  assert.equal(orbitBy(base, 0, 500).elevation, CAMERA_LIMITS.maxElevation);
});

test('swinging all the way round comes back where it started', () => {
  const base = presetOrbit('home-stands', metrics);
  const spun = orbitBy(base, 360, 0);
  close(wrapDegrees(spun.azimuth - base.azimuth), 0, 1e-9);
  assert.ok(Math.abs(spun.azimuth) <= 180, 'angles stay in -180..180');
});

test('wrapping never yields negative zero', () => {
  assert.equal(Object.is(wrapDegrees(360), -0), false);
  assert.equal(wrapDegrees(360), 0);
  assert.equal(wrapDegrees(190), -170);
  assert.equal(wrapDegrees(-190), 170);
});

test('zooming is bounded at both ends', () => {
  const base = presetOrbit('home-stands', metrics);
  assert.equal(dollyBy(base, 0.0001).distance, CAMERA_LIMITS.minDistance);
  assert.equal(dollyBy(base, 10000).distance, CAMERA_LIMITS.maxDistance);
  // A nonsense factor leaves the camera alone rather than sending it to NaN.
  assert.equal(dollyBy(base, Number.NaN), base);
  assert.equal(dollyBy(base, -2), base);
});

test('panning moves across the view, not across the world axes', () => {
  // Looking from the audience (azimuth 0), dragging right moves along +X.
  const base = { target: { x: 0, y: 0, z: 0 }, distance: 200, azimuth: 0, elevation: 30, fov: 50 };
  const right = panBy(base, 10, 0);
  close(right.target.x, 10, 1e-6);
  close(right.target.z, 0, 1e-6);

  // Swung a quarter turn, "right" is now along the other world axis entirely.
  const swung = panBy({ ...base, azimuth: 90 }, 10, 0);
  close(swung.target.x, 0, 1e-6);
  close(swung.target.z, -10, 1e-6);
});

test('panning cannot push the view under the turf', () => {
  const base = presetOrbit('home-stands', metrics);
  const pushed = panBy(base, 0, -10_000);
  assert.ok(pushed.target.y >= 0, 'the target stayed at or above ground');
});

test('flying forward follows the heading, not the tilt', () => {
  // Looking from the audience and tilted down, W should travel across the turf
  // toward the far side rather than diving into it.
  const base = { target: { x: 0, y: 6, z: 0 }, distance: 200, azimuth: 0, elevation: 45, fov: 50 };
  const flown = flyBy(base, { forward: 1, right: 0, up: 0 }, 1);
  assert.ok(flown.target.z < base.target.z, 'forward went away from the audience');
  assert.equal(flown.target.y, base.target.y, 'height did not change');
  assert.equal(flown.target.x, base.target.x);
});

test('flying up and down is bounded below by the ground', () => {
  const base = { target: { x: 0, y: 6, z: 0 }, distance: 200, azimuth: 0, elevation: 30, fov: 50 };
  assert.ok(flyBy(base, { forward: 0, right: 0, up: 1 }, 1).target.y > 6);
  assert.equal(flyBy(base, { forward: 0, right: 0, up: -1 }, 10).target.y, 0);
});

test('boost moves further than a plain step in the same time', () => {
  const base = { target: { x: 0, y: 6, z: 0 }, distance: 200, azimuth: 0, elevation: 30, fov: 50 };
  const plain = flyBy(base, { forward: 1, right: 0, up: 0 }, 0.1, false).target.z;
  const boosted = flyBy(base, { forward: 1, right: 0, up: 0 }, 0.1, true).target.z;
  assert.ok(boosted < plain, 'boost should cover more ground');
});

test('a zero-length frame moves nothing', () => {
  const base = presetOrbit('corner', metrics);
  assert.equal(flyBy(base, { forward: 1, right: 1, up: 1 }, 0), base);
});

test('clamp is inclusive of its bounds', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(50, 0, 10), 10);
});
