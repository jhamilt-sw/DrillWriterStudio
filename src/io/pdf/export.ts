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
 * PDF generation (FR-2.1 – FR-2.4).
 *
 * Two documents come out of a show:
 *
 *   * the director's book — one full-field chart per set, every performer
 *     marked and labelled;
 *   * performer coordinate sheets — one page (or more) per marcher listing
 *     every set they appear in, written in standard drill notation.
 *
 * Both are produced client-side with pdf-lib, so nothing about a roster ever
 * leaves the browser (NFR-2).
 */

import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  StandardFonts,
  rgb,
} from 'pdf-lib';

import type { Performer, Show } from '../../core/types.ts';
import { describeStepSize, fieldMetrics } from '../../core/field.ts';
import { describePoint, formatSteps } from '../../core/notation.ts';
import {
  countsAtSet,
  findSectionById,
  metricsForShow,
  resolvePosition,
  resolveSetPositions,
  sortedPerformers,
} from '../../core/show.ts';
import { analyseSegment, segmentsIntoSet } from '../../core/interpolate.ts';
import { APP_NAME } from '../../core/app.ts';
import { showFileBaseName } from '../../core/schema.ts';
import { formatCitation, hasCitation } from '../../core/audioSource.ts';
import { downloadBlob } from '../fileSystem.ts';
import {
  type PdfBox,
  drawField,
  drawLogos,
  embedLogos,
  drawPerformerMarker,
  drawSectionLegend,
  drillToPdf,
  fitFieldToPdfBox,
  hexToRgb,
} from './fieldDrawing.ts';

const LETTER_LANDSCAPE: [number, number] = [792, 612];
const LETTER_PORTRAIT: [number, number] = [612, 792];
const MARGIN = 36;

const GREY = (value: number) => rgb(value, value, value);

export interface ChartOptions {
  /** Draw the previous set's positions as hollow markers behind the current. */
  showPreviousSet: boolean;
  /** Draw movement paths from the previous set. */
  showPaths: boolean;
  showLabels: boolean;
  showEndZones: boolean;
  showLegend: boolean;
  /** Restrict the chart to one section — useful for sectional rehearsals. */
  sectionId?: string | null;
  /** Print the field logos faintly beneath the drill. */
  showLogos: boolean;
}

export interface CoordinateSheetOptions {
  /** Rounding used for written coordinates, in steps. */
  precisionSteps: number;
  /** Include a "steps to travel" column to help marchers pace a move. */
  includeMoveDistance: boolean;
  /** Only these performers; omit for the whole ensemble. */
  performerIds?: string[] | null;
}

export const DEFAULT_CHART_OPTIONS: ChartOptions = {
  showPreviousSet: true,
  showPaths: true,
  showLabels: true,
  showEndZones: true,
  showLegend: true,
  sectionId: null,
  showLogos: false,
};

export const DEFAULT_SHEET_OPTIONS: CoordinateSheetOptions = {
  precisionSteps: 0.25,
  includeMoveDistance: true,
  performerIds: null,
};

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

function drawPageHeader(
  page: PDFPage,
  fonts: Fonts,
  left: string,
  right: string,
  subtitle?: string,
): void {
  const { width, height } = page.getSize();
  page.drawText(left, {
    x: MARGIN,
    y: height - MARGIN + 4,
    size: 12,
    font: fonts.bold,
    color: GREY(0.12),
  });
  if (subtitle) {
    page.drawText(subtitle, {
      x: MARGIN,
      y: height - MARGIN - 9,
      size: 8,
      font: fonts.regular,
      color: GREY(0.42),
    });
  }
  const rightWidth = fonts.regular.widthOfTextAtSize(right, 9);
  page.drawText(right, {
    x: width - MARGIN - rightWidth,
    y: height - MARGIN + 5,
    size: 9,
    font: fonts.regular,
    color: GREY(0.42),
  });
  page.drawLine({
    start: { x: MARGIN, y: height - MARGIN - 16 },
    end: { x: width - MARGIN, y: height - MARGIN - 16 },
    thickness: 0.5,
    color: GREY(0.78),
  });
}

