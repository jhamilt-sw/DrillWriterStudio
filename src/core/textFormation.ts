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
 * Spelling something out on the field.
 *
 * Two problems, and the second is the interesting one. Laying out the glyphs is
 * ordinary typesetting: measure each advance, add letter spacing, centre the
 * result. Deciding *how many people go in each letter* is the part with no
 * typographic equivalent — an ensemble is a fixed number of bodies, and a `W`
 * needs more of them than an `I` to read at the same height.
 *
 * They are shared out in proportion to stroke length, which is the closest
 * thing to "how much line there is to stand on". Largest-remainder
 * apportionment then settles the fractions, so the spare performers go to the
 * letters with the most left over rather than all landing on the first word.
 */

import { assignByMinimalTravel } from './assignment.ts';
import {
  type Glyph,
  distributeAlongStrokes,
  glyphFor,
  placeStrokes,
  strokesLength,
  unsupportedCharacters,
} from './glyphs.ts';
import type { DrillPoint } from './types.ts';

export interface TextOptions {
  /** Cap height, in steps. */
  heightSteps: number;
  /** Gap between glyphs, in steps. */
  letterSpacingSteps: number;
  /** Where the middle of the finished word sits. */
  center: DrillPoint;
}

export const DEFAULT_TEXT_OPTIONS: Omit<TextOptions, 'center'> = {
  heightSteps: 12,
  letterSpacingSteps: 1.5,
};

/** Minimum and maximum cap height a letter can usefully be written at. */
export const MIN_TEXT_HEIGHT = 2;
export const MAX_TEXT_HEIGHT = 60;

export interface PlacedGlyph {
  character: string;
  glyph: Glyph;
  /** Bottom-left corner on the field. */
  origin: DrillPoint;
  widthSteps: number;
  /** Length of the glyph's strokes once scaled onto the field. */
  strokeLength: number;
}

/** Characters that consume width but need nobody standing on them. */
function isBlank(glyph: Glyph): boolean {
  return glyph.strokes.length === 0;
}

/**
 * Measure and place every glyph in a string.
 *
 * Returns an empty layout for text with nothing drawable in it — a string of
 * spaces has a width but no letters, and callers should say "type something"
 * rather than move the ensemble nowhere.
 */
export function layoutText(
  text: string,
  options: TextOptions,
): { glyphs: PlacedGlyph[]; widthSteps: number; heightSteps: number } {
  const height = Math.max(MIN_TEXT_HEIGHT, Math.min(MAX_TEXT_HEIGHT, options.heightSteps));
  const spacing = Math.max(0, options.letterSpacingSteps);

  const measured = [...text]
    .map((character) => ({ character, glyph: glyphFor(character) }))
    .filter(
      (entry): entry is { character: string; glyph: Glyph } => entry.glyph !== null,
    );
  if (measured.length === 0) return { glyphs: [], widthSteps: 0, heightSteps: height };

  const widths = measured.map((entry) => entry.glyph.advance * height);
  const totalWidth =
    widths.reduce((sum, width) => sum + width, 0) + spacing * (measured.length - 1);

  // Lay out from the left edge, then centre the whole word on the requested
  // point. Centring at the end rather than tracking a signed cursor keeps the
  // arithmetic in one place.
  const left = options.center.x - totalWidth / 2;
  const bottom = options.center.y - height / 2;

  const glyphs: PlacedGlyph[] = [];
  let cursor = left;
  measured.forEach((entry, index) => {
    const widthSteps = widths[index];
    const origin = { x: cursor, y: bottom };
    glyphs.push({
      character: entry.character,
      glyph: entry.glyph,
      origin,
      widthSteps,
      strokeLength: strokesLength(
        placeStrokes(entry.glyph.strokes, origin, widthSteps, height),
      ),
    });
    cursor += widthSteps + spacing;
  });

  return { glyphs, widthSteps: totalWidth, heightSteps: height };
}

/** How wide a string will be, for showing before anyone commits to it. */
export function measureText(text: string, options: TextOptions): number {
  return layoutText(text, options).widthSteps;
}

export interface TextAllocation {
  character: string;
  count: number;
}

