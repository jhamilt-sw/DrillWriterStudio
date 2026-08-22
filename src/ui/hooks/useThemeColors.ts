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

import { useEffect, useState } from 'react';

import type { FieldColors } from '../canvas/FieldGraphics.tsx';

const FALLBACK: FieldColors = {
  turf: '#ffffff',
  line: '#9aa3ad',
  lineStrong: '#6d7681',
  hash: '#6d7681',
  number: '#7b838d',
  endZone: '#f0f2f4',
  grid: '#e9ecef',
};

function readColors(): FieldColors {
  if (typeof window === 'undefined') return FALLBACK;
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    turf: read('--field-turf', FALLBACK.turf),
    line: read('--field-line', FALLBACK.line),
    lineStrong: read('--field-line-strong', FALLBACK.lineStrong),
    hash: read('--field-hash', FALLBACK.hash),
    number: read('--field-number', FALLBACK.number),
    endZone: read('--field-endzone', FALLBACK.endZone),
    grid: read('--border', FALLBACK.grid),
  };
}

/**
 * Canvas has no access to CSS custom properties, so the field's palette is read
 * out of the stylesheet and handed to Konva — and re-read when the OS theme
 * flips, so the field does not stay light inside a dark app.
 */
export function useThemeColors(): FieldColors {
  const [colors, setColors] = useState<FieldColors>(readColors);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setColors(readColors());
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return colors;
}
