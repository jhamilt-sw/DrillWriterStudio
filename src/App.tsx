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

import { useCallback, useState } from 'react';

import { AudioProvider, useAudio } from './audio/AudioProvider.tsx';
import { APP_SHORT_NAME } from './core/app.ts';
import { resolveSetPositions, totalCounts } from './core/show.ts';
import { useShowStore } from './state/showStore.ts';
import { FieldCanvas } from './ui/canvas/FieldCanvas.tsx';
import { AboutDialog } from './ui/dialogs/AboutDialog.tsx';
import { DeviceNoticeDialog } from './ui/dialogs/DeviceNoticeDialog.tsx';
import { ExportDialog } from './ui/dialogs/ExportDialog.tsx';
import { VideoExportDialog } from './ui/dialogs/VideoExportDialog.tsx';
import { ShowSettingsDialog } from './ui/dialogs/ShowSettingsDialog.tsx';
import { useAutosave } from './ui/hooks/useAutosave.ts';
import { useDeviceNotice } from './ui/hooks/useDeviceNotice.ts';
import { useKeyboardShortcuts } from './ui/hooks/useKeyboardShortcuts.ts';
import { useShowFile } from './ui/hooks/useShowFile.ts';
import { PlaybackWindow, type PlaybackMode } from './ui/playback3d/PlaybackWindow.tsx';
import { AlignPanel } from './ui/panels/AlignPanel.tsx';
import { AppearancePanel } from './ui/panels/AppearancePanel.tsx';
import { FormationTools } from './ui/panels/FormationTools.tsx';
import { Inspector } from './ui/panels/Inspector.tsx';
import { MusicPanel } from './ui/panels/MusicPanel.tsx';
import { LogosPanel } from './ui/panels/LogosPanel.tsx';
import { PathsPanel } from './ui/panels/PathsPanel.tsx';
import { RosterPanel } from './ui/panels/RosterPanel.tsx';
import { SetList } from './ui/panels/SetList.tsx';
import { Timeline } from './ui/Timeline.tsx';
import { Toolbar } from './ui/Toolbar.tsx';

export function App() {
  return (
    <AudioProvider>
      <Editor />
    </AudioProvider>
  );
}

