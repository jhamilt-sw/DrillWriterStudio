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
 * The stadium around the field: a raked bowl of seating, a track apron, and the
 * sky.
 *
 * Deliberately plain. The point of this view is to judge a drill — whether a
 * form reads from the stands, whether a transition is clean — and a detailed
 * stadium would cost frames and attention without answering either question.
 * What the geometry does provide is a sense of scale and a horizon, which is
 * exactly what a flat plane in empty space fails to give.
 */

import * as THREE from 'three';

import {
  PRESS_BOX,
  STAND_GEOMETRY,
  pressBoxFloorFeet,
  pressBoxGroundFeet,
  type FieldDimensions,
} from '../core/camera3d.ts';

export interface StadiumColors {
  sky: string;
  ground: string;
  concrete: string;
  seating: string;
}

export const DEFAULT_STADIUM: StadiumColors = {
  sky: '#8fb6d8',
  ground: '#3f4a3c',
  concrete: '#9a9a94',
  seating: '#5b6470',
};

/*
 * The seating dimensions come from core, not from constants here.
 *
 * The camera presets need to know where the seats are — a "sideline" view
 * placed by distance alone once landed behind the bleachers, and the camera
 * module had no way to know. One definition, read by both, is what makes that
 * impossible rather than merely fixed.
 */
const { apronFeet: APRON_FEET, rowCount: ROW_COUNT } = STAND_GEOMETRY;
const ROW_DEPTH_FEET = STAND_GEOMETRY.rowDepthFeet;
const ROW_RISE_FEET = STAND_GEOMETRY.rowRiseFeet;

/**
 * Build the bowl.
 *
 * Returned as one Group so the caller can add or dispose it in a single move —
 * a 3D window that is opened and closed repeatedly leaks GPU memory otherwise,
 * and the leak only shows up after the fifth or sixth time.
 */
export function buildStadium(
  dimensions: FieldDimensions,
  colors: StadiumColors = DEFAULT_STADIUM,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'stadium';

  const halfLength = dimensions.lengthFeet / 2 + dimensions.endZoneFeet;
  const halfDepth = dimensions.depthFeet / 2;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(halfLength * 6, halfDepth * 10),
    new THREE.MeshLambertMaterial({ color: new THREE.Color(colors.ground) }),
  );
  ground.rotation.x = -Math.PI / 2;
  // A hair below the turf so the two coplanar planes cannot z-fight.
  ground.position.y = -0.25;
  ground.receiveShadow = false;
  group.add(ground);

  const apron = new THREE.Mesh(
    new THREE.PlaneGeometry(
      (halfLength + APRON_FEET) * 2,
      (halfDepth + APRON_FEET) * 2,
    ),
    new THREE.MeshLambertMaterial({ color: new THREE.Color(colors.concrete) }),
  );
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.12;
  group.add(apron);

  const seating = new THREE.MeshLambertMaterial({ color: new THREE.Color(colors.seating) });

  /**
   * One side of raked seating, built as a stack of boxes.
   *
   * `sign` is which side of the field it sits on; the rows step away from the
   * field as they rise, which is what makes it read as a grandstand rather than
   * a wall.
   */
  const buildSideStand = (sign: 1 | -1) => {
    const stand = new THREE.Group();
    const length = (halfLength + APRON_FEET) * 2;
    for (let row = 0; row < ROW_COUNT; row += 1) {
      const geometry = new THREE.BoxGeometry(length, ROW_RISE_FEET, ROW_DEPTH_FEET);
      const mesh = new THREE.Mesh(geometry, seating);
      mesh.position.set(
        0,
        ROW_RISE_FEET * (row + 0.5),
        sign * (halfDepth + APRON_FEET + ROW_DEPTH_FEET * (row + 0.5)),
      );
      stand.add(mesh);
    }
    return stand;
  };

  const buildEndStand = (sign: 1 | -1) => {
    const stand = new THREE.Group();
    const width = (halfDepth + APRON_FEET) * 2;
    // End stands are shallower — most stadiums have far less seating there, and
    // a full bowl on every side boxes the view in.
    const rows = Math.round(ROW_COUNT * STAND_GEOMETRY.endRowFraction);
    for (let row = 0; row < rows; row += 1) {
      const geometry = new THREE.BoxGeometry(ROW_DEPTH_FEET, ROW_RISE_FEET, width);
      const mesh = new THREE.Mesh(geometry, seating);
      mesh.position.set(
        sign * (halfLength + APRON_FEET + ROW_DEPTH_FEET * (row + 0.5)),
        ROW_RISE_FEET * (row + 0.5),
        0,
      );
      stand.add(mesh);
    }
    return stand;
  };

  group.add(buildSideStand(1), buildSideStand(-1));
  group.add(buildEndStand(1), buildEndStand(-1));

  /*
   * The press box, at the top of the HOME stand.
   *
   * Home side, not the far side — that is where it sits in a real stadium, and
   * it is the side the front sideline faces. The 2D chart is already the press
   * box's view of the field, so putting the box opposite would have the drill
   * being written from one side and watched from the other.
   *
   * It is also the one piece of detail worth modelling: it tells you instantly
   * which way round you are looking.
   */
  const pressBoxZ = pressBoxGroundFeet(halfDepth);
  const pressBox = new THREE.Mesh(
    new THREE.BoxGeometry(PRESS_BOX.widthFeet, PRESS_BOX.heightFeet, PRESS_BOX.depthFeet),
    new THREE.MeshLambertMaterial({ color: new THREE.Color('#d8d8d2') }),
  );
  pressBox.position.set(0, pressBoxFloorFeet(), pressBoxZ);
  group.add(pressBox);

  // Supports, so the box reads as standing above the stand rather than floating.
  const legMaterial = new THREE.MeshLambertMaterial({ color: new THREE.Color('#8d8d88') });
  for (const offset of [-PRESS_BOX.widthFeet * 0.43, PRESS_BOX.widthFeet * 0.43]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(6, pressBoxFloorFeet(), 6),
      legMaterial,
    );
    leg.position.set(offset, pressBoxFloorFeet() / 2, pressBoxZ);
    group.add(leg);
  }

  return group;
}

/** Lighting: bright, even, and flat enough that section colours stay readable. */
export function buildLighting(dimensions: FieldDimensions): THREE.Group {
  const group = new THREE.Group();
  group.name = 'lighting';

  // Hemisphere light does most of the work: sky above, grass-bounce below. It
  // keeps every marcher legible regardless of which way they face, which a
  // single directional light would not.
  group.add(new THREE.HemisphereLight(0xdfeaf5, 0x40502f, 2.1));

  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(dimensions.lengthFeet * 0.4, 400, dimensions.depthFeet * 0.8);
  group.add(sun);

  return group;
}

/** Dispose a subtree's geometries and materials. Called when the window closes. */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material?.dispose();
  });
}
