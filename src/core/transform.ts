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
 * Drill units -> pixels.
 *
 * The model never stores pixels (spec §6.3), so every renderer — the Konva
 * canvas, the PDF chart generator, the thumbnail strip — asks this module for a
 * transform and applies it. Keeping one implementation means the printed chart
 * and the on-screen field cannot drift apart.
 *
 * **Vertical orientation.** Drill `y` grows from the front sideline toward the
 * back, but drill is drawn as the press box sees it: front sideline along the
 * *bottom* of the picture, back sideline along the top, so the front hash sits
 * below the back hash. That means screen y runs opposite to drill y, which is
 * what `yDirection` encodes. Every renderer and every hit test goes through
 * these functions rather than adding or subtracting on its own, because a flip
 * applied in one place and forgotten in another is invisible until someone
 * drags a marcher and it goes the wrong way.
 */

import type { DrillPoint } from './types.ts';
import type { FieldMetrics } from './field.ts';

/**
 * The application-wide vertical convention: front sideline at the bottom.
 *
 * Exported so code that has no viewport to hand — keyboard nudging, for
 * instance — resolves screen direction from the same constant the renderers do,
 * instead of hard-coding a sign that silently stops matching.
 */
export const FIELD_Y_DIRECTION: 1 | -1 = -1;

export interface Viewport {
  /** Pixels per drill step. Always positive. */
  scale: number;
  /** Pixel x of drill x = 0 (the Side 1 goal line). */
  offsetX: number;
  /** Pixel y of drill y = 0 (the front sideline). */
  offsetY: number;
  /**
   * -1 draws the front sideline at the bottom (the drill convention);
   * +1 would put it at the top. Screen y = offsetY + drillY * scale * yDirection.
   */
  yDirection: 1 | -1;
}

export interface FitOptions {
  /** Pixel padding kept clear around the field. */
  padding?: number;
  /** Include the end zones in the fitted area. */
  includeEndZones?: boolean;
  /** Override the vertical orientation. Defaults to front sideline at bottom. */
  yDirection?: 1 | -1;
}

/**
 * A viewport that fits the whole field into `width` x `height`, centred.
 */
export function fitFieldToBox(
  metrics: FieldMetrics,
  width: number,
  height: number,
  options: FitOptions = {},
): Viewport {
  const padding = options.padding ?? 16;
  const includeEndZones = options.includeEndZones ?? metrics.config.showEndZones;
  const yDirection = options.yDirection ?? FIELD_Y_DIRECTION;
  const endZone = includeEndZones ? metrics.endZoneSteps : 0;

  const contentWidth = metrics.widthSteps + endZone * 2;
  const contentHeight = metrics.depthSteps;

  const usableWidth = Math.max(1, width - padding * 2);
  const usableHeight = Math.max(1, height - padding * 2);

  const scale = Math.min(usableWidth / contentWidth, usableHeight / contentHeight);

  const renderedWidth = contentWidth * scale;
  const renderedHeight = contentHeight * scale;

  const top = (height - renderedHeight) / 2;

  return {
    scale,
    offsetX: (width - renderedWidth) / 2 + endZone * scale,
    // With the front sideline at the bottom, drill y = 0 lives at the bottom
    // edge of the fitted area and y grows upward on screen.
    offsetY: yDirection === -1 ? top + renderedHeight : top,
    yDirection,
  };
}

export function toPixels(point: DrillPoint, viewport: Viewport): { x: number; y: number } {
  return {
    x: viewport.offsetX + point.x * viewport.scale,
    y: viewport.offsetY + point.y * viewport.scale * viewport.yDirection,
  };
}

export function toDrill(
  pixel: { x: number; y: number },
  viewport: Viewport,
): DrillPoint {
  return {
    x: (pixel.x - viewport.offsetX) / viewport.scale,
    y: (pixel.y - viewport.offsetY) / (viewport.scale * viewport.yDirection),
  };
}

/**
 * Convert a pixel drag delta into a drill delta.
 *
 * Dividing a pixel delta by `scale` alone silently ignores the flip, so a
 * dragged marcher would move away from the cursor vertically. Callers use this
 * rather than doing the arithmetic themselves.
 */
export function deltaToDrill(
  dx: number,
  dy: number,
  viewport: Viewport,
): { x: number; y: number } {
  return {
    x: dx / viewport.scale,
    y: dy / (viewport.scale * viewport.yDirection),
  };
}

export type NudgeDirection = 'left' | 'right' | 'up' | 'down';

/**
 * The drill-unit delta for an arrow-key nudge.
 *
 * "Up" means up *on screen*, which is what the person pressing the key means.
 * Because the field is drawn front-sideline-down, up on screen is toward the
 * back sideline and therefore an **increase** in drill y — the opposite of the
 * naive mapping. Getting this backwards is invisible in code review and obvious
 * the instant anyone presses a key, so it lives here with a test rather than
 * inline in the key handler.
 */
export function nudgeDelta(
  direction: NudgeDirection,
  step: number,
  yDirection: 1 | -1 = FIELD_Y_DIRECTION,
): { dx: number; dy: number } {
  switch (direction) {
    case 'left':
      return { dx: -step, dy: 0 };
    case 'right':
      return { dx: step, dy: 0 };
    // Screen-up is -1 in pixel space; dividing by yDirection converts that to
    // drill space exactly as deltaToDrill does for a mouse drag.
    case 'up':
      return { dx: 0, dy: -step / yDirection };
    case 'down':
      return { dx: 0, dy: step / yDirection };
    default:
      return { dx: 0, dy: 0 };
  }
}

/** Apply a zoom factor about a fixed pixel point (the cursor). */
export function zoomAbout(
  viewport: Viewport,
  pixel: { x: number; y: number },
  factor: number,
  limits: { min: number; max: number },
): Viewport {
  const scale = Math.min(Math.max(viewport.scale * factor, limits.min), limits.max);
  const actualFactor = scale / viewport.scale;
  return {
    ...viewport,
    scale,
    offsetX: pixel.x - (pixel.x - viewport.offsetX) * actualFactor,
    offsetY: pixel.y - (pixel.y - viewport.offsetY) * actualFactor,
  };
}

export function panBy(viewport: Viewport, dx: number, dy: number): Viewport {
  return { ...viewport, offsetX: viewport.offsetX + dx, offsetY: viewport.offsetY + dy };
}

/**
 * Marker radius that stays legible as the field zooms.
 *
 * The base tracks zoom but is clamped at both ends: below the floor a marker is
 * an unclickable speck, above the ceiling a full-field view becomes a mass of
 * overlapping blobs. `sizeMultiplier` scales the clamped result, so a designer
 * can push past the ceiling deliberately without the zoom-tracking behaviour
 * changing underneath them.
 */
export function markerRadius(viewport: Viewport, sizeMultiplier = 1): number {
  const base = Math.max(2.5, Math.min(9, viewport.scale * 0.42));
  return base * Math.max(0.4, Math.min(3, sizeMultiplier));
}

/**
 * The pixel rectangle covering a drill-unit box, normalised so width and height
 * are positive regardless of orientation.
 */
export function pixelRect(
  from: DrillPoint,
  to: DrillPoint,
  viewport: Viewport,
): { x: number; y: number; width: number; height: number } {
  const a = toPixels(from, viewport);
  const b = toPixels(to, viewport);
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}
