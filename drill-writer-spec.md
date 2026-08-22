<!--
  DrillWriter Studio
  Author: Jasper Hamilton
  AI assistance: Portions of this code and its documentation were generated
    or refined using AI tools under human direction.
  Attribution: Credit to the original author in derivative works is
    appreciated as a courtesy. It is not required by the license; see NOTICE.
  Created: 2026-08-21  ·  Last modified: 2026-08-22
  SPDX-License-Identifier: Apache-2.0
-->

# Marching Band Drill Design Software — Specification

**Status:** Draft v0.1
**Author:** [Your name]
**License of this project:** Apache License 2.0

---

## 1. Purpose

This document specifies a web-based application for designing marching band drill: the choreographed formations and movement paths performers execute on a football field, synchronized to music. The application should let a designer build formations set-by-set, align them to a musical score or audio recording, and export both performer-facing coordinate sheets and director-facing drill charts.

---

## 2. Goals

| # | Goal |
|---|------|
| G1 | Easy-to-use interface for creating marching band drill sets |
| G2 | Output drill coordinate sheets (per-performer) and detailed drill charts (per-director) |
| G3 | Align drill to music, via MusicXML (viewable/playable in-editor) or common audio formats (MP3, etc.) |
| G4 | Fully web-based — runs entirely in the browser |
| G5 | Open source (Apache 2.0), with all third-party libraries cited |
| G6 | Save and load drill sets within the application |

---

## 3. Scope

### 3.1 In scope (v1 / MVP)
- Field canvas editor supporting standard high school and college marching band field configurations (yard lines, hashes, sidelines)
- Performer roster management (name, instrument/section, unique ID)
- Set-based drill creation: define performer positions at discrete "sets" (counts), with the app interpolating movement between them
- Path/transition visualization between consecutive sets
- MusicXML import and playback with a visual cursor, mapped to drill counts
- MP3/WAV/OGG import with a scrubbable waveform timeline, mapped to drill counts
- Manual tempo/count mapping tool (tap tempo or measure/beat entry) to align music time to drill counts when no MusicXML is available
- Export: individual performer coordinate sheets (PDF), full-field drill charts per set (PDF), season/show summary
- Save/load: export a show as a portable file (JSON-based), and import it back in
- No backend required — works from a static site, with local file save/load

### 3.2 Out of scope (v1)
- Real-time multi-user collaborative editing
- Mobile-native apps (the web app should be responsive, but touch-first mobile editing is not a v1 requirement)
- Automatic drill generation / AI-assisted formation design
- Sound synthesis quality suitable for actual performance rehearsal tracks (playback is a reference aid, not a substitute for a live band)
- Video/3D visualization of performers (2D top-down field view only in v1)

### 3.3 Candidate future scope (v2+)
- Cloud sync / accounts (would require a backend, breaking the "no server needed" model — needs a deliberate decision later)
- Collision/spacing validation (warn when performers are too close or paths cross awkwardly)
- Animation "flow" preview showing continuous movement across the whole show, not just set-to-set
- Import from other drill software formats

---

## 4. Functional Requirements

### 4.1 Field & Formation Editor (G1)
- FR-1.1: Render a regulation field (100-yard, with configurable hash placement: high school vs. college) as the base canvas, in standard drill coordinate units (steps per 5 yards — typically 8-to-5).
- FR-1.2: Support adding/removing performers, each assigned to a section (e.g., trumpets, snare) with a distinct color/marker.
- FR-1.3: Drag-and-drop placement of performer dots on the field, with snapping to a configurable grid (e.g., nearest 1/4 step).
- FR-1.4: Support "sets" as named/numbered snapshots of all performer positions at a given count.
- FR-1.5: Between two sets, auto-generate straight-line (and optionally curved) movement paths per performer; display these paths as an overlay.
- FR-1.6: Bulk formation tools: block/line generation, symmetry tools (mirror across yardline), and simple shape templates (arcs, blocks) to speed up common formations.
- FR-1.7: Undo/redo history.
- FR-1.8: Timeline scrubber to move between sets and preview transitions.

