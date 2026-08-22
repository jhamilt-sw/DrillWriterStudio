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

# DrillWriter Studio — user's guide

Everything you need to write a show, from an empty field to a printed book and
a video you can hand to your staff.

If you have ten minutes and want to see the whole thing work, start with
[Your first show](#your-first-show) and skip the rest until you need it.

---

## Contents

- [How DrillWriter thinks about a show](#how-drillwriter-thinks-about-a-show)
- [Your first show](#your-first-show)
- [The screen](#the-screen)
- [Selecting people](#selecting-people)
- [Building forms](#building-forms)
- [Letters, numbers and text](#letters-numbers-and-text)
- [Moving and refining](#moving-and-refining)
- [Lining things up](#lining-things-up)
- [Sets, counts and timing](#sets-counts-and-timing)
- [Music](#music)
- [Watching it back](#watching-it-back)
- [The 3D stadium](#the-3d-stadium)
- [Printing the book](#printing-the-book)
- [Exporting video](#exporting-video)
- [Saving and sharing](#saving-and-sharing)
- [Making the field look right](#making-the-field-look-right)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Mouse and trackpad](#mouse-and-trackpad)
- [When something looks wrong](#when-something-looks-wrong)
- [Glossary](#glossary)

---

## How DrillWriter thinks about a show

Four ideas, and the rest of the program follows from them.

**A show is a list of sets.** A set is a snapshot of where everybody stands.
You do not draw the movement between sets — you place the form, add the next
set, place that form, and DrillWriter works out the path each person walks.

**Counts join the sets.** Every set after the first has a number of counts
*into* it: how long the ensemble has to get there. Sixteen counts to travel four
steps is a stroll; sixteen counts to travel forty is not possible, and you get
told so before rehearsal finds out.

**Everything is measured in steps, not pixels.** A step is 22.5 inches by
default — the 8-to-5 standard, where eight steps cover five yards and a marcher
lands on a yard line every two steps. You can change that in **Show settings**,
and every coordinate rewrites itself so nobody physically moves.

**Nothing leaves your computer.** Shows, audio and logos all stay in your
browser. There is no account, no upload, and no server — which is also why
[saving](#saving-and-sharing) works the way it does.

---

## Your first show

**1. Name it.** Type over *Untitled show* in the toolbar.

**2. Add some people.** In the **Roster** panel on the left, each section has a
**+ 8** button. Press it. Eight performers appear, already selected — they have
no position yet, which is normal.

**3. Put them on the field.** In **Formation tools** on the right, press
**Block**. They land on the field in a block, centred on the fifty.

**4. Shape them.** Try **Line**, **Arc**, **Circle**. Each one builds around the
selection's own centre, so the form appears where you are already working rather
than jumping to the middle of the field.

**5. Make a second set.** Press **N**, or **Add set** in the set list. The new
set starts as a copy of the one before it.

**6. Move them.** Drag the performers somewhere else, or build a different form.
The path each person walks appears on the field.

**7. Watch it.** Drag the timeline at the bottom. The ensemble moves between the
two sets. Add a few more sets and it starts to look like a show.

**8. Save it.** `Ctrl+S` (`Cmd+S` on a Mac) writes a `.drillshow` file.

That is the whole loop: **select → shape → add set → move → repeat**. Everything
below is refinement.

---

## The screen

| Where | What |
|---|---|
| **Toolbar**, top | Show title, save and open, undo, snap size, view toggles, 3D playback, video, settings, export |
| **Left panel** | The set list, and the roster of performers by section |
| **Middle** | The field |
| **Right panel** | Inspector, alignment, formation tools, paths, field appearance, logos, music |
| **Timeline**, bottom | Transport, playhead, and the set markers |
| **Status bar** | Counts, selection, autosave time, and anyone not on the field |

The right panel scrolls. If you cannot find a control mentioned here, it is
probably below the fold.

---

## Selecting people

Nothing happens to anybody until they are selected.

- **One person** — click their dot on the field, or their chip in the roster.
- **Several** — hold `Shift` and click. Click again to remove one.
- **A region** — drag a box across empty field.
- **A whole section** — click the section's name in the roster, or its
  **Select all** button.
- **Everyone** — `Ctrl/Cmd+A`.
- **Nobody** — `Esc`.

The status bar flags anyone who has no position in the current set, and clicking
that warning selects exactly those people — the quickest way to find the four
trumpets you forgot to place.

---

## Building forms

**Formation tools** works on the selection and writes into the current set, as a
single undo step.

| Tool | What it makes |
|---|---|
| **Line** | Side to side, evenly spaced |
| **File** | Front to back |
| **Block** | Rows and columns; set the column count and both spacings |
| **Arc** | A curve; set radius and sweep |
| **Circle** | A closed ring |

**Shapes** gives you twelve outlines — square, rectangle, triangle, trapezoid,
diamond, pentagon, hexagon, octagon, star, cross, chevron and ellipse. Set the
width, depth and turn, then press **Form**. Corners get a performer first and the
edges are filled in proportion to their length, because a star with nobody
standing on its points does not read as a star.

**Who goes where is solved, not guessed.** When a selection takes a new shape,
DrillWriter matches people to positions for the least total distance marched —
and that matching provably contains **no crossing paths**. Nobody walks through
anybody. If hand-dragging later introduces a crossing, the Inspector lists it
under **⚠ Crossing paths**; click a pair to select both.

---

## Letters, numbers and text

**Formation tools → Text.** Type a word, set the letter height, press **Spell it
out**.

- Capitals `A–Z`, digits `0–9`, and the keyboard symbols. Lowercase is drawn as
  capitals — at eighty yards a single-stroke lowercase letter needs as many
  bodies as a capital and reads worse.
- People are shared between letters in proportion to how much line each has to
  stand on, so a `W` gets more than an `I`.
- The panel shows the finished width and the per-letter counts before you
  commit, and warns if the word is wider than the field or has more letters than
  you have people.
- **Fit to field** solves for the height that fits between the goal lines.

---

## Moving and refining

**Dragging.** Drag any selected performer and the whole selection moves. A badge
follows the pointer with the offset so far — `→ 4  ↑ 2 steps`.

**Nudging.** Arrow keys move the selection by one snap step; hold `Shift` for a
whole step. Set the snap size in the toolbar.

**Rotating.** Select anyone and a dashed ring appears with a **⟳** grip below it.
Drag the grip to turn the form about its own centre. It moves in **1° steps** by
default; hold `Shift` for the coarse step (5° out of the box). Both are
adjustable in **Show settings → Rotation handle**, and `Esc` cancels mid-turn.

**Transforms**, in Formation tools:

| Button | Effect |
|---|---|
| **Flip ↔** / **Flip ↕** | Mirror the selection across its own centre |
| **↺ / ↻** | Turn by a fixed number of degrees |
| **Spread** / **Condense** | Scale the form out or in about its centre |
| **Even out** | Equalise the spacing along the axis the form runs |

**Clearing a position.** `Delete` removes the selection's position *in this set
only*, so they inherit whatever they were doing in the set before. This is not
the same as deleting the performer — that is in the Roster panel.

---

## Lining things up

**Right-click the field** with a selection (or use the **Align** panel).
Right-clicking somebody who is not selected selects them first.

The menu has two kinds of command, and the difference matters:

- **Snap each** sends every person to their *own* nearest landmark. The form
  changes shape.
- **Move group** slides the whole form as one, so it keeps its shape exactly.

Landmarks are yard lines, hashes and sidelines. Because the alignment menu and
the printed coordinate sheets read one definition of where the hashes are, a
performer you align to the front hash is guaranteed to read `On Front Hash` on
their sheet rather than a hair off it.

There is also **dress the selection** to a front or side edge, and **even out
intervals** along either axis.

> **Tip.** If you cannot see the hash to aim at, turn on **Field appearance →
> Hash lines across the field**. A real field only has short marks at each yard,
> which do not read as a line to work against.

---

## Sets, counts and timing

The **set list** on the left is the spine of the show.

- **N** adds a set after the current one, copying it.
- `Ctrl/Cmd+D` duplicates the current set.
- With **nothing selected**, `←` and `→` step through the sets.
- The **Inspector** sets each set's label, its counts, its measure and beat, and
  a free-text note ("horns up", "drum break").

**Counts in** is how long the move into that set takes. The opening set always
has zero — you cannot march into the first set from nowhere.

**Stride warnings.** Every move is measured. If a set asks somebody to cover
more ground than the counts allow, their path turns amber and the Inspector
names them in inches per step. Past about 30" per step most ensembles cannot
hold the form. The threshold is adjustable in **Show settings**.

---

## Music

**Music panel → Import audio.** MP3, WAV, OGG or M4A.

**The tempo is read off the waveform** and applied to the marching pulse, with
the downbeat set to the first detected beat. If the octave comes out wrong,
**÷2** and **×2** fix it in one click. If detection finds nothing usable, tap it
in — press **Tap** along with the music at least three times, then **Use**.

**The recording comes back by itself.** The show file does not carry the audio —
that would quadruple the size of every save — but it remembers which recording
it was, and the bytes are kept in this browser. Refresh, reopen, or recover from
autosave and the music is simply there.

Detection deliberately does **not** re-run on reload. The show already carries
its tempo map, quite possibly one you corrected by hand, and re-analysing would
overwrite that every time. The panel says where the tempo came from and offers to
analyse afresh if you want it.

**If the recording is genuinely missing** — a different computer, a cleared
browser, a show a colleague sent you — the app says so, names the file, and
offers to re-import it.

**Source & credit.** Fill in the title, composer, where to get the recording and
its license. It is saved with the show, it survives the recording being removed,
and it is shown to whoever opens the file without the audio, with a button to
the source. It is also your programme credit — **Copy credit**, or find it
printed on the show summary.

**Travelling with the music.** Tick **Save the recording inside the show file**
to make the show portable. The file grows by about a third more than the audio
itself.

---

## Watching it back

- **Space** plays and pauses.
- Drag the **timeline** to scrub. The ensemble interpolates between sets.
- The transport's **◀ ▶** step between sets; **⤒** snaps back to the current one.
- Audio follows the drill: go back to set 1 and the music starts at the top.

**Paths.** Movement paths are on while editing and **off during playback** — 250
lines over a moving field hide the very thing you are watching for. Playback has
its own switch (**⤳** by the transport, or `Shift+P`), and the **Paths** panel
narrows either mode to the selection, or to chosen sections and individuals.

While the playhead sits between sets, editing is off and the canvas says
**Playback view — click a set to edit**. What you are looking at is an
interpolated moment, not a set, and dragging somebody there would write a
halfway coordinate into the drill.

---

## The 3D stadium

**3D playback** in the toolbar. The editor stays a flat chart, which is what you
design on; the 3D window answers the other question — does this form actually
read from where the audience sits.

**Camera presets:** home stands, press box, visitor stands, corner, end zone,
sideline, overhead.

**Free camera:**

| Input | Effect |
|---|---|
| Drag | Swing the camera around the field |
| Right-drag | Slide the view |
| Scroll | Zoom |
| `W` `A` `S` `D` | Fly across the ground |
| `Q` / `E` | Down / up |
| `Shift` | Move faster |

**The overlay** across the bottom names the previous, current and next set with
their counts. Toggle it with **Set overlay**.

**Pop out ↗** opens the stadium as a *separate window* you can drag to a second
monitor or a projector while you keep editing on the first. It shares the same
show and the same audio clock, so scrubbing in the editor moves the stadium
instantly.

`Esc` leaves the full-screen view.

---

## Printing the book

**Export…** in the toolbar produces three PDFs:

- **Coordinate sheets** — one row per set per performer, in standard drill
  notation: `Side 1: 2.0 steps inside 35 yd ln | 4.0 steps behind Front side
  line`.
- **Drill charts** — a landscape page per set.
- **Show summary** — one page: performers, sets, counts, the music credit, and
  the demanding moves worth looking at before a rehearsal.

Printed charts ignore your turf and line colours and stay on white paper — a
director's book is read under fluorescent light and printed in ink. Performer
size does carry through, so if you made the dots bigger on screen you get bigger
dots in the book.

---

## Exporting video

Records the whole show, every set, with the audio.

- **The 2D field** — **Video…** in the toolbar.
- **The 3D stadium** — **⏺ Record** on the stadium's own bar. That view takes
  over the window, so it records from inside itself; frame the camera the way
  you want the video to look first.

Set numbers are painted into the frames, so the video carries the previous,
current and next set with counts remaining.

**Three things to know before you press record:**

1. **It records in real time.** A four-minute show takes four minutes. Leave the
   tab in front and do not close it.
2. **The format depends on your browser.** MP4 where the browser offers it,
   WebM otherwise. Both upload to YouTube; Vimeo asks for MP4 or MOV. The dialog
   tells you which you are getting before you start.
3. **The 2D field records at the size it is on screen**, because it cannot be
   redrawn larger without disturbing the editor. Widen the window for a sharper
   file. The 3D view has no such limit and records up to 4K.

---

## Saving and sharing

**`Ctrl/Cmd+S`** saves, **`Ctrl/Cmd+O`** opens. Files are `.drillshow` — plain
JSON, so they diff and archive well.

On Chrome and Edge you get real Save and Save As, writing back to the same file.
Elsewhere it downloads and uploads.

**Autosave** writes to your browser every 30 seconds and offers to restore after
a crash or an accidental tab close. It is not a substitute for saving a file:
clearing your browser data clears it too.

**Sending a show to someone else.** The `.drillshow` file carries the drill, the
tempo map, the field settings, your logos and the music citation — but not the
recording, unless you ticked the embed option. Fill in **Source & credit** so
they know what to get.

---

## Making the field look right

**Field appearance**, in the right panel:

- **Turf** — Grass, Deep grass, Dry grass, Blue turf, Slate, Paper, or any
  colour you pick.
- **Lines** — White, Bone, Grey, Black, Gold, or your own.
- **Line weight** and **performer size**.
- **Hash lines across the field** — a continuous line along each hash, so you
  have something to align to. Off gives you the real 24-inch marks.
- **Mown bands** and **end zones**.

**Logos.** Drop in a PNG or JPEG for a crest at midfield or a wordmark in an end
zone. Drag to move, drag a corner to resize, then **lock** it so it stays painted
but stops intercepting presses meant for the drill. Logos are embedded in the
show file and appear in the 3D view too.

**Show settings** holds the things that change the geometry: hash placement
(high school, college, NFL), step size, rotation increments and stride warnings.

---

## Keyboard shortcuts

### Files and editing

| Key | Action |
|---|---|
| `Ctrl/Cmd + S` | Save |
| `Ctrl/Cmd + O` | Open |
| `Ctrl/Cmd + Z` | Undo |
| `Shift + Ctrl/Cmd + Z` or `Ctrl/Cmd + Y` | Redo |
| `Ctrl/Cmd + A` | Select everyone |
| `Ctrl/Cmd + D` | Duplicate the current set |

### The field

| Key | Action |
|---|---|
| Arrow keys | Nudge the selection by one snap step |
| `Shift` + arrows | Nudge by a whole step |
| Arrows, nothing selected | Previous / next set |
| `Esc` | Deselect — or cancel a rotation in progress |
| `Delete` / `Backspace` | Clear the selection's position in this set |

### Sets and playback

| Key | Action |
|---|---|
| `N` | New set after the current one |
| `Space` | Play / pause |

### View toggles

| Key | Action |
|---|---|
| `P` | Movement paths while editing |
| `Shift + P` | Movement paths during playback |
| `G` | Ghost of the previous set |
| `L` | Performer labels |

### In the 3D view

| Key | Action |
|---|---|
| `W` `A` `S` `D` | Fly |
| `Q` / `E` | Down / up |
| `Shift` | Move faster |
| `Esc` | Leave full screen |

> Shortcuts are ignored while you are typing in a text box, apart from Save and
> Open.

---

## Mouse and trackpad

**On the field:**

| Input | Effect |
|---|---|
| Click | Select |
| `Shift` + click | Add to or remove from the selection |
| Drag a performer | Move the whole selection |
| Drag empty field | Marquee-select |
| Drag the **⟳** grip | Rotate the selection |
| `Shift` while rotating | Coarse increment |
| Right-click | Alignment menu |
| `Alt` + drag, or middle-drag | Pan the field |
| Scroll | Zoom |

**On the timeline:** drag to scrub, click a set marker to jump.

**On the waveform:** click to seek.

---

## When something looks wrong

**"Nobody is on the field."** New performers have no position until you give
them one. Select them and press a formation tool — **Block** is the usual first
move.

**A tool did nothing.** Almost always an empty selection. The Formation tools
header shows how many are selected.

**I cannot drag anybody.** Check whether the canvas says *Playback view*. The
playhead is between sets and editing is off; click a set to come back.

**The play button is greyed out.** No recording is loaded. If the show expects
one, the transport says which file to re-import.

**A logo keeps grabbing my clicks.** Lock it in the Logos panel.

**The letters or shapes look thin.** There are not enough people on the form for
its size. Either select more, or make the form smaller — a shape only reads when
its corners and ends are occupied.

**Someone walks through someone else.** The formation tools never produce that,
but hand-dragging can. The Inspector's **⚠ Crossing paths** list names the pairs.

**The 3D window is empty or will not open.** It needs WebGL. The window says so
rather than showing a black rectangle. If the pop-out is blocked, it falls back
to full screen and tells you.

---

## Glossary

**Count** — one beat of marching. The unit everything is timed in.

**Set** — a snapshot of where everybody stands. Also called a page or a drill
chart.

**Step size** — how far one step covers. 8-to-5 means eight steps per five
yards, a 22.5-inch step, and is the default.

**Hash** — the inbounds lines, 53'4" in from each sideline for high school, 60'
for college, 70'9" for the NFL.

**Front sideline** — the sideline nearest the audience and the press box. The
editor draws it along the bottom, which is how the press box sees the field.

**Side 1 / Side 2** — the left and right halves of the field as the press box
sees them. Coordinates are written from the Side 1 goal line.

**Interval** — the side-to-side gap between neighbours. **Spacing** is the
front-to-back gap.

**Dress** — line a rank up to a common edge.