function drawPageFooter(page: PDFPage, fonts: Fonts, text: string): void {
  const { width } = page.getSize();
  const textWidth = fonts.regular.widthOfTextAtSize(text, 7);
  page.drawText(text, {
    x: width - MARGIN - textWidth,
    y: MARGIN - 16,
    size: 7,
    font: fonts.regular,
    color: GREY(0.6),
  });
}

/** Context line for a set: counts in, running total, and music position. */
export function setContextLine(show: Show, setIndex: number): string {
  const set = show.sets[setIndex];
  if (!set) return '';
  const parts: string[] = [];
  if (setIndex > 0) parts.push(`${set.counts} counts`);
  parts.push(`count ${countsAtSet(show, setIndex)} of ${countsAtSet(show, show.sets.length - 1)}`);
  if (set.music) parts.push(`m. ${set.music.measure} beat ${set.music.beat}`);
  if (set.notes) parts.push(set.notes);
  return parts.join('  ·  ');
}

// ---------------------------------------------------------------- charts --

/** The director's book: one landscape chart per set. */
export async function buildDrillChartPdf(
  show: Show,
  options: ChartOptions = DEFAULT_CHART_OPTIONS,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${show.metadata.title} — drill charts`);
  doc.setProducer(APP_NAME);
  doc.setCreator(APP_NAME);

  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const metrics = fieldMetrics(show.field);

  const visiblePerformers = options.sectionId
    ? show.performers.filter((performer) => performer.sectionId === options.sectionId)
    : show.performers;
  const visibleIds = new Set(visiblePerformers.map((performer) => performer.id));

  const legendHeight = options.showLegend ? 26 : 0;
  // Embedded once for the whole document, then referenced by every page.
  const logoImages = await embedLogos(doc, show.fieldLogos);

  show.sets.forEach((set, setIndex) => {
    const page = doc.addPage(LETTER_LANDSCAPE);
    const { width, height } = page.getSize();

    drawPageHeader(
      page,
      fonts,
      `Set ${set.label}`,
      [show.metadata.title, show.metadata.ensemble].filter(Boolean).join(' — '),
      setContextLine(show, setIndex),
    );

    const box: PdfBox = {
      x: MARGIN,
      y: MARGIN + legendHeight,
      width: width - MARGIN * 2,
      height: height - MARGIN * 2 - 34 - legendHeight,
    };
    const transform = fitFieldToPdfBox(metrics, box, options.showEndZones);
    drawField(page, metrics, transform, {
      showEndZones: options.showEndZones,
      // The hash line is a reference the designer aligns to, so the page shows
      // whatever the screen shows.
      showHashLines: show.field.appearance.showHashLines,
      font: fonts.regular,
    });
    if (options.showLogos) drawLogos(page, show.fieldLogos, logoImages, transform);

    const positions = resolveSetPositions(show, setIndex);
    const radius =
      Math.max(1.8, transform.scale * 0.42) *
      Math.max(0.4, Math.min(3, show.field.appearance.performerSize));

    // Ghost the previous set, then the paths, then the current positions, so
    // markers always sit on top of the lines that lead to them.
    if (options.showPreviousSet && setIndex > 0) {
      const previous = resolveSetPositions(show, setIndex - 1);
      for (const [performerId, point] of Object.entries(previous)) {
        if (!visibleIds.has(performerId)) continue;
        const pdfPoint = drillToPdf(point, transform);
        page.drawCircle({
          x: pdfPoint.x,
          y: pdfPoint.y,
          size: radius,
          borderColor: GREY(0.72),
          borderWidth: 0.4,
        });
      }
    }

    if (options.showPaths && setIndex > 0) {
      for (const segment of segmentsIntoSet(show, setIndex)) {
        if (!visibleIds.has(segment.performerId)) continue;
        const from = drillToPdf(segment.from, transform);
        const to = drillToPdf(segment.to, transform);
        if (Math.hypot(to.x - from.x, to.y - from.y) < 0.5) continue;
        page.drawLine({
          start: from,
          end: to,
          thickness: 0.4,
          color: GREY(0.62),
          opacity: 0.85,
        });
      }
    }

    for (const performer of visiblePerformers) {
      const point = positions[performer.id];
      if (!point) continue;
      const section = findSectionById(show, performer.sectionId);
      const pdfPoint = drillToPdf(point, transform);
      drawPerformerMarker(
        page,
        pdfPoint,
        radius,
        section?.symbol ?? 'circle',
        hexToRgb(section?.color ?? '#444444'),
      );
      if (options.showLabels && transform.scale > 2.2) {
        const size = Math.max(3.6, Math.min(6, transform.scale * 1.3));
        const labelWidth = fonts.regular.widthOfTextAtSize(performer.label, size);
        page.drawText(performer.label, {
          x: pdfPoint.x - labelWidth / 2,
          y: pdfPoint.y + radius + 1.4,
          size,
          font: fonts.regular,
          color: GREY(0.25),
        });
      }
    }

    if (options.showLegend) {
      drawSectionLegend(
        page,
        show,
        { x: MARGIN, y: MARGIN + 6, width: width - MARGIN * 2, height: legendHeight },
        fonts.regular,
      );
    }

    drawPageFooter(
      page,
      fonts,
      `Set ${setIndex + 1} of ${show.sets.length}  ·  ${show.metadata.season}`,
    );
  });

  return doc.save();
}

// ------------------------------------------------------ coordinate sheets --

interface SheetRow {
  set: string;
  counts: string;
  side: string;
  front: string;
  move: string;
}

/**
 * Movement summaries for every performer at every set, computed once.
 *
 * Looking a segment up per performer per set would rebuild the whole segment
 * list on each lookup — quadratic in the roster, which at 250 performers and 40
 * sets is millions of pointless allocations. One pass up front, then O(1)
 * lookups while laying out pages.
 */
function buildMoveIndex(
  show: Show,
  options: CoordinateSheetOptions,
): Map<number, Map<string, string>> {
  const index = new Map<number, Map<string, string>>();
  if (!options.includeMoveDistance) return index;
  const metrics = metricsForShow(show);
  for (let setIndex = 1; setIndex < show.sets.length; setIndex += 1) {
    const perPerformer = new Map<string, string>();
    for (const segment of segmentsIntoSet(show, setIndex)) {
      const analysis = analyseSegment(segment, metrics);
      perPerformer.set(
        segment.performerId,
        analysis.distanceSteps < 0.05
          ? 'hold'
          : `${formatSteps(analysis.distanceSteps)} steps · ${analysis.inchesPerStep.toFixed(0)}"`,
      );
    }
    index.set(setIndex, perPerformer);
  }
  return index;
}

