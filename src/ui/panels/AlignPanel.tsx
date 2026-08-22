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

import { useAlignmentActions } from '../alignment/useAlignmentActions.ts';

/**
 * The alignment commands as a panel.
 *
 * Identical to the right-click menu — same model, same handlers — so every
 * command has a keyboard-reachable home and the two can never disagree.
 */
export function AlignPanel() {
  const { groups, selectedCount, placedCount } = useAlignmentActions();
  const [openGroup, setOpenGroup] = useState<string | null>('yard-lines');

  const unplaced = selectedCount - placedCount;

  return (
    <div className="section">
      <div className="section__header">
        <h2 className="section__title">Align</h2>
        <span className="roster-section__count">{placedCount} on field</span>
      </div>

      <div className="section__body">
        {placedCount === 0 ? (
          <p className="hint" style={{ marginTop: 0 }}>
            {selectedCount === 0
              ? 'Select performers on the field to align them to yard lines, hashes and sidelines.'
              : 'The selected performers are not on the field in this set yet — place them first.'}
          </p>
        ) : (
          <>
            <p className="hint" style={{ marginTop: 0, marginBottom: 8 }}>
              Right-click the field for these same commands.
              {unplaced > 0 &&
                ` ${unplaced} selected performer${unplaced === 1 ? ' is' : 's are'} not on the field and will be skipped.`}
            </p>

            {groups.map((group) => {
              const isOpen = openGroup === group.id;
              return (
                <div key={group.id} style={{ marginBottom: 4 }}>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    style={{ width: '100%', justifyContent: 'space-between' }}
                    aria-expanded={isOpen}
                    onClick={() => setOpenGroup(isOpen ? null : group.id)}
                  >
                    <span>{group.label}</span>
                    <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
                  </button>
                  {isOpen && (
                    <div className="align-actions">
                      {group.actions.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          className="btn btn--sm"
                          style={{ width: '100%', justifyContent: 'flex-start' }}
                          disabled={action.disabled}
                          title={action.hint}
                          onClick={action.run}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
