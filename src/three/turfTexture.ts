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
 * The painted field, drawn once to a 2D canvas and used as a texture.
 *
 * Drawing the lines into a texture rather than building geometry for them means
 * one draw call for the whole field instead of a hundred thin meshes, and the
 * paint stays crisp because the texture is generated at the size it will be
 * seen at rather than scaled from an image file.
 *
 * Every dimension comes from the show's own `FieldMetrics`, so the 3D field is
 * the same field as the 2D chart — same hash placement, same step size, same
 * colours the designer chose in the appearance panel.
 */

import {
  HASH_MARK_LENGTH_FEET,
  HASH_MARK_WIDTH_FEET,
  hashMarkXs,
  yardLineX,
  yardTicks,
} from '../core/field.ts';
import type { FieldMetrics } from '../core/field.ts';
import type { FieldAppearance, FieldLogo } from '../core/types.ts';

/** Texture pixels per foot. 8 keeps a four-inch line about three pixels wide. */
const PIXELS_PER_FOOT = 8;

export interface TurfTexture {
  canvas: HTMLCanvasElement;
  /** Total painted area, end zone to end zone, in feet. */
  widthFeet: number;
  depthFeet: number;
}

/**
 * Paint the field, end zones included, into a canvas the caller wraps in a
 * texture. The canvas is sized to the full painted area so the texture maps
 * one-to-one onto a plane of the same proportions.
 */
