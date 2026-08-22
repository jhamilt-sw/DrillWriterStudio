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
 * Field logos: which ones the canvas should respond to.
 *
 * A logo is a large image sitting under the drill, so an unlocked one competes
 * with the work happening on top of it — a press on bare turf that happens to
 * be over the crest grabs the crest instead of starting a marquee, and a drag
 * meant for a rank of trumpets slides the logo instead.
 *
 * Locking is therefore about *interaction*, not visibility: a locked logo is
 * still painted, it simply stops being a target. Since logos are placed once at
 * the start of a season and the drill is written over it for months, locked is
 * the state most logos spend their life in.
 */

import type { FieldLogo } from './types.ts';

/**
 * Whether the canvas should let this logo be selected or dragged.
 *
 * Three independent reasons to say no, and all of them matter: a hidden logo
 * has nothing to grab, a locked one is deliberately inert, and nothing at all
 * is interactive while the show is playing.
 */
export function isLogoInteractive(logo: FieldLogo, editing: boolean): boolean {
  return editing && logo.visible && !logo.locked;
}

/** The logos the canvas can currently act on. */
export function interactiveLogos(logos: FieldLogo[], editing: boolean): FieldLogo[] {
  return logos.filter((logo) => isLogoInteractive(logo, editing));
}

/** True when every logo is locked — drives the "unlock all" affordance. */
export function allLogosLocked(logos: FieldLogo[]): boolean {
  return logos.length > 0 && logos.every((logo) => logo.locked);
}

/** Set the lock on every logo at once. */
export function setAllLogosLocked(logos: FieldLogo[], locked: boolean): FieldLogo[] {
  return logos.map((logo) => (logo.locked === locked ? logo : { ...logo, locked }));
}

/** How many logos are currently out of the way. */
export function lockedCount(logos: FieldLogo[]): number {
  return logos.filter((logo) => logo.locked).length;
}
