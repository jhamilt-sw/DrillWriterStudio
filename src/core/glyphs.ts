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
 * A stroke font for the field.
 *
 * Letters made of marchers are not typography. There is no fill, no weight and
 * no counter — every glyph is a set of open polylines that people stand along,
 * and legibility comes from having enough bodies on each stroke, not from
 * shape. So the font here is a skeleton: single-stroke forms designed to read
 * from the press box at twenty performers a letter, not to look good at 12pt.
 *
 * **The unit box** is x from 0 (left) to 1 (right) and y from 0 (baseline) to
 * 1 (cap height), with **y up** — the same direction drill y runs, so a glyph
 * is not mirrored on its way to the field. Every glyph stays inside that box,
 * including the ones that would normally have a descender: a comma below the
 * baseline would collide with the line beneath it, and on a football field
 * there is no line beneath it to relate to anyway.
 *
 * `advance` is how much width the glyph consumes, in unit-box widths. Narrow
 * glyphs like `I` and `.` claim less, so "MIAMI" does not come out with holes
 * either side of the I.
 */

import type { DrillPoint } from './types.ts';

/** One continuous run a group of performers stands along. */
export type GlyphStroke = DrillPoint[];

export interface Glyph {
  /** Width consumed, in unit-box widths. */
  advance: number;
  strokes: GlyphStroke[];
}

const DEG = Math.PI / 180;

/**
 * A polyline approximating an elliptical arc.
 *
 * Angles are degrees, 0 pointing along +x and increasing anticlockwise — the
 * ordinary mathematical convention, which works here because the unit box is
 * y-up. Curves are the reason a stroke font needs any code at all: `O` and `S`
 * written as literal point lists are unreadable and unmaintainable.
 */
function arc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fromDeg: number,
  toDeg: number,
  segments = 14,
): GlyphStroke {
  const points: GlyphStroke = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = (fromDeg + ((toDeg - fromDeg) * i) / segments) * DEG;
    points.push({ x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) });
  }
  return points;
}

/** A straight run through the given points. */
function line(...points: [number, number][]): GlyphStroke {
  return points.map(([x, y]) => ({ x, y }));
}

/** A closed ring, for O, 0 and the bowls of other glyphs. */
function ring(cx: number, cy: number, rx: number, ry: number, segments = 24): GlyphStroke {
  return arc(cx, cy, rx, ry, 0, 360, segments);
}

/** A dot, drawn as a very short stroke so at least one performer lands on it. */
function dot(x: number, y: number): GlyphStroke {
  return line([x - 0.03, y], [x + 0.03, y]);
}

