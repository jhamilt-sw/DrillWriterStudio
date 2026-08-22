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
 * Save-file schema: validation and migration (FR-6.1, NFR-5).
 *
 * The file format is documented in docs/file-format.md. The contract is that a
 * file written by any released version opens in every later version — so this
 * module never rejects a file for being old, only for being malformed, and
 * every migration step is additive and reversible in spirit.
 */

import type {
  AudioSource,
  DrillPoint,
  DrillSet,
  FieldAppearance,
  FieldLogo,
  Performer,
  Section,
  Show,
} from './types.ts';
import { DEFAULT_APPEARANCE, normaliseStepSize } from './field.ts';
import { APP_NAME } from './app.ts';
import { normaliseAudioSource } from './audioSource.ts';
import { isValidHex } from './color.ts';
import { CURRENT_SCHEMA_VERSION, DEFAULT_TEMPO_MAP, createEmptyShow } from './show.ts';

export const SHOW_FILE_EXTENSION = '.drillshow';
export const SHOW_FILE_MIME = 'application/json';

export class ShowFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShowFileError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asPoint(value: unknown): DrillPoint | null {
  if (!isRecord(value)) return null;
  const x = value.x;
  const y = value.y;
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}


/**
 * Parse and normalise an untrusted object into a Show. Unknown fields are
 * dropped; missing optional fields get defaults; anything structurally broken
 * raises a ShowFileError naming what was wrong.
 */