function buildSheetRows(
  show: Show,
  performer: Performer,
  options: CoordinateSheetOptions,
  moveIndex: Map<number, Map<string, string>>,
): SheetRow[] {
  const metrics = metricsForShow(show);
  const rows: SheetRow[] = [];
  show.sets.forEach((set, setIndex) => {
    const point = resolvePosition(show, performer.id, setIndex);
    if (!point) return;
    const written = describePoint(point, metrics, {
      precisionSteps: options.precisionSteps,
    });
    rows.push({
      set: set.label,
      counts: setIndex === 0 ? '—' : String(set.counts),
      side: written.horizontal.text,
      front: written.vertical.text,
      move: moveIndex.get(setIndex)?.get(performer.id) ?? '',
    });
  });
  return rows;
}

/**
 * Coordinate sheets. One performer per page (continuing onto more pages when a
 * show has more sets than fit), batched into a single document so a whole
 * ensemble's packet prints in one go (FR-2.3).
 */
export async function buildCoordinateSheetPdf(
  show: Show,
  options: CoordinateSheetOptions = DEFAULT_SHEET_OPTIONS,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${show.metadata.title} — coordinate sheets`);
  doc.setProducer(APP_NAME);
  doc.setCreator(APP_NAME);

  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  const wanted = options.performerIds ? new Set(options.performerIds) : null;
  const performers = sortedPerformers(show).filter(
    (performer) => !wanted || wanted.has(performer.id),
  );

  if (performers.length === 0) {
    const page = doc.addPage(LETTER_PORTRAIT);
    drawPageHeader(page, fonts, show.metadata.title, 'Coordinate sheets');
    page.drawText('No performers in this show yet.', {
      x: MARGIN,
      y: page.getSize().height - MARGIN - 44,
      size: 10,
      font: fonts.regular,
      color: GREY(0.45),
    });
    return doc.save();
  }

  const includeMove = options.includeMoveDistance;
  const columns = includeMove
    ? [
        { key: 'set' as const, label: 'Set', width: 34 },
        { key: 'counts' as const, label: 'Cts', width: 30 },
        { key: 'side' as const, label: 'Side to side', width: 200 },
        { key: 'front' as const, label: 'Front to back', width: 196 },
        { key: 'move' as const, label: 'Move', width: 80 },
      ]
    : [
        { key: 'set' as const, label: 'Set', width: 38 },
        { key: 'counts' as const, label: 'Cts', width: 34 },
        { key: 'side' as const, label: 'Side to side', width: 232 },
        { key: 'front' as const, label: 'Front to back', width: 236 },
      ];

  const rowHeight = 15.5;
  const moveIndex = buildMoveIndex(show, options);

  for (const performer of performers) {
    const section = findSectionById(show, performer.sectionId);
    const rows = buildSheetRows(show, performer, options, moveIndex);
    const heading = [performer.label, performer.name].filter(Boolean).join(' — ');
    const subtitle = [section?.name, show.metadata.ensemble, show.metadata.season]
      .filter(Boolean)
      .join('  ·  ');

    let page = doc.addPage(LETTER_PORTRAIT);
    let { height } = page.getSize();
    let cursorY = height - MARGIN - 40;
    let pageNumber = 1;

    const startPage = () => {
      drawPageHeader(
        page,
        fonts,
        heading,
        show.metadata.title,
        pageNumber === 1 ? subtitle : `${subtitle}  ·  continued`,
      );
      // Column headings.
      let x = MARGIN;
      for (const column of columns) {
        page.drawText(column.label, {
          x,
          y: cursorY,
          size: 7.5,
          font: fonts.bold,
          color: GREY(0.42),
        });
        x += column.width;
      }
      cursorY -= 5;
      page.drawLine({
        start: { x: MARGIN, y: cursorY },
        end: { x: page.getSize().width - MARGIN, y: cursorY },
        thickness: 0.5,
        color: GREY(0.78),
      });
      cursorY -= rowHeight;
    };

    startPage();

    rows.forEach((row, rowIndex) => {
      if (cursorY < MARGIN + 18) {
        drawPageFooter(page, fonts, `${heading}  ·  page ${pageNumber}`);
        page = doc.addPage(LETTER_PORTRAIT);
        height = page.getSize().height;
        cursorY = height - MARGIN - 40;
        pageNumber += 1;
        startPage();
      }
      // Zebra striping keeps a long list readable without relying on colour.
      if (rowIndex % 2 === 1) {
        page.drawRectangle({
          x: MARGIN - 3,
          y: cursorY - 3.5,
          width: page.getSize().width - MARGIN * 2 + 6,
          height: rowHeight - 2,
          color: GREY(0.965),
        });
      }
      let x = MARGIN;
      for (const column of columns) {
        const value = row[column.key];
        page.drawText(value, {
          x,
          y: cursorY,
          size: 8,
          font: column.key === 'set' ? fonts.bold : fonts.regular,
          color: GREY(0.12),
          maxWidth: column.width - 6,
        });
        x += column.width;
      }
      cursorY -= rowHeight;
    });

    drawPageFooter(page, fonts, `${heading}  ·  page ${pageNumber}`);
  }

  return doc.save();
}

// ------------------------------------------------------------- delivery ---

function toBlob(bytes: Uint8Array): Blob {
  // Copy into a fresh ArrayBuffer so the Blob never aliases pdf-lib's buffer.
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Blob([copy], { type: 'application/pdf' });
}

export async function exportDrillCharts(
  show: Show,
  options?: ChartOptions,
): Promise<void> {
  const bytes = await buildDrillChartPdf(show, options);
  downloadBlob(toBlob(bytes), `${showFileBaseName(show)}-drill-charts.pdf`);
}

export async function exportCoordinateSheets(
  show: Show,
  options?: CoordinateSheetOptions,
): Promise<void> {
  const bytes = await buildCoordinateSheetPdf(show, options);
  downloadBlob(toBlob(bytes), `${showFileBaseName(show)}-coordinates.pdf`);
}

/** A one-page overview of the show: every set, its counts and its music spot. */
/** Break a long credit across lines, since the page has no text wrapping. */
function wrapForWidth(text: string, characters: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (line && (line + ' ' + word).length > characters) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function buildShowSummaryPdf(show: Show): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${show.metadata.title} — show summary`);
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const metrics = metricsForShow(show);

  let page = doc.addPage(LETTER_PORTRAIT);
  drawPageHeader(
    page,
    fonts,
    show.metadata.title || 'Untitled show',
    'Show summary',
    [show.metadata.ensemble, show.metadata.season, show.metadata.designer]
      .filter(Boolean)
      .join('  ·  '),
  );

  let cursorY = page.getSize().height - MARGIN - 44;
  const line = (text: string, bold = false, indent = 0) => {
    if (cursorY < MARGIN) {
      page = doc.addPage(LETTER_PORTRAIT);
      cursorY = page.getSize().height - MARGIN;
    }
    page.drawText(text, {
      x: MARGIN + indent,
      y: cursorY,
      size: bold ? 9 : 8.5,
      font: bold ? fonts.bold : fonts.regular,
      color: GREY(bold ? 0.12 : 0.3),
    });
    cursorY -= bold ? 16 : 13;
  };

  line(
    `${show.performers.length} performers · ${show.sets.length} sets · ` +
      `${countsAtSet(show, show.sets.length - 1)} counts`,
    true,
  );
  line(
    `Field: ${show.field.type === 'highSchool' ? 'High school' : show.field.type === 'college' ? 'College' : 'Professional'} hashes · ` +
      describeStepSize(show.field.stepsPerFiveYards),
  );
  // The music credit, where a programme editor would look for it.
  if (hasCitation(show.music.audioSource)) {
    cursorY -= 4;
    line('Music', true);
    for (const chunk of wrapForWidth(formatCitation(show.music.audioSource), 108)) {
      line(chunk);
    }
    const notes = show.music.audioSource?.notes?.trim();
    if (notes) for (const chunk of wrapForWidth(notes, 108)) line(chunk);
  }

  cursorY -= 6;

  line('Sets', true);
  show.sets.forEach((set, index) => {
    const demanding = segmentsIntoSet(show, index)
      .map((segment) => analyseSegment(segment, metrics))
      .filter((analysis) => analysis.inchesPerStep > 30).length;
    const bits = [
      `Set ${set.label}`,
      index === 0 ? 'opening' : `${set.counts} cts`,
      set.music ? `m.${set.music.measure}` : null,
      demanding > 0 ? `${demanding} demanding move${demanding === 1 ? '' : 's'}` : null,
      set.notes ?? null,
    ].filter(Boolean);
    line(bits.join('  ·  '), false, 8);
  });

  cursorY -= 6;
  line('Sections', true);
  for (const section of show.sections) {
    const count = show.performers.filter(
      (performer) => performer.sectionId === section.id,
    ).length;
    if (count === 0) continue;
    line(`${section.name} (${section.abbreviation}) — ${count}`, false, 8);
  }

  return doc.save();
}

export async function exportShowSummary(show: Show): Promise<void> {
  const bytes = await buildShowSummaryPdf(show);
  downloadBlob(toBlob(bytes), `${showFileBaseName(show)}-summary.pdf`);
}
