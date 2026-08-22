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
 * Drawing a field into a PDF page.
 *
 * Shared by the director's drill charts and the thumbnail on a coordinate
 * sheet, so a printed chart and the on-screen canvas agree on geometry and
 * orientation: front sideline along the bottom, back sideline along the top.
 *
 * The field is drawn on white regardless of the show's turf colour. A chart
 * book is read under fluorescent light and printed in ink; a page of solid
 * green would be unreadable and would empty a toner cartridge.
 */

import {
  type PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  rgb,
} from 'pdf-lib';

import type { DrillPoint, FieldLogo, PerformerSymbol, Show } from '../../core/types.ts';
import {
  HASH_MARK_LENGTH_FEET,
  type FieldMetrics,
  feetToSteps,
  hashMarkXs,
  yardLines,
  yardTicks,
} from '../../core/field.ts';

export interface PdfBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfFieldTransform {
  scale: number;
  /** PDF x of drill x = 0. */
  originX: number;
  /** PDF y of drill y = 0 (the front sideline). */
  originY: number;
}

/**
 * Fit a field inside `box`, centred.
 *
 * Charts are drawn as the press box sees them — front sideline along the bottom
 * — matching the editor. PDF's own y axis already grows upward, so drill y and
 * page y run the same way here and the transform simply adds.
 */
export function fitFieldToPdfBox(
  metrics: FieldMetrics,
  box: PdfBox,
  includeEndZones: boolean,
): PdfFieldTransform {
  const endZone = includeEndZones ? metrics.endZoneSteps : 0;
  const contentWidth = metrics.widthSteps + endZone * 2;
  const contentHeight = metrics.depthSteps;
  const scale = Math.min(box.width / contentWidth, box.height / contentHeight);
  const renderedWidth = contentWidth * scale;
  const renderedHeight = contentHeight * scale;
  return {
    scale,
    originX: box.x + (box.width - renderedWidth) / 2 + endZone * scale,
    // Drill y = 0 (the front sideline) sits at the bottom of the fitted area.
    originY: box.y + (box.height - renderedHeight) / 2,
  };
}

export function drillToPdf(
  point: DrillPoint,
  transform: PdfFieldTransform,
): { x: number; y: number } {
  return {
    x: transform.originX + point.x * transform.scale,
    y: transform.originY + point.y * transform.scale,
  };
}

const GREY = (value: number) => rgb(value, value, value);

/** Parse `#rrggbb` into a pdf-lib colour, falling back to mid grey. */
export function hexToRgb(hex: string) {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return GREY(0.4);
  return rgb(
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  );
}

export interface DrawFieldOptions {
  showEndZones: boolean;
  /** Draw a light one-step grid. Useful for charts a designer marks up. */
  showStepGrid?: boolean;
  /**
   * Draw a continuous line along each hash. Defaults to on.
   *
   * Unlike turf and line colour — which printed charts deliberately ignore, so
   * a book prints readably in ink — this is structural. A designer who aligns
   * forms to a visible hash on screen needs the same reference on the page.
   */
  showHashLines?: boolean;
  font: PDFFont;
}

