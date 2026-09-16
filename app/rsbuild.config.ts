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
import path from 'node:path';

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
  resolve: {
    // The app declares Reactor as a sibling `file:` dependency. Bundle its
    // TypeScript entry points directly so a monorepo link and a plain checkout
    // behave identically, without depending on a previously generated lib/.
    alias: {
      // Reactor's sibling source otherwise resolves React from the monorepo
      // root while this app resolves its local dependency. Two dispatchers in
      // one page produce React's `useMemo`-of-null invalid-hook failure.
      'react$': path.resolve(import.meta.dirname, 'node_modules/react/index.js'),
      'react/jsx-runtime$': path.resolve(
        import.meta.dirname,
        'node_modules/react/jsx-runtime.js',
      ),
      'react/jsx-dev-runtime$': path.resolve(
        import.meta.dirname,
        'node_modules/react/jsx-dev-runtime.js',
      ),
      'react-dom$': path.resolve(import.meta.dirname, 'node_modules/react-dom/index.js'),
      'react-dom/client$': path.resolve(
        import.meta.dirname,
        'node_modules/react-dom/client.js',
      ),
      // Decks is a sibling `file:` package and therefore resolves its own
      // dependency tree when Rsbuild compiles its source. Primer's providers
      // and consumers must come from the same module instance: otherwise
      // portal-based components such as ActionMenu render correctly until
      // their overlay opens, then `useTheme()` reads an empty context. Keep
      // styled-components single as well because Primer's legacy theme
      // context is carried through it.
      '@primer/react$': path.resolve(
        import.meta.dirname,
        'node_modules/@primer/react/lib/index.js',
      ),
      'styled-components$': path.resolve(
        import.meta.dirname,
        'node_modules/styled-components/dist/styled-components.browser.esm.js',
      ),
      '@datalayer/reactor/react$': path.resolve(
        import.meta.dirname,
        '../../reactor/src/react/index.ts',
      ),
      '@datalayer/reactor$': path.resolve(import.meta.dirname, '../../reactor/src/index.ts'),
    },
  },
  server: { port: 5190 },
  output: {
    distPath: { root: '../share/datalayer/reactor/apps/decks' },
    cleanDistPath: true,
    // Absolute, so a route like /decks/talks/hello still finds the bundle.
    assetPrefix: '/',
  },
});
