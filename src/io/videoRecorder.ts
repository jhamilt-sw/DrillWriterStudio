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
 * Recording a canvas, with sound, to a downloadable file.
 *
 * Real time, by necessity: `MediaRecorder` records a live stream, so a
 * four-minute show takes four minutes to export. Rendering faster than real
 * time would mean encoding frames by hand through WebCodecs and muxing them,
 * which is a large amount of machinery and a new dependency — and it would
 * still have to play the audio through in real time to capture it. The honest
 * trade is to record in real time and say so.
 *
 * Nothing here leaves the machine: the stream is composed, encoded and handed
 * back as a Blob in the same tab.
 */

import { AUDIO_BITRATE, type VideoFormat, videoBitrate } from '../core/videoExport.ts';

export interface RecordingOptions {
  /** The canvas to capture. Its backing-store size decides the frame size. */
  canvas: HTMLCanvasElement;
  fps: number;
  format: VideoFormat;
  /** Audio to mux in, if the show has any and the user wants it. */
  audioTrack?: MediaStreamTrack | null;
}

export interface Recording {
  /** Resolves with the finished file once `stop` is called. */
  readonly done: Promise<Blob>;
  /** Finish and produce the file. */
  stop: () => void;
  /** Abandon the recording; `done` rejects with `RecordingCancelled`. */
  cancel: () => void;
}

export class RecordingCancelled extends Error {
  constructor() {
    super('The export was cancelled.');
    this.name = 'RecordingCancelled';
  }
}

/** Whether this browser can record a canvas at all. */
export function canRecordVideo(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function'
  );
}

/** Ask the browser, for `chooseVideoFormat`. */
export function isRecordingTypeSupported(mimeType: string): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof MediaRecorder.isTypeSupported === 'function' &&
    MediaRecorder.isTypeSupported(mimeType)
  );
}

export function startRecording(options: RecordingOptions): Recording {
  const { canvas, fps, format, audioTrack } = options;

  const stream = canvas.captureStream(fps);
  if (audioTrack) stream.addTrack(audioTrack);

  const recorder = new MediaRecorder(stream, {
    mimeType: format.mimeType,
    videoBitsPerSecond: videoBitrate(canvas.width, canvas.height, fps),
    ...(audioTrack ? { audioBitsPerSecond: AUDIO_BITRATE } : {}),
  });

  const chunks: BlobPart[] = [];
  let cancelled = false;

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = (event) => {
      reject(
        (event as unknown as { error?: DOMException }).error ??
          new Error('The recorder stopped unexpectedly.'),
      );
    };
    recorder.onstop = () => {
      // The captured video track belongs to this recording and nothing else;
      // leaving it live keeps the canvas being read sixty times a second after
      // the export has finished.
      for (const track of stream.getVideoTracks()) track.stop();
      if (cancelled) {
        reject(new RecordingCancelled());
        return;
      }
      // The type is set from the recorder rather than the requested format:
      // a browser may hand back a container it prefers over the one asked for.
      resolve(new Blob(chunks, { type: recorder.mimeType || format.mimeType }));
    };
  });

  // A timeslice keeps chunks arriving during the recording. Without one,
  // everything is delivered in a single blob at the end, and a long show can
  // exhaust memory before it gets there.
  recorder.start(1000);

  return {
    done,
    stop: () => {
      if (recorder.state !== 'inactive') recorder.stop();
    },
    cancel: () => {
      cancelled = true;
      if (recorder.state !== 'inactive') recorder.stop();
    },
  };
}

/** Hand a finished recording to the user as a download. */
export function downloadRecording(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoked on the next tick: revoking synchronously can beat the download in
  // some browsers, and the file arrives empty.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
