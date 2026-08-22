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
 * The performers: one simple model each, coloured by section.
 *
 * Two instanced meshes — bodies and heads — rather than 250 separate objects.
 * A show can run past 250 performers (NFR-1), and 250 individual meshes means
 * 250 draw calls per frame, which is what turns a smooth run-through into a
 * slideshow on a laptop. Instancing draws all of them in two.
 *
 * The colour of each marcher is the colour of their section in the 2D editor,
 * read from the same `Section.color` the roster chips and the field dots use.
 * That is the whole point: a director who has learned to read "the blue ones
 * are the trumpets" on the chart reads the same thing here.
 */

import * as THREE from 'three';

import type { FieldMetrics } from '../core/field.ts';
import { drillToWorld } from '../core/camera3d.ts';
import type { DrillPoint, Performer, Section } from '../core/types.ts';

/** A marcher is about six feet tall; the body is most of that. */
const BODY_HEIGHT_FEET = 4.4;
const BODY_RADIUS_FEET = 0.62;
const HEAD_RADIUS_FEET = 0.52;
const TOTAL_HEIGHT_FEET = BODY_HEIGHT_FEET + HEAD_RADIUS_FEET * 2;

export interface MarcherField {
  group: THREE.Group;
  /**
   * Move everyone. `positions` is keyed by performer id, exactly the shape the
   * 2D canvas animates from — both views read the same interpolation, so they
   * cannot disagree about where the ensemble is.
   */
  update: (positions: Record<string, DrillPoint>) => void;
  dispose: () => void;
}

export function buildMarchers(
  performers: Performer[],
  sections: Section[],
  metrics: FieldMetrics,
  options: { scale?: number } = {},
): MarcherField {
  const scale = Math.max(0.4, options.scale ?? 1);
  const count = performers.length;
  const group = new THREE.Group();
  group.name = 'marchers';

  const bodyGeometry = new THREE.CylinderGeometry(
    BODY_RADIUS_FEET * 0.78 * scale,
    BODY_RADIUS_FEET * scale,
    BODY_HEIGHT_FEET * scale,
    10,
  );
  const headGeometry = new THREE.SphereGeometry(HEAD_RADIUS_FEET * scale, 10, 8);
  // Lambert rather than Standard: no metalness or roughness to compute, and a
  // flat matte read is easier to pick colours out of at a distance anyway.
  const bodyMaterial = new THREE.MeshLambertMaterial();
  const headMaterial = new THREE.MeshLambertMaterial();

  const bodies = new THREE.InstancedMesh(bodyGeometry, bodyMaterial, Math.max(1, count));
  const heads = new THREE.InstancedMesh(headGeometry, headMaterial, Math.max(1, count));
  bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(bodies, heads);

  const colorBySection = new Map(sections.map((section) => [section.id, section.color]));
  const shade = new THREE.Color();
  const head = new THREE.Color();
  performers.forEach((performer, index) => {
    const hex = colorBySection.get(performer.sectionId) ?? '#4477AA';
    shade.set(hex);
    bodies.setColorAt(index, shade);
    // Heads a touch darker than the uniform, so a form still reads as people
    // rather than a field of lollipops when seen from the far stands.
    head.copy(shade).multiplyScalar(0.72);
    heads.setColorAt(index, head);
  });
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  if (heads.instanceColor) heads.instanceColor.needsUpdate = true;

  const matrix = new THREE.Matrix4();
  // Anyone with no position at this moment is parked far below the turf rather
  // than at the origin, where they would stand on the 50 looking like a marcher
  // who is genuinely there.
  const HIDDEN = new THREE.Vector3(0, -1000, 0);

  const update = (positions: Record<string, DrillPoint>) => {
    performers.forEach((performer, index) => {
      const point = positions[performer.id];
      if (!point) {
        matrix.makeTranslation(HIDDEN.x, HIDDEN.y, HIDDEN.z);
        bodies.setMatrixAt(index, matrix);
        heads.setMatrixAt(index, matrix);
        return;
      }
      const world = drillToWorld(point, metrics);
      matrix.makeTranslation(world.x, (BODY_HEIGHT_FEET / 2) * scale, world.z);
      bodies.setMatrixAt(index, matrix);
      matrix.makeTranslation(
        world.x,
        (BODY_HEIGHT_FEET + HEAD_RADIUS_FEET) * scale,
        world.z,
      );
      heads.setMatrixAt(index, matrix);
    });
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    // Instanced bounds are not recomputed automatically, and a stale sphere
    // makes the whole ensemble vanish when the camera swings past it.
    bodies.computeBoundingSphere();
    heads.computeBoundingSphere();
  };

  const dispose = () => {
    bodyGeometry.dispose();
    headGeometry.dispose();
    bodyMaterial.dispose();
    headMaterial.dispose();
    bodies.dispose();
    heads.dispose();
  };

  return { group, update, dispose };
}

export const MARCHER_HEIGHT_FEET = TOTAL_HEIGHT_FEET;
