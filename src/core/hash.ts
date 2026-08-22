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
 * A content hash for identifying imported media.
 *
 * Used to recognise a recording the user has imported before, so reopening a
 * show can find the same audio in the local cache instead of asking for the
 * file again.
 *
 * FNV-1a, run twice with different offsets and concatenated for a 128-bit
 * result. Deliberately **not** a cryptographic hash: SubtleCrypto is async and
 * unavailable on insecure origins, and this is not a security boundary — a
 * collision here would mean playing the wrong local file, not admitting an
 * attacker. What it does need is to be fast over a ten-megabyte buffer and
 * identical across sessions, which this is.
 */

const OFFSET_A = 0x811c9dc5;
const OFFSET_B = 0x01000193;
const PRIME = 0x01000193;

function fnv1a(bytes: Uint8Array, offset: number): number {
  let hash = offset >>> 0;
  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index];
    // Multiply by the FNV prime in 32-bit space. Math.imul keeps it exact;
    // plain `*` would go through a double and lose the low bits.
    hash = Math.imul(hash, PRIME) >>> 0;
  }
  return hash >>> 0;
}

function toHex(value: number): string {
  return (value >>> 0).toString(16).padStart(8, '0');
}

/**
 * A stable hex identity for a byte buffer, with the length mixed in so two
 * different-length buffers cannot collide on content alone.
 */
export function hashBytes(bytes: Uint8Array): string {
  const a = fnv1a(bytes, OFFSET_A);
  const b = fnv1a(bytes, OFFSET_B);
  return `${toHex(a)}${toHex(b)}${toHex(bytes.length)}`;
}
