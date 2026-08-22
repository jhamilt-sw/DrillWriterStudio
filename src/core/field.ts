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
 * Field geometry.
 *
 * Everything here derives from real field dimensions in feet, then converts to
 * steps using the show's step size. Keeping feet as the source of truth means
 * hash placement stays physically correct at any step size, and switching
 * between high school / college / pro hashes never needs a data migration.
 */

import type {
  FieldAppearance,
  FieldConfig,
  FieldSide,
  FieldType,
  StepsPerFiveYards,
} from './types.ts';

/** Goal line to goal line. */
export const FIELD_LENGTH_YARDS = 100;
/** Sideline to sideline: 53 yards 1 foot. */
export const FIELD_WIDTH_FEET = 160;
/** Depth of one end zone. */
export const END_ZONE_YARDS = 10;

export const FEET_PER_YARD = 3;
export const INCHES_PER_FOOT = 12;

/**
 * Distance from each sideline to the nearer hash, in feet.
 *
 * High school: 53' 4"  (NFHS)   -> hashes 53' 4" apart
 * College:     60' 0"  (NCAA)   -> hashes 40' 0" apart
 * Pro:         70' 9"  (NFL)    -> hashes 18' 6" apart
 */
export const HASH_INSET_FEET: Record<FieldType, number> = {
  highSchool: 53 + 4 / INCHES_PER_FOOT,
  college: 60,
  pro: 70 + 9 / INCHES_PER_FOOT,
};

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  highSchool: 'High school (NFHS)',
  college: 'College (NCAA)',
  pro: 'Professional (NFL)',
};

/**
 * The marching standard: eight steps to five yards, a 22.5" stride, one step
 * every 2.25 feet. Every new show starts here.
 */
export const DEFAULT_STEPS_PER_FIVE_YARDS = 8;

/**
 * Bounds on what a step size may be. Wide enough for anything a designer would
 * plausibly write — 2-to-5 is a 90" leap, 48-to-5 a 3.75" shuffle — and narrow
 * enough that a corrupt file cannot produce a field with a million grid lines.
 */
export const MIN_STEPS_PER_FIVE_YARDS = 2;
export const MAX_STEPS_PER_FIVE_YARDS = 48;

export interface StepSizePreset {
  stepsPerFiveYards: number;
  label: string;
  note: string;
}

/** The step sizes worth offering by name. Anything else can still be typed. */
export const STEP_SIZE_PRESETS: StepSizePreset[] = [
  { stepsPerFiveYards: 5, label: '5-to-5', note: '36" — one step per yard, parade' },
  { stepsPerFiveYards: 6, label: '6-to-5', note: '30" — broad, traditional' },
  { stepsPerFiveYards: 8, label: '8-to-5', note: '22.5" — standard' },
  { stepsPerFiveYards: 10, label: '10-to-5', note: '18" — tighter' },
  { stepsPerFiveYards: 12, label: '12-to-5', note: '15" — close intervals' },
  { stepsPerFiveYards: 16, label: '16-to-5', note: '11.25" — very tight' },
];

/** True for a step size the model will accept. */
export function isValidStepSize(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_STEPS_PER_FIVE_YARDS &&
    value <= MAX_STEPS_PER_FIVE_YARDS
  );
}

/**
 * Coerce anything into a usable step size: out-of-range values are clamped,
 * nonsense falls back to the 8-to-5 default rather than producing a field with
 * an infinite or zero-length step.
 */
export function normaliseStepSize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_STEPS_PER_FIVE_YARDS;
  }
  const clamped = Math.min(
    Math.max(value, MIN_STEPS_PER_FIVE_YARDS),
    MAX_STEPS_PER_FIVE_YARDS,
  );
  // Keep quarter-step precision so a hand-typed 8.333 does not haunt every
  // coordinate downstream.
  return Math.round(clamped * 100) / 100;
}

/** Length of one step in feet, e.g. 8-to-5 -> 1.875 ft (22.5"). */
export function stepLengthFeet(stepsPerFiveYards: StepsPerFiveYards): number {
  return (5 * FEET_PER_YARD) / stepsPerFiveYards;
}

/** Length of one step in inches — handy for display ("22.5 inch steps"). */
export function stepLengthInches(stepsPerFiveYards: StepsPerFiveYards): number {
  return stepLengthFeet(stepsPerFiveYards) * INCHES_PER_FOOT;
}

/** A step size written the way a designer says it out loud: `8-to-5 (22.5")`. */
export function describeStepSize(stepsPerFiveYards: StepsPerFiveYards): string {
  const inches = stepLengthInches(stepsPerFiveYards);
  const rounded = Math.round(inches * 100) / 100;
  return `${stepsPerFiveYards}-to-5 (${rounded}")`;
}

