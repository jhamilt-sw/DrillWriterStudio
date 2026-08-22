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
import { readFileSync } from 'node:fs';

import {
  APP_AUTHOR,
  APP_COPYRIGHT,
  APP_LICENSE,
  APP_NAME,
  APP_VERSION,
  APP_YEAR,
} from '../app.ts';

const manifest = JSON.parse(
  readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
);

test('the version in the About box is the version that shipped', () => {
  // Two copies of a version number drift, and a version nobody trusts is worse
  // than none. This is the only thing stopping them.
  assert.equal(APP_VERSION, manifest.version);
});

test('the licence and author match the package manifest', () => {
  assert.equal(APP_LICENSE, manifest.license);
  assert.equal(APP_AUTHOR, manifest.author);
});

test('the copyright line reads the way a copyright line should', () => {
  assert.equal(APP_COPYRIGHT, `© ${APP_YEAR} ${APP_AUTHOR}`);
  assert.match(APP_COPYRIGHT, /^© \d{4} \S/);
});

test('the application has a name', () => {
  assert.equal(APP_NAME, 'DrillWriter Studio');
  assert.ok(APP_NAME.length > 0);
});
