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
 * The previous / current / next readout over the 3D view.
 *
 * What a director calls from the tower, in the order they call it: where we
 * came from, where we are going, how many counts are left, and what is next.
 * Everything shown here comes from `setContextAtCount`, the same reading the
 * timeline uses, so the overlay cannot drift out of step with the playhead.
 */

import { describeMusicPosition, type SetContext, type SetSummary } from '../../core/setContext.ts';

function SetCard({
  summary,
  role,
  context,
}: {
  summary: SetSummary | null;
  role: 'previous' | 'current' | 'next';
  context?: SetContext;
}) {
  if (!summary) {
    return (
      <div className={`set-card set-card--${role} set-card--empty`}>
        <div className="set-card__role">{role}</div>
        <div className="set-card__label">—</div>
        <div className="set-card__detail">
          {role === 'previous' ? 'top of the show' : 'end of the show'}
        </div>
      </div>
    );
  }

  const music = describeMusicPosition(summary);
  return (
    <div className={`set-card set-card--${role}`}>
      <div className="set-card__role">{role}</div>
      <div className="set-card__label">Set {summary.label}</div>
      <div className="set-card__detail">
        {role === 'current' && context ? (
          <>
            <strong>{context.countsRemaining}</strong> to go
            {summary.counts > 0 && (
              <span className="set-card__muted">
                {' '}
                · {context.countsIn}/{summary.counts}
              </span>
            )}
          </>
        ) : (
          <>
            {summary.counts} counts
            {music && <span className="set-card__muted"> · {music}</span>}
          </>
        )}
      </div>
      {role === 'current' && summary.notes && (
        <div className="set-card__notes">{summary.notes}</div>
      )}
    </div>
  );
}

export function SetOverlay({ context }: { context: SetContext }) {
  return (
    <div className="set-overlay" role="status" aria-live="off">
      <SetCard summary={context.previous} role="previous" />
      <SetCard summary={context.current} role="current" context={context} />
      <SetCard summary={context.next} role="next" />
      <div
        className="set-overlay__progress"
        // A bar reads faster than a number at a glance across a rehearsal room.
        style={{ ['--progress' as string]: `${Math.round(context.progress * 100)}%` }}
        aria-hidden="true"
      >
        <span />
      </div>
    </div>
  );
}
