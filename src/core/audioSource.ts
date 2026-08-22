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
 * Where the music came from.
 *
 * A show file deliberately does not carry the recording — a three-minute track
 * would quadruple the size of every save, and much of the music a band marches
 * to cannot be redistributed anyway. That leaves a gap: hand the file to an
 * assistant director and they have the drill, the tempo map and the downbeat,
 * but no way to know *which* recording it was written against, let alone where
 * to get it.
 *
 * A citation closes that gap at almost no cost. It is a few hundred bytes that
 * turn "the audio is missing" into "the audio is missing, here is exactly what
 * it was and where to download it" — and it doubles as the credit line a
 * programme needs, which a director has to write out by hand otherwise.
 */

import type { AudioSource } from './types.ts';

/** Schemes a citation link may use. Anything else is dropped on load. */
const SAFE_SCHEMES = new Set(['http:', 'https:']);

/**
 * A link that is safe to render and to open.
 *
 * A show file is untrusted input — it arrives by email from another director —
 * and this string ends up in an `href`. `javascript:` and `data:` URLs in an
 * anchor run in the page's own origin, so a citation is a script-injection
 * route unless the scheme is checked. Returns null rather than a corrected
 * guess: a link that cannot be trusted should not be offered at all.
 */
export function safeSourceUrl(url: string | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) return null;
  try {
    const parsed = new URL(trimmed);
    return SAFE_SCHEMES.has(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

/** The site a link points at, for showing where a download lives. */
export function sourceProvider(url: string | undefined): string | null {
  const safe = safeSourceUrl(url);
  if (!safe) return null;
  try {
    return new URL(safe).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Whether a citation says anything worth saving or showing. */
export function hasCitation(source: AudioSource | undefined): boolean {
  if (!source) return false;
  return Boolean(
    source.title?.trim() ||
      source.artist?.trim() ||
      source.license?.trim() ||
      source.notes?.trim() ||
      safeSourceUrl(source.url),
  );
}

/**
 * The citation as one line of prose, in the order a credit is normally read:
 * what it is, who made it, where it came from, and on what terms.
 *
 * Used for the programme credit, the printed summary, and the clipboard button
 * — one implementation, so those three cannot word the same thing differently.
 */
export function formatCitation(source: AudioSource | undefined): string {
  if (!hasCitation(source)) return '';
  const parts: string[] = [];
  const title = source?.title?.trim();
  const artist = source?.artist?.trim();
  const url = safeSourceUrl(source?.url);
  const provider = sourceProvider(source?.url);
  const license = source?.license?.trim();

  if (title) parts.push(`“${title}”`);
  if (artist) parts.push(`by ${artist}`);
  if (provider && url) parts.push(`via ${provider}`);
  else if (url) parts.push(url);
  if (license) parts.push(`(${license})`);

  const line = parts.join(' ');
  // The URL goes last and only when the provider name has not already stood in
  // for it, so a credit line reads as prose rather than trailing a raw link.
  return provider && url ? `${line} — ${url}` : line;
}

/** How long each field may be. Free text in a file that may come from anyone. */
const LIMITS = { title: 200, artist: 200, license: 200, notes: 1000, url: 2048 } as const;

/**
 * Merge a keystroke into a citation, without tidying it.
 *
 * Deliberately does **not** trim. `normaliseAudioSource` trims, and calling
 * that on every keystroke means the space a user just typed is removed before
 * the next letter arrives — so they cannot type two words. Tidying is for the
 * moment a value is finished with (blur, save, load), never while it is being
 * written.
 *
 * Lengths are still bounded, because that is a limit on what can be stored
 * rather than a correction of what is being typed.
 */
export function editAudioSource(
  source: AudioSource | undefined,
  patch: Partial<AudioSource>,
): AudioSource | undefined {
  const merged: AudioSource = { ...source, ...patch };
  const out: AudioSource = {};
  let present = false;
  for (const key of ['title', 'artist', 'license', 'notes', 'url'] as const) {
    const value = merged[key];
    if (typeof value !== 'string' || value.length === 0) continue;
    out[key] = value.slice(0, LIMITS[key]);
    present = true;
  }
  // Kept while it holds any text at all, even a lone space: dropping it there
  // would clear the field out from under someone starting a title with one.
  return present ? out : undefined;
}

/**
 * Clean a citation for storage: trim, bound the lengths, drop unsafe links,
 * and return undefined when nothing is left.
 *
 * Bounded because these fields are free text in a file that may have come from
 * anyone; an unbounded "notes" is a way to make a show file enormous.
 */
export function normaliseAudioSource(
  source: Partial<AudioSource> | undefined,
): AudioSource | undefined {
  if (!source) return undefined;
  const text = (value: unknown, limit: number): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().slice(0, limit);
    return trimmed.length > 0 ? trimmed : undefined;
  };

  const cleaned: AudioSource = {};
  for (const key of ['title', 'artist', 'license', 'notes'] as const) {
    const value = text(source[key], LIMITS[key]);
    if (value) cleaned[key] = value;
  }
  const url = safeSourceUrl(typeof source.url === 'string' ? source.url : undefined);
  if (url) cleaned.url = url;

  return hasCitation(cleaned) ? cleaned : undefined;
}
