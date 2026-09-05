/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The Decks interface, built into the wheel.
 *
 * `distPath` is the whole reason this config exists apart from the defaults:
 * the output lands under `share/datalayer/reactor/apps/decks`, which is what
 * `datalayer-decks` serves and what `hatch` packages. One `npm run build` and
 * one `pip install .` later, the command serves both halves from one origin.
 *
 * `__DECKS_BACKEND_URL__` is empty in a production build — the Python host
 * serves this bundle from the same origin as the API — and points at the
 * default port in development, where Rsbuild is here and uvicorn is there.
 */

import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginStyledComponents } from '@rsbuild/plugin-styled-components';

export default defineConfig({
  plugins: [pluginReact(), pluginStyledComponents({ displayName: true, fileName: false })],
  source: {
    entry: { index: './src/main.tsx' },
    define: {
      __DECKS_BACKEND_URL__: JSON.stringify(
        process.env.DECKS_BACKEND_URL ??
          (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8797'),
      ),
    },
  },
  html: { title: 'Datalayer Decks' },
  server: { port: 5190 },
  output: {
    distPath: { root: '../share/datalayer/reactor/apps/decks' },
    // Absolute, so a route like /decks/talks/hello still finds the bundle.
    assetPrefix: '/',
  },
});
