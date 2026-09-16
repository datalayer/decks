/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import * as Reactor from '@datalayer/reactor';
import { setReactorSharedModules } from '@datalayer/reactor';
import * as ReactorReact from '@datalayer/reactor/react';
import { ThemedProvider, useThemeStore } from '@datalayer/primer-addons';
import App from './App';
import './styles.css';

/**
 * What an extension installed beside the server may borrow from this shell.
 *
 * A module fetched at runtime is not in this bundle; publishing our React is
 * what keeps it from bringing a second one whose hooks throw.
 */
setReactorSharedModules({
  react: React,
  '@datalayer/reactor': Reactor,
  '@datalayer/reactor/react': ReactorReact,
});

function main() {
  // This is the standalone Decks product, whose plugins are bundled above.
  // Generic extension discovery belongs to a generic Reactor host; doing it
  // here started every unrelated extension installed in the Python environment.
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemedProvider useStore={useThemeStore}>
        <App />
      </ThemedProvider>
    </React.StrictMode>,
  );
}

main();
