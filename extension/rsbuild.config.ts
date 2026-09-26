/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The decks plugin as a Module Federation container, built straight into the
 * wheel's `share/`.
 *
 * `datalayer_decks/extension.py` publishes this as the frontend half of the
 * extension: a Reactor host that bootstraps its installed extensions loads
 * `remoteEntry.js`, asks the container for `./plugin`, and gets `DecksPlugin`
 * — the same plugin the standalone app and the Loop mount by import. React,
 * the reactor and Primer are `shared` singletons, so the plugin runs on the
 * host's copies rather than bringing a second React along.
 *
 * `npm run extension:dev` serves the same container on :5191 with hot
 * updates; a running host swaps it in with
 * `updateFederatedRemote('datalayer_decks', 'http://localhost:5191/remoteEntry.js')`.
 */

import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';

const singleton = { singleton: true } as const;

export default defineConfig({
  // This config is invoked from the package root (`rsbuild -c extension/...`).
  // Anchor relative entries and output paths to the config directory.
  root: import.meta.dirname,
  plugins: [
    pluginReact(),
    pluginModuleFederation({
      name: 'datalayer_decks',
      // Named, because `datalayer_decks/extension.py` publishes exactly this
      // file as the container's entry; the plugin's default is a hashed
      // `static/js/datalayer_decks.<hash>.js` that nothing would find.
      filename: 'remoteEntry.js',
      exposes: { './plugin': './src/plugin.ts' },
      shared: {
        react: { singleton: true, requiredVersion: '^19.0.0' },
        'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
        '@datalayer/reactor': singleton,
        '@datalayer/reactor/react': singleton,
        '@primer/react': singleton,
        '@primer/octicons-react': singleton,
        '@datalayer/primer-addons': singleton,
        'styled-components': singleton,
      },
      dts: false,
    }),
  ],
  source: { entry: { index: './src/plugin.ts' } },
  server: { port: 5191 },
  output: {
    assetPrefix: 'auto',
    cleanDistPath: true,
    distPath: { root: '../share/datalayer/reactor/extensions/decks' },
  },
});
