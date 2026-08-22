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
 * The 3D playback view in whichever of its two homes is wanted: full screen
 * over the editor, or a window of its own.
 *
 * Both exist because both are real situations. On one laptop screen, full
 * screen is the only way to see anything; in a band room with a projector, the
 * stadium belongs on the second display while the drill stays on the first.
 * The same component renders in either case — only the container changes.
 */

import { Suspense, lazy, useEffect, useState } from 'react';

import { APP_NAME } from '../../core/app.ts';
import { PopoutWindow } from './PopoutWindow.tsx';

/*
 * three.js is loaded only when someone opens the 3D view.
 *
 * It is by far the largest dependency in the project, and a drill designer who
 * never opens this window should not pay for it on every page load — which
 * matters most on the static host this ships to, where the whole app is
 * downloaded before anything appears.
 */
const StadiumViewport = lazy(() =>
  import('./StadiumViewport.tsx').then((module) => ({ default: module.StadiumViewport })),
);

function Loading() {
  return <div className="stadium__loading">Starting the stadium…</div>;
}

export type PlaybackMode = 'closed' | 'fullscreen' | 'popout';

export function PlaybackWindow({
  mode,
  onModeChange,
}: {
  mode: PlaybackMode;
  onModeChange: (mode: PlaybackMode) => void;
}) {
  const [blocked, setBlocked] = useState(false);

  // Escape closes the full-screen view, the way it closes every other overlay
  // in the app. In a popped-out window the browser's own close button is the
  // obvious exit, so Escape there would be a surprise.
  useEffect(() => {
    if (mode !== 'fullscreen') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onModeChange('closed');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, onModeChange]);

  if (mode === 'closed') return null;

  if (mode === 'popout') {
    return (
      <PopoutWindow
        title={`${APP_NAME} — 3D playback`}
        onClose={() => {
          // Reached both when the user closes the window and when the browser
          // refused to open it. Falling back to full screen means a popup
          // blocker costs the user a window, not the feature.
          setBlocked(true);
          onModeChange('fullscreen');
        }}
      >
        <Suspense fallback={<Loading />}>
          <StadiumViewport poppedOut onClose={() => onModeChange('closed')} />
        </Suspense>
      </PopoutWindow>
    );
  }

  return (
    <div className="stadium-fullscreen" role="dialog" aria-label="3D playback">
      {blocked && (
        <div className="alert alert--warning stadium-fullscreen__notice" role="alert">
          Your browser blocked the pop-out window. Allow pop-ups for this site to
          put the stadium on a second screen — showing it here instead.
        </div>
      )}
      <Suspense fallback={<Loading />}>
        <StadiumViewport
          poppedOut={false}
          onPopOut={() => {
            setBlocked(false);
            onModeChange('popout');
          }}
          onClose={() => onModeChange('closed')}
        />
      </Suspense>
    </div>
  );
}
