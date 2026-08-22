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
  CAPTURE_HEIGHTS,
  VIDEO_FORMATS,
  chooseVideoFormat,
  describeUploadSupport,
  estimatedBytes,
  evenDimensions,
  formatBytes,
  formatDuration,
  frameForSource,
  letterbox,
  videoBitrate,
  videoFileName,
  widescreenSize,
} from '../videoExport.ts';

test('MP4 is chosen wherever the browser offers it', () => {
  // YouTube takes either, but Vimeo asks for MP4 or MOV — and finding that out
  // after recording costs the length of the show.
  const everything = chooseVideoFormat(() => true);
  assert.equal(everything?.extension, 'mp4');
  assert.equal(everything?.universal, true);
});

test('WebM is used when MP4 is not on offer', () => {
  // Chrome and Firefox on most machines.
  const webmOnly = chooseVideoFormat((mime) => mime.startsWith('video/webm'));
  assert.equal(webmOnly?.extension, 'webm');
  // VP9 before VP8: 250 small moving dots is exactly what a weak codec smears.
  assert.match(webmOnly!.mimeType, /vp9/);
});

test('a browser that records nothing is reported, not guessed around', () => {
  assert.equal(chooseVideoFormat(() => false), null);
});

test('every candidate names a container and an extension that agree', () => {
  for (const format of VIDEO_FORMATS) {
    assert.ok(format.mimeType.startsWith(`video/${format.extension}`), format.mimeType);
    assert.equal(format.universal, format.extension === 'mp4');
    assert.ok(format.label.length > 0);
  }
});

test('the upload advice matches the format', () => {
  assert.match(describeUploadSupport(VIDEO_FORMATS[0]), /YouTube, Vimeo/);
  const webm = VIDEO_FORMATS.find((format) => format.extension === 'webm')!;
  assert.match(describeUploadSupport(webm), /Vimeo asks for MP4/);
});

test('frame sizes are always even', () => {
  // H.264 refuses odd dimensions outright, and a canvas sized to a panel is odd
  // about half the time.
  assert.deepEqual(evenDimensions(1921, 1081), { width: 1920, height: 1080 });
  assert.deepEqual(evenDimensions(1920, 1080), { width: 1920, height: 1080 });
  // Down, never up: the frame must not claim pixels the source lacks.
  assert.deepEqual(evenDimensions(101, 99), { width: 100, height: 98 });
  // And never zero, whatever it is handed.
  assert.deepEqual(evenDimensions(0, 1), { width: 2, height: 2 });
  assert.deepEqual(evenDimensions(-40, 3), { width: 2, height: 2 });
});

test('the offered capture sizes are all 16:9 and even', () => {
  for (const height of CAPTURE_HEIGHTS) {
    const size = widescreenSize(height);
    assert.equal(size.height % 2, 0);
    assert.equal(size.width % 2, 0);
    assert.ok(Math.abs(size.width / size.height - 16 / 9) < 0.01, `${height} is not 16:9`);
  }
  assert.deepEqual(widescreenSize(1080), { width: 1920, height: 1080 });
});

test('bitrate rises with frame size and is bounded at both ends', () => {
  const hd = videoBitrate(1920, 1080, 30);
  const sd = videoBitrate(640, 360, 30);
  assert.ok(hd > sd);
  // A postage stamp still gets enough to keep the dots distinct.
  assert.ok(videoBitrate(64, 64, 24) >= 1_000_000);
  // And 8K at 60 does not ask for a gigabit.
  assert.ok(videoBitrate(7680, 4320, 60) <= 24_000_000);
});

test('a file name pairs with the show it came from', () => {
  const mp4 = VIDEO_FORMATS[0];
  assert.equal(videoFileName('rhapsody-in-blue', mp4, 'field'), 'rhapsody-in-blue-field.mp4');
  assert.equal(videoFileName('rhapsody-in-blue', mp4, 'stadium'), 'rhapsody-in-blue-3d.mp4');
});

test('durations read the way a video service shows them', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(9), '0:09');
  assert.equal(formatDuration(222), '3:42');
  assert.equal(formatDuration(600), '10:00');
  // Nonsense in, something sane out.
  assert.equal(formatDuration(Number.NaN), '0:00');
  assert.equal(formatDuration(-5), '0:00');
});

test('the size estimate accounts for the audio track', () => {
  const silent = estimatedBytes(240, 8_000_000, false);
  const withSound = estimatedBytes(240, 8_000_000, true);
  assert.ok(withSound > silent);
  // Four minutes at 8 Mbps is around 240 MB.
  assert.ok(silent > 230_000_000 && silent < 250_000_000, `${silent}`);
});

test('byte counts are written for a person', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(240 * 1024 * 1024), '240 MB');
  assert.equal(formatBytes(3 * 1024 ** 3), '3 GB');
});

test('a source that is not 16:9 is letterboxed, never stretched', () => {
  // The field is a measured drawing; stretching it is not a cosmetic problem.
  const box = letterbox(800, 600, 1920, 1080);
  assert.equal(Math.round(box.height), 1080);
  assert.equal(Math.round(box.width), 1440);
  // Centred, with the leftover split evenly.
  assert.equal(Math.round(box.x), 240);
  assert.equal(Math.round(box.y), 0);
  // And the aspect ratio survives.
  assert.ok(Math.abs(box.width / box.height - 800 / 600) < 1e-9);
});

test('a source already 16:9 fills the frame exactly', () => {
  const box = letterbox(1280, 720, 1920, 1080);
  assert.equal(Math.round(box.width), 1920);
  assert.equal(Math.round(box.height), 1080);
  assert.equal(Math.round(box.x), 0);
});

test('a degenerate source fills the frame rather than dividing by zero', () => {
  assert.deepEqual(letterbox(0, 0, 1920, 1080), { x: 0, y: 0, width: 1920, height: 1080 });
});

test('the frame is chosen from the source, so nothing is upscaled', () => {
  // A tall panel gets a wider frame; a wide one gets a taller frame. Either
  // way the source keeps its own pixels.
  const tall = frameForSource(800, 600);
  assert.ok(tall.width >= 800 && tall.height === 600);
  assert.ok(Math.abs(tall.width / tall.height - 16 / 9) < 0.01);

  const wide = frameForSource(1920, 400);
  assert.ok(wide.height >= 400 && wide.width === 1920);
  assert.ok(Math.abs(wide.width / wide.height - 16 / 9) < 0.01);

  // Always even, for H.264.
  for (const [w, h] of [[801, 601], [1001, 333], [1920, 1080]]) {
    const frame = frameForSource(w, h);
    assert.equal(frame.width % 2, 0);
    assert.equal(frame.height % 2, 0);
  }
});
