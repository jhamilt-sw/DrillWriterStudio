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
 * The editor's single source of truth.
 *
 * Show data is treated as immutable: every action produces a new `Show` rather
 * than mutating the old one. That makes undo/redo a matter of keeping
 * references to previous versions (FR-1.7) — no deep cloning, so a 250-performer
 * show can hold a long history without the memory cost showing up (NFR-1).
 *
 * Dragging is the one interaction that would otherwise flood the history stack,
 * so it is bracketed: `beginInteraction()` stashes a snapshot, intermediate
 * updates skip history, and `endInteraction()` pushes the single snapshot.
 */

import { create } from 'zustand';

import type {
  DrillPoint,
  DrillSet,
  FieldAppearance,
  FieldConfig,
  FieldLogo,
  MusicState,
  Performer,
  Section,
  Show,
  ShowMetadata,
  TransitionOverride,
} from '../core/types.ts';
import { fieldMetrics, type FieldMetrics } from '../core/field.ts';
import { createId } from '../core/id.ts';
import {
  convertShowStepSize,
  createEmptyShow,
  nextPerformerLabel,
  nextSetLabel,
  resolvePosition,
  resolveSetPositions,
} from '../core/show.ts';
import { SECTION_PALETTE } from '../core/sections.ts';
import { setAllLogosLocked } from '../core/logos.ts';
import { DEFAULT_ROTATION, normaliseStep, type RotationSettings } from '../core/rotation.ts';
import {
  DEFAULT_PATH_VISIBILITY,
  type PathVisibilitySettings,
  toggleId,
} from '../core/pathVisibility.ts';

const HISTORY_LIMIT = 120;

export interface HistoryEntry {
  show: Show;
  label: string;
}

export type ToolMode = 'select' | 'draw';

export interface ViewSettings {
  /** Snap granularity in steps. 0 disables snapping. */
  snapSteps: number;
  /** Who gets a movement path drawn, and whether that differs during playback. */
  paths: PathVisibilitySettings;
  /** Ghost the previous set behind the current one. */
  showPreviousSet: boolean;
  showNextSet: boolean;
  showLabels: boolean;
  /** Highlight moves demanding a stride longer than this, in inches. */
  strideWarningInches: number;
  showStrideWarnings: boolean;
  /** Increments used by the on-canvas rotation handle. */
  rotation: RotationSettings;
}

export interface ShowStoreState {
  show: Show;
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Snapshot taken at the start of a drag or other continuous gesture. */
  pendingSnapshot: { show: Show; label: string } | null;

  currentSetIndex: number;
  selectedPerformerIds: string[];
  /** The logo being edited on the canvas, if any. */
  selectedLogoId: string | null;
  /**
   * Bumped whenever the playhead is moved by the user rather than by audio
   * playback. The audio layer watches it and seeks the recording to match, so
   * stepping back to set 1 and pressing play starts the music from set 1.
   * A plain playhead value cannot serve: it is also written sixty times a
   * second *by* the audio, which would make every frame look like a seek.
   */
  seekNonce: number;
  /** Scrub position in counts from the top of the show. */
  playheadCount: number;
  isScrubbing: boolean;
  tool: ToolMode;
  view: ViewSettings;

  /** True when there are unsaved changes. */
  dirty: boolean;
  /** Name the show was last saved as, for the window title and export names. */
  lastSavedAt: number | null;

  // --- history -------------------------------------------------------------
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  beginInteraction: (label: string) => void;
  endInteraction: () => void;
  cancelInteraction: () => void;

  // --- whole-show ----------------------------------------------------------
  replaceShow: (show: Show, options?: { markSaved?: boolean }) => void;
  newShow: (title?: string) => void;
  markSaved: () => void;
  updateMetadata: (patch: Partial<ShowMetadata>) => void;
  updateField: (patch: Partial<FieldConfig>) => void;
  updateAppearance: (patch: Partial<FieldAppearance>) => void;
  updateMusic: (patch: Partial<MusicState>) => void;

