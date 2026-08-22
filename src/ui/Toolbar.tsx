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

import { APP_NAME } from '../core/app.ts';
import { useShowStore } from '../state/showStore.ts';

interface ToolbarProps {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onExport: () => void;
  onSettings: () => void;
  onPlay3D: () => void;
  onAbout: () => void;
  onExportVideo: () => void;
  busy: boolean;
  fileName: string | null;
}

const SNAP_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 0.25, label: '¼ step' },
  { value: 0.5, label: '½ step' },
  { value: 1, label: '1 step' },
  { value: 2, label: '2 steps' },
  { value: 4, label: '4 steps' },
];

export function Toolbar({
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onExport,
  onSettings,
  onPlay3D,
  onAbout,
  onExportVideo,
  busy,
  fileName,
}: ToolbarProps) {
  const title = useShowStore((state) => state.show.metadata.title);
  const updateMetadata = useShowStore((state) => state.updateMetadata);
  const undo = useShowStore((state) => state.undo);
  const redo = useShowStore((state) => state.redo);
  const past = useShowStore((state) => state.past);
  const future = useShowStore((state) => state.future);
  const view = useShowStore((state) => state.view);
  const updateView = useShowStore((state) => state.updateView);
  const updatePathVisibility = useShowStore((state) => state.updatePathVisibility);
  const dirty = useShowStore((state) => state.dirty);

  return (
    <header className="toolbar">
      <div className="toolbar__brand">
        <span className="toolbar__wordmark">{APP_NAME}</span>
      </div>

      <input
        className="toolbar__title-input"
        value={title}
        aria-label="Show title"
        onChange={(event) => updateMetadata({ title: event.target.value })}
      />
      {dirty && (
        <span className="status-bar__dirty" title="Unsaved changes">
          •
        </span>
      )}

      <div className="toolbar__group" style={{ marginLeft: 8 }}>
        <button type="button" className="btn btn--ghost" onClick={onNew}>
          New
        </button>
        <button type="button" className="btn btn--ghost" onClick={onOpen} disabled={busy}>
          Open
        </button>
        <button type="button" className="btn" onClick={onSave} disabled={busy}>
          Save
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onSaveAs}
          disabled={busy}
          title={fileName ? `Currently ${fileName}` : undefined}
        >
          Save as…
        </button>
      </div>

      <div className="toolbar__group">
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={undo}
          disabled={past.length === 0}
          title={past.length ? `Undo ${past[past.length - 1].label}` : 'Nothing to undo'}
          aria-label="Undo"
        >
          ↶
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--icon"
          onClick={redo}
          disabled={future.length === 0}
          title={future.length ? `Redo ${future[0].label}` : 'Nothing to redo'}
          aria-label="Redo"
        >
          ↷
        </button>
      </div>

      <div className="toolbar__group">
        <label className="field__label" htmlFor="snap-select">
          Snap
        </label>
        <select
          id="snap-select"
          className="select"
          style={{ width: 'auto', minWidth: 88 }}
          value={view.snapSteps}
          onChange={(event) => updateView({ snapSteps: Number(event.target.value) })}
        >
          {SNAP_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="toolbar__group">
        <button
          type="button"
          className={`btn btn--ghost${view.paths.whileEditing ? ' btn--active' : ''}`}
          onClick={() =>
            updatePathVisibility({ whileEditing: !view.paths.whileEditing })
          }
          title="Show movement paths while editing (P). Playback has its own switch."
          aria-pressed={view.paths.whileEditing}
        >
          Paths
        </button>
        <button
          type="button"
          className={`btn btn--ghost${view.showPreviousSet ? ' btn--active' : ''}`}
          onClick={() => updateView({ showPreviousSet: !view.showPreviousSet })}
          title="Ghost the previous set (G)"
          aria-pressed={view.showPreviousSet}
        >
          Ghost
        </button>
        <button
          type="button"
          className={`btn btn--ghost${view.showLabels ? ' btn--active' : ''}`}
          onClick={() => updateView({ showLabels: !view.showLabels })}
          title="Show performer labels (L)"
          aria-pressed={view.showLabels}
        >
          Labels
        </button>
      </div>

      <div className="toolbar__spacer" />

      <button
        type="button"
        className="btn btn--ghost"
        onClick={onPlay3D}
        title="Watch the drill in 3D from the stands"
      >
        3D playback
      </button>
      <button type="button" className="btn btn--ghost" onClick={onSettings}>
        Show settings
      </button>
      <button
        type="button"
        className="btn btn--ghost"
        onClick={onAbout}
        title={`About ${APP_NAME}`}
      >
        About
      </button>
      <button
        type="button"
        className="btn btn--ghost"
        onClick={onExportVideo}
        title="Record the show as a video file"
      >
        Video…
      </button>
      <button type="button" className="btn btn--primary" onClick={onExport}>
        Export…
      </button>
    </header>
  );
}
