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
 * Read the browser, decide whether to say something about the device, and
 * remember the answer once the user has dismissed it.
 *
 * The rules live in `core/device.ts`; this is only the part that touches the
 * browser and `localStorage`.
 */

import { useCallback, useState } from 'react';

import { type DeviceConcern, assessDevice } from '../../core/device.ts';

const DISMISSED_KEY = 'drillwriter.device-notice.dismissed';

/**
 * Whether the user has already been told and did not want to hear it again.
 *
 * Wrapped, because reading `localStorage` *throws* — not returns null — in a
 * private window and wherever site data is blocked. An unreadable preference
 * is not a reason to fail to start.
 */
function alreadyDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function remember(): void {
  try {
    window.localStorage.setItem(DISMISSED_KEY, 'true');
  } catch {
    // The notice will appear again next time. That is a small annoyance, and
    // the alternative is refusing to dismiss it at all.
  }
}

function media(query: string): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

export interface DeviceNotice {
  concern: DeviceConcern;
  /** True while the notice should be on screen. */
  open: boolean;
  dismiss: () => void;
}

export function useDeviceNotice(): DeviceNotice {
  /*
   * Assessed once, when the app starts.
   *
   * Not on every resize: someone dragging their window narrower for a moment
   * does not want a dialog in the way, and a notice that reappears while you
   * are working is worse than one you never saw.
   */
  const [concern] = useState<DeviceConcern>(() => {
    if (typeof window === 'undefined') return 'none';
    const userAgentData = (
      navigator as Navigator & { userAgentData?: { mobile?: boolean } }
    ).userAgentData;
    return assessDevice({
      mobileHint: typeof userAgentData?.mobile === 'boolean' ? userAgentData.mobile : null,
      coarsePointer: media('(pointer: coarse)'),
      canHover: media('(hover: hover)'),
      viewportWidth: window.innerWidth,
    });
  });

  const [dismissed, setDismissed] = useState(() => alreadyDismissed());

  const dismiss = useCallback(() => {
    remember();
    setDismissed(true);
  }, []);

  return { concern, open: concern !== 'none' && !dismissed, dismiss };
}
