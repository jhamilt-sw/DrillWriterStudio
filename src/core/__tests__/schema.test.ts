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
  MAX_LOGO_DATA_URL_LENGTH,
  ShowFileError,
  deserialiseShow,
  parseShow,
  serialiseShow,
  showFileBaseName,
} from '../schema.ts';
import { DEFAULT_APPEARANCE } from '../field.ts';
import {
  CURRENT_SCHEMA_VERSION,
  convertShowStepSize,
  createEmptyShow,
  withoutEmbeddedAudio,
} from '../show.ts';

test('a new show is valid and round-trips unchanged', () => {
  const show = createEmptyShow('Test Show');
  const restored = deserialiseShow(serialiseShow(show));
  assert.deepEqual(restored, show);
});

test('a show with content round-trips', () => {
  const show = createEmptyShow('Rhapsody');
  const sectionId = show.sections[0].id;
  show.performers = [
    { id: 'p1', label: 'TP1', name: 'Ada', sectionId, order: 0 },
    { id: 'p2', label: 'TP2', name: 'Grace', sectionId, order: 1 },
  ];
  show.sets = [
    { id: 's1', label: '1', counts: 0, positions: { p1: { x: 56, y: 12 } } },
    {
      id: 's2',
      label: '2',
      counts: 16,
      notes: 'horns up',
      music: { measure: 5, beat: 1 },
      positions: { p1: { x: 80, y: 12 }, p2: { x: 72, y: 20 } },
      transitions: { p1: { style: 'curve', control: { x: 68, y: 4 }, holdCounts: 4 } },
    },
  ];
  const restored = deserialiseShow(serialiseShow(show));
  assert.deepEqual(restored, show);
});

test('a file from the future is refused with a clear message', () => {
  assert.throws(
    () => parseShow({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 }),
    (error: unknown) =>
      error instanceof ShowFileError && /newer version/.test(error.message),
  );
});

test('a file with no schemaVersion is refused', () => {
  assert.throws(() => parseShow({ sets: [] }), ShowFileError);
  assert.throws(() => parseShow('nope'), ShowFileError);
  assert.throws(() => deserialiseShow('{ not json'), ShowFileError);
});

test('positions referring to deleted performers are dropped', () => {
  const show = parseShow({
    schemaVersion: 1,
    sections: [{ id: 'sec1', name: 'Trumpet', abbreviation: 'TP', color: '#000', symbol: 'circle' }],
    performers: [{ id: 'p1', label: 'TP1', name: '', sectionId: 'sec1', order: 0 }],
    sets: [
      {
        id: 's1',
        label: '1',
        counts: 0,
        positions: { p1: { x: 1, y: 2 }, ghost: { x: 9, y: 9 } },
      },
    ],
  });
  assert.deepEqual(Object.keys(show.sets[0].positions), ['p1']);
});

test('a performer pointing at a missing section is reassigned rather than lost', () => {
  const show = parseShow({
    schemaVersion: 1,
    sections: [{ id: 'sec1', name: 'Trumpet', abbreviation: 'TP', color: '#000', symbol: 'circle' }],
    performers: [{ id: 'p1', label: 'TP1', name: '', sectionId: 'gone', order: 0 }],
    sets: [{ id: 's1', label: '1', counts: 0, positions: {} }],
  });
  assert.equal(show.performers.length, 1);
  assert.equal(show.performers[0].sectionId, 'sec1');
});

test('non-finite coordinates are discarded', () => {
  const show = parseShow({
    schemaVersion: 1,
    sections: [{ id: 'sec1', name: 'T', abbreviation: 'T', color: '#000', symbol: 'circle' }],
    performers: [{ id: 'p1', label: 'T1', name: '', sectionId: 'sec1', order: 0 }],
    sets: [
      {
        id: 's1',
        label: '1',
        counts: 0,
        positions: { p1: { x: Number.NaN, y: 3 } },
      },
    ],
  });
  assert.deepEqual(show.sets[0].positions, {});
});

test('the tempo map always defines measure 1', () => {
  const show = parseShow({
    schemaVersion: 1,
    music: { tempoMap: { tempos: [{ measure: 9, bpm: 144 }], meters: [], offsetSeconds: 0 } },
  });
  assert.ok(show.music.tempoMap.tempos.some((tempo) => tempo.measure === 1));
  assert.ok(show.music.tempoMap.meters.some((meter) => meter.measure === 1));
});

test('the opening set always has zero counts', () => {
  const show = parseShow({
    schemaVersion: 1,
    sets: [{ id: 's1', label: '1', counts: 32, positions: {} }],
  });
  assert.equal(show.sets[0].counts, 0);
});