  // --- roster --------------------------------------------------------------
  addSection: (name: string) => string;
  updateSection: (sectionId: string, patch: Partial<Omit<Section, 'id'>>) => void;
  removeSection: (sectionId: string) => void;
  addPerformers: (sectionId: string, count: number) => string[];
  updatePerformer: (performerId: string, patch: Partial<Omit<Performer, 'id'>>) => void;
  removePerformers: (performerIds: string[]) => void;

  // --- sets ----------------------------------------------------------------
  addSet: (afterIndex?: number) => void;
  duplicateSet: (index: number) => void;
  removeSet: (index: number) => void;
  updateSet: (index: number, patch: Partial<Omit<DrillSet, 'id' | 'positions'>>) => void;
  moveSet: (from: number, to: number) => void;
  goToSet: (index: number) => void;

  // --- positions -----------------------------------------------------------
  setPositions: (
    positions: Record<string, DrillPoint>,
    options?: { setIndex?: number; label?: string; skipHistory?: boolean },
  ) => void;
  nudgeSelection: (dx: number, dy: number) => void;
  clearPositionsAtSet: (performerIds: string[]) => void;
  setTransition: (performerId: string, transition: TransitionOverride | null) => void;

  // --- selection & view ----------------------------------------------------
  select: (performerIds: string[], mode?: 'replace' | 'add' | 'toggle') => void;
  selectAll: () => void;
  selectSection: (sectionId: string) => void;
  clearSelection: () => void;
  setTool: (tool: ToolMode) => void;
  updateView: (patch: Partial<ViewSettings>) => void;
  updatePathVisibility: (patch: Partial<PathVisibilitySettings>) => void;
  updateRotationSettings: (patch: Partial<RotationSettings>) => void;
  togglePathSection: (sectionId: string) => void;
  togglePathPerformer: (performerId: string) => void;
  /** Put the current selection into the custom path scope. */
  addSelectionToPathScope: () => void;
  /** Move the playhead because the audio is playing. Does not request a seek. */
  setPlayhead: (count: number) => void;
  /** Move the playhead because the user asked. Requests an audio seek. */
  seekToCount: (count: number) => void;
  setScrubbing: (scrubbing: boolean) => void;

  // --- field logos ---------------------------------------------------------
  addLogo: (logo: Omit<FieldLogo, 'id'>) => string;
  updateLogo: (logoId: string, patch: Partial<Omit<FieldLogo, 'id'>>) => void;
  removeLogo: (logoId: string) => void;
  selectLogo: (logoId: string | null) => void;
  /** Lock or unlock every logo at once. */
  setAllLogosLocked: (locked: boolean) => void;
}

const DEFAULT_VIEW: ViewSettings = {
  snapSteps: 0.5,
  paths: { ...DEFAULT_PATH_VISIBILITY },
  showPreviousSet: true,
  showNextSet: false,
  showLabels: true,
  strideWarningInches: 30,
  showStrideWarnings: true,
  rotation: { ...DEFAULT_ROTATION },
};

