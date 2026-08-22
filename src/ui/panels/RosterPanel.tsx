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

import { useState } from 'react';

import { SECTION_PALETTE } from '../../core/sections.ts';
import type { PerformerSymbol } from '../../core/types.ts';
import { performersInSection, resolveSetPositions } from '../../core/show.ts';
import { useShowStore } from '../../state/showStore.ts';

const SYMBOLS: PerformerSymbol[] = ['circle', 'square', 'triangle', 'diamond'];

/**
 * Roster management (FR-1.2). Performers are grouped by section; clicking a
 * section selects everyone in it, which is how most editing starts — pick the
 * trumpets, then move them.
 */
export function RosterPanel() {
  const show = useShowStore((state) => state.show);
  const currentSetIndex = useShowStore((state) => state.currentSetIndex);
  const selectedIds = useShowStore((state) => state.selectedPerformerIds);
  const select = useShowStore((state) => state.select);
  const selectSection = useShowStore((state) => state.selectSection);
  const addPerformers = useShowStore((state) => state.addPerformers);
  const addSection = useShowStore((state) => state.addSection);
  const updateSection = useShowStore((state) => state.updateSection);
  const removeSection = useShowStore((state) => state.removeSection);
  const removePerformers = useShowStore((state) => state.removePerformers);

  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [addCount, setAddCount] = useState(8);

  const selected = new Set(selectedIds);
  const placed = resolveSetPositions(show, currentSetIndex);

  return (
    <div className="section">
      <div className="section__header">
        <h2 className="section__title">Roster ({show.performers.length})</h2>
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => {
            const id = addSection(`Section ${show.sections.length + 1}`);
            setEditingSectionId(id);
          }}
        >
          Add section
        </button>
      </div>

      <div className="section__body">
        {show.sections.map((section) => {
          const members = performersInSection(show, section.id);
          const isEditing = editingSectionId === section.id;
          return (
            <div className="roster-section" key={section.id}>
              <div className="roster-section__header">
                <span
                  className={`swatch${section.symbol === 'circle' ? ' swatch--round' : ''}`}
                  style={{ background: section.color }}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  className="roster-section__name"
                  onClick={() => selectSection(section.id)}
                  title={`Select all ${section.name}`}
                >
                  {section.name}
                </button>
                <span className="roster-section__count">{members.length}</span>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm btn--icon"
                  aria-label={`Edit ${section.name}`}
                  aria-expanded={isEditing}
                  onClick={() => setEditingSectionId(isEditing ? null : section.id)}
                >
                  ⚙
                </button>
              </div>

              {isEditing && (
                <div style={{ padding: '4px 0 8px 19px' }}>
                  <div className="field">
                    <label className="field__label" htmlFor={`name-${section.id}`}>
                      Name
                    </label>
                    <input
                      id={`name-${section.id}`}
                      className="input input--inline"
                      value={section.name}
                      onChange={(event) =>
                        updateSection(section.id, { name: event.target.value })
                      }
                    />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor={`abbr-${section.id}`}>
                      Abbreviation
                    </label>
                    <input
                      id={`abbr-${section.id}`}
                      className="input input--inline"
                      maxLength={4}
                      value={section.abbreviation}
                      onChange={(event) =>
                        updateSection(section.id, {
                          abbreviation: event.target.value.toUpperCase(),
                        })
                      }
                    />
                  </div>
                  <div className="field">
                    <span className="field__label">Colour</span>
                    <div className="row row--wrap">
                      {SECTION_PALETTE.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className="swatch"
                          style={{
                            background: color,
                            outline:
                              color === section.color ? '2px solid var(--accent)' : 'none',
                            outlineOffset: '1px',
                            cursor: 'pointer',
                          }}
                          aria-label={`Use colour ${color}`}
                          onClick={() => updateSection(section.id, { color })}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <span className="field__label">Symbol</span>
                    <div className="row">
                      {SYMBOLS.map((symbol) => (
                        <button
                          key={symbol}
                          type="button"
                          className={`btn btn--sm${
                            section.symbol === symbol ? ' btn--active' : ''
                          }`}
                          onClick={() => updateSection(section.id, { symbol })}
                        >
                          {symbol}
                        </button>
                      ))}
                    </div>
                    <p className="hint">
                      Shape carries the same information as colour, so charts stay
                      readable in greyscale.
                    </p>
                  </div>
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn--sm btn--danger"
                      disabled={show.sections.length <= 1}
                      onClick={() => {
                        removeSection(section.id);
                        setEditingSectionId(null);
                      }}
                    >
                      Delete section
                    </button>
                  </div>
                </div>
              )}

              {members.length > 0 && (
                <div className="performer-chips">
                  {members.map((performer) => (
                    <button
                      key={performer.id}
                      type="button"
                      className={`chip${selected.has(performer.id) ? ' chip--selected' : ''}${
                        placed[performer.id] ? '' : ' chip--unplaced'
                      }`}
                      title={
                        placed[performer.id]
                          ? performer.name || performer.label
                          : `${performer.label} — not placed in this set yet`
                      }
                      onClick={(event) =>
                        select(
                          [performer.id],
                          event.shiftKey || event.metaKey || event.ctrlKey
                            ? 'toggle'
                            : 'replace',
                        )
                      }
                    >
                      {performer.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="row" style={{ paddingLeft: 19, marginTop: 2 }}>
                {/* Newly added performers are selected straight away, so the
                    formation tools act on them without a second step. */}
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => select(addPerformers(section.id, addCount), 'replace')}
                >
                  + {addCount}
                </button>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => select(addPerformers(section.id, 1), 'replace')}
                >
                  + 1
                </button>
                {members.length > 0 && (
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={() => selectSection(section.id)}
                  >
                    Select all
                  </button>
                )}
              </div>
            </div>
          );
        })}

        <div className="field field--row" style={{ marginTop: 10 }}>
          <label className="field__label" htmlFor="bulk-add-count">
            Bulk add size
          </label>
          <input
            id="bulk-add-count"
            className="input input--number input--inline"
            type="number"
            min={1}
            max={64}
            value={addCount}
            onChange={(event) =>
              setAddCount(Math.max(1, Math.min(64, Number(event.target.value) || 1)))
            }
          />
        </div>

        {selectedIds.length > 0 && (
          <button
            type="button"
            className="btn btn--sm btn--danger"
            onClick={() => removePerformers(selectedIds)}
          >
            Remove {selectedIds.length} selected
          </button>
        )}

        {show.performers.length === 0 ? (
          <p className="hint">
            Add performers to a section with the <strong>+</strong> buttons above.
            They arrive selected but not yet on the field — then pick a shape in
            Formation tools to place them.
          </p>
        ) : (
          <p className="hint">
            A dashed chip means that performer is not on the field in this set.
            Select them and use a formation tool to place them.
          </p>
        )}
      </div>
    </div>
  );
}