export function parseShow(input: unknown): Show {
  if (!isRecord(input)) {
    throw new ShowFileError('This file does not contain a drill show.');
  }
  const version = asNumber(input.schemaVersion, 0);
  if (version < 1) {
    throw new ShowFileError(
      `Missing schemaVersion — this file was not written by ${APP_NAME}.`,
    );
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new ShowFileError(
      `This show was saved by a newer version of ${APP_NAME} (format ${version}; ` +
        `this build reads up to ${CURRENT_SCHEMA_VERSION}). Update the app to open it.`,
    );
  }

  const template = createEmptyShow();

  const metadataRaw = isRecord(input.metadata) ? input.metadata : {};
  const fieldRaw = isRecord(input.field) ? input.field : {};
  const musicRaw = isRecord(input.music) ? input.music : {};
  const tempoMapRaw = isRecord(musicRaw.tempoMap) ? musicRaw.tempoMap : {};

  const sections: Section[] = Array.isArray(input.sections)
    ? input.sections.filter(isRecord).map((raw, index) => ({
        id: asString(raw.id, `sec_${index}`),
        name: asString(raw.name, `Section ${index + 1}`),
        abbreviation: asString(raw.abbreviation, 'S'),
        color: asString(raw.color, '#4477AA'),
        symbol: (['circle', 'square', 'triangle', 'diamond'] as const).includes(
          raw.symbol as never,
        )
          ? (raw.symbol as Section['symbol'])
          : 'circle',
      }))
    : template.sections;

  const sectionIds = new Set(sections.map((section) => section.id));
  const fallbackSectionId = sections[0]?.id ?? template.sections[0].id;

  const performers: Performer[] = Array.isArray(input.performers)
    ? input.performers.filter(isRecord).map((raw, index) => {
        const sectionId = asString(raw.sectionId);
        return {
          id: asString(raw.id, `perf_${index}`),
          label: asString(raw.label, `P${index + 1}`),
          name: asString(raw.name),
          sectionId: sectionIds.has(sectionId) ? sectionId : fallbackSectionId,
          order: asNumber(raw.order, index),
        };
      })
    : [];

  const performerIds = new Set(performers.map((performer) => performer.id));

  const setsRaw = Array.isArray(input.sets) ? input.sets.filter(isRecord) : [];
  const sets: DrillSet[] = setsRaw.map((raw, index) => {
    const positions: Record<string, DrillPoint> = {};
    if (isRecord(raw.positions)) {
      for (const [performerId, value] of Object.entries(raw.positions)) {
        if (!performerIds.has(performerId)) continue; // drop orphans
        const point = asPoint(value);
        if (point) positions[performerId] = point;
      }
    }

    const transitions: DrillSet['transitions'] = {};
    if (isRecord(raw.transitions)) {
      for (const [performerId, value] of Object.entries(raw.transitions)) {
        if (!performerIds.has(performerId) || !isRecord(value)) continue;
        const control = asPoint(value.control);
        transitions[performerId] = {
          style: value.style === 'curve' ? 'curve' : 'straight',
          ...(control ? { control } : {}),
          holdCounts: Math.max(0, asNumber(value.holdCounts, 0)),
        };
      }
    }

    const music = isRecord(raw.music)
      ? {
          measure: Math.max(1, Math.round(asNumber(raw.music.measure, 1))),
          beat: Math.max(1, Math.round(asNumber(raw.music.beat, 1))),
        }
      : undefined;

    return {
      id: asString(raw.id, `set_${index}`),
      label: asString(raw.label, String(index + 1)),
      counts: index === 0 ? 0 : Math.max(0, Math.round(asNumber(raw.counts, 8))),
      ...(asString(raw.notes) ? { notes: asString(raw.notes) } : {}),
      ...(music ? { music } : {}),
      positions,
      ...(Object.keys(transitions).length ? { transitions } : {}),
    };
  });

  // Step size is a free value rather than a fixed list, so it is clamped into
  // a sane range instead of being checked for membership. Anything unusable
  // falls back to the 8-to-5 standard.
  const stepSize = normaliseStepSize(fieldRaw.stepsPerFiveYards);
  const appearance = parseAppearance(fieldRaw.appearance);

  const show: Show = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    metadata: {
      title: asString(metadataRaw.title, 'Untitled Show'),
      ensemble: asString(metadataRaw.ensemble),
      season: asString(metadataRaw.season),
      designer: asString(metadataRaw.designer),
    },
    field: {
      type: (['highSchool', 'college', 'pro'] as const).includes(
        fieldRaw.type as never,
      )
        ? (fieldRaw.type as Show['field']['type'])
        : 'highSchool',
      stepsPerFiveYards: stepSize,
      showEndZones: fieldRaw.showEndZones !== false,
      appearance,
    },
    sections,
    performers,
    sets: sets.length > 0 ? sets : template.sets,
    fieldLogos: Array.isArray(input.fieldLogos)
      ? input.fieldLogos
          .filter(isRecord)
          .map(parseLogo)
          .filter((logo): logo is FieldLogo => logo !== null)
      : [],
    music: {
      tempoMap: {
        tempos: Array.isArray(tempoMapRaw.tempos)
          ? tempoMapRaw.tempos.filter(isRecord).map((raw) => ({
              measure: Math.max(1, Math.round(asNumber(raw.measure, 1))),
              bpm: Math.max(20, Math.min(400, asNumber(raw.bpm, 120))),
            }))
          : [...DEFAULT_TEMPO_MAP.tempos],
        meters: Array.isArray(tempoMapRaw.meters)
          ? tempoMapRaw.meters.filter(isRecord).map((raw) => ({
              measure: Math.max(1, Math.round(asNumber(raw.measure, 1))),
              beatsPerMeasure: Math.max(
                1,
                Math.round(asNumber(raw.beatsPerMeasure, 4)),
              ),
              beatUnit: Math.max(1, Math.round(asNumber(raw.beatUnit, 4))),
            }))
          : [...DEFAULT_TEMPO_MAP.meters],
        offsetSeconds: asNumber(tempoMapRaw.offsetSeconds, 0),
      },
      ...(isRecord(musicRaw.audio)
        ? {
            audio: {
              fileName: asString(musicRaw.audio.fileName, 'audio'),
              mimeType: asString(musicRaw.audio.mimeType, 'audio/mpeg'),
              durationSeconds: asNumber(musicRaw.audio.durationSeconds, 0),
              storage: musicRaw.audio.storage === 'embedded' ? 'embedded' : 'reference',
              ...(typeof musicRaw.audio.data === 'string'
                ? { data: musicRaw.audio.data }
                : {}),
              // Only a plausible hash survives: a stray value here would send
              // the audio cache looking for a recording that cannot exist.
              ...(typeof musicRaw.audio.hash === 'string' &&
              /^[0-9a-f]{8,64}$/.test(musicRaw.audio.hash)
                ? { hash: musicRaw.audio.hash }
                : {}),
            },
          }
        : {}),
      // The citation is cleaned on the way in: a show file arrives from another
      // director, and its link ends up in an href.
      ...(isRecord(musicRaw.audioSource)
        ? (() => {
            const source = normaliseAudioSource(
              musicRaw.audioSource as Partial<AudioSource>,
            );
            return source ? { audioSource: source } : {};
          })()
        : {}),
      ...(isRecord(musicRaw.score)
        ? {
            score: {
              fileName: asString(musicRaw.score.fileName, 'score.musicxml'),
              storage: musicRaw.score.storage === 'reference' ? 'reference' : 'embedded',
              ...(typeof musicRaw.score.data === 'string'
                ? { data: musicRaw.score.data }
                : {}),
            },
          }
        : {}),
    },
  };

  // The tempo map must always define measure 1, or count/time maths has no
  // starting point.
  if (!show.music.tempoMap.tempos.some((tempo) => tempo.measure === 1)) {
    show.music.tempoMap.tempos.unshift({ measure: 1, bpm: 120 });
  }
  if (!show.music.tempoMap.meters.some((meter) => meter.measure === 1)) {
    show.music.tempoMap.meters.unshift({ measure: 1, beatsPerMeasure: 4, beatUnit: 4 });
  }
  show.sets[0].counts = 0;

  return show;
}

