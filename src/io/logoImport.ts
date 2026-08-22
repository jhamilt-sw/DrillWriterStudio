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
 * Reading a logo image the user picked.
 *
 * A show file embeds its logos so it stays self-contained, which makes image
 * size a file-size problem: a 4000px school crest is 5MB of base64 that has to
 * be parsed every time the show opens. So images are downscaled on import to a
 * sensible maximum before being embedded, and re-encoded as PNG or JPEG.
 */

/** Longest edge kept after downscaling. Ample for a field graphic. */
export const MAX_LOGO_PIXELS = 1024;

/** Refuse anything wildly oversized before spending time decoding it. */
const MAX_SOURCE_BYTES = 24 * 1024 * 1024;

export interface ImportedLogo {
  name: string;
  dataUrl: string;
  /** width / height of the source image. */
  aspectRatio: number;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.readAsDataURL(file);
  });
}

function decode(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error('That image could not be decoded. Try a PNG or JPEG.'));
    image.src = dataUrl;
  });
}

export async function loadLogoFile(file: File): Promise<ImportedLogo> {
  if (!file.type.startsWith('image/')) {
    throw new Error(`${file.name} is not an image.`);
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error(
      `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB — too large to embed. ` +
        'Scale it down and try again.',
    );
  }

  const sourceUrl = await readAsDataUrl(file);
  const image = await decode(sourceUrl);

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (width === 0 || height === 0) {
    throw new Error('That image has no dimensions.');
  }

  const name = file.name.replace(/\.[^.]+$/, '') || 'Logo';
  const aspectRatio = width / height;

  // Already small enough, and in a format that embeds directly: keep the
  // original bytes rather than re-encoding and losing quality for nothing.
  const withinBudget = Math.max(width, height) <= MAX_LOGO_PIXELS;
  const embeddable = file.type === 'image/png' || file.type === 'image/jpeg';
  if (withinBudget && embeddable) {
    return { name, dataUrl: sourceUrl, aspectRatio };
  }

  const scale = Math.min(1, MAX_LOGO_PIXELS / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not process that image.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  // PNG preserves the transparency a crest almost always has; a photographic
  // JPEG is re-encoded as JPEG to avoid ballooning it into a lossless format.
  const outputType = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  const dataUrl = canvas.toDataURL(outputType, 0.92);

  return { name, dataUrl, aspectRatio };
}
