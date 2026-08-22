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

# The `.drillshow` file format

A show is one JSON document. It is plain text, so it diffs cleanly in version
control and can be read or repaired in any editor, and it is versioned, so a
show saved by today's build still opens in later ones (NFR-5).

```jsonc
{
  "schemaVersion": 1,
  "metadata": { "title": "…", "ensemble": "…", "season": "…", "designer": "…" },
  "field":    { "type": "highSchool", "stepsPerFiveYards": 8, "showEndZones": true },
  "sections": [ … ],
  "performers": [ … ],
  "sets": [ … ],
  "music": { "tempoMap": { … }, "audio": { … }, "score": { … } }
}
```

## Coordinates

Positions are stored in **steps**, never pixels and never yards:

- `x` — steps from the **Side 1 goal line**, increasing toward Side 2.
  At 8-to-5, goal line to goal line is exactly 160 steps.
- `y` — steps from the **front sideline**, increasing toward the back sideline.
  At 8-to-5, the field is 85.33 steps deep.

Both are in the show's own step size, which is why `field.stepsPerFiveYards` is
part of the document. Changing that setting in the editor rescales every stored
coordinate so that nobody physically moves — only the units the coordinate is
written in change.

`field.stepsPerFiveYards` defaults to **8** — the 8-to-5 standard, a 22.5" step,
a marcher on a yard line every two steps. It is a free numeric value rather than
a fixed list, so 6-to-5, 12-to-5, 16-to-5 and anything in between are all legal.
On load it is clamped to 2–48 steps per five yards and rounded to two decimals;
anything missing, zero, negative or non-numeric becomes 8 rather than producing
a field with an infinite or zero-length step.

Hash placement is *not* baked into coordinates. It is derived from
`field.type` in feet (53′4″ from each sideline for NFHS, 60′ for NCAA, 70′9″ for
NFL), so switching between field types moves the hash lines without touching a
single performer.

## Sets are sparse

`sets[n].positions` maps performer id to point, and it is allowed to be
incomplete. A performer with no entry at set *n* inherits their position from
the most recent earlier set that does list them. A performer who appears in no
set at or before *n* is simply not on the field yet.

This keeps files small for shows where most of the ensemble holds through a
phrase, and it makes "add a performer at set 12" behave sensibly. Readers must
resolve positions by walking backwards rather than reading `positions` directly.

`sets[0].counts` is always `0` — nobody moves into the opening set — and the
loader forces this even if a file says otherwise.

## Transitions

`sets[n].transitions[performerId]` describes how a performer travels *into* set
*n*:

```jsonc
{ "style": "straight" | "curve", "control": { "x": 0, "y": 0 }, "holdCounts": 4 }
```

`holdCounts` counts spent standing before moving. `control` is the control point
of a quadratic Bézier and is only meaningful for `"curve"`. The field is present
in schema version 1 even though the editor's curve tooling is still being built,
so adding it later needs no format change.

## Field appearance

```jsonc
"field": {
  "type": "highSchool",
  "stepsPerFiveYards": 8,
  "showEndZones": true,
  "appearance": {
    "turfColor": "#3d7a3f",
    "endZoneColor": "#33693a",
    "lineColor": "#ffffff",
    "numberColor": "#ffffff",
    "lineWeight": 1,
    "performerSize": 1,
    "showMowingStripes": true
  }
}
```

Part of the show, so a file reopens looking the way it was left. A colour that
does not parse falls back to the default rather than painting the field a solid
slab; `lineWeight` is clamped to 0.25–4 and `performerSize` to 0.4–3.

Appearance arrived after schema version 1. A file written before it simply has
no `appearance` key and gets the grass defaults — the additive-with-defaults
rule below is what makes that a non-event rather than a migration.

Printed charts ignore appearance entirely and stay on white paper.

## Field logos

```jsonc
"fieldLogos": [
  {
    "id": "logo_ab12",
    "name": "Crest",
    "dataUrl": "data:image/png;base64,…",
    "center": { "x": 80, "y": 42.67 },
    "widthSteps": 40, "heightSteps": 24,
    "rotationDegrees": 0,
    "opacity": 0.85,
    "visible": true,
    "lockAspect": true,
    "locked": false
  }
]
```

Optional and empty by default. Geometry is in drill units like everything else,
so a logo stays put when the step size or field type changes.

`locked` and `lockAspect` are unrelated: `lockAspect` keeps width and height in
proportion when one is edited, while `locked` makes the logo ignore pointer
events on the canvas so it cannot be grabbed by a drag meant for performers. A
locked logo is still drawn. Both default to *not* locked on load, so a file
written before locking existed does not open frozen.

Images are **embedded**, not referenced, so a show handed to another director
arrives complete. On import they are downscaled to 1024px on the longest edge to
keep files openable. On load:

- anything whose `dataUrl` is not a `data:image/...` URL is **dropped** — a show
  file must never cause a fetch to somewhere else;
- a payload over 8MB is dropped rather than embedded;
- sizes and opacity are clamped to something drawable.

## Music

```jsonc
"music": {
  "tempoMap": {
    "tempos": [ { "measure": 1, "bpm": 144 }, { "measure": 33, "bpm": 96 } ],
    "meters": [ { "measure": 1, "beatsPerMeasure": 4, "beatUnit": 4 } ],
    "offsetSeconds": 2.4
  }
}
```

One drill count is one notated beat. Tempo and meter changes take effect at
measure boundaries. `offsetSeconds` is how far into the audio file measure 1
beat 1 lands, which is what makes a recording with a count-off line up.

Audio and scores can be stored two ways:

- `"storage": "reference"` — only the file name is kept. The file is small and
  contains no copyrighted audio, but the recording has to be re-linked on open.
  This is the default.
- `"storage": "embedded"` — the payload is base64 in `data`. The show is fully
  self-contained at the cost of a much larger file.

## Orientation

Drill `y` grows from the front sideline toward the back, and the editor draws
the field as the press box sees it — front sideline along the **bottom**, so the
front hash sits below the back hash. That is a rendering convention, not a data
one: nothing in the file changes if it were ever flipped.

## Compatibility rules

- **Unknown fields are dropped** on load rather than causing a failure, so a
  file written by a newer minor build still opens.
- **A higher `schemaVersion` is refused** with a message telling the user to
  update, rather than silently misreading data.
- **Dangling references are repaired**: positions for deleted performers are
  discarded, and a performer pointing at a missing section is reassigned to the
  first one rather than vanishing.
- **Non-finite coordinates are discarded** — a `NaN` in a file becomes an
  unplaced performer, not a marker at the origin.

Every one of these rules is covered by a test in
`src/core/__tests__/schema.test.ts`.

## Changing the format

When the model gains something that cannot be expressed in version 1:

1. Bump `CURRENT_SCHEMA_VERSION` in `src/core/show.ts`.
2. Add a migration branch in `parseShow` keyed on the incoming version.
3. Add a test that opens a fixture written in the old version.
4. Note the change here.

Additive fields with sensible defaults do **not** need a version bump — that is
what the "unknown fields are dropped, missing fields get defaults" rule is for.