### 4.2 Output Generation (G2)
- FR-2.1: Per-performer coordinate sheets: for each set, output the performer's position described in standard drill notation (e.g., "on 35 yard line, 4 steps outside hash, 2 steps behind front hash"), plus counts to the next set.
- FR-2.2: Director's drill chart: full-field diagram per set showing all performers, labeled by section/number, with the field grid visible.
- FR-2.3: Both outputs exportable as PDF; performer sheets should be batchable (generate all performers' full-show packet in one export).
- FR-2.4: Include music/count context on outputs (e.g., "Set 12 — Measure 34, Count 3").

### 4.3 Music Alignment (G3)
- FR-3.1: Import a MusicXML file; render it in-editor using a notation renderer.
- FR-3.2: Play back the MusicXML with an audio cursor moving through the score in sync with elapsed time.
- FR-3.3: Import MP3 (and other common formats — WAV, OGG, M4A where browser codec support allows); display a waveform and allow scrubbing/playback.
- FR-3.4: Map musical position (measure/beat, or audio timestamp) to drill counts, so that moving the playback cursor also moves the drill timeline, and vice versa.
- FR-3.5: Support tempo maps (tempo can change across a show) so count-to-time mapping stays accurate through tempo changes, for both MusicXML and manually-tapped tempo on raw audio.
- FR-3.6: Allow scrubbing drill sets while music plays, so a designer can preview formation changes against the actual music.

### 4.4 Web-Based Architecture (G4)
- FR-4.1: The application must run entirely client-side; no server-side processing required for core functionality (editing, playback, export, save/load).
- FR-4.2: Deployable as a static site (e.g., GitHub Pages, Netlify, or self-hosted via any static file server).
- FR-4.3: Target modern evergreen browsers (Chrome, Edge, Firefox, Safari — current and prior major version).

### 4.5 Open Source & Licensing (G5)
- FR-5.1: Project licensed under Apache License 2.0.
- FR-5.2: A `NOTICE`/`THIRD_PARTY_LICENSES` file lists every third-party library used, its license, and a link to its source — kept current as dependencies change.
- FR-5.3: License compatibility check: no dependency may carry a license that's incompatible with Apache 2.0 redistribution (e.g., avoid GPL-licensed libraries, which would impose copyleft obligations on the whole project).

### 4.6 Save & Load (G6)
- FR-6.1: Save the full show state (roster, sets, positions, music alignment, metadata) to a single portable file (JSON, or a zipped bundle if binary assets like audio are embedded).
- FR-6.2: Load a previously saved show file back into the editor, fully restoring state.
- FR-6.3: Where the browser supports the File System Access API, allow direct "Save"/"Save As" to disk and reopening; otherwise fall back to file download/upload.
- FR-6.4: Autosave to browser local storage/IndexedDB periodically, to reduce risk of data loss between explicit saves.

---

## 5. Non-Functional Requirements

- NFR-1: **Performance** — the editor should remain responsive with at least 250 performers and 40+ sets (a large marching band show) without noticeable lag when dragging or scrubbing.
- NFR-2: **No data leaves the browser** unless the user explicitly exports/shares a file — consistent with the no-backend architecture and a reasonable privacy expectation for school data (rosters, etc.).
- NFR-3: **Accessibility** — keyboard navigation for core editing actions, sufficient color contrast, and color choices that remain distinguishable for common color-vision deficiencies (don't rely on red/green alone to distinguish sections).
- NFR-4: **Responsiveness** — usable on laptop and tablet screen sizes; phone-sized editing is not required but the app shouldn't break outright.
- NFR-5: **Data durability** — the save file format should be documented and versioned, so shows saved by an older version of the app can still be opened later.

---

## 6. Recommended Technical Architecture

Since there's no backend, "architecture" here is mostly about client-side structure and library choices.

### 6.1 Stack

| Layer | Choice | Why |
|---|---|---|
| UI framework | **React + TypeScript** | Large ecosystem, good fit for the complex, stateful editor UI; TypeScript catches coordinate/data-model bugs early |
| Build tooling | **Vite** | Fast dev server and simple static-site output, well-suited to a no-backend deploy |
| Field/drill canvas | **Konva.js** via **react-konva** | 2D canvas library built for exactly this kind of draggable-object, layered-scene use case; simpler and lighter than a WebGL engine like PixiJS, which would be overkill for top-down 2D dots |
| Music notation | **OpenSheetMusicDisplay (OSMD)** | Renders MusicXML to SVG in-browser; actively maintained, widely used for exactly this purpose |
| MusicXML audio playback | Soundfont-based player (e.g., **soundfont-player**) driven off OSMD's cursor/timing data | OSMD renders notation but does not synthesize audio itself — a soundfont player fills that gap for reference playback |
| MP3/audio playback & sync | **Web Audio API** directly (not a plain `<audio>` tag) | Needed for sample-accurate scrubbing and tight sync between playback position and drill counts; a bare `<audio>` element's timing precision isn't reliable enough |
| State management | **Zustand** | Lightweight, avoids Redux boilerplate, fits a single-page editor well |
| PDF export | **pdf-lib** | Generates PDFs client-side with no server round-trip, fits the no-backend requirement |
| Local persistence | **IndexedDB** (via a thin wrapper) for autosave; File System Access API for explicit save/load, with download/upload fallback | Matches FR-6.3/6.4 |
| Testing | **Vitest** + **React Testing Library** | Standard, fast, integrates cleanly with Vite |

### 6.2 Data model (conceptual)

A show is composed of:

- **Show metadata**: title, season, field type (HS/college), step size (8-to-5, 6-to-5, etc.)
- **Roster**: list of performers, each with an ID, name, section, and default symbol/color
- **Sets**: an ordered list, each containing:
  - Set number/label
  - Count length (counts until next set)
  - Music position (measure/beat or timestamp) it corresponds to
  - Per-performer coordinates (expressed in yard-line + step-offset form, not raw pixels, so field size/step size changes don't corrupt the data)
- **Music reference**: either an embedded/linked MusicXML file plus tempo map, or an embedded/linked audio file plus a count-to-time mapping table
- **Transition style** (optional, per performer per segment): straight-line by default, with room to extend to curved paths later

This model should be the save-file schema (FR-6.1), versioned (e.g., `"schemaVersion": 1`) so future format changes don't break old files (NFR-5).

### 6.3 Coordinate system

Use the standard marching-band convention rather than raw pixels internally:
- Horizontal position: yard line (0–100) + steps from that yard line, referenced to a side (this is the customary way coordinate sheets are written, and it's what FR-2.1 needs to output directly)
- Vertical position: steps from front sideline, or steps relative to a hash mark, per convention
- Canvas rendering is then a transform from this coordinate system to pixels, keeping the source of truth in drill units

---

## 7. Third-Party Library Attribution Plan

Per G5/FR-5.2, maintain a `THIRD_PARTY_LICENSES` (or `NOTICE`) file at the repo root listing, at minimum, for each dependency:
- Library name and version
- License type
- Link to source repository

This should be regenerated or checked whenever dependencies change (a simple CI check that diffs `package.json` against the notice file is worth adding once the project has automated builds, even if that's a v1.1 nicety rather than a blocker).

---

## 8. Suggested Phased Roadmap

1. **Phase 1 — Core editor**: field canvas, roster management, set creation/editing, basic drag-and-drop positioning, undo/redo
2. **Phase 2 — Music alignment**: MusicXML import/playback, MP3 import/playback, count-to-music mapping
3. **Phase 3 — Output**: PDF export for coordinate sheets and drill charts
4. **Phase 4 — Persistence**: save/load file format, autosave, File System Access API integration
5. **Phase 5 — Polish**: bulk formation tools, symmetry tools, accessibility pass, performance tuning at scale (250+ performers)

---

## 9. Open Questions

- Field type coverage: is support for both high school (typically 8-to-5 steps) and college fields a v1 requirement, or can it start with one and add the other later?
- Curved paths: is straight-line-only transition acceptable for v1, or is curved-path support (common in modern drill design) needed from the start?
- Embedded audio in save files: should the save file bundle the actual MP3/audio data (larger file, fully self-contained) or just a reference/filename (smaller file, requires re-linking the audio on load)?
