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

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Static-site build (FR-4.1, FR-4.2). No server, no API, no environment
 * variables — `npm run build` produces a `dist/` folder that can be dropped on
 * any static host or opened from a file share.
 *
 * `base` is relative so the build works from a subdirectory, which is what
 * GitHub Pages project sites need.
 */
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Keep the canvas and PDF engines out of the initial payload so the
        // editor paints quickly; both are pulled in on demand.
        manualChunks: {
          konva: ['konva', 'react-konva'],
          pdf: ['pdf-lib'],
          // three is the largest dependency here and only the 3D playback
          // window needs it, so it stays in its own chunk that is fetched the
          // first time someone opens that window.
          three: ['three'],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
