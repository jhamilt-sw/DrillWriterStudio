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
 * About: who made this, when, and on what terms.
 *
 * Everything shown here is read from `core/app.ts` rather than typed into the
 * markup, so the About box cannot quietly disagree with the file headers, the
 * PDF metadata or the package manifest — which is the usual fate of an About
 * box, and the reason nobody trusts the version number in one.
 */

import {
  APP_AI_NOTICE,
  APP_ATTRIBUTION_REQUEST,
  APP_AUTHOR,
  APP_COPYRIGHT,
  APP_CREATED,
  APP_LICENSE,
  APP_NAME,
  APP_VERSION,
} from '../../core/app.ts';

export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`About ${APP_NAME}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog dialog--narrow">
        <div className="dialog__header">
          <h2 className="dialog__title">About {APP_NAME}</h2>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="dialog__body">
          <p className="about__lede">
            Marching band drill design, in the browser. Build formations set by
            set, align them to music, watch them from the stands, and print the
            coordinate sheets a band can rehearse from.
          </p>

          <dl className="about__facts">
            <dt>Created by</dt>
            <dd>{APP_AUTHOR}</dd>
            <dt>First written</dt>
            <dd>{APP_CREATED}</dd>
            <dt>Version</dt>
            <dd>{APP_VERSION}</dd>
            <dt>License</dt>
            <dd>{APP_LICENSE}</dd>
          </dl>

          <p className="about__copyright">{APP_COPYRIGHT}</p>

          <p className="hint">{APP_ATTRIBUTION_REQUEST}</p>
          <p className="hint">{APP_AI_NOTICE}</p>
          <p className="hint">
            Third-party components and their licenses are listed in{' '}
            <code>THIRD_PARTY_LICENSES.md</code>. Nothing in this application
            sends your work anywhere: shows, audio and logos stay on this
            machine.
          </p>
        </div>

        <div className="dialog__footer">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