/**
 * Share `count` performers between the glyphs of a laid-out string.
 *
 * Every drawable glyph gets at least one performer before length is considered:
 * a word with a letter missing entirely is not the word, and a `1` in a score
 * with nobody on it is a different score. Past that it is proportional to how
 * much stroke there is to stand on.
 */
export function allocatePerformers(
  glyphs: PlacedGlyph[],
  count: number,
): TextAllocation[] {
  const drawable = glyphs.filter((placed) => !isBlank(placed.glyph));
  if (drawable.length === 0 || count <= 0) {
    return glyphs.map((placed) => ({ character: placed.character, count: 0 }));
  }

  const allocation = new Map<PlacedGlyph, number>();
  // Fewer performers than letters: the ones that fit get one each, left to
  // right, and the caller warns about the rest. Silently dropping the tail of a
  // word is worse than a warning that says which letters will not appear.
  if (count <= drawable.length) {
    drawable.forEach((placed, index) => allocation.set(placed, index < count ? 1 : 0));
  } else {
    const total = drawable.reduce((sum, placed) => sum + placed.strokeLength, 0);
    const spare = count - drawable.length;
    const quotas = drawable.map((placed) =>
      total > 0 ? (spare * placed.strokeLength) / total : spare / drawable.length,
    );
    const whole = quotas.map((quota) => Math.floor(quota));
    let left = spare - whole.reduce((sum, value) => sum + value, 0);
    const byRemainder = quotas
      .map((quota, index) => ({ index, remainder: quota - Math.floor(quota) }))
      .sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; left > 0; i += 1, left -= 1) {
      whole[byRemainder[i % byRemainder.length].index] += 1;
    }
    drawable.forEach((placed, index) => allocation.set(placed, 1 + whole[index]));
  }

  return glyphs.map((placed) => ({
    character: placed.character,
    count: allocation.get(placed) ?? 0,
  }));
}

/**
 * Every position needed to spell `text` with `count` performers.
 *
 * The order of the returned points is the reading order of the word, but that
 * order is thrown away by the assignment step — see `formTextFrom` — so it
 * matters only for the preview.
 */
export function buildTextFormation(
  text: string,
  count: number,
  options: TextOptions,
): DrillPoint[] {
  const { glyphs, heightSteps } = layoutText(text, options);
  if (glyphs.length === 0 || count <= 0) return [];

  const allocation = allocatePerformers(glyphs, count);
  const points: DrillPoint[] = [];
  glyphs.forEach((placed, index) => {
    const share = allocation[index].count;
    if (share <= 0) return;
    const strokes = placeStrokes(
      placed.glyph.strokes,
      placed.origin,
      placed.widthSteps,
      heightSteps,
    );
    points.push(...distributeAlongStrokes(strokes, share));
  });
  return points;
}

export interface TextPlan {
  /** Where each performer should end up. Empty when nothing can be formed. */
  targets: Record<string, DrillPoint>;
  /** Per-glyph counts, for showing the designer before they commit. */
  allocation: TextAllocation[];
  widthSteps: number;
  heightSteps: number;
  /** Characters the font cannot draw, reported once each. */
  unsupported: string[];
  /** Set when there are too few performers to spell the word at all. */
  shortfall: number;
}

/**
 * Turn a selection into a word.
 *
 * The final step is the same optimal, non-crossing assignment every other
 * formation uses: performers are matched to letter positions by least total
 * distance marched, which — because the cost is plain distance — provably
 * leaves no two paths crossing. Spelling a word is where that matters most,
 * since the naive alternative sends the last person in the roster to the far
 * end of the field for no reason at all.
 */
export function planText(
  current: { id: string; point: DrillPoint }[],
  text: string,
  options: TextOptions,
): TextPlan {
  const layout = layoutText(text, options);
  const allocation = allocatePerformers(layout.glyphs, current.length);
  const drawable = layout.glyphs.filter((placed) => placed.glyph.strokes.length > 0);
  const targets = buildTextFormation(text, current.length, options);

  return {
    targets: assignByMinimalTravel(current, targets),
    allocation,
    widthSteps: layout.widthSteps,
    heightSteps: layout.heightSteps,
    unsupported: unsupportedCharacters(text),
    shortfall: Math.max(0, drawable.length - current.length),
  };
}
