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

import { useMemo } from 'react';

import { describePoint, formatSteps } from '../../core/notation.ts';
import { findDemandingMoves, segmentsIntoSet } from '../../core/interpolate.ts';
import { findCrossings } from '../../core/assignment.ts';
import { countsAtSet, findSectionById, resolvePosition } from '../../core/show.ts';
import { useFieldMetrics, useShowStore } from '../../state/showStore.ts';

/**
 * Properties of the current set, the written coordinate of whatever is
 * selected, and a warning list for moves that demand an unreasonable stride.
 *
 * The coordinate readout is the same text that lands on the printed sheet, so a
 * designer can sanity-check what a marcher will actually be told without
 * exporting anything.
 */
export function Inspector() {
  const show = useShowStore((state) => state.show);
  const currentSetIndex = useShowStore((state) => state.currentSetIndex);
  const selectedIds = useShowStore((state) => state.selectedPerformerIds);
  const updateSet = useShowStore((state) => state.updateSet);
  const select = useShowStore((state) => state.select);
  const view = useShowStore((state) => state.view);
  const metrics = useFieldMetrics();

  const set = show.sets[currentSetIndex];

  const demanding = useMemo(
    () =>
      view.showStrideWarnings
        ? findDemandingMoves(show, currentSetIndex, metrics, view.strideWarningInches)
        : [],
    [show, currentSetIndex, metrics, view.showStrideWarnings, view.strideWarningInches],
  );

  /**
   * Paths that cross on the way into this set.
   *
   * The formation tools assign performers optimally, which provably leaves no
   * crossings — but hand-dragging can reintroduce them, and a crossing is a
   * collision waiting to happen at rehearsal.
   */
  const crossings = useMemo(
    () =>
      findCrossings(
        segmentsIntoSet(show, currentSetIndex).map((segment) => ({
          id: segment.performerId,
          from: segment.from,
          to: segment.to,
        })),
      ),
    [show, currentSetIndex],
  );

  const performerLabel = (performerId: string) =>
    show.performers.find((performer) => performer.id === performerId)?.label ?? '?';

  if (!set) return null;

  const singleSelection =
    selectedIds.length === 1
      ? show.performers.find((performer) => performer.id === selectedIds[0])
      : undefined;
  const singlePoint = singleSelection
    ? resolvePosition(show, singleSelection.id, currentSetIndex)
    : null;

  return (
    <>
      <div className="section">
        <div className="section__header">
          <h2 className="section__title">Set {set.label}</h2>
          <span className="roster-section__count">
            count {countsAtSet(show, currentSetIndex)}
          </span>
        </div>
        <div className="section__body">
          <div className="grid-2">
            <div className="field">
              <label className="field__label" htmlFor="set-label">
                Label
              </label>
              <input
                id="set-label"
                className="input"
                value={set.label}
                onChange={(event) =>
                  updateSet(currentSetIndex, { label: event.target.value })
                }
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="set-counts">
                Counts in
              </label>
              <input
                id="set-counts"
                className="input"
                type="number"
                min={0}
                max={512}
                disabled={currentSetIndex === 0}
                value={set.counts}
                onChange={(event) =>
                  updateSet(currentSetIndex, {
                    counts: Math.max(0, Number(event.target.value) || 0),
                  })
                }
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="field">
              <label className="field__label" htmlFor="set-measure">
                Measure
              </label>
              <input
                id="set-measure"
                className="input"
                type="number"
                min={1}
                value={set.music?.measure ?? ''}
                placeholder="—"
                onChange={(event) => {
                  const measure = Number(event.target.value);
                  updateSet(currentSetIndex, {
                    music: measure
                      ? { measure, beat: set.music?.beat ?? 1 }
                      : undefined,
                  });
                }}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="set-beat">
                Beat
              </label>
              <input
                id="set-beat"
                className="input"
                type="number"
                min={1}
                disabled={!set.music}
                value={set.music?.beat ?? ''}
                placeholder="—"
                onChange={(event) =>
                  updateSet(currentSetIndex, {
                    music: {
                      measure: set.music?.measure ?? 1,
                      beat: Math.max(1, Number(event.target.value) || 1),
                    },
                  })
                }
              />
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="set-notes">
              Notes
            </label>
            <input
              id="set-notes"
              className="input"
              value={set.notes ?? ''}
              placeholder="horns up, drum break…"
              onChange={(event) =>
                updateSet(currentSetIndex, { notes: event.target.value || undefined })
              }
            />
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section__header">
          <h2 className="section__title">
            Selection {selectedIds.length > 0 && `(${selectedIds.length})`}
          </h2>
        </div>
        <div className="section__body">
          {selectedIds.length === 0 && (
            <p className="hint">
              Click a performer, drag a box around several, or click a section name to
              select the whole section.
            </p>
          )}

          {singleSelection && singlePoint && (
            <>
              <div className="field">
                <label className="field__label" htmlFor="performer-name">
                  {singleSelection.label} ·{' '}
                  {findSectionById(show, singleSelection.sectionId)?.name}
                </label>
                <input
                  id="performer-name"
                  className="input"
                  placeholder="Name (optional)"
                  value={singleSelection.name}
                  onChange={(event) =>
                    useShowStore
                      .getState()
                      .updatePerformer(singleSelection.id, { name: event.target.value })
                  }
                />
              </div>
              <div className="coordinate-readout">
                {(() => {
                  const written = describePoint(singlePoint, metrics);
                  return (
                    <>
                      <div>{written.horizontal.text}</div>
                      <div>{written.vertical.text}</div>
                    </>
                  );
                })()}
              </div>
            </>
          )}

          {selectedIds.length > 1 && (
            <p className="hint">
              {selectedIds.length} performers selected. Arrow keys nudge by one snap
              step; hold Shift for a whole step.
            </p>
          )}
        </div>
      </div>

      {crossings.length > 0 && (
        <div className="section">
          <div className="section__header">
            <h2 className="section__title">⚠ Crossing paths</h2>
            <span className="roster-section__count">{crossings.length}</span>
          </div>
          <div className="section__body">
            <p className="hint" style={{ marginTop: 0, marginBottom: 6 }}>
              Into set {set.label}. Two marchers pass through the same point.
            </p>
            <ul className="stride-list">
              {crossings.slice(0, 8).map((pair) => (
                <li key={`${pair.first}-${pair.second}`}>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => select([pair.first, pair.second], 'replace')}
                  >
                    {performerLabel(pair.first)} × {performerLabel(pair.second)}
                  </button>
                </li>
              ))}
            </ul>
            {crossings.length > 8 && (
              <p className="hint">and {crossings.length - 8} more</p>
            )}
          </div>
        </div>
      )}

      {demanding.length > 0 && (
        <div className="section">
          <div className="section__header">
            <h2 className="section__title">⚠ Demanding moves</h2>
            <span className="roster-section__count">{demanding.length}</span>
          </div>
          <div className="section__body">
            <p className="hint" style={{ marginTop: 0, marginBottom: 6 }}>
              Into set {set.label}, over {set.counts} counts. Anything past{' '}
              {view.strideWarningInches}&quot; per step is hard to march cleanly.
            </p>
            <ul className="stride-list">
              {demanding.slice(0, 12).map((analysis) => (
                <li key={analysis.performerId}>
                  <button
                    type="button"
                    className="chip"
                    onClick={() => select([analysis.performerId], 'replace')}
                  >
                    {performerLabel(analysis.performerId)}
                  </button>
                  <span>
                    {formatSteps(analysis.distanceSteps)} steps ·{' '}
                    {analysis.inchesPerStep.toFixed(1)}&quot;
                  </span>
                </li>
              ))}
            </ul>
            {demanding.length > 12 && (
              <p className="hint">and {demanding.length - 12} more</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
