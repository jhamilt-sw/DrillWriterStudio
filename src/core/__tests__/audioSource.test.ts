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
  editAudioSource,
  formatCitation,
  hasCitation,
  normaliseAudioSource,
  safeSourceUrl,
  sourceProvider,
} from '../audioSource.ts';

test('an http or https link is kept', () => {
  const url =
    'https://pixabay.com/music/marching-band-marching-music-the-stars-and-stripes-forever-95379/';
  assert.equal(safeSourceUrl(url), url);
  assert.equal(safeSourceUrl('http://example.org/track.mp3'), 'http://example.org/track.mp3');
});

test('a link that would run code is refused, not repaired', () => {
  // A show file arrives from another director and this string lands in an
  // href. A javascript: or data: URL there executes in the page's own origin.
  assert.equal(safeSourceUrl('javascript:alert(1)'), null);
  assert.equal(safeSourceUrl('data:text/html,<script>alert(1)</script>'), null);
  assert.equal(safeSourceUrl('file:///etc/passwd'), null);
  assert.equal(safeSourceUrl('vbscript:msgbox'), null);
  // Not a URL at all.
  assert.equal(safeSourceUrl('pixabay.com/music/95379'), null);
  assert.equal(safeSourceUrl(''), null);
  assert.equal(safeSourceUrl(undefined), null);
});

test('an absurdly long link is refused', () => {
  assert.equal(safeSourceUrl(`https://example.org/${'a'.repeat(4000)}`), null);
});

test('the provider is the site the link points at', () => {
  assert.equal(sourceProvider('https://www.pixabay.com/music/95379'), 'pixabay.com');
  assert.equal(sourceProvider('https://musopen.org/music/1234/'), 'musopen.org');
  assert.equal(sourceProvider('javascript:alert(1)'), null);
});

test('a citation reads as a credit line', () => {
  assert.equal(
    formatCitation({
      title: 'The Stars and Stripes Forever',
      artist: 'John Philip Sousa',
      url: 'https://pixabay.com/music/95379/',
      license: 'Pixabay Content License',
    }),
    '“The Stars and Stripes Forever” by John Philip Sousa via pixabay.com ' +
      '(Pixabay Content License) — https://pixabay.com/music/95379/',
  );
});

test('half a citation is still worth printing', () => {
  // Demanding a complete one would mean most shows carry nothing at all.
  assert.equal(formatCitation({ artist: 'Sousa' }), 'by Sousa');
  assert.equal(formatCitation({ title: 'Semper Fidelis' }), '“Semper Fidelis”');
  assert.equal(
    formatCitation({ url: 'https://example.org/x' }),
    'via example.org — https://example.org/x',
  );
});

test('nothing to say produces nothing', () => {
  assert.equal(formatCitation(undefined), '');
  assert.equal(formatCitation({}), '');
  assert.equal(formatCitation({ title: '   ' }), '');
  assert.equal(hasCitation(undefined), false);
  assert.equal(hasCitation({ title: '  ' }), false);
  assert.equal(hasCitation({ artist: 'Sousa' }), true);
});

test('an unsafe link alone is not a citation', () => {
  // Otherwise a show could claim a citation that renders as nothing at all.
  assert.equal(hasCitation({ url: 'javascript:alert(1)' }), false);
  assert.equal(normaliseAudioSource({ url: 'javascript:alert(1)' }), undefined);
});

test('storing a citation trims it and drops what it cannot keep', () => {
  const stored = normaliseAudioSource({
    title: '  Stars and Stripes  ',
    artist: '',
    url: 'javascript:alert(1)',
    notes: 'x'.repeat(5000),
  });
  assert.equal(stored?.title, 'Stars and Stripes');
  assert.equal(stored?.artist, undefined, 'an empty field is not stored');
  assert.equal(stored?.url, undefined, 'an unsafe link is not stored');
  assert.equal(stored?.notes?.length, 1000, 'free text is bounded');
});

test('a citation with nothing usable in it is stored as nothing', () => {
  assert.equal(normaliseAudioSource({}), undefined);
  assert.equal(normaliseAudioSource(undefined), undefined);
  assert.equal(normaliseAudioSource({ title: '   ', notes: '' }), undefined);
});

test('non-string fields are ignored rather than stringified', () => {
  const stored = normaliseAudioSource({
    title: 42 as unknown as string,
    artist: 'Sousa',
  });
  assert.equal(stored?.title, undefined);
  assert.equal(stored?.artist, 'Sousa');
});

test('typing a title with spaces in it works', () => {
  // The regression: normalising on every keystroke trimmed the trailing space
  // the moment it was typed, so the next letter joined the previous word and
  // no field could hold more than one word.
  let source = normaliseAudioSource({});
  for (const character of 'Stars and Stripes') {
    source = editAudioSource(source, { title: `${source?.title ?? ''}${character}` });
  }
  assert.equal(source?.title, 'Stars and Stripes');
});

test('a field being typed into survives a leading space', () => {
  // Dropping the citation the moment it holds only whitespace would clear the
  // input out from under someone who pressed space first.
  const source = editAudioSource(undefined, { title: ' ' });
  assert.equal(source?.title, ' ');
});

test('editing still bounds what can be stored', () => {
  // Length is a limit on storage, not a correction of what is being typed.
  const source = editAudioSource(undefined, { notes: 'x'.repeat(5000) });
  assert.equal(source?.notes?.length, 1000);
});

test('an emptied field leaves nothing behind', () => {
  const source = editAudioSource({ title: 'Sousa' }, { title: '' });
  assert.equal(source, undefined);
});

test('tidying happens when a value is finished, not while it is typed', () => {
  // Blur is what trims, and what refuses a link that cannot be opened safely.
  const typed = editAudioSource(undefined, { title: '  Stars and Stripes  ' });
  assert.equal(typed?.title, '  Stars and Stripes  ', 'typing is left alone');
  assert.equal(normaliseAudioSource(typed)?.title, 'Stars and Stripes');

  const withLink = editAudioSource(typed, { url: 'javascript:alert(1)' });
  assert.equal(withLink?.url, 'javascript:alert(1)', 'kept while being typed');
  assert.equal(normaliseAudioSource(withLink)?.url, undefined, 'refused when finished');
});