test('an unknown field type falls back to high school', () => {
  const show = parseShow({ schemaVersion: 1, field: { type: 'cricket' } });
  assert.equal(show.field.type, 'highSchool');
});

test('a missing step size defaults to the 8-to-5 standard', () => {
  assert.equal(parseShow({ schemaVersion: 1 }).field.stepsPerFiveYards, 8);
  assert.equal(
    parseShow({ schemaVersion: 1, field: { type: 'college' } }).field.stepsPerFiveYards,
    8,
  );
});

test('an unusual but legal step size survives a save', () => {
  const show = createEmptyShow();
  show.field.stepsPerFiveYards = 7;
  const restored = deserialiseShow(serialiseShow(show));
  assert.equal(restored.field.stepsPerFiveYards, 7);
});

test('a nonsensical step size is repaired rather than trusted', () => {
  const cases: [unknown, number][] = [
    [0, 8],
    [-6, 8],
    ['eight', 8],
    [null, 8],
    [10_000, 48],
    [0.1, 2],
  ];
  for (const [input, expected] of cases) {
    const show = parseShow({
      schemaVersion: 1,
      field: { type: 'highSchool', stepsPerFiveYards: input },
    });
    assert.equal(
      show.field.stepsPerFiveYards,
      expected,
      `stepsPerFiveYards ${String(input)} should become ${expected}`,
    );
  }
});

test('changing step size moves nobody', () => {
  const show = createEmptyShow();
  show.performers = [
    { id: 'p1', label: 'TP1', name: '', sectionId: show.sections[0].id, order: 0 },
  ];
  // Side 1's 35 yard line, on the front sideline, in 8-to-5 steps.
  show.sets[0].positions = { p1: { x: 56, y: 0 } };

  const converted = convertShowStepSize(show, 6);
  assert.equal(converted.field.stepsPerFiveYards, 6);
  // 56 eight-to-five steps and 42 six-to-five steps are both 35 yards.
  assert.equal(converted.sets[0].positions.p1.x, 42);
  assert.equal(converted.sets[0].positions.p1.y, 0);
});

test('converting to an arbitrary step size and back is lossless', () => {
  const show = createEmptyShow();
  show.performers = [
    { id: 'p1', label: 'TP1', name: '', sectionId: show.sections[0].id, order: 0 },
  ];
  show.sets[0].positions = { p1: { x: 56, y: 24 } };

  const odd = convertShowStepSize(show, 7);
  assert.equal(odd.field.stepsPerFiveYards, 7);
  // 35 yards at 7-to-5 is 49 steps.
  assert.equal(odd.sets[0].positions.p1.x, 49);

  const back = convertShowStepSize(odd, 8);
  assert.equal(back.field.stepsPerFiveYards, 8);
  assert.ok(Math.abs(back.sets[0].positions.p1.x - 56) < 1e-9);
  assert.ok(Math.abs(back.sets[0].positions.p1.y - 24) < 1e-9);
});

test('converting to a bad step size leaves the show usable', () => {
  const show = createEmptyShow();
  show.performers = [
    { id: 'p1', label: 'TP1', name: '', sectionId: show.sections[0].id, order: 0 },
  ];
  show.sets[0].positions = { p1: { x: 56, y: 0 } };
  // A zero step size would make every coordinate infinite.
  const converted = convertShowStepSize(show, 0);
  assert.equal(converted.field.stepsPerFiveYards, 8);
  assert.ok(Number.isFinite(converted.sets[0].positions.p1.x));
});

test('export file names are filesystem-safe', () => {
  assert.equal(showFileBaseName(createEmptyShow('Rhapsody in Blue!')), 'rhapsody-in-blue');
  assert.equal(showFileBaseName(createEmptyShow('   ')), 'untitled-show');
  assert.equal(showFileBaseName(createEmptyShow('///')), 'untitled-show');
});

// --- field appearance and logos -------------------------------------------

test('a field with no appearance recorded gets the grass default', () => {
  const show = parseShow({ schemaVersion: 1, field: { type: 'college' } });
  assert.equal(show.field.appearance.turfColor, DEFAULT_APPEARANCE.turfColor);
  assert.equal(show.field.appearance.lineColor, '#ffffff');
  assert.equal(show.field.appearance.showMowingStripes, true);
});

test('a custom appearance round-trips', () => {
  const show = createEmptyShow();
  show.field.appearance = {
    turfColor: '#123456',
    endZoneColor: '#654321',
    lineColor: '#eeeeee',
    numberColor: '#dddddd',
    lineWeight: 2.5,
    performerSize: 1.75,
    showMowingStripes: false,
    showHashLines: false,
  };
  const restored = deserialiseShow(serialiseShow(show));
  assert.deepEqual(restored.field.appearance, show.field.appearance);
});