const GLYPHS: Record<string, Glyph> = {
  A: { advance: 1, strokes: [line([0, 0], [0.5, 1], [1, 0]), line([0.17, 0.34], [0.83, 0.34])] },
  B: {
    advance: 1,
    strokes: [
      line([0, 0], [0, 1]),
      [...line([0, 1], [0.42, 1]), ...arc(0.42, 0.76, 0.5, 0.24, 90, -90, 10)],
      [...line([0, 0.52], [0.46, 0.52]), ...arc(0.46, 0.26, 0.52, 0.26, 90, -90, 10)],
      line([0, 0], [0.46, 0]),
    ],
  },
  C: { advance: 1, strokes: [arc(0.52, 0.5, 0.52, 0.5, 48, 312, 20)] },
  D: {
    advance: 1,
    strokes: [
      line([0, 0], [0, 1]),
      [...line([0, 1], [0.35, 1]), ...arc(0.35, 0.5, 0.65, 0.5, 90, -90, 14), ...line([0.35, 0], [0, 0])],
    ],
  },
  E: {
    advance: 0.95,
    strokes: [line([0, 0], [0, 1]), line([0, 1], [0.95, 1]), line([0, 0.5], [0.78, 0.5]), line([0, 0], [0.95, 0])],
  },
  F: { advance: 0.92, strokes: [line([0, 0], [0, 1]), line([0, 1], [0.92, 1]), line([0, 0.52], [0.74, 0.52])] },
  G: {
    advance: 1,
    strokes: [arc(0.5, 0.5, 0.5, 0.5, 48, 312, 20), line([1, 0.44], [0.55, 0.44]), line([1, 0.44], [1, 0.06])],
  },
  H: { advance: 1, strokes: [line([0, 0], [0, 1]), line([1, 0], [1, 1]), line([0, 0.5], [1, 0.5])] },
  I: { advance: 0.42, strokes: [line([0.21, 0], [0.21, 1]), line([0, 1], [0.42, 1]), line([0, 0], [0.42, 0])] },
  J: {
    advance: 0.8,
    strokes: [line([0.62, 1], [0.62, 0.28]), arc(0.31, 0.28, 0.31, 0.28, 0, -180, 10)],
  },
  K: { advance: 0.95, strokes: [line([0, 0], [0, 1]), line([0.95, 1], [0, 0.46]), line([0.2, 0.58], [0.95, 0])] },
  L: { advance: 0.8, strokes: [line([0, 1], [0, 0], [0.8, 0])] },
  M: { advance: 1.05, strokes: [line([0, 0], [0, 1], [0.52, 0.36], [1.05, 1], [1.05, 0])] },
  N: { advance: 1, strokes: [line([0, 0], [0, 1], [1, 0], [1, 1])] },
  O: { advance: 1, strokes: [ring(0.5, 0.5, 0.5, 0.5)] },
  P: {
    advance: 0.95,
    strokes: [line([0, 0], [0, 1]), [...line([0, 1], [0.42, 1]), ...arc(0.42, 0.73, 0.53, 0.27, 90, -90, 10), ...line([0.42, 0.46], [0, 0.46])]],
  },
  Q: { advance: 1, strokes: [ring(0.5, 0.5, 0.5, 0.5), line([0.62, 0.3], [1, 0])] },
  R: {
    advance: 0.98,
    strokes: [
      line([0, 0], [0, 1]),
      [...line([0, 1], [0.4, 1]), ...arc(0.4, 0.74, 0.5, 0.26, 90, -90, 10), ...line([0.4, 0.48], [0, 0.48])],
      line([0.4, 0.48], [0.98, 0]),
    ],
  },
  S: {
    advance: 0.95,
    strokes: [
      [
        ...arc(0.48, 0.74, 0.47, 0.26, 20, 180, 10),
        ...arc(0.48, 0.74, 0.47, 0.26, 180, 270, 6),
        ...arc(0.48, 0.26, 0.47, 0.26, 90, 0, 6),
        ...arc(0.48, 0.26, 0.47, 0.26, 0, -160, 10),
      ],
    ],
  },
  T: { advance: 0.9, strokes: [line([0, 1], [0.9, 1]), line([0.45, 1], [0.45, 0])] },
  U: {
    advance: 1,
    strokes: [[...line([0, 1], [0, 0.32]), ...arc(0.5, 0.32, 0.5, 0.32, 180, 360, 12), ...line([1, 0.32], [1, 1])]],
  },
  V: { advance: 1, strokes: [line([0, 1], [0.5, 0], [1, 1])] },
  W: { advance: 1.15, strokes: [line([0, 1], [0.29, 0], [0.575, 0.62], [0.86, 0], [1.15, 1])] },
  X: { advance: 0.95, strokes: [line([0, 1], [0.95, 0]), line([0, 0], [0.95, 1])] },
  Y: { advance: 0.95, strokes: [line([0, 1], [0.475, 0.5], [0.95, 1]), line([0.475, 0.5], [0.475, 0])] },
  Z: { advance: 0.95, strokes: [line([0, 1], [0.95, 1], [0, 0], [0.95, 0])] },

  '0': { advance: 0.9, strokes: [ring(0.45, 0.5, 0.45, 0.5), line([0.2, 0.18], [0.7, 0.82])] },
  '1': { advance: 0.6, strokes: [line([0.08, 0.78], [0.34, 1], [0.34, 0]), line([0.02, 0], [0.6, 0])] },
  '2': {
    advance: 0.9,
    strokes: [[...arc(0.45, 0.72, 0.44, 0.28, 170, -20, 12), ...line([0.78, 0.5], [0, 0], [0.9, 0])]],
  },
  '3': {
    advance: 0.9,
    strokes: [
      [...arc(0.44, 0.74, 0.42, 0.26, 160, -80, 12), ...line([0.3, 0.5], [0.44, 0.5]), ...arc(0.44, 0.26, 0.44, 0.26, 80, -170, 12)],
    ],
  },
  '4': { advance: 0.95, strokes: [line([0.7, 0], [0.7, 1], [0, 0.3], [0.95, 0.3])] },
  '5': {
    advance: 0.9,
    strokes: [line([0.86, 1], [0.06, 1], [0.03, 0.56]), [...line([0.03, 0.56], [0.45, 0.6]), ...arc(0.45, 0.3, 0.45, 0.3, 90, -150, 14)]],
  },
  '6': {
    advance: 0.9,
    strokes: [[...arc(0.45, 0.3, 0.45, 0.3, 80, 360 + 80, 20)], line([0.14, 0.52], [0.62, 1])],
  },
  '7': { advance: 0.9, strokes: [line([0, 1], [0.9, 1], [0.32, 0])] },
  '8': { advance: 0.9, strokes: [ring(0.45, 0.73, 0.36, 0.27, 16), ring(0.45, 0.27, 0.45, 0.27, 18)] },
  '9': { advance: 0.9, strokes: [ring(0.45, 0.7, 0.45, 0.3, 18), line([0.76, 0.48], [0.28, 0])] },

  ' ': { advance: 0.55, strokes: [] },
  '.': { advance: 0.32, strokes: [dot(0.16, 0.04)] },
  ',': { advance: 0.32, strokes: [line([0.22, 0.14], [0.06, 0])] },
  ':': { advance: 0.32, strokes: [dot(0.16, 0.7), dot(0.16, 0.16)] },
  ';': { advance: 0.32, strokes: [dot(0.16, 0.7), line([0.22, 0.2], [0.06, 0.04])] },
  '!': { advance: 0.3, strokes: [line([0.15, 1], [0.15, 0.26]), dot(0.15, 0.04)] },
  '?': {
    advance: 0.85,
    strokes: [[...arc(0.42, 0.74, 0.4, 0.26, 175, -60, 12), ...line([0.62, 0.5], [0.42, 0.28])], dot(0.42, 0.05)],
  },
  "'": { advance: 0.26, strokes: [line([0.13, 1], [0.13, 0.72])] },
  '"': { advance: 0.45, strokes: [line([0.13, 1], [0.13, 0.72]), line([0.34, 1], [0.34, 0.72])] },
  '-': { advance: 0.7, strokes: [line([0.08, 0.5], [0.62, 0.5])] },
  '_': { advance: 0.9, strokes: [line([0, 0], [0.9, 0])] },
  '+': { advance: 0.8, strokes: [line([0.05, 0.5], [0.75, 0.5]), line([0.4, 0.15], [0.4, 0.85])] },
  '=': { advance: 0.8, strokes: [line([0.05, 0.62], [0.75, 0.62]), line([0.05, 0.38], [0.75, 0.38])] },
  '*': {
    advance: 0.7,
    strokes: [line([0.35, 0.95], [0.35, 0.45]), line([0.06, 0.85], [0.64, 0.55]), line([0.64, 0.85], [0.06, 0.55])],
  },
  '/': { advance: 0.7, strokes: [line([0, 0], [0.7, 1])] },
  '\\': { advance: 0.7, strokes: [line([0, 1], [0.7, 0])] },
  '|': { advance: 0.3, strokes: [line([0.15, 0], [0.15, 1])] },
  '(': { advance: 0.45, strokes: [arc(0.55, 0.5, 0.45, 0.5, 145, 215, 10)] },
  ')': { advance: 0.45, strokes: [arc(-0.1, 0.5, 0.45, 0.5, 35, -35, 10)] },
  '[': { advance: 0.45, strokes: [line([0.4, 1], [0.08, 1], [0.08, 0], [0.4, 0])] },
  ']': { advance: 0.45, strokes: [line([0.05, 1], [0.37, 1], [0.37, 0], [0.05, 0])] },
  '{': { advance: 0.5, strokes: [line([0.44, 1], [0.2, 0.86], [0.2, 0.58], [0.04, 0.5], [0.2, 0.42], [0.2, 0.14], [0.44, 0])] },
  '}': { advance: 0.5, strokes: [line([0.06, 1], [0.3, 0.86], [0.3, 0.58], [0.46, 0.5], [0.3, 0.42], [0.3, 0.14], [0.06, 0])] },
  '<': { advance: 0.7, strokes: [line([0.68, 0.9], [0.04, 0.5], [0.68, 0.1])] },
  '>': { advance: 0.7, strokes: [line([0.02, 0.9], [0.66, 0.5], [0.02, 0.1])] },
  '@': {
    advance: 1.1,
    strokes: [ring(0.55, 0.5, 0.28, 0.24, 14), [...arc(0.55, 0.5, 0.55, 0.5, -35, 290, 22)], line([0.83, 0.5], [0.83, 0.28])],
  },
  '#': {
    advance: 0.95,
    strokes: [line([0.28, 0], [0.38, 1]), line([0.6, 0], [0.7, 1]), line([0.05, 0.3], [0.9, 0.3]), line([0.08, 0.7], [0.93, 0.7])],
  },
  $: {
    advance: 0.9,
    strokes: [
      [
        ...arc(0.45, 0.7, 0.42, 0.22, 20, 180, 8),
        ...arc(0.45, 0.7, 0.42, 0.22, 180, 265, 5),
        ...arc(0.45, 0.3, 0.42, 0.22, 95, 0, 5),
        ...arc(0.45, 0.3, 0.42, 0.22, 0, -160, 8),
      ],
      line([0.45, 1], [0.45, 0]),
    ],
  },
  '%': {
    advance: 1,
    strokes: [ring(0.22, 0.78, 0.2, 0.2, 10), ring(0.78, 0.22, 0.2, 0.2, 10), line([0.02, 0.05], [0.98, 0.95])],
  },
  '^': { advance: 0.7, strokes: [line([0.05, 0.68], [0.35, 1], [0.65, 0.68])] },
  '&': {
    advance: 1,
    strokes: [
      [
        ...arc(0.36, 0.82, 0.24, 0.18, 0, 180, 8),
        ...line([0.12, 0.82], [0.78, 0.14]),
        ...arc(0.32, 0.22, 0.3, 0.22, 20, 200, 10),
        ...line([0.06, 0.3], [1, 0.3]),
      ],
    ],
  },
  '~': {
    advance: 0.86,
    strokes: [[...arc(0.23, 0.5, 0.21, 0.16, 180, 0, 8), ...arc(0.65, 0.5, 0.21, 0.16, 180, 360, 8)]],
  },
  '`': { advance: 0.3, strokes: [line([0.03, 1], [0.24, 0.78])] },
};