/** Yard lines, hashes, sidelines and printed numbers. */
export function drawField(
  page: PDFPage,
  metrics: FieldMetrics,
  transform: PdfFieldTransform,
  options: DrawFieldOptions,
): void {
  const { scale } = transform;
  // Named by where they land on the page, not by which sideline they are: the
  // front sideline is now the *lower* edge.
  const frontY = drillToPdf({ x: 0, y: 0 }, transform).y;
  const backY = drillToPdf({ x: 0, y: metrics.depthSteps }, transform).y;
  const bottomY = Math.min(frontY, backY);
  const topY = Math.max(frontY, backY);

  // End zones, drawn first so everything else sits on top.
  if (options.showEndZones) {
    for (const side of [-1, 1]) {
      const outer = side === -1 ? -metrics.endZoneSteps : metrics.widthSteps;
      const start = drillToPdf({ x: outer, y: 0 }, transform);
      page.drawRectangle({
        x: start.x,
        y: bottomY,
        width: metrics.endZoneSteps * scale,
        height: topY - bottomY,
        color: GREY(0.955),
        borderColor: GREY(0.75),
        borderWidth: 0.5,
      });
    }
  }

  // Playing surface.
  const surfaceStart = drillToPdf({ x: 0, y: 0 }, transform);
  page.drawRectangle({
    x: surfaceStart.x,
    y: bottomY,
    width: metrics.widthSteps * scale,
    height: topY - bottomY,
    color: rgb(1, 1, 1),
    borderColor: GREY(0.25),
    borderWidth: 1.5,
  });

  if (options.showStepGrid && scale > 1.6) {
    for (let step = 1; step < metrics.widthSteps; step += 1) {
      if (step % metrics.stepsPerFiveYardLine === 0) continue;
      const x = transform.originX + step * scale;
      page.drawLine({
        start: { x, y: bottomY },
        end: { x, y: topY },
        thickness: 0.15,
        color: GREY(0.9),
      });
    }
  }

  // Five-yard lines.
  for (const line of yardLines(metrics)) {
    const x = transform.originX + line.x * scale;
    const isGoalLine = line.yardsFromSide1 === 0 || line.yardsFromSide1 === 100;
    page.drawLine({
      start: { x, y: bottomY },
      end: { x, y: topY },
      thickness: isGoalLine ? 1.5 : line.isNumbered ? 1.1 : 0.7,
      color: isGoalLine ? GREY(0.3) : GREY(0.62),
    });
  }

  // Hash marks: a tick every yard along both hash lines, over a continuous
  // hash line. The line is what a designer aligns a form to, and a printed
  // chart is read the same way as the screen — so it is drawn here too, at the
  // lightest weight on the page so it never competes with a performer's dot.
  const halfMark =
    (feetToSteps(HASH_MARK_LENGTH_FEET, metrics.config.stepsPerFiveYards) * scale) / 2;
  for (const hashY of [metrics.frontHashY, metrics.backHashY]) {
    const y = drillToPdf({ x: 0, y: hashY }, transform).y;
    if (options.showHashLines !== false) {
      page.drawLine({
        start: { x: transform.originX, y },
        end: { x: transform.originX + metrics.widthSteps * scale, y },
        thickness: 0.4,
        color: GREY(0.72),
      });
    }
    // Along the field, not across it — see `hashMarkXs`. Skipped when the
    // continuous line is drawn, since the two occupy the same place.
    if (options.showHashLines !== false) continue;
    for (const stepX of hashMarkXs(metrics)) {
      const x = transform.originX + stepX * scale;
      page.drawLine({
        start: { x: x - halfMark, y },
        end: { x: x + halfMark, y },
        thickness: 0.9,
        color: GREY(0.45),
      });
    }
  }

  // Yard markers: ticks across the field, in from the sidelines and out from
  // the hashes.
  for (const tick of yardTicks(metrics)) {
    const x = transform.originX + tick.x * scale;
    page.drawLine({
      start: { x, y: drillToPdf({ x: tick.x, y: tick.fromY }, transform).y },
      end: { x, y: drillToPdf({ x: tick.x, y: tick.toY }, transform).y },
      thickness: 0.7,
      color: GREY(0.5),
    });
  }

  // Printed yard numbers, top and bottom, as they appear on a real field.
  const numberSize = Math.max(4.5, Math.min(11, scale * 2.6));
  for (const line of yardLines(metrics)) {
    if (!line.isNumbered) continue;
    const label = String(line.number);
    const width = options.font.widthOfTextAtSize(label, numberSize);
    const x = transform.originX + line.x * scale - width / 2;
    for (const y of [topY - numberSize * 1.9, bottomY + numberSize * 0.9]) {
      page.drawText(label, { x, y, size: numberSize, font: options.font, color: GREY(0.62) });
    }
  }
}