test('a show saved before hash lines existed opens with them on', () => {
  // Absent means on, matching the default — an older show should gain the
  // reference line rather than silently opening without it.
  const show = createEmptyShow();
  const raw = JSON.parse(serialiseShow(show));
  delete raw.field.appearance.showHashLines;
  assert.equal(parseShow(raw).field.appearance.showHashLines, true);
});

test('hash lines can be turned off and stay off', () => {
  const show = createEmptyShow();
  show.field.appearance = { ...show.field.appearance, showHashLines: false };
  assert.equal(
    deserialiseShow(serialiseShow(show)).field.appearance.showHashLines,
    false,
  );
});

test('a nonsense colour falls back rather than painting nothing', () => {
  const show = parseShow({
    schemaVersion: 1,
    field: { appearance: { turfColor: 'chartreuse', lineColor: '#fff', lineWeight: 99 } },
  });
  assert.equal(show.field.appearance.turfColor, DEFAULT_APPEARANCE.turfColor);
  // A valid short hex is accepted.
  assert.equal(show.field.appearance.lineColor, '#fff');
  // Line weight is clamped into a drawable range.
  assert.equal(show.field.appearance.lineWeight, 4);
});

test('a show has no logos until one is added', () => {
  assert.deepEqual(createEmptyShow().fieldLogos, []);
  assert.deepEqual(parseShow({ schemaVersion: 1 }).fieldLogos, []);
});

test('a logo round-trips with its geometry intact', () => {
  const show = createEmptyShow();
  show.fieldLogos = [
    {
      id: 'logo1',
      name: 'Midfield',
      dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      center: { x: 80, y: 42 },
      widthSteps: 40,
      heightSteps: 24,
      rotationDegrees: 15,
      opacity: 0.7,
      visible: true,
      lockAspect: true,
      locked: true,
    },
  ];
  const restored = deserialiseShow(serialiseShow(show));
  assert.deepEqual(restored.fieldLogos, show.fieldLogos);
});

test('a logo that is not an embedded image is refused', () => {
  // A show file must never cause a fetch to somewhere else.
  const show = parseShow({
    schemaVersion: 1,
    fieldLogos: [
      { id: 'a', dataUrl: 'https://example.com/logo.png', center: { x: 0, y: 0 } },
      { id: 'b', dataUrl: 'javascript:alert(1)', center: { x: 0, y: 0 } },
      { id: 'c', dataUrl: 'data:text/html;base64,PHNjcmlwdD4=', center: { x: 0, y: 0 } },
      { id: 'd', dataUrl: 'data:image/png;base64,iVBORw0KGgo=', center: { x: 0, y: 0 } },
    ],
  });
  assert.equal(show.fieldLogos.length, 1);
  assert.equal(show.fieldLogos[0].id, 'd');
});

test('an absurdly large logo payload is dropped', () => {
  const huge = `data:image/png;base64,${'A'.repeat(MAX_LOGO_DATA_URL_LENGTH)}`;
  const show = parseShow({
    schemaVersion: 1,
    fieldLogos: [{ id: 'big', dataUrl: huge, center: { x: 0, y: 0 } }],
  });
  assert.equal(show.fieldLogos.length, 0);
});

test('logo geometry is clamped to something drawable', () => {
  const show = parseShow({
    schemaVersion: 1,
    fieldLogos: [
      {
        id: 'a',
        dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
        center: { x: 10, y: 10 },
        widthSteps: 0,
        heightSteps: -5,
        opacity: 4,
      },
    ],
  });
  const [logo] = show.fieldLogos;
  assert.ok(logo.widthSteps > 0);
  assert.ok(logo.heightSteps > 0);
  assert.equal(logo.opacity, 1);
});

test('performer size defaults to 1 and is clamped on load', () => {
  assert.equal(parseShow({ schemaVersion: 1 }).field.appearance.performerSize, 1);
  const clamped = parseShow({
    schemaVersion: 1,
    field: { appearance: { performerSize: 99 } },
  });
  assert.equal(clamped.field.appearance.performerSize, 3);
  const tiny = parseShow({
    schemaVersion: 1,
    field: { appearance: { performerSize: 0 } },
  });
  assert.equal(tiny.field.appearance.performerSize, 0.4);
});

test('a logo is unlocked unless the file says otherwise', () => {
  // Files written before locking existed must not open with everything frozen.
  const show = parseShow({
    schemaVersion: 1,
    fieldLogos: [
      { id: 'a', dataUrl: 'data:image/png;base64,iVBORw0KGgo=', center: { x: 0, y: 0 } },
    ],
  });
  assert.equal(show.fieldLogos[0].locked, false);
});

