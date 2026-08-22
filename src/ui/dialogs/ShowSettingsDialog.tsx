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
  DEFAULT_STEPS_PER_FIVE_YARDS,
  FIELD_TYPE_LABELS,
  MAX_STEPS_PER_FIVE_YARDS,
  MIN_STEPS_PER_FIVE_YARDS,
  STEP_SIZE_PRESETS,
  normaliseStepSize,
  stepLengthInches,
} from '../../core/field.ts';
import {
  DEFAULT_ROTATION,
  MAX_ROTATION_STEP,
  normaliseStep,
} from '../../core/rotation.ts';
import type { FieldType } from '../../core/types.ts';
import { useShowStore } from '../../state/showStore.ts';

const CUSTOM = 'custom';

export function ShowSettingsDialog({ onClose }: { onClose: () => void }) {
  const show = useShowStore((state) => state.show);
  const updateMetadata = useShowStore((state) => state.updateMetadata);
  const updateField = useShowStore((state) => state.updateField);
  const view = useShowStore((state) => state.view);
  const updateView = useShowStore((state) => state.updateView);
  const updateRotationSettings = useShowStore((state) => state.updateRotationSettings);

  const isPreset = STEP_SIZE_PRESETS.some(
    (preset) => preset.stepsPerFiveYards === show.field.stepsPerFiveYards,
  );
  const [customOpen, setCustomOpen] = useState(!isPreset);

  return (
    <div
      className="dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Show settings"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog">
        <div className="dialog__header">
          <h2 className="dialog__title">Show settings</h2>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="dialog__body">
          <div className="grid-2">
            <div className="field">
              <label className="field__label" htmlFor="meta-ensemble">
                Ensemble
              </label>
              <input
                id="meta-ensemble"
                className="input"
                value={show.metadata.ensemble}
                onChange={(event) => updateMetadata({ ensemble: event.target.value })}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="meta-season">
                Season
              </label>
              <input
                id="meta-season"
                className="input"
                value={show.metadata.season}
                onChange={(event) => updateMetadata({ season: event.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="meta-designer">
              Designer
            </label>
            <input
              id="meta-designer"
              className="input"
              value={show.metadata.designer}
              onChange={(event) => updateMetadata({ designer: event.target.value })}
            />
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '14px 0' }} />

          <div className="grid-2">
            <div className="field">
              <label className="field__label" htmlFor="field-type">
                Hash placement
              </label>
              <select
                id="field-type"
                className="select"
                value={show.field.type}
                onChange={(event) =>
                  updateField({ type: event.target.value as FieldType })
                }
              >
                {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((type) => (
                  <option key={type} value={type}>
                    {FIELD_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="field-steps">
                Step size
              </label>
              <select
                id="field-steps"
                className="select"
                value={isPreset ? show.field.stepsPerFiveYards : CUSTOM}
                onChange={(event) => {
                  if (event.target.value === CUSTOM) {
                    setCustomOpen(true);
                    return;
                  }
                  setCustomOpen(false);
                  updateField({ stepsPerFiveYards: Number(event.target.value) });
                }}
              >
                {STEP_SIZE_PRESETS.map((preset) => (
                  <option key={preset.stepsPerFiveYards} value={preset.stepsPerFiveYards}>
                    {preset.label} — {preset.note}
                  </option>
                ))}
                <option value={CUSTOM}>Custom…</option>
              </select>
            </div>
          </div>

          {(customOpen || !isPreset) && (
            <div className="field" style={{ maxWidth: 260 }}>
              <label className="field__label" htmlFor="field-steps-custom">
                Steps per five yards
              </label>
              <div className="row">
                <input
                  id="field-steps-custom"
                  className="input input--number"
                  type="number"
                  step={0.25}
                  min={MIN_STEPS_PER_FIVE_YARDS}
                  max={MAX_STEPS_PER_FIVE_YARDS}
                  value={show.field.stepsPerFiveYards}
                  onChange={(event) => {
                    const raw = Number(event.target.value);
                    if (!Number.isFinite(raw) || raw <= 0) return;
                    updateField({ stepsPerFiveYards: normaliseStepSize(raw) });
                  }}
                />
                <span className="roster-section__count">
                  ={' '}
                  {Math.round(stepLengthInches(show.field.stepsPerFiveYards) * 100) / 100}
                  &quot; per step
                </span>
                {show.field.stepsPerFiveYards !== DEFAULT_STEPS_PER_FIVE_YARDS && (
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={() => {
                      setCustomOpen(false);
                      updateField({
                        stepsPerFiveYards: DEFAULT_STEPS_PER_FIVE_YARDS,
                      });
                    }}
                  >
                    Reset to 8-to-5
                  </button>
                )}
              </div>
            </div>
          )}

          <p className="hint" style={{ marginTop: 0 }}>
            <strong>8-to-5 is the standard</strong> and the default for every new
            show: eight 22.5&quot; steps per five yards, which puts a marcher on a
            yard line every two steps. Anything from {MIN_STEPS_PER_FIVE_YARDS} to{' '}
            {MAX_STEPS_PER_FIVE_YARDS} steps per five yards is allowed.
          </p>
          <p className="hint" style={{ marginTop: 0 }}>
            Changing hash placement moves the hashes, not the performers. Changing
            step size rewrites every coordinate so nobody physically moves — a
            marcher on the 35 stays on the 35, their coordinate is just written in
            different-sized steps.
          </p>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={show.field.showEndZones}
              onChange={(event) => updateField({ showEndZones: event.target.checked })}
            />
            Draw the end zones
          </label>

          <p className="hint">
            Turf and line colours, line weight and performer size live in the
            <strong> Field appearance</strong> panel on the right, beside the
            field they change.
          </p>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '14px 0' }} />

          <h3 className="section__title" style={{ margin: '0 0 8px' }}>
            Rotation handle
          </h3>
          <div className="grid-2">
            <div className="field">
              <label className="field__label" htmlFor="rotation-step">
                Rotation increment (°)
              </label>
              <div className="row">
                <input
                  id="rotation-step"
                  className="input input--number"
                  type="number"
                  min={0}
                  max={MAX_ROTATION_STEP}
                  step={0.5}
                  value={view.rotation.stepDegrees}
                  onChange={(event) =>
                    updateRotationSettings({
                      stepDegrees: normaliseStep(Number(event.target.value)),
                    })
                  }
                />
                {view.rotation.stepDegrees !== DEFAULT_ROTATION.stepDegrees && (
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={() =>
                      updateRotationSettings({
                        stepDegrees: DEFAULT_ROTATION.stepDegrees,
                      })
                    }
                  >
                    Reset to 1°
                  </button>
                )}
              </div>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="rotation-coarse">
                With Shift held (°)
              </label>
              <input
                id="rotation-coarse"
                className="input input--number"
                type="number"
                min={0}
                max={MAX_ROTATION_STEP}
                step={0.5}
                value={view.rotation.coarseStepDegrees}
                onChange={(event) =>
                  updateRotationSettings({
                    coarseStepDegrees: normaliseStep(Number(event.target.value)),
                  })
                }
              />
            </div>
          </div>
          <p className="hint" style={{ marginTop: 0 }}>
            Dragging the rotation handle turns in <strong>1° increments</strong>{' '}
            by default. Hold <strong>Shift</strong> mid-drag for the coarser step
            — handy for landing exactly on 45° or 90°. Set either field to 0 for
            continuous rotation.
          </p>

          <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '14px 0' }} />

          <label className="checkbox">
            <input
              type="checkbox"
              checked={view.showStrideWarnings}
              onChange={(event) =>
                updateView({ showStrideWarnings: event.target.checked })
              }
            />
            Warn about moves that demand a long stride
          </label>

          <div className="field" style={{ maxWidth: 200 }}>
            <label className="field__label" htmlFor="stride-threshold">
              Warn above (inches per step)
            </label>
            <input
              id="stride-threshold"
              className="input"
              type="number"
              min={12}
              max={60}
              disabled={!view.showStrideWarnings}
              value={view.strideWarningInches}
              onChange={(event) =>
                updateView({
                  strideWarningInches: Math.max(
                    12,
                    Math.min(60, Number(event.target.value) || 30),
                  ),
                })
              }
            />
            <p className="hint">
              For reference: 8-to-5 is 22.5&quot;, 6-to-5 is 30&quot;. Past 30&quot;
              most ensembles cannot hold the form.
            </p>
          </div>
        </div>

        <div className="dialog__footer">
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