/**
 * Field appearance, with every field individually defaulted.
 *
 * Appearance arrived after schema version 1, so a file written before it exists
 * simply has no `appearance` key — the additive-with-defaults rule in
 * docs/file-format.md is exactly what makes that a non-event.
 */
function parseAppearance(raw: unknown): FieldAppearance {
  if (!isRecord(raw)) return { ...DEFAULT_APPEARANCE };
  const colour = (value: unknown, fallback: string): string =>
    typeof value === 'string' && isValidHex(value) ? value : fallback;
  return {
    turfColor: colour(raw.turfColor, DEFAULT_APPEARANCE.turfColor),
    endZoneColor: colour(raw.endZoneColor, DEFAULT_APPEARANCE.endZoneColor),
    lineColor: colour(raw.lineColor, DEFAULT_APPEARANCE.lineColor),
    numberColor: colour(raw.numberColor, DEFAULT_APPEARANCE.numberColor),
    lineWeight: Math.max(0.25, Math.min(4, asNumber(raw.lineWeight, 1))),
    performerSize: Math.max(0.4, Math.min(3, asNumber(raw.performerSize, 1))),
    showMowingStripes: raw.showMowingStripes !== false,
    showHashLines: raw.showHashLines !== false,
  };
}

/** Largest image payload accepted from a file, to keep show files openable. */
export const MAX_LOGO_DATA_URL_LENGTH = 8 * 1024 * 1024;

function parseLogo(raw: Record<string, unknown>): FieldLogo | null {
  const dataUrl = asString(raw.dataUrl);
  // Anything that is not an embedded image is dropped rather than trusted: a
  // show file should never cause a fetch to somewhere else.
  if (!dataUrl.startsWith('data:image/')) return null;
  if (dataUrl.length > MAX_LOGO_DATA_URL_LENGTH) return null;
  const center = asPoint(raw.center) ?? { x: 0, y: 0 };
  return {
    id: asString(raw.id, `logo_${Math.abs(hashString(dataUrl))}`),
    name: asString(raw.name, 'Logo'),
    dataUrl,
    center,
    widthSteps: Math.max(0.5, asNumber(raw.widthSteps, 32)),
    heightSteps: Math.max(0.5, asNumber(raw.heightSteps, 32)),
    rotationDegrees: asNumber(raw.rotationDegrees, 0),
    opacity: Math.max(0, Math.min(1, asNumber(raw.opacity, 0.85))),
    visible: raw.visible !== false,
    lockAspect: raw.lockAspect !== false,
    locked: raw.locked === true,
  };
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return hash;
}

/** Serialise a show to the on-disk JSON text. */
export function serialiseShow(show: Show, pretty = true): string {
  const payload: Show = { ...show, schemaVersion: CURRENT_SCHEMA_VERSION };
  return JSON.stringify(payload, null, pretty ? 2 : 0);
}

export function deserialiseShow(text: string): Show {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ShowFileError('That file is not valid JSON.');
  }
  return parseShow(parsed);
}

/** A filesystem-safe name for a show's export files. */
export function showFileBaseName(show: Show): string {
  const raw = show.metadata.title.trim() || 'untitled-show';
  return (
    raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'untitled-show'
  );
}