test('an audio reference keeps the hash that finds the recording again', () => {
  const show = createEmptyShow('With music');
  show.music.audio = {
    fileName: 'opener.mp3',
    mimeType: 'audio/mpeg',
    durationSeconds: 187.5,
    storage: 'reference',
    hash: 'a1b2c3d4e5f60718',
  };
  const restored = deserialiseShow(serialiseShow(show));
  assert.deepEqual(restored.music.audio, show.music.audio);
});

test('a junk audio hash is dropped rather than trusted', () => {
  // Anything not hash-shaped would send the cache hunting for a recording that
  // cannot exist, and the user would see "restoring…" that never finishes.
  const parsed = parseShow({
    ...JSON.parse(serialiseShow(createEmptyShow('Junk'))),
    music: {
      tempoMap: { tempos: [], meters: [], offsetSeconds: 0 },
      audio: {
        fileName: 'x.mp3',
        mimeType: 'audio/mpeg',
        durationSeconds: 10,
        storage: 'reference',
        hash: '../../etc/passwd',
      },
    },
  });
  assert.equal(parsed.music.audio?.hash, undefined);
  assert.equal(parsed.music.audio?.fileName, 'x.mp3');
});

test('a show written before the audio cache existed still opens', () => {
  const parsed = parseShow({
    ...JSON.parse(serialiseShow(createEmptyShow('Old'))),
    music: {
      tempoMap: { tempos: [], meters: [], offsetSeconds: 0 },
      audio: {
        fileName: 'legacy.wav',
        mimeType: 'audio/wav',
        durationSeconds: 42,
        storage: 'reference',
      },
    },
  });
  assert.equal(parsed.music.audio?.hash, undefined);
  assert.equal(parsed.music.audio?.fileName, 'legacy.wav');
});

test('autosave snapshots drop the embedded recording but remember the intent', () => {
  const show = createEmptyShow('Carried');
  show.music.audio = {
    fileName: 'opener.mp3',
    mimeType: 'audio/mpeg',
    durationSeconds: 187.5,
    storage: 'embedded',
    hash: 'a1b2c3d4e5f60718',
    data: 'QUJDRA==',
  };
  const stripped = withoutEmbeddedAudio(show);
  assert.equal(stripped.music.audio?.data, undefined);
  // The flag and the hash survive, which is what lets a recovered snapshot put
  // the payload back instead of downgrading to a plain reference.
  assert.equal(stripped.music.audio?.storage, 'embedded');
  assert.equal(stripped.music.audio?.hash, 'a1b2c3d4e5f60718');
  // And the original is untouched.
  assert.equal(show.music.audio?.data, 'QUJDRA==');
});

test('stripping a show with no embedded audio hands back the same show', () => {
  const show = createEmptyShow('Plain');
  assert.equal(withoutEmbeddedAudio(show), show);
});

test('an audio citation is saved with the show and comes back whole', () => {
  const show = createEmptyShow('With a credit');
  show.music.audioSource = {
    title: 'The Stars and Stripes Forever',
    artist: 'John Philip Sousa',
    url: 'https://pixabay.com/music/95379/',
    license: 'Pixabay Content License',
    notes: 'Trimmed 4s from the front.',
  };
  const restored = deserialiseShow(serialiseShow(show));
  assert.deepEqual(restored.music.audioSource, show.music.audioSource);
});

test('a citation outlives the recording it describes', () => {
  // The whole point: the file arrives on somebody else's machine with no audio
  // and the citation is what tells them what to go and get.
  const show = createEmptyShow('Shared');
  show.music.audioSource = { artist: 'Sousa', url: 'https://example.org/x' };
  show.music.audio = undefined;
  const restored = deserialiseShow(serialiseShow(show));
  assert.equal(restored.music.audioSource?.artist, 'Sousa');
});

test('a hostile citation link never survives loading a file', () => {
  // A show file arrives by email and its link is rendered as an anchor.
  const parsed = parseShow({
    ...JSON.parse(serialiseShow(createEmptyShow('Hostile'))),
    music: {
      tempoMap: { tempos: [], meters: [], offsetSeconds: 0 },
      audioSource: { title: 'Nice tune', url: 'javascript:alert(document.cookie)' },
    },
  });
  assert.equal(parsed.music.audioSource?.url, undefined);
  // And the harmless part of the citation is kept rather than the whole thing
  // being thrown away.
  assert.equal(parsed.music.audioSource?.title, 'Nice tune');
});

test('a citation of nothing is stored as nothing', () => {
  const parsed = parseShow({
    ...JSON.parse(serialiseShow(createEmptyShow('Empty'))),
    music: {
      tempoMap: { tempos: [], meters: [], offsetSeconds: 0 },
      audioSource: { title: '   ', url: '' },
    },
  });
  assert.equal(parsed.music.audioSource, undefined);
});
