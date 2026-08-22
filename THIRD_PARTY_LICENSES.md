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

# Third-party licenses

Every third-party package DrillWriter Studio depends on, its license, and where its
source lives (FR-5.2). Run `npm run licenses` to check this file against
`package.json` — the check fails if a dependency is missing here, or if it
carries a license that is incompatible with Apache-2.0 redistribution (FR-5.3).

## Why this matters

DrillWriter Studio is distributed under Apache License 2.0. Apache-2.0 can incorporate
permissively licensed code (MIT, BSD, ISC, Apache-2.0), but it **cannot**
incorporate code under a strong copyleft license such as GPL-2.0 or GPL-3.0
without imposing that copyleft on the whole project. LGPL and MPL are weak
copyleft: linking is acceptable, but modifications to those files must be
released under the same license, which is a complication worth avoiding in a
bundled single-page app where "linking" and "copying" are the same operation.
The check script therefore rejects GPL outright and flags LGPL/MPL for review.

## Runtime dependencies

These are bundled into the shipped application.

| Package | Version | License | Source |
|---|---|---|---|
| [react](https://www.npmjs.com/package/react) | ^18.3.1 | MIT | https://github.com/facebook/react |
| [react-dom](https://www.npmjs.com/package/react-dom) | ^18.3.1 | MIT | https://github.com/facebook/react |
| [konva](https://www.npmjs.com/package/konva) | ^9.3.16 | MIT | https://github.com/konvajs/konva |
| [react-konva](https://www.npmjs.com/package/react-konva) | ^18.2.10 | MIT | https://github.com/konvajs/react-konva |
| [zustand](https://www.npmjs.com/package/zustand) | ^4.5.5 | MIT | https://github.com/pmndrs/zustand |
| [pdf-lib](https://www.npmjs.com/package/pdf-lib) | ^1.17.1 | MIT | https://github.com/Hopding/pdf-lib |
| [three](https://www.npmjs.com/package/three) | ^0.169.0 | MIT | https://github.com/mrdoob/three.js |

`three` powers the 3D playback window only, and is code-split into its own
chunk that is fetched the first time that window is opened — a designer who
never opens it never downloads it. It has no dependencies of its own.

`pdf-lib` pulls in a small number of transitive dependencies of its own
(`@pdf-lib/standard-fonts`, `@pdf-lib/upng`, `pako`, `tslib`), all MIT.

## Development dependencies

Not shipped to users; used to build and check the project.

| Package | Version | License | Source |
|---|---|---|---|
| [typescript](https://www.npmjs.com/package/typescript) | ^5.6.3 | Apache-2.0 | https://github.com/microsoft/TypeScript |
| [vite](https://www.npmjs.com/package/vite) | ^5.4.10 | MIT | https://github.com/vitejs/vite |
| [@vitejs/plugin-react](https://www.npmjs.com/package/@vitejs/plugin-react) | ^4.3.3 | MIT | https://github.com/vitejs/vite-plugin-react |
| [@types/react](https://www.npmjs.com/package/@types/react) | ^18.3.12 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |
| [@types/react-dom](https://www.npmjs.com/package/@types/react-dom) | ^18.3.1 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |
| [@types/node](https://www.npmjs.com/package/@types/node) | ^22.9.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |
| [@types/three](https://www.npmjs.com/package/@types/three) | ^0.169.0 | MIT | https://github.com/DefinitelyTyped/DefinitelyTyped |

## Planned dependencies

Not yet added — listed here so the license position is settled before the code
lands.

| Package | License | Purpose | Status |
|---|---|---|---|
| [opensheetmusicdisplay](https://www.npmjs.com/package/opensheetmusicdisplay) | BSD-3-Clause | MusicXML rendering (FR-3.1, FR-3.2) | Compatible; pending the MusicXML phase |
| [soundfont-player](https://www.npmjs.com/package/soundfont-player) | MIT | Reference playback of an imported score | Compatible; pending the MusicXML phase |

## Nothing else

DrillWriter Studio loads no fonts, scripts, styles, analytics or telemetry from any
remote host at runtime. PDF output uses the PDF standard fonts, which are
supplied by the reader rather than embedded. The application makes no network
requests of its own once loaded (NFR-2).
