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
 * Show-level helpers: constructing a new show, and resolving the questions the
 * rest of the app keeps asking of the model — "where is this performer at set
 * 7?", "how many counts in?", "which sets has this performer been added to?".
 *
 * `DrillSet.positions` is sparse: a performer with no entry inherits the last
 * position they were explicitly given. That keeps files small and makes "add a
 * performer mid-show" behave sensibly, but it means callers must go through
 * `resolvePosition` rather than reading `positions` directly.
 */

import type {
  DrillPoint,
  DrillSet,
  Performer,
  Section,
  Show,
  TempoMap,
} from './types.ts';
import { DEFAULT_FIELD, fieldMetrics, normaliseStepSize } from './field.ts';
import { createId } from './id.ts';
import { SECTION_TEMPLATES, sectionFromTemplate } from './sections.ts';

export const CURRENT_SCHEMA_VERSION = 1;

export const DEFAULT_TEMPO_MAP: TempoMap = {
  tempos: [{ measure: 1, bpm: 120 }],
  meters: [{ measure: 1, beatsPerMeasure: 4, beatUnit: 4 }],
  offsetSeconds: 0,
};

export function createEmptyShow(title = 'Untitled Show'): Show {
  const sections = SECTION_TEMPLATES.slice(0, 6).map((template) =>
    sectionFromTemplate(template, createId('sec')),
  );
  const openingSet: DrillSet = {
    id: createId('set'),
    label: '1',
    counts: 0,
    positions: {},
  };
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    metadata: {
      title,
      ensemble: '',
      season: String(new Date().getFullYear()),
      designer: '',
    },
    field: { ...DEFAULT_FIELD },
    sections,
    performers: [],
    sets: [openingSet],
    music: { tempoMap: structuredCloneCompat(DEFAULT_TEMPO_MAP) },
    fieldLogos: [],
  };
}

/** `structuredClone` with a JSON fallback for older runtimes. */
export function structuredCloneCompat<T>(value: T): T {
  const fn = (globalThis as { structuredClone?: <U>(v: U) => U }).structuredClone;
  if (typeof fn === 'function') return fn(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Where a performer stands at `setIndex`, walking backwards until an explicit
 * position is found. Returns null when the performer has not been placed yet.
 */
export function resolvePosition(
  show: Show,
  performerId: string,
  setIndex: number,
): DrillPoint | null {
  for (let i = Math.min(setIndex, show.sets.length - 1); i >= 0; i -= 1) {
    const point = show.sets[i]?.positions[performerId];
    if (point) return { x: point.x, y: point.y };
  }
  return null;
}

/** Every placed performer's position at a set, keyed by performer id. */
export function resolveSetPositions(
  show: Show,
  setIndex: number,
): Record<string, DrillPoint> {
  const out: Record<string, DrillPoint> = {};
  for (const performer of show.performers) {
    const point = resolvePosition(show, performer.id, setIndex);
    if (point) out[performer.id] = point;
  }
  return out;
}

/** True when the performer has an explicit (not inherited) entry at this set. */
export function hasExplicitPosition(
  show: Show,
  performerId: string,
  setIndex: number,
): boolean {
  return Boolean(show.sets[setIndex]?.positions[performerId]);
}

/** Running count total at the *arrival* of each set, starting from 0 at set 1. */
export function countsAtSet(show: Show, setIndex: number): number {
  let total = 0;
  for (let i = 1; i <= setIndex && i < show.sets.length; i += 1) {
    total += Math.max(0, show.sets[i].counts);
  }
  return total;
}

/** Total counts in the show. */
export function totalCounts(show: Show): number {
  return countsAtSet(show, show.sets.length - 1);
}

/** Cumulative counts at every set — handy for timeline layout. */
export function countTimeline(show: Show): number[] {
  const out: number[] = [];
  let total = 0;
  show.sets.forEach((set, index) => {
    if (index > 0) total += Math.max(0, set.counts);
    out.push(total);
  });
  return out;
}

export function findSectionById(show: Show, sectionId: string): Section | undefined {
  return show.sections.find((section) => section.id === sectionId);
}

export function performersInSection(show: Show, sectionId: string): Performer[] {
  return show.performers
    .filter((performer) => performer.sectionId === sectionId)
    .sort((a, b) => a.order - b.order);
}

/** Performers in roster order: by section order, then by their own order. */
export function sortedPerformers(show: Show): Performer[] {
  const sectionOrder = new Map(show.sections.map((s, i) => [s.id, i]));
  return [...show.performers].sort((a, b) => {
    const sectionDelta =
      (sectionOrder.get(a.sectionId) ?? 999) - (sectionOrder.get(b.sectionId) ?? 999);
    if (sectionDelta !== 0) return sectionDelta;
    return a.order - b.order;
  });
}

/**
 * Next label for a new performer in a section, e.g. TP1, TP2. Skips labels
 * already in use so deleting from the middle does not create duplicates.
 */
export function nextPerformerLabel(show: Show, sectionId: string): string {
  const section = findSectionById(show, sectionId);
  const prefix = section?.abbreviation ?? 'P';
  const used = new Set(show.performers.map((performer) => performer.label));
  let index = 1;
  while (used.has(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}

/** Next set label, continuing a numeric sequence where one exists. */
export function nextSetLabel(show: Show): string {
  const numeric = show.sets
    .map((set) => Number.parseInt(set.label, 10))
    .filter((value) => Number.isFinite(value));
  const highest = numeric.length ? Math.max(...numeric) : show.sets.length;
  return String(highest + 1);
}

/** The field metrics implied by the show's configuration. */
export function metricsForShow(show: Show) {
  return fieldMetrics(show.field);
}

/**
 * Rescale every stored position when the step size changes, so nobody
 * physically moves — a marcher on the 35 stays on the 35, their coordinate is
 * just written in different-sized steps.
 */
export function convertShowStepSize(show: Show, nextStepsPerFiveYards: number): Show {
  const next = normaliseStepSize(nextStepsPerFiveYards);
  const ratio = next / show.field.stepsPerFiveYards;
  if (ratio === 1) return show;
  return {
    ...show,
    field: { ...show.field, stepsPerFiveYards: next },
    sets: show.sets.map((set) => ({
      ...set,
      positions: Object.fromEntries(
        Object.entries(set.positions).map(([id, point]) => [
          id,
          { x: point.x * ratio, y: point.y * ratio },
        ]),
      ),
      transitions: set.transitions
        ? Object.fromEntries(
            Object.entries(set.transitions).map(([id, transition]) => [
              id,
              transition.control
                ? {
                    ...transition,
                    control: {
                      x: transition.control.x * ratio,
                      y: transition.control.y * ratio,
                    },
                  }
                : transition,
            ]),
          )
        : undefined,
    })),
  };
}

/**
 * The show with any embedded audio payload removed.
 *
 * For autosave. A recording embedded in the show is a base64 string a third
 * larger than the file itself, and the autosave history keeps ten snapshots —
 * embedding a five-megabyte recording would put seventy megabytes of duplicate
 * audio into IndexedDB and trip the browser's storage quota, taking the
 * snapshots down with it.
 *
 * The `storage: 'embedded'` flag is deliberately kept while the payload goes.
 * It records what the user asked for, and the bytes are recoverable from the
 * audio cache by hash, so a recovered snapshot can put the payload back rather
 * than quietly downgrading the show to a plain reference.
 */
export function withoutEmbeddedAudio(show: Show): Show {
  const audio = show.music.audio;
  if (!audio?.data) return show;
  const { data: _data, ...rest } = audio;
  return { ...show, music: { ...show.music, audio: rest } };
}