export const useShowStore = create<ShowStoreState>((set, get) => {
  /**
   * Apply an immutable update, recording it in the history stack unless the
   * caller is mid-gesture.
   */
  function commit(
    label: string,
    recipe: (show: Show) => Show,
    options: { skipHistory?: boolean } = {},
  ): void {
    const state = get();
    const next = recipe(state.show);
    if (next === state.show) return;
    const skip = options.skipHistory || state.pendingSnapshot !== null;
    set({
      show: next,
      dirty: true,
      ...(skip
        ? {}
        : {
            past: [...state.past, { show: state.show, label }].slice(-HISTORY_LIMIT),
            future: [],
          }),
    });
  }

  /** Clamp the current set index after sets are added or removed. */
  function clampSetIndex(show: Show, index: number): number {
    return Math.min(Math.max(index, 0), Math.max(0, show.sets.length - 1));
  }

  return {
    show: createEmptyShow(),
    past: [],
    future: [],
    pendingSnapshot: null,
    currentSetIndex: 0,
    selectedPerformerIds: [],
    selectedLogoId: null,
    seekNonce: 0,
    playheadCount: 0,
    isScrubbing: false,
    tool: 'select',
    view: { ...DEFAULT_VIEW },
    dirty: false,
    lastSavedAt: null,

    // --- history -----------------------------------------------------------
    undo: () => {
      const { past, future, show } = get();
      const previous = past[past.length - 1];
      if (!previous) return;
      set({
        show: previous.show,
        past: past.slice(0, -1),
        future: [{ show, label: previous.label }, ...future].slice(0, HISTORY_LIMIT),
        dirty: true,
        currentSetIndex: clampSetIndex(previous.show, get().currentSetIndex),
        selectedPerformerIds: get().selectedPerformerIds.filter((id) =>
          previous.show.performers.some((performer) => performer.id === id),
        ),
      });
    },

    redo: () => {
      const { past, future, show } = get();
      const next = future[0];
      if (!next) return;
      set({
        show: next.show,
        past: [...past, { show, label: next.label }].slice(-HISTORY_LIMIT),
        future: future.slice(1),
        dirty: true,
        currentSetIndex: clampSetIndex(next.show, get().currentSetIndex),
      });
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    beginInteraction: (label) => {
      if (get().pendingSnapshot) return;
      set({ pendingSnapshot: { show: get().show, label } });
    },

    endInteraction: () => {
      const { pendingSnapshot, show, past } = get();
      if (!pendingSnapshot) return;
      if (pendingSnapshot.show === show) {
        set({ pendingSnapshot: null });
        return;
      }
      set({
        pendingSnapshot: null,
        past: [...past, pendingSnapshot].slice(-HISTORY_LIMIT),
        future: [],
      });
    },

    cancelInteraction: () => {
      const { pendingSnapshot } = get();
      if (!pendingSnapshot) return;
      set({ pendingSnapshot: null, show: pendingSnapshot.show });
    },

    // --- whole-show --------------------------------------------------------
    replaceShow: (show, options) =>
      set({
        show,
        past: [],
        future: [],
        pendingSnapshot: null,
        currentSetIndex: 0,
        selectedPerformerIds: [],
        playheadCount: 0,
        dirty: !options?.markSaved,
        lastSavedAt: options?.markSaved ? Date.now() : null,
      }),

    newShow: (title) => get().replaceShow(createEmptyShow(title), { markSaved: false }),

    markSaved: () => set({ dirty: false, lastSavedAt: Date.now() }),

    updateMetadata: (patch) =>
      commit('Edit show details', (show) => ({
        ...show,
        metadata: { ...show.metadata, ...patch },
      })),

    updateField: (patch) =>
      commit('Change field settings', (show) => {
        // Step size is special: positions must be rescaled so nobody physically
        // moves. `convertShowStepSize` normalises the value, so the rest of the
        // patch is applied first and the converted field wins — otherwise a raw
        // out-of-range number from an input box would overwrite it.
        if (
          typeof patch.stepsPerFiveYards === 'number' &&
          patch.stepsPerFiveYards !== show.field.stepsPerFiveYards
        ) {
          const converted = convertShowStepSize(show, patch.stepsPerFiveYards);
          return {
            ...converted,
            field: {
              ...converted.field,
              ...patch,
              stepsPerFiveYards: converted.field.stepsPerFiveYards,
            },
          };
        }
        return { ...show, field: { ...show.field, ...patch } };
      }),

    updateAppearance: (patch) =>
      commit('Change field appearance', (show) => ({
        ...show,
        field: { ...show.field, appearance: { ...show.field.appearance, ...patch } },
      })),

    updateMusic: (patch) =>
      commit('Edit music settings', (show) => ({
        ...show,
        music: { ...show.music, ...patch },
      })),

    // --- roster ------------------------------------------------------------
    addSection: (name) => {
      const id = createId('sec');
      commit('Add section', (show) => ({
        ...show,
        sections: [
          ...show.sections,
          {
            id,
            name,
            abbreviation: name.slice(0, 2).toUpperCase() || 'S',
            color: SECTION_PALETTE[show.sections.length % SECTION_PALETTE.length],
            symbol: 'circle',
          },
        ],
      }));
      return id;
    },

    updateSection: (sectionId, patch) =>
      commit('Edit section', (show) => ({
        ...show,
        sections: show.sections.map((section) =>
          section.id === sectionId ? { ...section, ...patch } : section,
        ),
      })),

    removeSection: (sectionId) =>
      commit('Remove section', (show) => {
        if (show.sections.length <= 1) return show;
        const doomed = new Set(
          show.performers
            .filter((performer) => performer.sectionId === sectionId)
            .map((performer) => performer.id),
        );
        return {
          ...show,
          sections: show.sections.filter((section) => section.id !== sectionId),
          performers: show.performers.filter(
            (performer) => performer.sectionId !== sectionId,
          ),
          sets: show.sets.map((drillSet) => ({
            ...drillSet,
            positions: omitKeys(drillSet.positions, doomed),
            transitions: drillSet.transitions
              ? omitKeys(drillSet.transitions, doomed)
              : undefined,
          })),
        };
      }),

    addPerformers: (sectionId, count) => {
      const ids: string[] = [];
      commit(count === 1 ? 'Add performer' : `Add ${count} performers`, (show) => {
        let working = show;
        const additions: Performer[] = [];
        const existingInSection = show.performers.filter(
          (performer) => performer.sectionId === sectionId,
        ).length;
        for (let i = 0; i < count; i += 1) {
          const id = createId('perf');
          ids.push(id);
          const performer: Performer = {
            id,
            label: nextPerformerLabel(working, sectionId),
            name: '',
            sectionId,
            order: existingInSection + i,
          };
          additions.push(performer);
          working = { ...working, performers: [...working.performers, performer] };
        }
        return { ...show, performers: [...show.performers, ...additions] };
      });
      return ids;
    },

    updatePerformer: (performerId, patch) =>
      commit('Edit performer', (show) => ({
        ...show,
        performers: show.performers.map((performer) =>
          performer.id === performerId ? { ...performer, ...patch } : performer,
        ),
      })),

    removePerformers: (performerIds) => {
      const doomed = new Set(performerIds);
      if (doomed.size === 0) return;
      commit(
        doomed.size === 1 ? 'Remove performer' : `Remove ${doomed.size} performers`,
        (show) => ({
          ...show,
          performers: show.performers.filter((performer) => !doomed.has(performer.id)),
          sets: show.sets.map((drillSet) => ({
            ...drillSet,
            positions: omitKeys(drillSet.positions, doomed),
            transitions: drillSet.transitions
              ? omitKeys(drillSet.transitions, doomed)
              : undefined,
          })),
        }),
      );
      set({
        selectedPerformerIds: get().selectedPerformerIds.filter((id) => !doomed.has(id)),
      });
    },

    // --- sets --------------------------------------------------------------
    addSet: (afterIndex) => {
      const state = get();
      const index = afterIndex ?? state.currentSetIndex;
      // A new set starts as a copy of the one before it, which is how drill is
      // written: place the form, then change what moves.
      const source = state.show.sets[index];
      const inherited = resolveSetPositions(state.show, index);
      const newSet: DrillSet = {
        id: createId('set'),
        label: nextSetLabel(state.show),
        counts: 16,
        positions: source ? { ...inherited } : {},
      };
      commit('Add set', (show) => ({
        ...show,
        sets: [...show.sets.slice(0, index + 1), newSet, ...show.sets.slice(index + 1)],
      }));
      set({ currentSetIndex: index + 1 });
    },

    duplicateSet: (index) => {
      const state = get();
      const source = state.show.sets[index];
      if (!source) return;
      const copy: DrillSet = {
        ...source,
        id: createId('set'),
        label: `${source.label}A`,
        positions: { ...resolveSetPositions(state.show, index) },
      };
      commit('Duplicate set', (show) => ({
        ...show,
        sets: [...show.sets.slice(0, index + 1), copy, ...show.sets.slice(index + 1)],
      }));
      set({ currentSetIndex: index + 1 });
    },

    removeSet: (index) => {
      const state = get();
      if (state.show.sets.length <= 1) return;
      // Positions that were only implicit in the following set become explicit,
      // so removing a set never teleports anyone.
      const survivingPositions = resolveSetPositions(state.show, index);
      commit('Remove set', (show) => {
        const sets = show.sets.filter((_, i) => i !== index);
        if (index < show.sets.length - 1) {
          const followerIndex = index;
          const follower = sets[followerIndex];
          sets[followerIndex] = {
            ...follower,
            positions: { ...survivingPositions, ...follower.positions },
          };
        }
        sets[0] = { ...sets[0], counts: 0 };
        return { ...show, sets };
      });
      set({ currentSetIndex: clampSetIndex(get().show, index - 1) });
    },

    updateSet: (index, patch) =>
      commit('Edit set', (show) => ({
        ...show,
        sets: show.sets.map((drillSet, i) =>
          i === index
            ? { ...drillSet, ...patch, ...(i === 0 ? { counts: 0 } : {}) }
            : drillSet,
        ),
      })),

    moveSet: (from, to) =>
      commit('Reorder sets', (show) => {
        if (from === to || from < 0 || to < 0) return show;
        if (from >= show.sets.length || to >= show.sets.length) return show;
        const sets = [...show.sets];
        const [moved] = sets.splice(from, 1);
        sets.splice(to, 0, moved);
        sets[0] = { ...sets[0], counts: 0 };
        return { ...show, sets };
      }),

    goToSet: (index) => {
      const clamped = clampSetIndex(get().show, index);
      set({
        currentSetIndex: clamped,
        playheadCount: countsAt(get().show, clamped),
        // Jumping to a set is a seek: the music should follow the drill.
        seekNonce: get().seekNonce + 1,
        /*
         * Landing on a set ends scrubbing, always.
         *
         * `isScrubbing` means "the playhead is somewhere between sets, so what
         * you see is interpolated and not editable" — it suppresses the ghosts,
         * the paths, the rotation handle and logo hit-testing. It used to be
         * cleared only by the transport buttons, so scrubbing the timeline and
         * then picking a set from the list left the app stuck in a
         * look-but-don't-touch mode with no obvious way out. Clearing it here
         * means every route back to a set — the list, the transport, the
         * keyboard, duplicating a set — leaves the same way.
         */
        isScrubbing: false,
      });
    },

    // --- positions ---------------------------------------------------------
    setPositions: (positions, options) => {
      const index = options?.setIndex ?? get().currentSetIndex;
      commit(
        options?.label ?? 'Move performers',
        (show) => {
          const target = show.sets[index];
          if (!target) return show;
          return {
            ...show,
            sets: show.sets.map((drillSet, i) =>
              i === index
                ? { ...drillSet, positions: { ...drillSet.positions, ...positions } }
                : drillSet,
            ),
          };
        },
        { skipHistory: options?.skipHistory },
      );
    },

    nudgeSelection: (dx, dy) => {
      const state = get();
      const { show, currentSetIndex, selectedPerformerIds } = state;
      if (selectedPerformerIds.length === 0) return;
      const moved: Record<string, DrillPoint> = {};
      for (const performerId of selectedPerformerIds) {
        const point = resolvePosition(show, performerId, currentSetIndex);
        if (!point) continue;
        moved[performerId] = { x: point.x + dx, y: point.y + dy };
      }
      state.setPositions(moved, { label: 'Nudge performers' });
    },

    clearPositionsAtSet: (performerIds) => {
      const index = get().currentSetIndex;
      if (index === 0) return; // set 1 has nothing to inherit from
      const doomed = new Set(performerIds);
      commit('Inherit previous position', (show) => ({
        ...show,
        sets: show.sets.map((drillSet, i) =>
          i === index
            ? { ...drillSet, positions: omitKeys(drillSet.positions, doomed) }
            : drillSet,
        ),
      }));
    },

    setTransition: (performerId, transition) => {
      const index = get().currentSetIndex;
      commit('Edit transition', (show) => ({
        ...show,
        sets: show.sets.map((drillSet, i) => {
          if (i !== index) return drillSet;
          const transitions = { ...(drillSet.transitions ?? {}) };
          if (transition) transitions[performerId] = transition;
          else delete transitions[performerId];
          return {
            ...drillSet,
            transitions: Object.keys(transitions).length ? transitions : undefined,
          };
        }),
      }));
    },

    // --- selection & view --------------------------------------------------
    select: (performerIds, mode = 'replace') => {
      const current = get().selectedPerformerIds;
      if (mode === 'replace') {
        set({ selectedPerformerIds: [...performerIds] });
        return;
      }
      if (mode === 'add') {
        const merged = new Set(current);
        for (const id of performerIds) merged.add(id);
        set({ selectedPerformerIds: [...merged] });
        return;
      }
      const merged = new Set(current);
      for (const id of performerIds) {
        if (merged.has(id)) merged.delete(id);
        else merged.add(id);
      }
      set({ selectedPerformerIds: [...merged] });
    },

    selectAll: () =>
      set({ selectedPerformerIds: get().show.performers.map((p) => p.id) }),

    selectSection: (sectionId) =>
      set({
        selectedPerformerIds: get()
          .show.performers.filter((performer) => performer.sectionId === sectionId)
          .map((performer) => performer.id),
      }),

    clearSelection: () => set({ selectedPerformerIds: [] }),

    setTool: (tool) => set({ tool }),

    updateView: (patch) => set({ view: { ...get().view, ...patch } }),

    updatePathVisibility: (patch) =>
      set({ view: { ...get().view, paths: { ...get().view.paths, ...patch } } }),

    updateRotationSettings: (patch) => {
      // Normalise here rather than trusting the caller: a half-typed number in
      // the settings field must not put the handle into a state where dragging
      // it collapses the form onto 0deg.
      const merged = { ...get().view.rotation, ...patch };
      set({
        view: {
          ...get().view,
          rotation: {
            stepDegrees: normaliseStep(merged.stepDegrees),
            coarseStepDegrees: normaliseStep(merged.coarseStepDegrees),
          },
        },
      });
    },

    togglePathSection: (sectionId) => {
      const paths = get().view.paths;
      set({
        view: {
          ...get().view,
          paths: { ...paths, sectionIds: toggleId(paths.sectionIds, sectionId) },
        },
      });
    },

    togglePathPerformer: (performerId) => {
      const paths = get().view.paths;
      set({
        view: {
          ...get().view,
          paths: { ...paths, performerIds: toggleId(paths.performerIds, performerId) },
        },
      });
    },

    addSelectionToPathScope: () => {
      const state = get();
      const merged = new Set([
        ...state.view.paths.performerIds,
        ...state.selectedPerformerIds,
      ]);
      set({
        view: {
          ...state.view,
          paths: { ...state.view.paths, scope: 'custom', performerIds: [...merged] },
        },
      });
    },

    setPlayhead: (count) => {
      const state = get();
      const clamped = Math.max(0, count);
      // Keep the set list in step with the playhead so the inspector and the
      // canvas never disagree about which set is current.
      let elapsed = 0;
      let index = 0;
      for (let i = 1; i < state.show.sets.length; i += 1) {
        const counts = Math.max(0, state.show.sets[i].counts);
        if (clamped < elapsed + counts) {
          index = i - 1;
          break;
        }
        elapsed += counts;
        index = i;
      }
      set({ playheadCount: clamped, currentSetIndex: index });
    },

    seekToCount: (count) => {
      get().setPlayhead(count);
      set({ seekNonce: get().seekNonce + 1 });
    },

    setScrubbing: (scrubbing) => set({ isScrubbing: scrubbing }),

    // --- field logos -------------------------------------------------------
    addLogo: (logo) => {
      const id = createId('logo');
      commit('Add logo', (show) => ({
        ...show,
        fieldLogos: [...show.fieldLogos, { ...logo, id }],
      }));
      set({ selectedLogoId: id });
      return id;
    },

    updateLogo: (logoId, patch) => {
      // A locked logo cannot be dragged, so leaving it selected would strand
      // resize handles that no longer do anything.
      if (patch.locked === true && get().selectedLogoId === logoId) {
        set({ selectedLogoId: null });
      }
      commit('Edit logo', (show) => ({
        ...show,
        fieldLogos: show.fieldLogos.map((logo) => {
          if (logo.id !== logoId) return logo;
          const next = { ...logo, ...patch };
          // With the aspect locked, changing one dimension carries the other,
          // so a logo never ends up stretched by an accidental single edit.
          if (next.lockAspect && logo.widthSteps > 0 && logo.heightSteps > 0) {
            const ratio = logo.heightSteps / logo.widthSteps;
            if (patch.widthSteps !== undefined && patch.heightSteps === undefined) {
              next.heightSteps = patch.widthSteps * ratio;
            } else if (patch.heightSteps !== undefined && patch.widthSteps === undefined) {
              next.widthSteps = patch.heightSteps / ratio;
            }
          }
          return next;
        }),
      }));
    },

    setAllLogosLocked: (locked) => {
      if (locked) set({ selectedLogoId: null });
      commit(locked ? 'Lock logos' : 'Unlock logos', (show) => {
        const fieldLogos = setAllLogosLocked(show.fieldLogos, locked);
        // Referentially identical when nothing changed, so `commit` skips it
        // and no empty entry lands in undo history.
        const changed = fieldLogos.some((logo, index) => logo !== show.fieldLogos[index]);
        return changed ? { ...show, fieldLogos } : show;
      });
    },

    removeLogo: (logoId) => {
      commit('Remove logo', (show) => ({
        ...show,
        fieldLogos: show.fieldLogos.filter((logo) => logo.id !== logoId),
      }));
      if (get().selectedLogoId === logoId) set({ selectedLogoId: null });
    },

    selectLogo: (logoId) => set({ selectedLogoId: logoId }),
  };
});

function omitKeys<T>(record: Record<string, T>, keys: Set<string>): Record<string, T> {
  let changed = false;
  const out: Record<string, T> = {};
  for (const [key, value] of Object.entries(record)) {
    if (keys.has(key)) {
      changed = true;
      continue;
    }
    out[key] = value;
  }
  return changed ? out : record;
}

function countsAt(show: Show, setIndex: number): number {
  let total = 0;
  for (let i = 1; i <= setIndex && i < show.sets.length; i += 1) {
    total += Math.max(0, show.sets[i].counts);
  }
  return total;
}

/** Field metrics for the current show. Memoised on the field config object. */
let metricsCache: { config: FieldConfig; metrics: FieldMetrics } | null = null;
export function useFieldMetrics(): FieldMetrics {
  const config = useShowStore((state) => state.show.field);
  if (!metricsCache || metricsCache.config !== config) {
    metricsCache = { config, metrics: fieldMetrics(config) };
  }
  return metricsCache.metrics;
}
