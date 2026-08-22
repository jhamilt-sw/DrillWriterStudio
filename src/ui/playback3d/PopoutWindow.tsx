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
 * A real second browser window, rendered into with a portal.
 *
 * The window is opened by the browser but the React tree inside it is still
 * *this* tree — a portal, not a second app. That matters more than it sounds:
 * the store, the audio engine and the tempo map are the same JavaScript objects
 * in both windows, so the 3D view follows the editor's playhead with no message
 * passing, no serialisation, and nothing to fall out of sync. Put the stadium
 * on the projector and keep writing drill on the laptop.
 *
 * The cost is that the child window has no stylesheet of its own, so this
 * copies the parent's across on open and watches for new ones — Vite injects
 * styles as <style> tags during development, and a window opened before a
 * hot-reload would otherwise slowly lose its formatting.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

function copyStyles(source: Document, target: Document): void {
  target.head.querySelectorAll('[data-copied-style]').forEach((node) => node.remove());
  source.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    const copy = node.cloneNode(true) as HTMLElement;
    copy.setAttribute('data-copied-style', 'true');
    target.head.appendChild(copy);
  });
}

export function PopoutWindow({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const popup = window.open(
      '',
      'drill-writer-3d',
      'width=1280,height=760,menubar=no,toolbar=no,location=no',
    );
    if (!popup) {
      // Blocked. The caller falls back to full screen in the main window.
      onClose();
      return;
    }

    popup.document.title = title;
    const host = popup.document.createElement('div');
    host.className = 'popout-root';
    popup.document.body.appendChild(host);
    popup.document.body.style.margin = '0';
    copyStyles(document, popup.document);

    // Vite adds stylesheets after load in development; without this the popped
    // out window keeps whatever CSS existed at the moment it opened.
    const observer = new MutationObserver(() => copyStyles(document, popup.document));
    observer.observe(document.head, { childList: true });

    setContainer(host);

    // Closing the window from its own title bar has to reach React, or the app
    // goes on believing the view is open and the button says "Close" forever.
    const handleUnload = () => onClose();
    popup.addEventListener('beforeunload', handleUnload);
    // A parent that navigates away or reloads must not leave an orphan window.
    const closeChild = () => popup.close();
    window.addEventListener('beforeunload', closeChild);

    return () => {
      observer.disconnect();
      popup.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('beforeunload', closeChild);
      setContainer(null);
      popup.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!container) return null;
  return createPortal(children, container);
}

/** Whether this browser will let us open a window at all. */
export function popupsLikelyAllowed(): boolean {
  return typeof window !== 'undefined' && typeof window.open === 'function';
}