function Editor() {
  const file = useShowFile();
  const audio = useAudio();
  const { recovered, dismissRecovery, lastAutosaveAt } = useAutosave();
  const device = useDeviceNotice();

  const [showExport, setShowExport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  /*
   * The 3D view is a mode of the app rather than a route, so the editor keeps
   * its state — selection, undo history, the loaded recording — while the
   * stadium is open, and popping the stadium out does not reload anything.
   */
  const [playback3D, setPlayback3D] = useState<PlaybackMode>('closed');

  const replaceShow = useShowStore((state) => state.replaceShow);

  useKeyboardShortcuts({
    onSave: useCallback(() => void file.save(), [file]),
    onOpen: useCallback(() => void file.open(), [file]),
    onTogglePlay: useCallback(() => audio.toggle(), [audio]),
  });

  return (
    <div className="app">
      <Toolbar
        onNew={file.startNew}
        onOpen={() => void file.open()}
        onSave={() => void file.save()}
        onSaveAs={() => void file.saveAs()}
        onExport={() => setShowExport(true)}
        onSettings={() => setShowSettings(true)}
        onPlay3D={() => setPlayback3D('fullscreen')}
        onAbout={() => setShowAbout(true)}
        onExportVideo={() => setShowVideo(true)}
        busy={file.busy}
        fileName={file.fileName}
      />

      <div className="workspace">
        <aside className="panel" aria-label="Sets and roster">
          <div className="panel__scroll">
            <SetList />
            <RosterPanel />
          </div>
        </aside>

        <main className="canvas-cell" aria-label="Field editor">
          <FieldCanvas />
        </main>

        <aside className="panel panel--right" aria-label="Inspector and tools">
          <div className="panel__scroll">
            <Inspector />
            <AlignPanel />
            <FormationTools />
            <PathsPanel />
            <AppearancePanel />
            <LogosPanel />
            <MusicPanel />
          </div>
        </aside>
      </div>

      <Timeline />
      <StatusBar lastAutosaveAt={lastAutosaveAt} fileName={file.fileName} />

      {file.error && (
        <div className="dialog-backdrop" role="alertdialog" aria-label="File error">
          <div className="dialog">
            <div className="dialog__header">
              <h2 className="dialog__title">That file could not be used</h2>
            </div>
            <div className="dialog__body">
              <div className="alert alert--error">{file.error}</div>
            </div>
            <div className="dialog__footer">
              <button type="button" className="btn btn--primary" onClick={file.clearError}>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {recovered && (
        <div className="dialog-backdrop" role="alertdialog" aria-label="Recover show">
          <div className="dialog">
            <div className="dialog__header">
              <h2 className="dialog__title">Pick up where you left off?</h2>
            </div>
            <div className="dialog__body">
              <p style={{ marginTop: 0 }}>
                {APP_SHORT_NAME} autosaved <strong>{recovered.show.metadata.title}</strong>{' '}
                on {new Date(recovered.savedAt).toLocaleString()} —{' '}
                {recovered.show.performers.length} performers,{' '}
                {recovered.show.sets.length} sets, {totalCounts(recovered.show)} counts.
              </p>
              <p className="hint">
                Autosaves live in this browser only and are never uploaded anywhere.
              </p>
            </div>
            <div className="dialog__footer">
              <button type="button" className="btn" onClick={dismissRecovery}>
                Start fresh
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  replaceShow(recovered.show, { markSaved: false });
                  dismissRecovery();
                }}
              >
                Restore it
              </button>
            </div>
          </div>
        </div>
      )}

      <PlaybackWindow mode={playback3D} onModeChange={setPlayback3D} />

      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
      {showSettings && <ShowSettingsDialog onClose={() => setShowSettings(false)} />}
      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}

      {/*
        Shown before anything else a user might click, but after the app has
        rendered behind it — so they can see what they are being told about.
      */}
      {device.open && (
        <DeviceNoticeDialog concern={device.concern} onDismiss={device.dismiss} />
      )}
      {showVideo && (
        <VideoExportDialog
          onClose={() => setShowVideo(false)}
          onOpen3D={() => {
            setShowVideo(false);
            setPlayback3D('fullscreen');
          }}
        />
      )}
    </div>
  );
}

function StatusBar({
  lastAutosaveAt,
  fileName,
}: {
  lastAutosaveAt: number | null;
  fileName: string | null;
}) {
  const show = useShowStore((state) => state.show);
  const selectedCount = useShowStore((state) => state.selectedPerformerIds.length);
  const currentSetIndex = useShowStore((state) => state.currentSetIndex);
  const dirty = useShowStore((state) => state.dirty);
  const view = useShowStore((state) => state.view);

  // Inherited positions count as placed, so this must resolve rather than
  // count the sparse map on the set itself.
  const placedCount = Object.keys(resolveSetPositions(show, currentSetIndex)).length;
  const unplaced = show.performers.length - placedCount;

  return (
    <div className="status-bar">
      <span>
        Set {show.sets[currentSetIndex]?.label ?? '—'} of {show.sets.length}
      </span>
      <span>{selectedCount} selected</span>
      <span>
        {show.field.stepsPerFiveYards}-to-5 ·{' '}
        {view.snapSteps > 0 ? `snap ${view.snapSteps}` : 'snap off'}
      </span>
      {unplaced > 0 && (
        <button
          type="button"
          className="btn btn--ghost btn--sm status-bar__warning"
          title="Select everyone who is not on the field in this set"
          onClick={() => {
            const positions = resolveSetPositions(show, currentSetIndex);
            useShowStore
              .getState()
              .select(
                show.performers
                  .filter((performer) => !positions[performer.id])
                  .map((performer) => performer.id),
                'replace',
              );
          }}
        >
          ⚠ {unplaced} performer{unplaced === 1 ? '' : 's'} not placed — select them
        </button>
      )}
      <span className="status-bar__spacer" />
      {fileName && <span className="status-bar__dirty">{fileName}</span>}
      {lastAutosaveAt && (
        <span className="status-bar__dirty">
          autosaved {new Date(lastAutosaveAt).toLocaleTimeString()}
        </span>
      )}
      <span className="status-bar__dirty">{dirty ? 'Unsaved changes' : 'Saved'}</span>
    </div>
  );
}
