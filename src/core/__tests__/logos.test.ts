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
  allLogosLocked,
  interactiveLogos,
  isLogoInteractive,
  lockedCount,
  setAllLogosLocked,
} from '../logos.ts';
import type { FieldLogo } from '../types.ts';

const logo = (patch: Partial<FieldLogo> = {}): FieldLogo => ({
  id: 'logo1',
  name: 'Crest',
  dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
  center: { x: 80, y: 42 },
  widthSteps: 40,
  heightSteps: 24,
  rotationDegrees: 0,
  opacity: 0.85,
  visible: true,
  lockAspect: true,
  locked: false,
  ...patch,
});

test('an unlocked, visible logo is interactive while editing', () => {
  assert.equal(isLogoInteractive(logo(), true), true);
});

test('a locked logo is never interactive, however it is drawn', () => {
  assert.equal(isLogoInteractive(logo({ locked: true }), true), false);
  // Still painted — locking is about interaction, not visibility.
  assert.equal(logo({ locked: true }).visible, true);
});

test('a hidden logo has nothing to grab', () => {
  assert.equal(isLogoInteractive(logo({ visible: false }), true), false);
});

test('nothing is interactive while the show is playing', () => {
  assert.equal(isLogoInteractive(logo(), false), false);
  assert.equal(isLogoInteractive(logo({ locked: true }), false), false);
});

test('locking is independent of the aspect lock', () => {
  // Two different "locks" live on this object; confusing them would either
  // freeze a logo nobody meant to freeze or let a locked one be dragged.
  const squashable = logo({ lockAspect: false, locked: true });
  assert.equal(isLogoInteractive(squashable, true), false);
  const draggable = logo({ lockAspect: true, locked: false });
  assert.equal(isLogoInteractive(draggable, true), true);
});

test('the interactive set filters out locked and hidden logos', () => {
  const logos = [
    logo({ id: 'a' }),
    logo({ id: 'b', locked: true }),
    logo({ id: 'c', visible: false }),
    logo({ id: 'd' }),
  ];
  assert.deepEqual(
    interactiveLogos(logos, true).map((entry) => entry.id),
    ['a', 'd'],
  );
  assert.deepEqual(interactiveLogos(logos, false), []);
});

test('locking every logo is one operation', () => {
  const logos = [logo({ id: 'a' }), logo({ id: 'b', locked: true })];
  const locked = setAllLogosLocked(logos, true);
  assert.ok(locked.every((entry) => entry.locked));
  assert.equal(allLogosLocked(locked), true);
  assert.equal(lockedCount(locked), 2);

  const unlocked = setAllLogosLocked(locked, false);
  assert.ok(unlocked.every((entry) => !entry.locked));
  assert.equal(allLogosLocked(unlocked), false);
});

test('setting the lock leaves untouched logos identical', () => {
  // Referential stability keeps undo history cheap and avoids re-rendering
  // logos that did not change.
  const already = logo({ id: 'b', locked: true });
  const [, unchanged] = setAllLogosLocked([logo({ id: 'a' }), already], true);
  assert.equal(unchanged, already);
});

test('an empty show is not "all locked"', () => {
  // Otherwise the panel would offer to unlock logos that do not exist.
  assert.equal(allLogosLocked([]), false);
  assert.equal(lockedCount([]), 0);
});
