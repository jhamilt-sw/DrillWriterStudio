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

import {
  DEFAULT_CHART_OPTIONS,
  DEFAULT_SHEET_OPTIONS,
  exportCoordinateSheets,
  exportDrillCharts,
  exportShowSummary,
} from '../../io/pdf/export.ts';
import { APP_NAME } from '../../core/app.ts';
import { downloadShow } from '../../io/showFile.ts';
import { useShowStore } from '../../state/showStore.ts';

type Tab = 'sheets' | 'charts' | 'summary';

/**
 * Export (FR-2.3). Everything is generated in the browser and handed straight
 * to a download — no upload, no round trip, so a roster of minors never leaves
 * the machine it was typed on (NFR-2).
 */
export function ExportDialog({ onClose }: { onClose: () => void }) {
  const show = useShowStore((state) => state.show);
  const selectedIds = useShowStore((state) => state.selectedPerformerIds);

  const [tab, setTab] = useState<Tab>('sheets');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [chartOptions, setChartOptions] = useState({ ...DEFAULT_CHART_OPTIONS });
  const [sheetOptions, setSheetOptions] = useState({ ...DEFAULT_SHEET_OPTIONS });
  const [onlySelected, setOnlySelected] = useState(false);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'The PDF could not be generated.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Export"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog dialog--wide">
        <div className="dialog__header">
          <h2 className="dialog__title">Export</h2>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="tab-row">
          <button
            type="button"
            className={`tab${tab === 'sheets' ? ' tab--active' : ''}`}
            onClick={() => setTab('sheets')}
          >
            Coordinate sheets
          </button>
          <button
            type="button"
            className={`tab${tab === 'charts' ? ' tab--active' : ''}`}
            onClick={() => setTab('charts')}
          >
            Drill charts
          </button>
          <button
            type="button"
            className={`tab${tab === 'summary' ? ' tab--active' : ''}`}
            onClick={() => setTab('summary')}
          >
            Show file
          </button>
        </div>

        <div className="dialog__body">
          {error && (
            <div className="alert alert--error" role="alert">
              {error}
            </div>
          )}

          {tab === 'sheets' && (
            <>
              <p className="hint" style={{ marginTop: 0 }}>
                One page per performer listing every set they appear in, written the
                way it is read on the field: side, yard line, and distance from the
                nearest hash or sideline.
              </p>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={sheetOptions.includeMoveDistance}
                  onChange={(event) =>
                    setSheetOptions({
                      ...sheetOptions,
                      includeMoveDistance: event.target.checked,
                    })
                  }
                />
                Include how far each move travels and the stride it needs
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={onlySelected}
                  disabled={selectedIds.length === 0}
                  onChange={(event) => setOnlySelected(event.target.checked)}
                />
                Only the {selectedIds.length} selected performer
                {selectedIds.length === 1 ? '' : 's'}
              </label>
              <div className="field" style={{ maxWidth: 180, marginTop: 10 }}>
                <label className="field__label" htmlFor="sheet-precision">
                  Round coordinates to
                </label>
                <select
                  id="sheet-precision"
                  className="select"
                  value={sheetOptions.precisionSteps}
                  onChange={(event) =>
                    setSheetOptions({
                      ...sheetOptions,
                      precisionSteps: Number(event.target.value),
                    })
                  }
                >
                  <option value={0.25}>Quarter step</option>
                  <option value={0.5}>Half step</option>
                  <option value={0.1}>Tenth of a step</option>
                  <option value={1}>Whole step</option>
                </select>
              </div>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    exportCoordinateSheets(show, {
                      ...sheetOptions,
                      performerIds: onlySelected ? selectedIds : null,
                    }),
                  )
                }
              >
                {busy ? 'Generating…' : 'Download coordinate sheets'}
              </button>
            </>
          )}

          {tab === 'charts' && (
            <>
              <p className="hint" style={{ marginTop: 0 }}>
                One landscape page per set, every performer marked and labelled —
                the director&rsquo;s book.
              </p>
              {(
                [
                  ['showPreviousSet', 'Ghost the previous set behind each chart'],
                  ['showPaths', 'Draw movement paths into each set'],
                  ['showLabels', 'Label every performer'],
                  ['showEndZones', 'Draw the end zones'],
                  ['showLegend', 'Include a section legend'],
                  ['showLogos', 'Print field logos faintly beneath the drill'],
                ] as const
              ).map(([key, label]) => (
                <label className="checkbox" key={key}>
                  <input
                    type="checkbox"
                    checked={chartOptions[key]}
                    onChange={(event) =>
                      setChartOptions({ ...chartOptions, [key]: event.target.checked })
                    }
                  />
                  {label}
                </label>
              ))}
              <div className="field" style={{ maxWidth: 220, marginTop: 10 }}>
                <label className="field__label" htmlFor="chart-section">
                  Limit to one section
                </label>
                <select
                  id="chart-section"
                  className="select"
                  value={chartOptions.sectionId ?? ''}
                  onChange={(event) =>
                    setChartOptions({
                      ...chartOptions,
                      sectionId: event.target.value || null,
                    })
                  }
                >
                  <option value="">Whole ensemble</option>
                  {show.sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={() => run(() => exportDrillCharts(show, chartOptions))}
              >
                {busy ? 'Generating…' : `Download ${show.sets.length} charts`}
              </button>
            </>
          )}

          {tab === 'summary' && (
            <>
              <p className="hint" style={{ marginTop: 0 }}>
                A one-page overview of the show, or a copy of the show file itself.
              </p>
              <div className="row row--wrap">
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => run(() => exportShowSummary(show))}
                >
                  Download show summary (PDF)
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    downloadShow(show);
                    onClose();
                  }}
                >
                  Download show file (.drillshow)
                </button>
              </div>
              <p className="hint">
                The show file is plain JSON with a version stamp, so a show saved
                today still opens in later versions of {APP_NAME}.
              </p>
            </>
          )}
        </div>

        <div className="dialog__footer">
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