export function feetToSteps(feet: number, stepsPerFiveYards: StepsPerFiveYards): number {
  return feet / stepLengthFeet(stepsPerFiveYards);
}

export function stepsToFeet(steps: number, stepsPerFiveYards: StepsPerFiveYards): number {
  return steps * stepLengthFeet(stepsPerFiveYards);
}

export function yardsToSteps(yards: number, stepsPerFiveYards: StepsPerFiveYards): number {
  return feetToSteps(yards * FEET_PER_YARD, stepsPerFiveYards);
}

export function stepsToYards(steps: number, stepsPerFiveYards: StepsPerFiveYards): number {
  return stepsToFeet(steps, stepsPerFiveYards) / FEET_PER_YARD;
}

/**
 * Derived metrics for a configured field, all in steps.
 *
 * `x` runs from the Side 1 goal line (0) to the Side 2 goal line (`widthSteps`).
 * `y` runs from the front sideline (0) to the back sideline (`depthSteps`).
 */
export interface FieldMetrics {
  config: FieldConfig;
  /** Goal line to goal line, in steps. 160 at 8-to-5. */
  widthSteps: number;
  /** Front sideline to back sideline, in steps. 85.33 at 8-to-5. */
  depthSteps: number;
  /** Steps between adjacent five-yard lines. 8 at 8-to-5. */
  stepsPerFiveYardLine: number;
  /** y of the front hash. */
  frontHashY: number;
  /** y of the back hash. */
  backHashY: number;
  /** Depth of one end zone, in steps. */
  endZoneSteps: number;
  /** x of the 50 yard line. */
  fiftyX: number;
}

/**
 * The inbounds marks — the hashes proper.
 *
 * **These are not small yard lines**, which is the mistake worth naming
 * because the drawing looks plausible either way. A hash mark is a dash *along*
 * the field, 4 inches wide and 24 inches long, lying parallel to the sidelines
 * and centred on the yard it marks (NFHS and NCAA both; only the distance in
 * from the sideline differs between codes). Drawn across the field instead, it
 * reads as a stubby yard line, which is precisely what it is not.
 *
 * They mark the 1-yard intervals *between* the five-yard lines. At a five-yard
 * line there is already a full line crossing the hash, so no dash is painted
 * there.
 */
export const HASH_MARK_LENGTH_FEET = 2;
export const HASH_MARK_WIDTH_FEET = 4 / INCHES_PER_FOOT;

/**
 * Where the hash marks sit, as x in steps from the Side 1 goal line.
 *
 * **On the five-yard lines**, one mark bisecting each — the mark is centred on
 * the line and runs a foot up-field and a foot down-field of it. That is what
 * the lining specifications describe, and it is the placement a designer reads
 * a hash by: the hash is a reference tied to the numbered lines, not a texture
 * spread down the whole field.
 *
 * Kept separate from `yardMarkXs` below, which is deliberately a different
 * list. They used to be the same call, and moving one silently moved the other.
 */
export function hashMarkXs(metrics: FieldMetrics): number[] {
  const xs: number[] = [];
  for (let yard = 0; yard <= FIELD_LENGTH_YARDS; yard += 5) {
    xs.push(yardsToSteps(yard, metrics.config.stepsPerFiveYards));
  }
  return xs;
}

/**
 * Where the yard markers sit: every yard *between* the five-yard lines.
 *
 * At a five-yard line the full line already crosses, so no stub is drawn there
 * — a marker on a line it is a fragment of would be invisible anyway.
 */
export function yardMarkXs(metrics: FieldMetrics): number[] {
  const xs: number[] = [];
  for (let yard = 1; yard < FIELD_LENGTH_YARDS; yard += 1) {
    if (yard % 5 === 0) continue;
    xs.push(yardsToSteps(yard, metrics.config.stepsPerFiveYards));
  }
  return xs;
}

/**
 * The yard markers: short ticks *across* the field, one per yard between the
 * five-yard lines, in four rows.
 *
 * Distinct from the hash marks, and the distinction is the whole point. A hash
 * mark lies **along** the field and says "this is the inbounds spot". A yard
 * marker runs **across** it and says "this is the 37" — it is a stub of the
 * yard line that is not painted full width. Both exist on a real field and
 * neither substitutes for the other.
 *
 * Two rows run in from the sidelines. Two more sit at the hashes, and those are
 * deliberately *offset* rather than centred: a tick centred on the hash swamps
 * the hash mark it shares a spot with, which is what made the hashes
 * unreadable. Each one starts at the edge of the hash mark and runs outward,
 * toward the sideline its numbers are painted on, so the mark and the tick read
 * as two things instead of one blur.
 */
