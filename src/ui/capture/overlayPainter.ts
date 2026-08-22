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
 * The set readout, painted into the recorded frames.
 *
 * A run-through video with no set numbers on it is much less useful than one
 * with them: the whole reason to send a video to a staff member is so they can
 * say "the problem is going into 14". The on-screen overlay is HTML, and HTML
 * is not part of a canvas — so recording the canvas alone would silently drop
 * it. This paints an equivalent directly into the captured frame.
 *
 * Sized in proportion to the frame rather than in fixed pixels, so the same
 * code produces a readable bar at 720p and at 4K.
 */

import type { SetContext } from '../../core/setContext.ts';

export function paintSetOverlay(
  context: CanvasRenderingContext2D,
  frame: { width: number; height: number },
  reading: SetContext,
): void {
  const unit = frame.height / 1080;
  const barHeight = Math.round(96 * unit);
  const pad = Math.round(28 * unit);
  const top = frame.height - barHeight - pad;
  const width = Math.min(frame.width - pad * 2, Math.round(900 * unit));
  const left = Math.round((frame.width - width) / 2);
  const radius = Math.round(10 * unit);

  context.save();

  // A dark plate, so the text reads over bright turf as well as over shadow.
  context.beginPath();
  context.roundRect?.(left, top, width, barHeight, radius);
  if (!context.roundRect) context.rect(left, top, width, barHeight);
  context.fillStyle = 'rgba(9, 13, 18, 0.74)';
  context.fill();
  context.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  context.lineWidth = Math.max(1, unit);
  context.stroke();

  const column = width / 3;
  const cells: { role: string; label: string; detail: string; current: boolean }[] = [
    {
      role: 'PREVIOUS',
      label: reading.previous ? `Set ${reading.previous.label}` : '—',
      detail: reading.previous ? `${reading.previous.counts} counts` : 'top of show',
      current: false,
    },
    {
      role: 'CURRENT',
      label: `Set ${reading.current.label}`,
      detail: `${reading.countsRemaining} to go`,
      current: true,
    },
    {
      role: 'NEXT',
      label: reading.next ? `Set ${reading.next.label}` : '—',
      detail: reading.next ? `${reading.next.counts} counts` : 'end of show',
      current: false,
    },
  ];

  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  cells.forEach((cell, index) => {
    const centre = left + column * index + column / 2;
    context.fillStyle = 'rgba(255, 255, 255, 0.55)';
    context.font = `${Math.round(13 * unit)}px system-ui, sans-serif`;
    context.fillText(cell.role, centre, top + Math.round(26 * unit));

    context.fillStyle = cell.current ? '#8fc4ff' : 'rgba(255, 255, 255, 0.82)';
    context.font = `600 ${Math.round(cell.current ? 34 : 26) * 1}px system-ui, sans-serif`;
    context.font = `600 ${Math.round((cell.current ? 34 : 26) * unit)}px system-ui, sans-serif`;
    context.fillText(cell.label, centre, top + Math.round(60 * unit));

    context.fillStyle = 'rgba(255, 255, 255, 0.6)';
    context.font = `${Math.round(15 * unit)}px system-ui, sans-serif`;
    context.fillText(cell.detail, centre, top + Math.round(82 * unit));
  });

  // Progress through the current move, along the foot of the plate.
  const progressWidth = Math.max(0, Math.min(1, reading.progress)) * width;
  context.fillStyle = '#58a6ff';
  context.fillRect(left, top + barHeight - Math.max(2, 3 * unit), progressWidth, Math.max(2, 3 * unit));

  context.restore();
}
