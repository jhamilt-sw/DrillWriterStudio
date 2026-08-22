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
 * Default ensemble sections.
 *
 * Colours come from Paul Tol's qualitative "bright"/"muted" sets, which stay
 * distinguishable under deuteranopia, protanopia and tritanopia (NFR-3). Shape
 * is varied alongside colour so a chart is still readable in greyscale or by a
 * reader who cannot separate two hues.
 */

import type { PerformerSymbol, Section } from './types.ts';

export interface SectionTemplate {
  name: string;
  abbreviation: string;
  color: string;
  symbol: PerformerSymbol;
}

export const SECTION_TEMPLATES: SectionTemplate[] = [
  { name: 'Trumpet', abbreviation: 'TP', color: '#4477AA', symbol: 'circle' },
  { name: 'Mellophone', abbreviation: 'MP', color: '#66CCEE', symbol: 'circle' },
  { name: 'Baritone', abbreviation: 'BR', color: '#228833', symbol: 'circle' },
  { name: 'Tuba', abbreviation: 'TU', color: '#CCBB44', symbol: 'square' },
  { name: 'Flute', abbreviation: 'FL', color: '#EE6677', symbol: 'diamond' },
  { name: 'Clarinet', abbreviation: 'CL', color: '#AA3377', symbol: 'diamond' },
  { name: 'Alto Sax', abbreviation: 'AS', color: '#BBBBBB', symbol: 'diamond' },
  { name: 'Snare', abbreviation: 'SN', color: '#332288', symbol: 'square' },
  { name: 'Tenor', abbreviation: 'TN', color: '#88CCEE', symbol: 'square' },
  { name: 'Bass Drum', abbreviation: 'BD', color: '#117733', symbol: 'square' },
  { name: 'Cymbals', abbreviation: 'CY', color: '#999933', symbol: 'square' },
  { name: 'Front Ensemble', abbreviation: 'FE', color: '#DDCC77', symbol: 'square' },
  { name: 'Colour Guard', abbreviation: 'CG', color: '#CC6677', symbol: 'triangle' },
  { name: 'Drum Major', abbreviation: 'DM', color: '#000000', symbol: 'triangle' },
];

/** Colours offered when the user adds a section of their own. */
export const SECTION_PALETTE: string[] = [
  '#4477AA',
  '#66CCEE',
  '#228833',
  '#CCBB44',
  '#EE6677',
  '#AA3377',
  '#332288',
  '#88CCEE',
  '#117733',
  '#999933',
  '#DDCC77',
  '#CC6677',
  '#882255',
  '#44AA99',
  '#BBBBBB',
  '#000000',
];

export function sectionFromTemplate(template: SectionTemplate, id: string): Section {
  return { id, ...template };
}

/**
 * Readable text colour for a filled marker, using the WCAG relative-luminance
 * rule rather than a naive brightness average.
 */
export function contrastingTextColor(hex: string): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const channel = (offset: number): number => {
    const srgb = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
  return luminance > 0.45 ? '#111111' : '#FFFFFF';
}