export const YARD_TICK_LENGTH_FEET = 2;

export interface YardTick {
  /** Steps from the Side 1 goal line. */
  x: number;
  /** Steps from the front sideline, at each end of the tick. */
  fromY: number;
  toY: number;
}

export function yardTicks(metrics: FieldMetrics): YardTick[] {
  const spf = metrics.config.stepsPerFiveYards;
  const length = feetToSteps(YARD_TICK_LENGTH_FEET, spf);
  // Clear of the hash mark's own 4-inch width, so the two never overlap.
  const clearance = feetToSteps(HASH_MARK_WIDTH_FEET / 2, spf);
  const middle = metrics.depthSteps / 2;

  const rows: { start: number; direction: 1 | -1 }[] = [
    // In from each sideline.
    { start: 0, direction: 1 },
    { start: metrics.depthSteps, direction: -1 },
    // Out from each hash, away from the middle of the field — which is the
    // direction the yard numbers are painted in on that side.
    {
      start: metrics.frontHashY - clearance,
      direction: metrics.frontHashY < middle ? -1 : 1,
    },
    {
      start: metrics.backHashY + clearance,
      direction: metrics.backHashY > middle ? 1 : -1,
    },
  ];

  const ticks: YardTick[] = [];
  for (const x of yardMarkXs(metrics)) {
    for (const row of rows) {
      ticks.push({ x, fromY: row.start, toY: row.start + length * row.direction });
    }
  }
  return ticks;
}

export function fieldMetrics(config: FieldConfig): FieldMetrics {
  const spf = config.stepsPerFiveYards;
  const widthSteps = yardsToSteps(FIELD_LENGTH_YARDS, spf);
  const depthSteps = feetToSteps(FIELD_WIDTH_FEET, spf);
  const inset = HASH_INSET_FEET[config.type];
  return {
    config,
    widthSteps,
    depthSteps,
    stepsPerFiveYardLine: spf,
    frontHashY: feetToSteps(inset, spf),
    backHashY: depthSteps - feetToSteps(inset, spf),
    endZoneSteps: yardsToSteps(END_ZONE_YARDS, spf),
    fiftyX: widthSteps / 2,
  };
}

/**
 * The x coordinate (steps from the Side 1 goal line) of a yard line.
 *
 * @param number  the printed yard-line number, 0–50
 * @param side    which half of the field it sits on; ignored for the 50
 */
export function yardLineX(
  number: number,
  side: FieldSide,
  metrics: FieldMetrics,
): number {
  const fromSide1GoalLine = side === 1 ? number : FIELD_LENGTH_YARDS - number;
  return yardsToSteps(fromSide1GoalLine, metrics.config.stepsPerFiveYards);
}

/** Every five-yard line on the field, left to right. */
export interface YardLine {
  /** Printed number, 0–50. */
  number: number;
  side: FieldSide;
  /** Distance from the Side 1 goal line in yards, 0–100. */
  yardsFromSide1: number;
  x: number;
  /** Yard lines every 10 yards carry printed numbers on a real field. */
  isNumbered: boolean;
}

export function yardLines(metrics: FieldMetrics): YardLine[] {
  const spf = metrics.config.stepsPerFiveYards;
  const lines: YardLine[] = [];
  for (let yards = 0; yards <= FIELD_LENGTH_YARDS; yards += 5) {
    const number = yards <= 50 ? yards : FIELD_LENGTH_YARDS - yards;
    lines.push({
      number,
      side: yards < 50 ? 1 : 2,
      yardsFromSide1: yards,
      x: yardsToSteps(yards, spf),
      isNumbered: yards % 10 === 0 && yards !== 0 && yards !== FIELD_LENGTH_YARDS,
    });
  }
  return lines;
}

/**
 * The named front-to-back references a coordinate can be written against.
 * These strings appear verbatim on coordinate sheets, so they are the labels,
 * not a separate display mapping.
 */
export type VerticalLandmarkName =
  | 'Front side line'
  | 'Front Hash'
  | 'Back Hash'
  | 'Back side line';

/**
 * A line on the field that performers can be aligned or measured against.
 *
 * One definition serves both the alignment tools and the written coordinates,
 * so a marcher the menu snapped to the front hash reads "On Front Hash" on
 * their sheet — the two cannot drift apart.
 */
export interface FieldLandmark {
  id: string;
  label: string;
  /** Which coordinate the landmark constrains. */
  axis: 'x' | 'y';
  /** Position in steps along that axis. */
  value: number;
}

