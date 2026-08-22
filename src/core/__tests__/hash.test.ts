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

import { hashBytes } from '../hash.ts';

const bytes = (...values: number[]) => Uint8Array.from(values);

test('the same bytes always hash the same', () => {
  assert.equal(hashBytes(bytes(1, 2, 3)), hashBytes(bytes(1, 2, 3)));
  assert.equal(hashBytes(bytes()), hashBytes(bytes()));
});

test('a hash is stable hex, not a number', () => {
  const hash = hashBytes(bytes(9, 9, 9));
  assert.match(hash, /^[0-9a-f]+$/);
  assert.equal(hash.length, 24);
});

test('different content hashes differently', () => {
  assert.notEqual(hashBytes(bytes(1, 2, 3)), hashBytes(bytes(1, 2, 4)));
  // Order matters — a sum-style hash would miss this.
  assert.notEqual(hashBytes(bytes(1, 2)), hashBytes(bytes(2, 1)));
  // And so does length, even when one buffer is a prefix of the other.
  assert.notEqual(hashBytes(bytes(1, 2)), hashBytes(bytes(1, 2, 0)));
});

test('a single flipped byte deep inside a large buffer changes the hash', () => {
  // The realistic case: two takes of the same recording differing in one frame.
  const size = 200_000;
  const first = new Uint8Array(size);
  for (let index = 0; index < size; index += 1) first[index] = index % 251;
  const second = first.slice();
  second[size - 7] ^= 0x01;
  assert.notEqual(hashBytes(first), hashBytes(second));
});

test('hashing stays exact past the 32-bit multiply', () => {
  // Regression guard for using `*` instead of Math.imul: with a plain multiply
  // the low bits are lost to float rounding and long buffers of similar bytes
  // start colliding.
  const seen = new Set<string>();
  for (let index = 0; index < 500; index += 1) {
    const buffer = new Uint8Array(64).fill(index % 256);
    buffer[0] = index & 0xff;
    buffer[1] = (index >> 8) & 0xff;
    seen.add(hashBytes(buffer));
  }
  assert.equal(seen.size, 500);
});