/** Every character the font can draw, in a sensible order for a picker. */
export const SUPPORTED_CHARACTERS: string[] = Object.keys(GLYPHS).filter(
  (character) => character !== ' ',
);

/**
 * The glyph for a character, or null.
 *
 * Lowercase folds to uppercase: single-stroke lowercase forms need roughly the
 * same number of performers as capitals to read, and nobody spells a field show
 * in lowercase. Folding rather than refusing means typing "Go Band" works.
 */
export function glyphFor(character: string): Glyph | null {
  return GLYPHS[character] ?? GLYPHS[character.toUpperCase()] ?? null;
}

export function isSupported(character: string): boolean {
  return glyphFor(character) !== null;
}

/** Characters in a string the font cannot draw. */
export function unsupportedCharacters(text: string): string[] {
  const seen = new Set<string>();
  for (const character of text) {
    if (character !== ' ' && !isSupported(character)) seen.add(character);
  }
  return [...seen];
}

/** Total length of a set of strokes, in whatever units they are written. */
export function strokesLength(strokes: GlyphStroke[]): number {
  let total = 0;
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.length; i += 1) {
      total += Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y);
    }
  }
  return total;
}

/** Scale and move a glyph's strokes into place on the field. */
export function placeStrokes(
  strokes: GlyphStroke[],
  origin: DrillPoint,
  width: number,
  height: number,
): GlyphStroke[] {
  return strokes.map((stroke) =>
    stroke.map((point) => ({
      x: origin.x + point.x * width,
      y: origin.y + point.y * height,
    })),
  );
}