export interface VerticalLandmark extends FieldLandmark {
  axis: 'y';
  label: VerticalLandmarkName;
}

/** Front sideline, both hashes, back sideline — front to back. */
export function verticalLandmarks(metrics: FieldMetrics): VerticalLandmark[] {
  return [
    { id: 'frontSideline', label: 'Front side line', axis: 'y', value: 0 },
    { id: 'frontHash', label: 'Front Hash', axis: 'y', value: metrics.frontHashY },
    { id: 'backHash', label: 'Back Hash', axis: 'y', value: metrics.backHashY },
    {
      id: 'backSideline',
      label: 'Back side line',
      axis: 'y',
      value: metrics.depthSteps,
    },
  ];
}

/** Every five-yard line, as an alignment target. */
export function yardLineLandmarks(metrics: FieldMetrics): FieldLandmark[] {
  return yardLines(metrics).map((line) => ({
    id: `yard-${line.yardsFromSide1}`,
    label:
      line.yardsFromSide1 === 50
        ? '50 yd ln'
        : `Side ${line.side} ${line.number} yd ln`,
    axis: 'x' as const,
    value: line.x,
  }));
}

/** Just the two hashes — the most common vertical alignment targets. */
export function hashLandmarks(metrics: FieldMetrics): VerticalLandmark[] {
  return verticalLandmarks(metrics).filter(
    (landmark) => landmark.id === 'frontHash' || landmark.id === 'backHash',
  );
}

/** Just the two sidelines. */
export function sidelineLandmarks(metrics: FieldMetrics): VerticalLandmark[] {
  return verticalLandmarks(metrics).filter(
    (landmark) => landmark.id === 'frontSideline' || landmark.id === 'backSideline',
  );
}

/**
 * The landmark closest to `value`. Ties go to the earlier entry, which keeps
 * repeated snaps stable rather than oscillating between two equidistant lines.
 */
export function nearestLandmark<T extends FieldLandmark>(
  value: number,
  landmarks: T[],
): T {
  if (landmarks.length === 0) {
    throw new Error('nearestLandmark needs at least one landmark');
  }
  let best = landmarks[0];
  let bestDistance = Math.abs(value - best.value);
  for (const landmark of landmarks) {
    const distance = Math.abs(value - landmark.value);
    if (distance < bestDistance) {
      best = landmark;
      bestDistance = distance;
    }
  }
  return best;
}

/** Clamp a point to the playing surface (sidelines and goal lines inclusive). */
export function clampToField(
  point: { x: number; y: number },
  metrics: FieldMetrics,
): { x: number; y: number } {
  return {
    x: Math.min(Math.max(point.x, 0), metrics.widthSteps),
    y: Math.min(Math.max(point.y, 0), metrics.depthSteps),
  };
}

/**
 * A grass field under stadium light: mown turf, white paint.
 *
 * Line weights sit at 1 here and the renderers draw a deliberately heavy
 * default, because a field read at a glance needs the yard lines to carry from
 * across a room, not to be hairlines.
 */
export const DEFAULT_APPEARANCE: FieldAppearance = {
  turfColor: '#3d7a3f',
  endZoneColor: '#33693a',
  lineColor: '#ffffff',
  numberColor: '#ffffff',
  lineWeight: 1,
  performerSize: 1,
  showMowingStripes: true,
  showHashLines: true,
};

/** Line-paint colours offered alongside the free colour picker. */
export const LINE_COLOR_PRESETS: { label: string; color: string }[] = [
  { label: 'White', color: '#ffffff' },
  { label: 'Bone', color: '#f2ede2' },
  { label: 'Grey', color: '#b9c0c7' },
  { label: 'Black', color: '#141719' },
  { label: 'Gold', color: '#f0c04a' },
];

/** Turf colours offered in the appearance picker. */
export const TURF_PRESETS: { label: string; turf: string; endZone: string }[] = [
  { label: 'Grass', turf: '#3d7a3f', endZone: '#33693a' },
  { label: 'Deep grass', turf: '#2f5f33', endZone: '#28522c' },
  { label: 'Dry grass', turf: '#6b7f45', endZone: '#5c6f3b' },
  { label: 'Blue turf', turf: '#2a4d7a', endZone: '#22406a' },
  { label: 'Slate', turf: '#3a4046', endZone: '#31363b' },
  { label: 'Paper', turf: '#ffffff', endZone: '#f0f2f4' },
];

export const DEFAULT_FIELD: FieldConfig = {
  type: 'highSchool',
  stepsPerFiveYards: DEFAULT_STEPS_PER_FIVE_YARDS,
  showEndZones: true,
  appearance: { ...DEFAULT_APPEARANCE },
};
