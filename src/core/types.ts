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
 * Core data model for a drill show.
 *
 * Design rule (spec §6.3): positions are stored in *drill units* — steps
 * measured from fixed field landmarks — never in pixels. Rendering is a pure
 * transform applied on top of this model.
 */

/** Which hash-mark geometry the field uses. */
export type FieldType = 'highSchool' | 'college' | 'pro';

/**
 * Step size, expressed as the number of steps taken to cover five yards.
 *
 * **8-to-5 is the standard and the application default**: eight 22.5" steps
 * per five yards, which lands a marcher exactly on every yard line at a
 * two-step interval. It is what `DEFAULT_FIELD` uses and what every new show
 * starts with.
 *
 * The value is free rather than a fixed list, because designers do use others:
 * 6-to-5 (30") for broad, traditional spacing, 12-to-5 (15") and 16-to-5
 * (11.25") for tight work, 5-to-5 (36") for parade, and occasionally something
 * in between for a specific effect. `STEP_SIZE_PRESETS` in `field.ts` names the
 * common ones; `normaliseStepSize` bounds what a file is allowed to contain.
 *
 * Changing this on an existing show rescales every stored coordinate so nobody
 * physically moves — see `convertShowStepSize`.
 */
export type StepsPerFiveYards = number;

/** A side of the field, as seen from the press box. Side 1 is the left. */
export type FieldSide = 1 | 2;

/** Front-to-back landmarks a vertical coordinate can be described against. */
export type VerticalReference =
  | 'frontSideline'
  | 'frontHash'
  | 'backHash'
  | 'backSideline';

/**
 * A performer position in drill units.
 *
 * `x` — steps from the Side 1 goal line, increasing toward Side 2.
 *       At 8-to-5 the goal-line-to-goal-line span is exactly 160 steps.
 * `y` — steps from the front sideline, increasing toward the back sideline.
 *       At 8-to-5 the field is 85.33 steps deep.
 *
 * Both are measured in the show's configured step size.
 */
export interface DrillPoint {
  x: number;
  y: number;
}

/** A section of the ensemble (trumpets, snares, guard, ...). */
export interface Section {
  id: string;
  name: string;
  /** Short label used on drill charts, e.g. "TP". */
  abbreviation: string;
  /** Hex colour. Chosen from a palette that stays distinguishable under
   *  common colour-vision deficiencies (NFR-3). */
  color: string;
  /** Marker drawn on the field and in exports. */
  symbol: PerformerSymbol;
}

export type PerformerSymbol = 'circle' | 'square' | 'triangle' | 'diamond';

/** One marcher. */
export interface Performer {
  id: string;
  /** Label shown on charts and coordinate sheets, e.g. "T7". */
  label: string;
  name: string;
  sectionId: string;
  /** Sort order within the section; drives default labelling. */
  order: number;
}

/** How a performer travels from the previous set to this one. */
export type TransitionStyle = 'straight' | 'curve';

/** A per-performer override of the default transition into a set. */
export interface TransitionOverride {
  style: TransitionStyle;
  /**
   * Control point for a quadratic curve, in drill units. Only meaningful when
   * `style` is 'curve'. Reserved for the curved-path work in a later phase;
   * the model carries it today so saved files never need a schema bump for it.
   */
  control?: DrillPoint;
  /** Counts spent standing still before moving. */
  holdCounts?: number;
}

/** Where a set sits in the music. */
export interface MusicAnchor {
  /** 1-based measure number. */
  measure: number;
  /** 1-based beat within the measure. */
  beat: number;
}

/** A snapshot of every performer's position at one point in the show. */
export interface DrillSet {
  id: string;
  /** Display label — usually a number, but shows use "1A", "12b" and so on. */
  label: string;
  /** Counts spent moving from the previous set into this one. 0 for set 1. */
  counts: number;
  /** Optional designer note ("horns up", "drum break"). */
  notes?: string;
  /** Where this set lands in the music, when a score is loaded. */
  music?: MusicAnchor;
  /** performerId -> position. Performers absent from the map inherit the
   *  previous set's position. */
  positions: Record<string, DrillPoint>;
  /** performerId -> transition override for the move *into* this set. */
  transitions?: Record<string, TransitionOverride>;
}

/** A tempo marking that takes effect at a given measure. */
export interface TempoMarking {
  /** 1-based measure at which this tempo takes effect. */
  measure: number;
  /** Beats per minute. */
  bpm: number;
}

/** Time signature change, effective from `measure` onward. */
export interface MeterMarking {
  measure: number;
  beatsPerMeasure: number;
  /** Denominator of the time signature (4 = quarter note gets the beat). */
  beatUnit: number;
}

/**
 * Maps musical position to wall-clock time. Used for both MusicXML playback and
 * hand-tapped tempo over a raw audio file (FR-3.5).
 */
export interface TempoMap {
  tempos: TempoMarking[];
  meters: MeterMarking[];
  /** Seconds of audio before measure 1 beat 1 (count-off, pickup, silence). */
  offsetSeconds: number;
}

export type AudioStorage = 'embedded' | 'reference';

/**
 * An imported audio track.
 *
 * Normally a *reference*: the bytes are not in the show file, because a
 * three-minute recording would quadruple the size of every save and every
 * autosave snapshot. `hash` is what makes a reference useful rather than a
 * dead name — it identifies the recording in the browser's audio cache, so
 * reopening a show finds its music again without the user re-importing it.
 */
