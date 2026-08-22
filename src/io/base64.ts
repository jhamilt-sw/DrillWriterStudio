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
 * Binary <-> base64, for the optional "keep the recording inside the show
 * file" mode.
 *
 * Chunked deliberately: `String.fromCharCode(...bytes)` on a five-megabyte
 * recording spreads five million arguments onto the call stack and throws
 * RangeError in every browser. 32k at a time is comfortably under every
 * engine's argument limit.
 */

const CHUNK = 0x8000;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  }
  return btoa(binary);
}

export function base64ToBytes(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/** Roughly how many bytes a base64 payload of this length occupies as text. */
export function base64Bytes(encoded: string): number {
  return Math.ceil((encoded.length * 3) / 4);
}
