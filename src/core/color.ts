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
 * Small colour helpers for field rendering.
 *
 * Kept here rather than in a component because the canvas and the PDF exporter
 * both need to derive the same shades — mowing stripes, for instance, must be
 * the same lightening of the same turf colour in both, or a printed chart will
 * not match the screen.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Parse `#rgb` or `#rrggbb`. Returns null for anything else. */
export function parseHex(hex: string): Rgb | null {
  const value = hex.trim().replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((character) => character + character)
          .join('')
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

const clampChannel = (value: number): number =>
  Math.max(0, Math.min(255, Math.round(value)));

export function toHex({ r, g, b }: Rgb): string {
  const part = (value: number) => clampChannel(value).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

/**
 * Move a colour toward white (positive amount) or black (negative), where 1
 * is fully white and -1 fully black. Invalid input is returned untouched so a
 * bad colour never turns the field into a blank rectangle.
 */
export function shade(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const target = amount >= 0 ? 255 : 0;
  const strength = Math.min(1, Math.abs(amount));
  return toHex({
    r: rgb.r + (target - rgb.r) * strength,
    g: rgb.g + (target - rgb.g) * strength,
    b: rgb.b + (target - rgb.b) * strength,
  });
}

export function lighten(hex: string, amount: number): string {
  return shade(hex, Math.abs(amount));
}

export function darken(hex: string, amount: number): string {
  return shade(hex, -Math.abs(amount));
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const channel = (value: number): number => {
    const srgb = value / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** Black or white, whichever reads better on the given background. */
export function readableInkOn(hex: string): string {
  return relativeLuminance(hex) > 0.45 ? '#111111' : '#FFFFFF';
}

/** WCAG contrast ratio between two colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Whether a colour string is usable as a fill. */
export function isValidHex(hex: string): boolean {
  return parseHex(hex) !== null;
}
