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
 * A word about the device, shown once.
 *
 * Deliberately dismissible rather than blocking. Somebody opening the link on a
 * phone to see what it is should be able to look around; the notice is there so
 * they do not conclude the application is broken when a drag does not work the
 * way they expect.
 */

import { APP_NAME } from '../../core/app.ts';
import { type DeviceConcern, deviceAdvice } from '../../core/device.ts';

export function DeviceNoticeDialog({
  concern,
  onDismiss,
}: {
  concern: DeviceConcern;
  onDismiss: () => void;
}) {
  const advice = deviceAdvice(concern);
  if (!advice) return null;

  return (
    <div
      className="dialog-backdrop"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="device-notice-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <div className="dialog dialog--narrow">
        <div className="dialog__header">
          <h2 className="dialog__title" id="device-notice-title">
            {advice.title}
          </h2>
        </div>

        <div className="dialog__body">
          <p style={{ marginTop: 0 }}>{advice.body}</p>
          {concern === 'touch' && (
            <p className="hint">
              {APP_NAME} keeps your work in this browser, so a show started here
              will not be waiting for you on the computer. Save the file and
              carry it across.
            </p>
          )}
        </div>

        <div className="dialog__footer">
          <button type="button" className="btn btn--primary" onClick={onDismiss}>
            Continue anyway
          </button>
        </div>
      </div>
    </div>
  );
}
