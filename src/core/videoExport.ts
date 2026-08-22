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
 * Choosing how to record a run-through.
 *
 * The awkward truth of recording video in a browser is that you do not get to
 * pick the format — the browser does, from what its operating system can
 * encode. Chrome and Firefox reliably give WebM (VP9 + Opus); Safari gives MP4
 * (H.264 + AAC); Chrome sometimes gives MP4 where the machine has a hardware
 * H.264 encoder. So the choice is made at run time by asking, in order of
 * preference, and the answer is reported to the user rather than hidden —
 * because it decides where the file can be uploaded afterwards.
 *
 * MP4 is preferred wherever it is offered. YouTube takes either, but Vimeo
 * asks for MP4 or MOV, and a designer who exports a show to find it rejected
 * has wasted the length of the show finding out.
 */

/** A container and codec pair, in the form MediaRecorder expects. */
export interface VideoFormat {
  /** Passed to `MediaRecorder`. */
  mimeType: string;
  /** File extension, without the dot. */
  extension: string;
  /** How to describe it to somebody deciding where to upload it. */
  label: string;
  /** True for MP4-family containers, which every service accepts. */
  universal: boolean;
}

/**
 * Candidates in preference order.
 *
 * MP4 first for the upload reason above. Within WebM, VP9 before VP8: better
 * quality at the same bitrate, and a field of 250 small moving dots is exactly
 * the content that shows compression artefacts.
 */
export const VIDEO_FORMATS: VideoFormat[] = [
  {
    mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    extension: 'mp4',
    label: 'MP4 (H.264 + AAC)',
    universal: true,
  },
  { mimeType: 'video/mp4', extension: 'mp4', label: 'MP4', universal: true },
  {
    mimeType: 'video/webm;codecs=vp9,opus',
    extension: 'webm',
    label: 'WebM (VP9 + Opus)',
    universal: false,
  },
  {
    mimeType: 'video/webm;codecs=vp8,opus',
    extension: 'webm',
    label: 'WebM (VP8 + Opus)',
    universal: false,
  },
  { mimeType: 'video/webm', extension: 'webm', label: 'WebM', universal: false },
];

/**
 * The best format this browser will actually record, or null if none.
 *
 * `isSupported` is passed in rather than reaching for `MediaRecorder` so this
 * stays pure and testable — and so the caller can probe a browser that does not
 * exist in a test runner.
 */
export function chooseVideoFormat(
  isSupported: (mimeType: string) => boolean,
): VideoFormat | null {
  return VIDEO_FORMATS.find((format) => isSupported(format.mimeType)) ?? null;
}

/** What a designer needs to know about where this file can go. */
export function describeUploadSupport(format: VideoFormat): string {
  return format.universal
    ? 'MP4 uploads directly to YouTube, Vimeo and everything else.'
    : 'WebM uploads directly to YouTube. Vimeo asks for MP4 or MOV, so a WebM ' +
        'file may need converting first — this browser does not offer MP4 recording.';
}

/**
 * Round a size down to even numbers.
 *
 * H.264 encodes in 16×16 macroblocks and refuses odd dimensions outright; a
 * canvas sized to whatever the panel happens to be is odd half the time. Down
 * rather than up, so the frame never claims pixels the source does not have.
 */
export function evenDimensions(width: number, height: number): {
  width: number;
  height: number;
} {
  return {
    width: Math.max(2, Math.floor(width / 2) * 2),
    height: Math.max(2, Math.floor(height / 2) * 2),
  };
}

/**
 * A bitrate for this frame size.
 *
 * Drill is unusually demanding for its apparent simplicity: a flat green field
 * where 250 small high-contrast dots move independently. Low bitrates smear
 * exactly the thing being watched. This is roughly 0.12 bits per pixel per
 * frame, which is generous for the content and still far below what a phone
 * records at.
 */
export function videoBitrate(width: number, height: number, fps: number): number {
  const raw = width * height * fps * 0.12;
  // Bounded: below 1 Mbps the dots smear, and past 24 Mbps nothing improves
  // while the file becomes tiresome to upload.
  return Math.round(Math.min(24_000_000, Math.max(1_000_000, raw)));
}

export const AUDIO_BITRATE = 192_000;

/** Frame rates worth offering. 30 is the default; 60 doubles the file for little. */
export const FRAME_RATES = [24, 30, 60] as const;
export const DEFAULT_FRAME_RATE = 30;

/** Capture heights offered for the 3D view, which can render at any size. */
export const CAPTURE_HEIGHTS = [720, 1080, 1440, 2160] as const;
export const DEFAULT_CAPTURE_HEIGHT = 1080;

/** A 16:9 frame of a given height, which is what video services expect. */
export function widescreenSize(height: number): { width: number; height: number } {
  return evenDimensions(Math.round((height * 16) / 9), height);
}

/**
 * A file name for the export.
 *
 * Kept close to the show's own file name so a video and the drill it came from
 * sort together in a folder.
 */
export function videoFileName(
  showBaseName: string,
  format: VideoFormat,
  source: 'field' | 'stadium',
): string {
  const suffix = source === 'stadium' ? '3d' : 'field';
  return `${showBaseName}-${suffix}.${format.extension}`;
}

/** A duration written the way a video service shows it: `3:42`. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  return `${minutes}:${String(whole % 60).padStart(2, '0')}`;
}

/** Roughly how large the finished file will be, for warning before a long export. */
export function estimatedBytes(
  seconds: number,
  videoBitsPerSecond: number,
  withAudio: boolean,
): number {
  const bits = seconds * (videoBitsPerSecond + (withAudio ? AUDIO_BITRATE : 0));
  return Math.round(bits / 8);
}

/** Bytes as a human reads them. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10} ${units[unit]}`;
}

/**
 * Fit a source frame inside a video frame without distorting it.
 *
 * The 2D field is whatever shape the panel happens to be, and video services
 * expect 16:9. Stretching to fit would make the field the wrong shape — on a
 * chart where every distance is measured, that is not a cosmetic problem. So
 * the picture is scaled to fit and centred, with bars on whichever pair of
 * edges is left over.
 */
export function letterbox(
  sourceWidth: number,
  sourceHeight: number,
  frameWidth: number,
  frameHeight: number,
): { x: number; y: number; width: number; height: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return { x: 0, y: 0, width: frameWidth, height: frameHeight };
  }
  const scale = Math.min(frameWidth / sourceWidth, frameHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  return {
    x: (frameWidth - width) / 2,
    y: (frameHeight - height) / 2,
    width,
    height,
  };
}

/**
 * A 16:9 frame that holds this source at its own resolution, never upscaled.
 *
 * Recording the 2D field means capturing what is already on screen — there is
 * no way to re-render a React canvas at four times the size without disturbing
 * the editor. Choosing the frame from the source rather than from a menu means
 * the file is sharp at whatever size the window happens to be, instead of a
 * soft 1080p blow-up of a 700-pixel panel.
 */
export function frameForSource(
  sourceWidth: number,
  sourceHeight: number,
): { width: number; height: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0) return widescreenSize(720);
  const byHeight = (sourceHeight * 16) / 9;
  return byHeight >= sourceWidth
    ? evenDimensions(byHeight, sourceHeight)
    : evenDimensions(sourceWidth, (sourceWidth * 9) / 16);
}