/** A point at `distance` along a polyline. */
function pointAlong(stroke: GlyphStroke, distance: number): DrillPoint {
  let travelled = 0;
  for (let i = 1; i < stroke.length; i += 1) {
    const segment = Math.hypot(
      stroke[i].x - stroke[i - 1].x,
      stroke[i].y - stroke[i - 1].y,
    );
    if (travelled + segment >= distance || i === stroke.length - 1) {
      const along = segment > 0 ? Math.min(1, (distance - travelled) / segment) : 0;
      return {
        x: stroke[i - 1].x + (stroke[i].x - stroke[i - 1].x) * along,
        y: stroke[i - 1].y + (stroke[i].y - stroke[i - 1].y) * along,
      };
    }
    travelled += segment;
  }
  return { ...stroke[stroke.length - 1] };
}

/**
 * Spread `count` performers along a glyph's strokes.
 *
 * **Endpoints come first.** A letter is read by its extremities — the ends of
 * the arms of a `Y`, the corners of a `Z` — and spacing purely by arc length
 * leaves those ends empty about as often as not, which turns a `L` into a
 * vague corner. So every stroke's two ends are claimed, and only what is left
 * is shared out along the strokes in proportion to their length.
 *
 * Below one performer per stroke there is nothing to be done but put them on
 * the longest strokes: a two-person `E` is not going to read, and pretending
 * otherwise by spreading them thinly is worse than admitting it.
 */
