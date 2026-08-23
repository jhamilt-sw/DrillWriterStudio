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
 * Whether this device can comfortably be used to write drill.
 *
 * Not "is it a phone". User-agent sniffing answers that question badly — an
 * iPad has reported itself as desktop Safari since iPadOS 13, and every list of
 * device strings is out of date the week it is written. The question that
 * actually matters here is whether the person has the two things this editor
 * needs: a **precise pointer**, for dragging one marcher among two hundred and
 * for right-clicking to align, and **width**, for a field with panels either
 * side of it. Ask about those directly and the answer stays correct on hardware
 * nobody has built yet.
 *
 * Pure, so the rules can be tested against every awkward device without owning
 * one. The caller reads the browser and passes the numbers in.
 */

/** What the browser reports about how it is being used. */
export interface DeviceReading {
  /**
   * `navigator.userAgentData.mobile`, where the browser offers it.
   *
   * Authoritative when present — the browser is stating it, rather than us
   * guessing from a string. Null on browsers without User-Agent Client Hints,
   * which is most of them outside Chromium.
   */
  mobileHint: boolean | null;
  /** `(pointer: coarse)` — the *primary* pointer is a finger. */
  coarsePointer: boolean;
  /** `(hover: hover)` — the primary pointer can hover, as a mouse does. */
  canHover: boolean;
  viewportWidth: number;
}

/**
 * Below this, the field and both panels cannot be on screen together.
 *
 * Taken from the layout's own breakpoint rather than invented: the panels
 * narrow at 1100px, and below roughly this the editor stops being comfortable
 * regardless of what kind of pointer is driving it.
 */
export const MINIMUM_COMFORTABLE_WIDTH = 1000;

export type DeviceConcern =
  /** A phone or tablet: fingers, no hover. */
  | 'touch'
  /** A real pointer, but not enough room. */
  | 'narrow'
  /** Nothing to say. */
  | 'none';

/**
 * What, if anything, to tell the user about their device.
 *
 * Deliberately checks the *primary* pointer rather than `any-pointer`. A
 * touchscreen laptop has a coarse pointer available and a fine one in use;
 * warning its owner that they should switch to a computer would be both wrong
 * and slightly insulting.
 */
export function assessDevice(reading: DeviceReading): DeviceConcern {
  if (reading.mobileHint === true) return 'touch';
  // A browser that says it is *not* mobile is believed, but its screen is not:
  // a desktop browser in a narrow window is still a narrow window.
  if (reading.mobileHint !== false && reading.coarsePointer && !reading.canHover) {
    return 'touch';
  }
  if (reading.viewportWidth > 0 && reading.viewportWidth < MINIMUM_COMFORTABLE_WIDTH) {
    return 'narrow';
  }
  return 'none';
}

/** The heading and body for each concern. One place, so the two cannot drift. */
export function deviceAdvice(concern: DeviceConcern): {
  title: string;
  body: string;
} | null {
  switch (concern) {
    case 'touch':
      return {
        title: 'Best used on a computer',
        body:
          'Drill is written by dragging individual marchers, right-clicking to ' +
          'align them, and reading a whole field at once — none of which a ' +
          'touchscreen does well. You are welcome to look around on this ' +
          'device, but open DrillWriter Studio on a laptop or desktop when you ' +
          'sit down to write.',
      };
    case 'narrow':
      return {
        title: 'This window is quite narrow',
        body:
          'The field needs room, with the roster on one side and the tools on ' +
          'the other. Widening the window — or moving to a larger screen — ' +
          'makes everything easier to reach.',
      };
    default:
      return null;
  }
}
