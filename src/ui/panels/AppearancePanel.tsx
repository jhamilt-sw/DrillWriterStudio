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

import {
  DEFAULT_APPEARANCE,
  LINE_COLOR_PRESETS,
  TURF_PRESETS,
} from '../../core/field.ts';
import { contrastRatio } from '../../core/color.ts';
import { useShowStore } from '../../state/showStore.ts';

/**
 * How the field looks.
 *
 * Lives in the sidebar next to Paths and Logos rather than inside the settings
 * dialog: these are things a designer reaches for while looking at the field,
 * and a control you have to open a dialog to find is a control nobody finds.
 */
export function AppearancePanel() {
  const field = useShowStore((state) => state.show.field);
  const updateField = useShowStore((state) => state.updateField);
  const updateAppearance = useShowStore((state) => state.updateAppearance);
  const appearance = field.appearance;

  // White-on-white is an easy accident with a free colour picker, and the
  // result is an invisible field rather than an obviously wrong one.
  const paintContrast = contrastRatio(appearance.turfColor, appearance.lineColor);
  const paintTooClose = paintContrast < 1.6;

  return (
    <div className="section">
      <div className="section__header">
        <h2 className="section__title">Field appearance</h2>
        <button
          type="button"
          className="btn btn--sm btn--ghost"
          onClick={() => updateAppearance({ ...DEFAULT_APPEARANCE })}
          title="Back to grass and white paint"
        >
          Reset
        </button>
      </div>

      <div className="section__body">
        <div className="field">
          <span className="field__label">Turf</span>
          <div className="row row--wrap">
            {TURF_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={`chip${
                  appearance.turfColor === preset.turf ? ' chip--selected' : ''
                }`}
                aria-pressed={appearance.turfColor === preset.turf}
                onClick={() =>
                  updateAppearance({
                    turfColor: preset.turf,
                    endZoneColor: preset.endZone,
                  })
                }
              >
                <span
                  className="swatch swatch--round"
                  style={{
                    background: preset.turf,
                    display: 'inline-block',
                    marginRight: 4,
                    verticalAlign: 'middle',
                  }}
                  aria-hidden="true"
                />
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label className="field__label" htmlFor="turf-color">
              Turf colour
            </label>
            <input
              id="turf-color"
              className="input input--color"
              type="color"
              value={appearance.turfColor}
              onChange={(event) => updateAppearance({ turfColor: event.target.value })}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="endzone-color">
              End zones
            </label>
            <input
              id="endzone-color"
              className="input input--color"
              type="color"
              value={appearance.endZoneColor}
              onChange={(event) =>
                updateAppearance({ endZoneColor: event.target.value })
              }
            />
          </div>
        </div>

        <div className="field">
          <span className="field__label">Line colour</span>
          <div className="row row--wrap">
            {LINE_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                className={`chip${
                  appearance.lineColor === preset.color ? ' chip--selected' : ''
                }`}
                aria-pressed={appearance.lineColor === preset.color}
                title={preset.label}
                onClick={() =>
                  // Numbers are painted in the same colour as the lines on a real
                  // field, so they follow unless deliberately set apart.
                  updateAppearance({
                    lineColor: preset.color,
                    numberColor: preset.color,
                  })
                }
              >
                <span
                  className="swatch"
                  style={{
                    background: preset.color,
                    display: 'inline-block',
                    marginRight: 4,
                    verticalAlign: 'middle',
                  }}
                  aria-hidden="true"
                />
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2">
          <div className="field">
            <label className="field__label" htmlFor="line-color">
              Lines and hashes
            </label>
            <input
              id="line-color"
              className="input input--color"
              type="color"
              value={appearance.lineColor}
              onChange={(event) => updateAppearance({ lineColor: event.target.value })}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="number-color">
              Yard numbers
            </label>
            <input
              id="number-color"
              className="input input--color"
              type="color"
              value={appearance.numberColor}
              onChange={(event) => updateAppearance({ numberColor: event.target.value })}
            />
          </div>
        </div>

        {paintTooClose && (
          <div className="alert alert--warning" role="status">
            The line colour is very close to the turf — the yard lines will be
            hard to see.
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="line-weight">
            Line weight — {appearance.lineWeight.toFixed(2)}×
          </label>
          <input
            id="line-weight"
            className="input"
            type="range"
            min={0.5}
            max={3}
            step={0.05}
            value={appearance.lineWeight}
            onChange={(event) =>
              updateAppearance({ lineWeight: Number(event.target.value) })
            }
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="performer-size">
            Performer size — {appearance.performerSize.toFixed(2)}×
          </label>
          <input
            id="performer-size"
            className="input"
            type="range"
            min={0.4}
            max={3}
            step={0.05}
            value={appearance.performerSize}
            onChange={(event) =>
              updateAppearance({ performerSize: Number(event.target.value) })
            }
          />
          <p className="hint">
            Applies to printed charts too. Labels grow with the markers.
          </p>
        </div>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={appearance.showMowingStripes}
            onChange={(event) =>
              updateAppearance({ showMowingStripes: event.target.checked })
            }
          />
          Mown bands between the five-yard lines
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={appearance.showHashLines}
            onChange={(event) =>
              updateAppearance({ showHashLines: event.target.checked })
            }
          />
          Hash lines across the field
        </label>
        <p className="hint" style={{ marginTop: -2 }}>
          On: a continuous line along each hash, so a form can be aligned to a
          hash you can actually see. Off: the 24&quot; hash marks a real field
          is painted with. One or the other — drawn together they land in the
          same place and read as a lumpy line. Either way the yard markers stay,
          and printed charts match the screen.
        </p>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={field.showEndZones}
            onChange={(event) => updateField({ showEndZones: event.target.checked })}
          />
          Draw the end zones
        </label>

        <p className="hint">
          Saved with the show. Printed charts stay on white paper — a page of
          solid green is unreadable in a binder and empties a toner cartridge.
        </p>
      </div>
    </div>
  );
}