export function distributeAlongStrokes(
  strokes: GlyphStroke[],
  count: number,
): DrillPoint[] {
  const usable = strokes.filter((stroke) => stroke.length >= 2);
  if (count <= 0 || usable.length === 0) return [];

  const lengths = usable.map((stroke) => strokesLength([stroke]));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return Array.from({ length: count }, () => ({ ...usable[0][0] }));

  // Fewer performers than strokes: give them to the longest strokes, one each.
  if (count < usable.length) {
    return lengths
      .map((length, index) => ({ length, index }))
      .sort((a, b) => b.length - a.length)
      .slice(0, count)
      .map((entry) => pointAlong(usable[entry.index], lengths[entry.index] / 2));
  }

  /*
   * One performer per stroke, then a second on the longest strokes so their
   * ends are claimed, then everything left over shared by length.
   *
   * The middle step is the one that is easy to skip: with four strokes and five
   * performers there is no way to claim every end, so the fifth goes to the
   * longest stroke, where a missing endpoint shows most. Handing every stroke
   * two before checking whether there are two to hand out is how a four-person
   * E ends up placing eight people.
   */
  const perStroke = usable.map(() => 1);
  let spare = count - usable.length;

  const byLength = lengths
    .map((length, index) => ({ length, index }))
    .sort((a, b) => b.length - a.length);
  for (const entry of byLength) {
    if (spare <= 0) break;
    perStroke[entry.index] += 1;
    spare -= 1;
  }

  if (spare > 0) {
    const quotas = lengths.map((length) => (spare * length) / total);
    const whole = quotas.map((quota) => Math.floor(quota));
    let left = spare - whole.reduce((sum, value) => sum + value, 0);
    const byRemainder = quotas
      .map((quota, index) => ({ index, remainder: quota - Math.floor(quota) }))
      .sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; left > 0; i += 1, left -= 1) {
      whole[byRemainder[i % byRemainder.length].index] += 1;
    }
    for (let i = 0; i < perStroke.length; i += 1) perStroke[i] += whole[i];
  }

  const out: DrillPoint[] = [];
  usable.forEach((stroke, index) => {
    const on = perStroke[index];
    const length = lengths[index];
    if (on <= 0) return;
    if (on === 1) {
      out.push(pointAlong(stroke, length / 2));
      return;
    }
    // Inclusive of both ends: `on - 1` gaps between `on` people.
    for (let i = 0; i < on; i += 1) {
      out.push(pointAlong(stroke, (length * i) / (on - 1)));
    }
  });
  return out;
}