/**
 * Paint the show's logos onto a chart.
 *
 * Embedded once per document and reused across pages — a crest embedded forty
 * times would multiply the file size by forty. A payload pdf-lib cannot decode
 * (a progressive JPEG, say) is skipped rather than failing the whole export:
 * a chart book without a logo is still a chart book.
 */
export async function embedLogos(
  doc: PDFDocument,
  logos: FieldLogo[],
): Promise<Map<string, PDFImage>> {
  const embedded = new Map<string, PDFImage>();
  for (const logo of logos) {
    if (!logo.visible || embedded.has(logo.dataUrl)) continue;
    try {
      const [header, payload] = logo.dataUrl.split(',');
      if (!payload) continue;
      const bytes = Uint8Array.from(atob(payload), (character) =>
        character.charCodeAt(0),
      );
      const image = header.includes('image/png')
        ? await doc.embedPng(bytes)
        : await doc.embedJpg(bytes);
      embedded.set(logo.dataUrl, image);
    } catch {
      // Undecodable image: leave it out of the chart.
    }
  }
  return embedded;
}

export function drawLogos(
  page: PDFPage,
  logos: FieldLogo[],
  images: Map<string, PDFImage>,
  transform: PdfFieldTransform,
): void {
  for (const logo of logos) {
    if (!logo.visible) continue;
    const image = images.get(logo.dataUrl);
    if (!image) continue;
    const centre = drillToPdf(logo.center, transform);
    const width = logo.widthSteps * transform.scale;
    const height = logo.heightSteps * transform.scale;
    page.drawImage(image, {
      x: centre.x - width / 2,
      y: centre.y - height / 2,
      width,
      height,
      // Printed charts get a lighter hand than the screen: the marks on top are
      // what a director reads, and a strong logo underneath fights them.
      opacity: Math.min(logo.opacity, 0.35),
    });
  }
}

/** One performer marker. */
export function drawPerformerMarker(
  page: PDFPage,
  point: { x: number; y: number },
  radius: number,
  symbol: PerformerSymbol,
  color: ReturnType<typeof rgb>,
): void {
  switch (symbol) {
    case 'square':
      page.drawRectangle({
        x: point.x - radius,
        y: point.y - radius,
        width: radius * 2,
        height: radius * 2,
        color,
        borderColor: GREY(0.15),
        borderWidth: 0.3,
      });
      break;
    case 'triangle':
      page.drawSvgPath(
        `M 0 0 L ${radius * 2} 0 L ${radius} ${radius * 2} Z`,
        {
          x: point.x - radius,
          y: point.y + radius,
          color,
          borderColor: GREY(0.15),
          borderWidth: 0.3,
        },
      );
      break;
    case 'diamond':
      page.drawSvgPath(
        `M ${radius} 0 L ${radius * 2} ${radius} L ${radius} ${radius * 2} L 0 ${radius} Z`,
        {
          x: point.x - radius,
          y: point.y + radius,
          color,
          borderColor: GREY(0.15),
          borderWidth: 0.3,
        },
      );
      break;
    case 'circle':
    default:
      page.drawCircle({
        x: point.x,
        y: point.y,
        size: radius,
        color,
        borderColor: GREY(0.15),
        borderWidth: 0.3,
      });
      break;
  }
}

/** A legend mapping section colours to names, laid out across the page. */
export function drawSectionLegend(
  page: PDFPage,
  show: Show,
  box: PdfBox,
  font: PDFFont,
  size = 7,
): void {
  let x = box.x;
  let y = box.y;
  const columnGap = 12;
  for (const section of show.sections) {
    const label = `${section.abbreviation} ${section.name}`;
    const width = font.widthOfTextAtSize(label, size) + size + 6;
    if (x + width > box.x + box.width) {
      x = box.x;
      y -= size + 4;
      if (y < box.y - box.height) return;
    }
    drawPerformerMarker(
      page,
      { x: x + size / 2, y: y + size / 2 - 1 },
      size / 2,
      section.symbol,
      hexToRgb(section.color),
    );
    page.drawText(label, {
      x: x + size + 3,
      y,
      size,
      font,
      color: GREY(0.25),
    });
    x += width + columnGap;
  }
}