export function drawTurfTexture(
  metrics: FieldMetrics,
  appearance: FieldAppearance,
  options: {
    includeEndZones: boolean;
    /** Painted onto the field, over the yard lines, as the 2D editor draws them. */
    logos?: FieldLogo[];
    /** Decoded images, keyed by data URL. Logos with no entry are skipped. */
    logoImages?: Map<string, HTMLImageElement>;
    /** Reuse an existing canvas instead of allocating another one. */
    canvas?: HTMLCanvasElement;
  },
): TurfTexture {
  const spf = metrics.config.stepsPerFiveYards;
  const toFeet = (steps: number) => (steps * 5 * 3) / spf;

  const fieldFeet = toFeet(metrics.widthSteps);
  const depthFeet = toFeet(metrics.depthSteps);
  const endZoneFeet = options.includeEndZones ? toFeet(metrics.endZoneSteps) : 0;
  const widthFeet = fieldFeet + endZoneFeet * 2;

  const canvas = options.canvas ?? document.createElement('canvas');
  canvas.width = Math.round(widthFeet * PIXELS_PER_FOOT);
  canvas.height = Math.round(depthFeet * PIXELS_PER_FOOT);
  const context = canvas.getContext('2d');
  if (!context) return { canvas, widthFeet, depthFeet };

  const px = (feet: number) => feet * PIXELS_PER_FOOT;
  // Texture x runs Side 1 to Side 2 with the end zone offset folded in.
  const fieldX = (steps: number) => px(endZoneFeet + toFeet(steps));
  // Texture y is measured from the *back* sideline downward, because the plane
  // is laid with its far edge at the top — the same way the press box sees it.
  const fieldY = (steps: number) => px(depthFeet - toFeet(steps));

  context.fillStyle = appearance.turfColor;
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (endZoneFeet > 0) {
    context.fillStyle = appearance.endZoneColor;
    context.fillRect(0, 0, px(endZoneFeet), canvas.height);
    context.fillRect(canvas.width - px(endZoneFeet), 0, px(endZoneFeet), canvas.height);
  }

  if (appearance.showMowingStripes) {
    // Five-yard mown bands, the same alternation the 2D field draws.
    context.fillStyle = 'rgba(255, 255, 255, 0.035)';
    const band = toFeet(metrics.stepsPerFiveYardLine);
    for (let yards = 0; yards < 100; yards += 10) {
      context.fillRect(px(endZoneFeet + yards * 3), 0, px(band), canvas.height);
    }
  }

  const weight = Math.max(0.4, appearance.lineWeight);
  // A painted line on a real field is four inches wide.
  const lineWidth = Math.max(1, px(4 / 12) * weight);
  context.strokeStyle = appearance.lineColor;
  context.fillStyle = appearance.lineColor;
  context.lineCap = 'butt';

  const verticalLine = (steps: number, width: number) => {
    context.lineWidth = width;
    context.beginPath();
    context.moveTo(fieldX(steps), fieldY(metrics.depthSteps));
    context.lineTo(fieldX(steps), fieldY(0));
    context.stroke();
  };

  // Every five yards, with the goal lines and the 50 drawn heavier.
  for (let yards = 0; yards <= 100; yards += 5) {
    const steps = (yards / 5) * metrics.stepsPerFiveYardLine;
    const emphatic = yards === 0 || yards === 100 || yards === 50;
    verticalLine(steps, emphatic ? lineWidth * 1.8 : lineWidth);
  }

  // Sidelines.
  context.lineWidth = lineWidth * 1.8;
  for (const y of [0, metrics.depthSteps]) {
    context.beginPath();
    context.moveTo(fieldX(0), fieldY(y));
    context.lineTo(fieldX(metrics.widthSteps), fieldY(y));
    context.stroke();
  }

  /*
   * The continuous hash line, drawn before the ticks so they sit on top of it.
   * Lighter than a yard line — it is a designer's reference, not paint that
   * exists on the ground — and it stops at the goal lines, not the end zones.
   */
  if (appearance.showHashLines) {
    context.save();
    context.globalAlpha = 0.75;
    context.lineWidth = lineWidth * 0.8;
    for (const hashY of [metrics.frontHashY, metrics.backHashY]) {
      context.beginPath();
      context.moveTo(fieldX(0), fieldY(hashY));
      context.lineTo(fieldX(metrics.widthSteps), fieldY(hashY));
      context.stroke();
    }
    context.restore();
  }

  /*
   * The hash marks: 24-inch dashes lying *along* the field, one bisecting each
   * five-yard line. Their length runs goal-to-goal, not across — a mark drawn
   * across the field is a stubby yard line, not a hash.
   */
  // Only when the continuous hash line is off: drawn together they sit on top
  // of one another and read as a lumpy line rather than as either thing.
  if (!appearance.showHashLines) {
    const halfMark = px(HASH_MARK_LENGTH_FEET / 2);
    context.lineWidth = Math.max(1, px(HASH_MARK_WIDTH_FEET) * weight);
    context.lineCap = 'butt';
    for (const hashY of [metrics.frontHashY, metrics.backHashY]) {
      const y = fieldY(hashY);
      for (const stepX of hashMarkXs(metrics)) {
        const x = fieldX(stepX);
        context.beginPath();
        context.moveTo(x - halfMark, y);
        context.lineTo(x + halfMark, y);
        context.stroke();
      }
    }
  }

  // Yard markers: ticks across the field, in from the sidelines and out from
  // the hashes. Always drawn — reading the yardage between the five-yard lines
  // is not what the hash-line switch is about.
  context.lineWidth = Math.max(1, lineWidth * 0.8);
  for (const tick of yardTicks(metrics)) {
    const x = fieldX(tick.x);
    context.beginPath();
    context.moveTo(x, fieldY(tick.fromY));
    context.lineTo(x, fieldY(tick.toY));
    context.stroke();
  }

  // Yard numbers, six feet tall, sitting in from each sideline the way they are
  // painted on a real field.
  context.fillStyle = appearance.numberColor;
  context.font = `bold ${Math.round(px(6))}px system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (let number = 10; number <= 50; number += 10) {
    for (const side of [1, 2] as const) {
      const steps = yardLineX(number, side, metrics);
      const x = fieldX(steps);
      for (const inset of [9, depthFeet - 9]) {
        context.save();
        context.translate(x, px(inset));
        // Numbers on the far side of the field read upside down from the near
        // side, exactly as painted, so the field looks right from the stands.
        if (inset < depthFeet / 2) context.rotate(Math.PI);
        context.fillText(String(number), 0, 0);
        context.restore();
      }
      if (number === 50) break;
    }
  }

  /*
   * Logos go on last, over the paint.
   *
   * This matches the 2D editor, where the logo layer sits above the field
   * graphics — and it matches most real fields, where a midfield crest is
   * repainted over the yard lines rather than having them run across it. The
   * two views have to agree above all else: a designer who positions a crest on
   * the chart must see that crest in the same place, the same way round, from
   * the stands.
   *
   * The transform matches the editor's exactly: rotate about the centre, in
   * degrees, clockwise. The texture happens to share the screen canvas's
   * handedness — texture x runs Side 1 to Side 2, texture y runs back sideline
   * to front — so the same angle produces the same picture from the stands as
   * it does on the chart.
   */
  for (const logo of options.logos ?? []) {
    if (!logo.visible) continue;
    const image = options.logoImages?.get(logo.dataUrl);
    if (!image) continue;
    const logoWidth = px(toFeet(logo.widthSteps));
    const logoHeight = px(toFeet(logo.heightSteps));
    if (logoWidth <= 0 || logoHeight <= 0) continue;
    context.save();
    context.globalAlpha = Math.max(0, Math.min(1, logo.opacity));
    context.translate(fieldX(logo.center.x), fieldY(logo.center.y));
    context.rotate((logo.rotationDegrees * Math.PI) / 180);
    try {
      context.drawImage(image, -logoWidth / 2, -logoHeight / 2, logoWidth, logoHeight);
    } catch {
      // A half-decoded image throws rather than drawing nothing. One bad logo
      // must not cost the whole field its paint.
    }
    context.restore();
  }

  return { canvas, widthFeet, depthFeet };
}

/**
 * Decode logo images so they can be composited into the turf.
 *
 * Every logo is a `data:` URL embedded in the show, so there is no network and
 * no CORS to worry about — but decoding is still asynchronous, and a texture
 * drawn before the images are ready simply has no logos on it. Callers draw the
 * field immediately, await this, and redraw.
 *
 * Failures resolve rather than reject: one unreadable image should cost that
 * logo, not the whole field.
 */
export function loadLogoImages(
  logos: FieldLogo[],
  cache = new Map<string, HTMLImageElement>(),
): Promise<Map<string, HTMLImageElement>> {
  const wanted = logos.filter((logo) => logo.visible && !cache.has(logo.dataUrl));
  if (wanted.length === 0) return Promise.resolve(cache);

  return Promise.all(
    wanted.map(
      (logo) =>
        new Promise<void>((resolve) => {
          const image = new Image();
          image.onload = () => {
            cache.set(logo.dataUrl, image);
            resolve();
          };
          image.onerror = () => resolve();
          image.src = logo.dataUrl;
        }),
    ),
  ).then(() => cache);
}
