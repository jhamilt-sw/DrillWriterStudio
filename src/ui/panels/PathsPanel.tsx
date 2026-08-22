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

import type { PathScope } from '../../core/pathVisibility.ts';
import { describePathScope, visiblePathPerformers } from '../../core/pathVisibility.ts';
import { performersInSection } from '../../core/show.ts';
import { useShowStore } from '../../state/showStore.ts';

const SCOPES: { value: PathScope; label: string; hint: string }[] = [
  { value: 'all', label: 'Everyone', hint: 'Every performer in the show.' },
  {
    value: 'selected',
    label: 'Selection',
    hint: 'Follows whatever is selected — useful while watching one squad.',
  },
  {
    value: 'custom',
    label: 'Choose…',
    hint: 'Pick sections and individuals below. Stays put as the selection changes.',
  },
];

/**
 * Who gets a movement path, and when.
 *
 * Editing and playback are separate switches because they want opposite
 * defaults: paths are how you write drill, and they are what stops you seeing
 * it when you watch it back.
 */
export function PathsPanel() {
  const show = useShowStore((state) => state.show);
  const paths = useShowStore((state) => state.view.paths);
  const selectedIds = useShowStore((state) => state.selectedPerformerIds);
  const updatePathVisibility = useShowStore((state) => state.updatePathVisibility);
  const togglePathSection = useShowStore((state) => state.togglePathSection);
  const togglePathPerformer = useShowStore((state) => state.togglePathPerformer);
  const addSelectionToPathScope = useShowStore((state) => state.addSelectionToPathScope);

  const visible = visiblePathPerformers(show.performers, paths, selectedIds);
  const scopeLabel = describePathScope(paths, visible.size, show.performers.length);

  return (
    <div className="section">
      <div className="section__header">
        <h2 className="section__title">Paths</h2>
        <span className="roster-section__count">{scopeLabel}</span>
      </div>

      <div className="section__body">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={paths.whileEditing}
            onChange={(event) =>
              updatePathVisibility({ whileEditing: event.target.checked })
            }
          />
          Show while editing <span className="hint-inline">(P)</span>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={paths.whilePlaying}
            onChange={(event) =>
              updatePathVisibility({ whilePlaying: event.target.checked })
            }
          />
          Show during playback <span className="hint-inline">(Shift+P)</span>
        </label>
        <p className="hint" style={{ marginTop: 0 }}>
          Off during playback by default — 250 lines over a moving field hide the
          thing you are watching for.
        </p>

        <div className="field">
          <span className="field__label">Whose paths</span>
          <div className="row row--wrap">
            {SCOPES.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`btn btn--sm${paths.scope === option.value ? ' btn--active' : ''}`}
                title={option.hint}
                aria-pressed={paths.scope === option.value}
                onClick={() => updatePathVisibility({ scope: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {paths.scope === 'selected' && selectedIds.length === 0 && (
          <p className="hint">
            Nothing is selected, so no paths will be drawn. Select performers on
            the field or in the roster.
          </p>
        )}

        {paths.scope === 'custom' && (
          <>
            <div className="field">
              <span className="field__label">Sections</span>
              <div className="row row--wrap">
                {show.sections.map((section) => {
                  const count = performersInSection(show, section.id).length;
                  const on = paths.sectionIds.includes(section.id);
                  return (
                    <button
                      key={section.id}
                      type="button"
                      className={`chip${on ? ' chip--selected' : ''}`}
                      aria-pressed={on}
                      title={`${section.name} — ${count} performer${count === 1 ? '' : 's'}`}
                      onClick={() => togglePathSection(section.id)}
                    >
                      <span
                        className="swatch swatch--round"
                        style={{
                          background: section.color,
                          display: 'inline-block',
                          marginRight: 4,
                          verticalAlign: 'middle',
                        }}
                        aria-hidden="true"
                      />
                      {section.abbreviation}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="field">
              <span className="field__label">
                Individuals ({paths.performerIds.length})
              </span>
              <button
                type="button"
                className="btn btn--sm"
                disabled={selectedIds.length === 0}
                onClick={addSelectionToPathScope}
              >
                Add {selectedIds.length} selected
              </button>
              {paths.performerIds.length > 0 && (
                <>
                  <div className="performer-chips" style={{ paddingLeft: 0 }}>
                    {paths.performerIds.map((id) => {
                      const performer = show.performers.find((p) => p.id === id);
                      if (!performer) return null;
                      return (
                        <button
                          key={id}
                          type="button"
                          className="chip chip--selected"
                          title="Remove from path list"
                          onClick={() => togglePathPerformer(id)}
                        >
                          {performer.label} ×
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={() => updatePathVisibility({ performerIds: [] })}
                  >
                    Clear individuals
                  </button>
                </>
              )}
            </div>

            {visible.size === 0 && (
              <p className="hint">
                Nothing chosen yet, so no paths will be drawn.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