export interface AudioReference {
  fileName: string;
  mimeType: string;
  durationSeconds: number;
  storage: AudioStorage;
  /** base64 payload, present only when `storage` is 'embedded'. */
  data?: string;
  /**
   * Content hash of the recording (see `core/hash.ts`). Absent only on shows
   * written before the cache existed, which is why every reader treats it as
   * optional and falls back to asking for the file.
   */
  hash?: string;
}

/** An imported MusicXML score. */
export interface ScoreReference {
  fileName: string;
  /** Raw MusicXML text. Compressed .mxl files are inflated on import. */
  data?: string;
  storage: AudioStorage;
}

/**
 * A citation for the recording a drill was written against.
 *
 * Kept beside the audio rather than inside it, so removing or replacing the
 * recording does not throw away the note saying where to get it — which is
 * precisely the state a show file arrives in on somebody else's machine.
 *
 * Every field is optional. Half a citation ("Sousa, public domain") is more
 * use to the person opening the file than none, and demanding a complete one
 * would mean most shows carry nothing at all.
 */
export interface AudioSource {
  /** The title of the recording, which need not be the piece's title. */
  title?: string;
  /** Composer, arranger, ensemble — whoever the credit belongs to. */
  artist?: string;
  /** Where to obtain it. http/https only; anything else is dropped on load. */
  url?: string;
  /** Terms it was obtained under, e.g. "Pixabay Content License". */
  license?: string;
  /** Anything else the next person needs: which take, where it was trimmed. */
  notes?: string;
}

export interface MusicState {
  tempoMap: TempoMap;
  audio?: AudioReference;
  /**
   * Where the recording came from, for whoever opens this file without it.
   * Also serves as the programme credit.
   */
  audioSource?: AudioSource;
  score?: ScoreReference;
  /** Counts per measure used by the drill grid when it differs from the
   *  meter — rare, but shows in mixed meter sometimes count in 4 regardless. */
  countsPerMeasureOverride?: number;
}

/**
 * How the field is painted.
 *
 * Part of the show rather than a local preference, so a show reopens looking
 * the way it was left and a school can keep its own turf colour. Printed charts
 * ignore this and stay on white paper — a director's book is read under
 * fluorescent light and printed in ink, not lit like a stadium.
 */
export interface FieldAppearance {
  /** Playing-surface fill. */
  turfColor: string;
  /** End-zone fill. */
  endZoneColor: string;
  /** Yard lines, sidelines and hash marks. */
  lineColor: string;
  /** Printed yard numbers. */
  numberColor: string;
  /** Multiplier on every line weight. 1 is the drawn default. */
  lineWeight: number;
  /**
   * Multiplier on performer marker size. 1 is the drawn default.
   *
   * A 250-performer show at full field zoom draws very small dots; a director
   * reading a projected field, or anyone working from across a desk, wants them
   * larger. Applies to printed charts too — someone who wants bigger dots on
   * screen wants them in the book.
   */
  performerSize: number;
  /** Alternating mown bands, five yards wide. */
  showMowingStripes: boolean;
  /**
   * A continuous line along each hash, goal line to goal line.
   *
   * Not something a real field has — a real field has only the short tick at
   * each yard. But a designer aligning a form to the front hash needs to *see*
   * the hash, and two rows of disconnected ticks do not read as a line to work
   * against. On by default for that reason; turn it off for a field that looks
   * like the one the band will actually march on.
   */
  showHashLines: boolean;
}

/**
 * An image painted onto the field — a school logo at midfield, a wordmark in an
 * end zone.
 *
 * Geometry is in drill units like everything else, so a logo stays where it was
 * put when the step size or field type changes. The image is embedded as a data
 * URL so a show file stays self-contained: a chart handed to another director
 * should not arrive with a missing graphic.
 */
export interface FieldLogo {
  id: string;
  name: string;
  /** `data:image/...;base64,...` */
  dataUrl: string;
  /** Centre of the image, in steps. */
  center: DrillPoint;
  /** Painted size, in steps. */
  widthSteps: number;
  heightSteps: number;
  rotationDegrees: number;
  /** 0–1. Below 1 the turf shows through, which is what sells "painted on". */
  opacity: number;
  visible: boolean;
  /** Keep width and height in proportion when one is changed. */
  lockAspect: boolean;
  /**
   * Ignore pointer events on the canvas.
   *
   * Distinct from `visible`: a locked logo is still painted, it just stops
   * intercepting presses meant for the drill on top of it. This is the state a
   * logo spends most of its life in, since it is positioned once and then
   * marched over for a season.
   */
  locked: boolean;
}

export interface FieldConfig {
  type: FieldType;
  stepsPerFiveYards: StepsPerFiveYards;
  /** Draw the end zones on the canvas and in chart exports. */
  showEndZones: boolean;
  appearance: FieldAppearance;
}

export interface ShowMetadata {
  title: string;
  ensemble: string;
  season: string;
  designer: string;
}

/** Everything needed to reconstruct a show. This is the save-file payload. */
export interface Show {
  schemaVersion: number;
  metadata: ShowMetadata;
  field: FieldConfig;
  sections: Section[];
  performers: Performer[];
  sets: DrillSet[];
  music: MusicState;
  /** Images painted onto the field. Empty by default — logos are opt-in. */
  fieldLogos: FieldLogo[];
}

/** A position resolved for a specific performer at a specific set. */
export interface ResolvedPosition {
  performerId: string;
  point: DrillPoint;
}
