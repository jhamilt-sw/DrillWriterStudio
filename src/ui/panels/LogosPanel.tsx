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

import { useFieldMetrics, useShowStore } from '../../state/showStore.ts';
import { loadLogoFile, MAX_LOGO_PIXELS } from '../../io/logoImport.ts';
import { allLogosLocked, lockedCount } from '../../core/logos.ts';

/**
 * Logos painted onto the field (opt-in — a show has none until one is added).
 *
 * The canvas handles dragging and corner-resizing; these numbers are the exact
 * path, for "make it forty steps wide, centred on the 50" rather than nudging
 * until it looks right.
 */
export function LogosPanel() {
  const logos = useShowStore((state) => state.show.fieldLogos);
  const selectedLogoId = useShowStore((state) => state.selectedLogoId);
  const addLogo = useShowStore((state) => state.addLogo);
  const updateLogo = useShowStore((state) => state.updateLogo);
  const removeLogo = useShowStore((state) => state.removeLogo);
  const selectLogo = useShowStore((state) => state.selectLogo);
  const setAllLocked = useShowStore((state) => state.setAllLogosLocked);
  const metrics = useFieldMetrics();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const imported = await loadLogoFile(file);
        // Land it at midfield, sized so it reads without covering the drill.
        const widthSteps = Math.min(metrics.widthSteps / 4, 40);
        addLogo({
          name: imported.name,
          dataUrl: imported.dataUrl,
          center: { x: metrics.fiftyX, y: metrics.depthSteps / 2 },
          widthSteps,
          heightSteps: widthSteps / imported.aspectRatio,
          rotationDegrees: 0,
          opacity: 0.85,
          visible: true,
          lockAspect: true,
          // New logos start unlocked so they can be positioned straight away.
          locked: false,
        });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That image could not be read.');
    } finally {
      setBusy(false);
    }
  };

  const selected = logos.find((logo) => logo.id === selectedLogoId) ?? null;

  return (
    <div className="section">
      <div className="section__header">
        <h2 className="section__title">Field logos</h2>
        <span className="roster-section__count">
          {logos.length > 0 && lockedCount(logos) > 0
            ? `${lockedCount(logos)}/${logos.length} locked`
            : logos.length}
        </span>
      </div>

      <div className="section__body">
        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        <label className="btn btn--sm" style={{ cursor: 'pointer' }}>
          {busy ? 'Reading…' : 'Add image…'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            multiple
            className="file-input"
            onChange={(event) => {
              void handleFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </label>

        {logos.length > 0 && (
          <>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={allLogosLocked(logos)}
                onChange={(event) => setAllLocked(event.target.checked)}
              />
              Lock all logos
            </label>
            <p className="hint" style={{ marginTop: 0 }}>
              A locked logo is still painted but ignores the mouse, so pressing
              on turf above it starts a selection instead of grabbing the logo.
            </p>
          </>
        )}

        {logos.length === 0 ? (
          <p className="hint">
            Optional. Add a PNG or JPEG to paint a crest at midfield or a
            wordmark in an end zone — it is drawn under the yard lines, so it
            reads as part of the field rather than a sticker on top.
          </p>
        ) : (
          <div className="performer-chips" style={{ paddingLeft: 0, marginTop: 6 }}>
            {logos.map((logo) => (
              <button
                key={logo.id}
                type="button"
                className={`chip${logo.id === selectedLogoId ? ' chip--selected' : ''}${
                  logo.visible ? '' : ' chip--unplaced'
                }`}
                title={
                  logo.locked
                    ? `${logo.name} — locked`
                    : logo.visible
                      ? logo.name
                      : `${logo.name} — hidden`
                }
                onClick={() => selectLogo(logo.id === selectedLogoId ? null : logo.id)}
              >
                {logo.locked ? '🔒 ' : ''}
                {logo.name}
              </button>
            ))}
          </div>
        )}

        {selected && (
          <div style={{ marginTop: 10 }}>
            <div className="field">
              <label className="field__label" htmlFor="logo-name">
                Name
              </label>
              <input
                id="logo-name"
                className="input input--inline"
                value={selected.name}
                onChange={(event) =>
                  updateLogo(selected.id, { name: event.target.value })
                }
              />
            </div>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={selected.locked}
                onChange={(event) =>
                  updateLogo(selected.id, { locked: event.target.checked })
                }
              />
              Lock on the field
            </label>

            {selected.locked && (
              <div className="alert alert--warning" role="status">
                Locked. Unlock it to drag or resize it on the field — the
                numbers below stay read-only until then.
              </div>
            )}

            <label className="checkbox">
              <input
                type="checkbox"
                checked={selected.visible}
                onChange={(event) =>
                  updateLogo(selected.id, { visible: event.target.checked })
                }
              />
              Show on the field
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={selected.lockAspect}
                disabled={selected.locked}
                onChange={(event) =>
                  updateLogo(selected.id, { lockAspect: event.target.checked })
                }
              />
              Keep proportions
            </label>

            <div className="grid-2">
              <div className="field">
                <label className="field__label" htmlFor="logo-width">
                  Width (steps)
                </label>
                <input
                  id="logo-width"
                  className="input"
                  disabled={selected.locked}
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={Math.round(selected.widthSteps * 100) / 100}
                  onChange={(event) =>
                    updateLogo(selected.id, {
                      widthSteps: Math.max(0.5, Number(event.target.value) || 1),
                    })
                  }
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="logo-height">
                  Height (steps)
                </label>
                <input
                  id="logo-height"
                  className="input"
                  disabled={selected.locked}
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={Math.round(selected.heightSteps * 100) / 100}
                  onChange={(event) =>
                    updateLogo(selected.id, {
                      heightSteps: Math.max(0.5, Number(event.target.value) || 1),
                    })
                  }
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="field">
                <label className="field__label" htmlFor="logo-x">
                  Centre — side to side
                </label>
                <input
                  id="logo-x"
                  className="input"
                  disabled={selected.locked}
                  type="number"
                  step={0.5}
                  value={Math.round(selected.center.x * 100) / 100}
                  onChange={(event) =>
                    updateLogo(selected.id, {
                      center: {
                        x: Number(event.target.value) || 0,
                        y: selected.center.y,
                      },
                    })
                  }
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="logo-y">
                  Centre — front to back
                </label>
                <input
                  id="logo-y"
                  className="input"
                  disabled={selected.locked}
                  type="number"
                  step={0.5}
                  value={Math.round(selected.center.y * 100) / 100}
                  onChange={(event) =>
                    updateLogo(selected.id, {
                      center: {
                        x: selected.center.x,
                        y: Number(event.target.value) || 0,
                      },
                    })
                  }
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="field">
                <label className="field__label" htmlFor="logo-rotation">
                  Rotation (°)
                </label>
                <input
                  id="logo-rotation"
                  className="input"
                  disabled={selected.locked}
                  type="number"
                  step={5}
                  value={Math.round(selected.rotationDegrees)}
                  onChange={(event) =>
                    updateLogo(selected.id, {
                      rotationDegrees: Number(event.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="logo-opacity">
                  Opacity
                </label>
                <input
                  id="logo-opacity"
                  className="input"
                  disabled={selected.locked}
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={selected.opacity}
                  onChange={(event) =>
                    updateLogo(selected.id, { opacity: Number(event.target.value) })
                  }
                />
              </div>
            </div>

            <div className="row row--wrap">
              <button
                type="button"
                className="btn btn--sm"
                disabled={selected.locked}
                onClick={() =>
                  updateLogo(selected.id, {
                    center: { x: metrics.fiftyX, y: metrics.depthSteps / 2 },
                  })
                }
              >
                Centre on the 50
              </button>
              <button
                type="button"
                className="btn btn--sm btn--danger"
                onClick={() => removeLogo(selected.id)}
              >
                Remove
              </button>
            </div>

            <p className="hint">
              {selected.locked
                ? 'Unlock to drag or resize on the field.'
                : 'Drag the logo on the field to move it, or drag a corner to resize.'}{' '}
              Images are stored inside the show file, downscaled to{' '}
              {MAX_LOGO_PIXELS}px so a crest does not bloat it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
