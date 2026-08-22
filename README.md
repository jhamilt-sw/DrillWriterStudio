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

# DrillWriter Studio

[![Deploy to GitHub Pages](https://github.com/jhamilt-sw/DrillWriterStudio/actions/workflows/pages.yml/badge.svg)](https://github.com/jhamilt-sw/DrillWriterStudio/actions/workflows/pages.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

Browser-based marching band drill design. Build formations set by set, watch the
transitions between them, align the whole thing to a recording, and print the
two documents a season actually runs on: coordinate sheets for the marchers and
a chart book for the podium.

It runs entirely in the browser. No account, no server, no upload — a roster of
students never leaves the machine it was typed on.

**[Open DrillWriter Studio](https://jhamilt-sw.github.io/DrillWriterStudio/)** · [User's guide](docs/user-guide.md) ·
[File format](docs/file-format.md)

Licensed under Apache 2.0. Built against [`drill-writer-spec.md`](drill-writer-spec.md).

## Running it

```bash
git clone https://github.com/jhamilt-sw/DrillWriterStudio.git
cd DrillWriterStudio
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # typecheck, then a static bundle in dist/
npm run preview  # serve that bundle locally
npm test         # core logic tests — no build step, no test framework
npm run licenses # check THIRD_PARTY_LICENSES.md against package.json
```

`dist/` is a plain static site. Drop it on GitHub Pages, Netlify, an S3 bucket,
or a school's own web server; `vite.config.ts` sets `base: './'` so it works
from a subdirectory too.

`.github/workflows/pages.yml` publishes to GitHub Pages on every push to `main`
— tests, license check and typecheck all have to pass first. Enable it once in
the repository's **Settings → Pages** by setting the source to **GitHub
Actions**. Nothing else is needed: there is no server, no API and no secret to
configure, because the app never talks to one.

## Documentation

[**docs/user-guide.md**](docs/user-guide.md) is the full how-to: getting
started, every panel, the keyboard shortcuts, and what to check when something
looks wrong. [`docs/file-format.md`](docs/file-format.md) documents the
`.drillshow` file for anyone reading or writing one, and [`docs/`](docs/) has an
index of both.

## Getting started: your first form

The app opens on an empty field with six sections and no performers.

**1. Add performers.** In the **Roster** panel on the left, each section has
`+ 8` and `+ 1` buttons. Press `+ 8` under Trumpet. Eight chips appear —
**dashed**, meaning they exist in the roster but are not on the field yet — and
they arrive already selected.

**2. Put them on the field.** In **Formation tools** on the right, press
**Block**, **Line**, **Arc** or **Circle**. The form is built around the
selection's own centre; performers who have never been placed start from the 50
on the front hash. There's also a **Place *n* on the field** button that drops
them in a plain block without shaping them.

Nothing on the field can be dragged until it has been placed once — that is
what this step is for.

**3. Adjust.** Drag anyone. `Interval` sets side-to-side spacing, `Row gap`
front-to-back, `Columns` how wide a block is. **Even out** fixes ragged
intervals; **Mirror ↔ 50** reflects a form to the other side of the field.

**4. Make it move.** Press **Add set** (or `N`). The new set starts as a copy of
the current one, so move the selection somewhere new and the app draws the path
between. Set the counts in the **Set** inspector — that's what turns a distance
into a stride, and what triggers a warning if the move is too far for the time.

**5. Export.** **Export…** in the toolbar gives you coordinate sheets, a chart
book, or both.

### Three ways to select

| | |
|---|---|
| A whole section | Click the section's **name**, or its **Select all** button |
| Individuals | Click a chip in the roster, or a dot on the field. Shift-click adds |
| A region | Drag a box across empty field |

The status bar flags anyone who isn't on the field in the current set, and
clicking that warning selects exactly those performers.

## What works today

**The field.** Mown grass with white paint, drawn as the press box sees it:
front sideline along the bottom, so the front hash is below the back hash.
Everything about how it looks lives in the **Field appearance** panel in the
right sidebar: turf presets (Grass, Deep grass, Dry grass, Blue turf, Slate,
Paper) and a free colour picker, line-colour presets (White, Bone, Grey, Black,
Gold) with their own picker, line weight, **performer size**, and a **hash
line** switch.

The hash marks themselves follow the rule book: 4-inch by 24-inch dashes lying
**parallel to the sidelines**, one bisecting each five-yard line. They are not
short yard lines — a mark drawn across the field instead of along it looks
plausible and is a different thing entirely. Hash placement comes from the field
type in feet: 53&#39;4&quot; for NFHS, 60&#39; for NCAA, 70&#39;9&quot; for the
NFL.

Separately, **yard markers** — short ticks *across* the field at every yard
*between* the five-yard lines — run in from both sidelines and out from both
hashes. The ones at the
hashes start at the edge of the hash mark and run outward toward the sideline
their numbers are painted on, rather than being centred on the hash, where they
would swamp the mark they share a spot with.

The hash-line switch chooses between the two ways of showing a hash: on gives a
continuous line the whole length of the field, which is a designer's addition
rather than something a real field has, and off gives the painted 24&quot;
marks. Never both — drawn together they land in the same place and read as a
lumpy line. The yard markers stay either way, and printed charts match the
screen. Colours are
saved with the show; printed charts stay on white paper, but performer size
carries into them.

**Field logos.** Optional. Drop in a PNG or JPEG to paint a crest at midfield or
a wordmark in an end zone — drawn above the turf and *beneath* the yard lines,
so it reads as part of the field rather than a sticker on it. Drag to move, drag
a corner to resize, or set the numbers exactly — then **lock** it, individually
or all at once, so it stays painted but stops intercepting presses meant for the
drill on top of it. Images are embedded in the show file (downscaled to 1024px)
so a show handed to someone else arrives complete.

**Editing.** A regulation field with high school, college or NFL hash placement.
Step size defaults to **8-to-5** — the standard 22.5" step, a marcher on a yard
line every two steps — and is changeable in **Show settings** to any value from
2 to 48 steps per five yards, with 5-, 6-, 8-, 10-, 12- and 16-to-5 offered as
presets. Changing it rescales every coordinate so nobody physically moves: a
marcher on the 35 stays on the 35, their coordinate is just written in
different-sized steps. Add performers by section, drag them
around with grid snapping, marquee-select, nudge with the arrow keys, undo
anything. Sets are snapshots of the whole ensemble; the app draws the paths
between them and interpolates the movement when you scrub.

**Formation tools.** Lines, files, blocks, arcs and circles built around the
selection's own centre; mirror across the 50 or across the selection; rotate,
spread, condense, even out spacing.

**Who goes where.** When a selection takes a new shape, the app solves the
matching rather than guessing it: a Hungarian assignment over the full cost
matrix picks the pairing of performers to slots with the least total distance
marched. That is not just tidier — it is *provably free of crossing paths*.
Because the cost is plain distance, any two paths that crossed could be
un-crossed for a strictly shorter total (the triangle inequality), so the
cheapest assignment cannot contain a crossing. Nobody has to walk through
anybody. (Squared distance, the more common default, does **not** have this
property, which is why it isn't used here.) Hand-dragging can of course
reintroduce a crossing, so the inspector keeps a **⚠ Crossing paths** list for
the move into the current set; clicking a pair selects both marchers.

**Rotation handle.** Select anyone and a dashed ring appears around the
selection with a ⟳ grip below it. Drag the grip to spin the form about its own
centre, live, with the angle and the increment in force shown as you go. (The
rig is hidden during playback, when the positions on screen are interpolated
rather than editable — click a set to come back.) It
turns in **1° increments** by default — an adjustable field in **Show settings →
Rotation handle** — and holding <kbd>Shift</kbd> mid-drag switches to a coarser
step, 5° out of the box and adjustable too, for landing exactly on 45° or 90°.
Either field set to 0 gives continuous rotation. Rotation is always computed
from where the form stood when you grabbed the handle, so dragging back and
forth doesn't accumulate drift, and `Esc` cancels mid-drag.

**Drag feedback.** While you drag performers the cursor becomes a grabbing hand
and a badge follows the pointer with the live offset — `→ 4  ↑ 2 steps` — so you
can see how far a form has moved without letting go and reading the inspector.

**Shapes.** Square, rectangle, triangle, trapezoid, diamond, pentagon, hexagon,
octagon, star, cross, chevron and ellipse — outline forms with width, depth and
rotation, and an adjustable point count on the star. Performers land on every
corner first and then fill the edges in proportion to their length, because a
star whose points have nobody standing on them doesn't read as a star.

**Text and letters.** Type a word into **Formation tools → Text** and the
selection spells it. The font is a *stroke* font built for the field, not
borrowed typography: every glyph is a set of open runs that people stand along,
with the ends of each run claimed first, because a letter is read by its
extremities — the arms of a `Y`, the corners of a `Z` — and an `L` with nobody
on the end of its foot is just a corner. Capitals A–Z, digits 0–9 and the
keyboard symbols are all there; lowercase folds to capitals, since single-stroke
lowercase needs as many bodies as a capital to read at 80 yards.

Performers are shared between the letters in proportion to how much stroke each
one has to stand on, so a `W` gets more than an `I` rather than the word coming
out with a sketched `W` and a queue for an `I`. Nobody is rounded away: the
fractions are settled by largest-remainder apportionment, so every selected
performer lands somewhere. The panel shows the finished width, the per-letter
counts, and warns before you commit if the word is wider than the field or has
more letters than you have people. Letters use the same optimal, non-crossing
assignment as every other formation — which matters most here, since the naive
alternative sends the last person in the roster to the far end of the field.

**Alignment.** Right-click the field (or use the **Align** panel) to put a
selection onto the field's own landmarks: snap each performer to their nearest
yard line, slide a whole form onto the front hash, dress a rank to its front
edge, even out intervals along one axis. Snapping and moving are deliberately
separate — *snap each* sends every performer to their own nearest line and
changes the shape, *move group* translates the whole form rigidly and preserves
it exactly. Because the menu and the coordinate sheets share one definition of
where the hashes are, a performer you align to the front hash is guaranteed to
read `On Front Hash` on their sheet rather than a hair off it.

**Path visibility.** Movement paths are on while editing and **off during
playback** — 250 lines over a moving field hide the very thing you are watching
for. Playback has its own switch (the ⤳ button by the transport, or `Shift+P`),
and either mode can be narrowed to the current selection or to a chosen set of
sections and individuals, so you can follow just the trumpets through a
transition.

**Stride warnings.** Every move is measured. If a set asks somebody to cover
more ground than the count allows, the path turns amber and the inspector names
them, in inches per step, before a rehearsal has to discover it.

**Music.** Import MP3/WAV/OGG/M4A and the tempo is read straight off the
waveform — onset detection, autocorrelation, and a tempo prior that stops a 144
BPM chart being reported as 72 — then applied to the marching pulse with the
downbeat set to the first detected beat. One click halves or doubles it if the
octave came out wrong. Failing that, tap it in or type it. Counts follow a tempo
map that handles tempo and meter changes, so the drill playhead tracks the
recording through a ritard.

Detection does **not** re-run when a recording is restored on reload — the show
already carries its tempo map, quite possibly one corrected by hand, and
re-analysing would overwrite that every time the file opened. The panel says so
and offers to analyse afresh, rather than reporting a failure that never
happened.

**Audio comes back by itself.** The show file stores the *reference* to a
recording — name, duration, tempo, downbeat — not the bytes, because embedding
a three-minute track would quadruple the size of every save. The bytes are kept
in this browser instead, keyed by a content hash, so a refresh, an autosave
recovery or reopening the file tomorrow restores the music without touching the
file picker. If the recording genuinely isn't here — a different machine, a
cleared browser, a show from a colleague — the app **says so**, beside the
transport and in the Music panel, naming the file to re-import rather than
leaving a greyed-out play button to be puzzled over. And when a show does need
to travel with its music, **Save the recording inside the show file** embeds it;
autosave snapshots strip the payload back out so ten copies of it cannot fill
the browser's storage.

**3D playback.** A separate view that watches the drill from the stands. The
editor stays what it is — a flat, top-down chart, which is what you design on —
and the 3D window answers the other question: does this form actually read from
where the audience sits. Seven camera presets — home stands, press box (above
the home stands, the angle the drill is written for), visitor stands looking
back, corner, end zone, sideline at eye level, and straight overhead — with a
free camera on top of them: drag to swing, right-drag to slide, scroll to zoom,
`WASD` to fly with `Q`/`E` for height and `Shift` to move faster.

Field logos come through too, in the same place, at the same angle, over the
same paint as the chart shows them — they are composited into the turf texture
rather than added as separate geometry, so a crest costs nothing per frame. Move
a logo in the editor with the 3D window open and the field repaints, throttled
so that dragging one does not re-upload a fourteen-megabyte texture per frame.

The seating dimensions live in `core/camera3d.ts` alongside the camera, not in
the code that builds the meshes, and every preset is written as a physical
placement — this far out from the sideline, this high. A test then walks each
preset and asserts the camera clears the seating rake at its own depth, so no
angle can end up watching the drill through the back of a grandstand. Marchers are simple three-dimensional figures
coloured by their section — the same colours as the dots on the chart, so a
director who reads "the blue ones are trumpets" reads the same thing here.

It opens full screen over the editor, and **pops out into a real second window**
for a projector or a second monitor. The popped-out window is a portal, not a
second copy of the app: it shares the store and the audio clock directly, so
scrubbing in the editor moves the stadium instantly with nothing to fall out of
sync. If a popup blocker refuses, it falls back to full screen and says so.

An optional overlay across the bottom names the **previous, current and next
set** with their counts, measure and beat, plus counts remaining in the move and
a progress bar — read from the same set arithmetic the timeline uses, so the
overlay cannot disagree with the playhead.

**Citing the recording.** A show file does not carry the audio, which leaves a
gap when you hand the drill to someone else: they have the sets, the tempo map
and the downbeat, but no way to know *which* recording it was written against.
**Music → Source & credit** fills that in — title, composer, where to get it, the
license it came under, and a note for anything else. It is saved with the show,
it survives the recording being removed or replaced, and it is shown to whoever
opens the file without the audio, right beside the prompt to import it, with a
button that opens the source. It doubles as the credit line for a programme:
copy it to the clipboard, or find it printed on the show summary.

Links are restricted to `http` and `https`. A show file arrives from another
director and its link ends up in an anchor, where a `javascript:` URL would run
in the app's own origin — so anything else is dropped when the file loads,
keeping the rest of the citation.

**Video export.** Records the whole show — every set, for as long as the counts
last — as a file you can upload straight to YouTube or Vimeo. The 2D field is
recorded from **Video…** in the toolbar. The 3D stadium is recorded from
**⏺ Record** on its own bar, because that view takes over the window: there is
no opening it and coming back to a dialog in the editor, and the camera has to
be framed before the recording starts anyway.

Set numbers are painted into the frames — previous, current and next, with the
counts remaining. The on-screen overlay is HTML and HTML is not part of a
canvas, so without this the video would carry no set numbers at all, which is
the first thing anyone watching a run-through wants to know. The audio is muxed in, tapped in parallel with
the speakers so you can hear the run-through while it records.

The container depends on the browser, because the browser decides what its
machine can encode. MP4 (H.264 + AAC) is used wherever it is offered — Safari
always, Chrome on machines with a hardware H.264 encoder — and WebM (VP9 +
Opus) otherwise. The dialog says which you are getting and what it means: both
upload to YouTube, while Vimeo asks for MP4 or MOV, and finding that out *after*
recording costs the length of the show.

Two limits worth knowing before you start. It records in real time, so a
four-minute show takes four minutes and the tab has to stay in front. And the 2D
field records at the size it is on screen, because it cannot be redrawn larger
without disturbing the editor — widen the window for a sharper file. The 3D view
has no such limit and renders at up to 4K regardless of the window, since raising
its drawing buffer leaves the on-screen layout alone.

**Export.** Coordinate sheets in standard drill notation
(`Side 1: 2.0 steps inside 35 yd ln | 4.0 steps behind Front side line`), a
landscape chart per set, and a one-page show summary. All PDF, all generated
in-browser.

**Persistence.** Save and reopen `.drillshow` files — real Save/Save As on
Chrome and Edge, download/upload elsewhere. Autosave to IndexedDB every 30
seconds, with a recovery prompt if a tab dies.

## What isn't built yet

- **MusicXML import and score playback** (spec FR-3.1, FR-3.2). The tempo-map
  machinery underneath is written and tested; what's missing is the
  OpenSheetMusicDisplay integration and a soundfont player. License positions
  for both are already recorded in `THIRD_PARTY_LICENSES.md`.
- **Curved transition paths.** The data model carries `style` and `control` per
  performer per segment, the renderer draws curves, and the interpolator walks
  them — there is no UI for placing a control point yet.
- **Component tests.** The core logic is well covered; nothing renders React in
  a test yet. The spec calls for Vitest and React Testing Library, which is the
  natural next addition.
- `noUnusedLocals` / `noUnusedParameters` are off in `tsconfig.json` so a stray
  import can't block a build. Turn them on once CI is running.

## How it's put together

```
src/
  core/      pure domain logic — no React, no DOM, fully tested
    types.ts        the data model
    field.ts        field geometry and landmarks, derived from feet
    notation.ts     positions -> the text a marcher reads
    align.ts        snapping and dressing a selection to landmarks
    shapes.ts       outline forms and perimeter distribution
    glyphs.ts       the stroke font: letters, digits and symbols
    textFormation.ts  laying a word out and sharing people between letters
    color.ts        turf shades, contrast, readable ink
    interpolate.ts  movement between sets, and how big a stride it demands
    formations.ts   line/block/arc/circle, mirror, rotate, assignment
    assignment.ts   Hungarian matching for least-travel, non-crossing forms
    rotation.ts     angle maths and snapping for the rotation handle
    pathVisibility.ts  whose movement paths are drawn, and when
    tempo.ts        counts <-> measures <-> seconds
    tempoDetection.ts  reading BPM and the downbeat off a waveform
    transform.ts    drill units -> pixels
    camera3d.ts     3D camera orbit, presets, and drill -> world in feet
    setContext.ts   previous/current/next set, for the 3D overlay
    hash.ts         content hashing, for recognising an imported recording
    audioSource.ts  citing where a recording came from, and vetting its link
    videoExport.ts  picking a recordable format, frame sizes and bitrates
    schema.ts       save-file validation and migration
  state/     Zustand store, undo/redo, selection
  ui/        React components — canvas, panels, dialogs, hooks
  three/     the 3D stadium: scene, turf texture, instanced marchers
  io/        file system access, IndexedDB autosave and audio cache, PDF
  audio/     Web Audio playback and the count/time binding
```

The rule that keeps the rest honest: **`core/` never imports from anywhere
else.** It has no React and no DOM, which is why it can be tested with nothing
but Node, and why the canvas, the PDF exporter and the coordinate sheets all
agree about where a performer is standing.

### Coordinates

Positions are stored in steps from fixed landmarks — never pixels, never
screen-relative. `x` is steps from the Side 1 goal line, `y` is steps from the
front sideline. Hash placement is derived from field type in feet, so switching
from high school to college hashes moves the hashes and nobody else. Full
details in [`docs/file-format.md`](docs/file-format.md).

### Tests

```bash
npm test
```

The core suite runs on Node's built-in test runner with type stripping, so there
is no framework to install and no build step between editing a file and running
it. It covers the parts where a quiet bug would be expensive: field geometry
against real NFHS/NCAA/NFL dimensions, the inside/outside flip either side of
the 50, hash-relative vertical coordinates, count-to-time through tempo and
meter changes, formation geometry, the assignment solver's optimality and its
no-crossing guarantee, rotation snapping, and save-file round-tripping and
repair.

## Keyboard

| | |
|---|---|
| `Ctrl/Cmd S` · `Ctrl/Cmd O` | Save · Open |
| `Ctrl/Cmd Z` · `Shift Ctrl/Cmd Z` | Undo · Redo |
| `Ctrl/Cmd A` | Select all |
| `Ctrl/Cmd D` | Duplicate current set |
| Arrows | Nudge selection by one snap step (Shift: a whole step) |
| Arrows, nothing selected | Previous / next set |
| `Space` | Play or pause the audio |
| `N` | New set after the current one |
| `P` · `Shift P` | Toggle paths while editing · during playback |
| `G` · `L` | Toggle previous-set ghost · labels |
| `Delete` | Clear the selection's position at this set (inherit the previous one) |
| `Esc` (in 3D) | Leave the full-screen 3D view |
| `Esc` | Deselect |

On the canvas: drag to marquee-select, Shift-click to add, Alt-drag or
middle-drag to pan, scroll to zoom, **right-click to align the selection**
(right-clicking an unselected performer selects them first), and drag the ⟳ grip
below a selection to rotate it — hold `Shift` for the coarse increment, `Esc` to
cancel the turn. In the menu, arrow keys move between commands and Escape closes
it.

## About

**About** in the toolbar shows the name, author, first-written date, version and
license. Every value there is read from `core/app.ts`, so the About box cannot
quietly disagree with the file headers, the PDF metadata or `package.json` — a
test asserts the version and author match the manifest, which is the only thing
that keeps two copies of a version number from drifting.

## Authorship

**Author:** Jasper Hamilton

**AI assistance:** Portions of this code and its documentation were generated or
refined using AI tools under human direction.

**Created:** 21 August 2026 · **Last modified:** see the stamp at the top of any
file.

**Attribution:** Crediting Jasper Hamilton as the original author in derivative
or redistributed works is appreciated. This is a courtesy request rather than a
licensing term — the software is distributed under the Apache License 2.0, and
that license constitutes the complete set of obligations governing its use. It
already requires that the copyright notice and `NOTICE` accompany any copy or
derivative work, and that modified files carry prominent notices of the changes
made; nothing here extends it.

Every source and documentation file carries that statement as a header
comment, along with the date it was last stamped. The dates are generated
rather than typed:

```bash
npm run stamp        # refresh every file's Last modified date
npm run stamp:check  # fail if any file's stamp is out of date
```

A hand-written "last modified" line is wrong within a week — someone edits the
file, forgets the header, and the stamp now asserts something false, which is
worse than saying nothing at all. `stamp:check` is wired into the Pages
workflow so a stale stamp fails the build rather than shipping.

Licensed under Apache-2.0; see `LICENSE` and `NOTICE`.

## Contributing

Keep `core/` pure and tested — if a rule about the field, the notation or the
music can be expressed without a browser, it belongs there with a test, not in a
component. Run `npm test` and `npm run licenses` before opening a PR, and add
any new dependency to `THIRD_PARTY_LICENSES.md` in the same commit.
