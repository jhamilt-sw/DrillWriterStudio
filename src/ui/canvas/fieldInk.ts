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

import type { FieldAppearance } from '../../core/types.ts';
import { darken, lighten, readableInkOn } from '../../core/color.ts';

/**
 * Colours for everything drawn *on* the field — paths, ghosts, labels.
 *
 * Derived from the turf rather than from the app's light/dark theme, because
 * these marks sit on the playing surface, not on a panel. A dark grey path that
 * reads well on a white page disappears on green grass; on a "Paper" turf the
 * same derivation gives back the dark ink that page wants.
 */
export interface FieldInk {
  path: string;
  pathStrong: string;
  ghost: string;
  label: string;
  strain: string;
}

export function fieldInk(appearance: FieldAppearance): FieldInk {
  const ink = readableInkOn(appearance.turfColor);
  const onDarkTurf = ink === '#FFFFFF';
  return {
    // Paths need to be visible without competing with the white paint, so they
    // sit a step away from the ink colour rather than on it.
    path: onDarkTurf ? lighten(appearance.turfColor, 0.55) : darken(appearance.turfColor, 0.45),
    pathStrong: onDarkTurf ? lighten(appearance.turfColor, 0.8) : darken(appearance.turfColor, 0.7),
    ghost: onDarkTurf ? lighten(appearance.turfColor, 0.45) : darken(appearance.turfColor, 0.35),
    label: ink,
    // Amber reads as a warning on grass and on paper alike.
    strain: onDarkTurf ? '#ffc247' : '#b45309',
  };
}
