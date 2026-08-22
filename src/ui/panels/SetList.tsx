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

import { useShowStore } from '../../state/showStore.ts';
import { countTimeline } from '../../core/show.ts';

/**
 * The show's sets, in order. Clicking one makes it current; the counts field is
 * editable inline because adjusting how long a move takes is the single most
 * common edit after placing the form itself.
 */
export function SetList() {
  const sets = useShowStore((state) => state.show.sets);
  const show = useShowStore((state) => state.show);
  const currentSetIndex = useShowStore((state) => state.currentSetIndex);
  const goToSet = useShowStore((state) => state.goToSet);
  const addSet = useShowStore((state) => state.addSet);
  const duplicateSet = useShowStore((state) => state.duplicateSet);
  const removeSet = useShowStore((state) => state.removeSet);
  const moveSet = useShowStore((state) => state.moveSet);

  const timeline = countTimeline(show);

  return (
    <div className="section">
      <div className="section__header">
        <h2 className="section__title">Sets</h2>
        <div className="row">
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => duplicateSet(currentSetIndex)}
            title="Duplicate the current set"
          >
            Duplicate
          </button>
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={() => addSet()}
            title="Add a set after the current one"
          >
            Add set
          </button>
        </div>
      </div>

      <div className="set-list">
        {sets.map((set, index) => {
          const isCurrent = index === currentSetIndex;
          return (
            <div
              key={set.id}
              className={`set-item${isCurrent ? ' set-item--current' : ''}`}
              onClick={() => goToSet(index)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  goToSet(index);
                }
              }}
              role="button"
              tabIndex={0}
              aria-current={isCurrent}
            >
              <span className="set-item__label">{set.label}</span>
              <span className="set-item__meta">
                <span className="set-item__counts">
                  {index === 0 ? 'opening' : `${set.counts} cts`} · count{' '}
                  {timeline[index]}
                </span>
                {set.notes && <span className="set-item__notes">{set.notes}</span>}
              </span>
              <span className="row">
                <button
                  type="button"
                  className="btn btn--ghost btn--sm btn--icon"
                  title="Move earlier"
                  aria-label={`Move set ${set.label} earlier`}
                  disabled={index === 0}
                  onClick={(event) => {
                    event.stopPropagation();
                    moveSet(index, index - 1);
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm btn--icon"
                  title="Move later"
                  aria-label={`Move set ${set.label} later`}
                  disabled={index === sets.length - 1}
                  onClick={(event) => {
                    event.stopPropagation();
                    moveSet(index, index + 1);
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm btn--icon btn--danger"
                  title="Delete this set"
                  aria-label={`Delete set ${set.label}`}
                  disabled={sets.length <= 1}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeSet(index);
                  }}
                >
                  ×
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
