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

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MINIMUM_COMFORTABLE_WIDTH,
  assessDevice,
  deviceAdvice,
  type DeviceReading,
} from '../device.ts';

const desktop: DeviceReading = {
  mobileHint: false,
  coarsePointer: false,
  canHover: true,
  viewportWidth: 1680,
};

test('a desktop with a mouse is left alone', () => {
  assert.equal(assessDevice(desktop), 'none');
  assert.equal(deviceAdvice('none'), null);
});

test('a phone is told to use a computer', () => {
  // Chromium says so outright.
  assert.equal(
    assessDevice({ mobileHint: true, coarsePointer: true, canHover: false, viewportWidth: 390 }),
    'touch',
  );
  // And on a browser with no such hint, fingers plus no hover is the same thing.
  assert.equal(
    assessDevice({ mobileHint: null, coarsePointer: true, canHover: false, viewportWidth: 390 }),
    'touch',
  );
});

test('an iPad is caught even though it claims to be a desktop', () => {
  // iPadOS has reported itself as desktop Safari since version 13, which is why
  // this asks about the pointer rather than about the user agent.
  assert.equal(
    assessDevice({
      mobileHint: null,
      coarsePointer: true,
      canHover: false,
      viewportWidth: 1180,
    }),
    'touch',
  );
});

test('a touchscreen laptop is not mistaken for a tablet', () => {
  // It has a coarse pointer available and a fine one in use. Telling its owner
  // to switch to a computer would be wrong and faintly insulting — which is
  // why the primary pointer is what gets asked about, not `any-pointer`.
  assert.equal(
    assessDevice({
      mobileHint: false,
      coarsePointer: false,
      canHover: true,
      viewportWidth: 1512,
    }),
    'none',
  );
});

test('a narrow window on a real computer gets different advice', () => {
  const concern = assessDevice({ ...desktop, viewportWidth: 720 });
  assert.equal(concern, 'narrow');
  // And it says something a person can act on, rather than telling them to go
  // and find a computer they are already sitting at.
  assert.match(deviceAdvice(concern)!.body, /Widening the window/);
});

test('the width threshold is applied at its edge, not around it', () => {
  assert.equal(assessDevice({ ...desktop, viewportWidth: MINIMUM_COMFORTABLE_WIDTH }), 'none');
  assert.equal(assessDevice({ ...desktop, viewportWidth: MINIMUM_COMFORTABLE_WIDTH - 1 }), 'narrow');
});

test('an unknown width is not treated as a tiny one', () => {
  // Server-side rendering, or a browser that has not laid out yet. Silence is
  // better than a warning based on a zero.
  assert.equal(assessDevice({ ...desktop, viewportWidth: 0 }), 'none');
});

test('touch takes precedence over width', () => {
  // A phone in landscape can be wider than the threshold; it is still a phone.
  assert.equal(
    assessDevice({ mobileHint: true, coarsePointer: true, canHover: false, viewportWidth: 1024 }),
    'touch',
  );
});

test('every concern that warns has something to say', () => {
  for (const concern of ['touch', 'narrow'] as const) {
    const advice = deviceAdvice(concern);
    assert.ok(advice && advice.title.length > 0 && advice.body.length > 40, concern);
  }
});
