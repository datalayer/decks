/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import * as Reactor from '@datalayer/reactor';
import { bootstrapExtensions, setReactorSharedModules } from '@datalayer/reactor';
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

async function main() {
  // Anything pip-installed beside `datalayer-decks` joins the shell — the
  // same round trip every Reactor host makes. An unreachable server costs the
  // extensions, not the page.
  const remotes = __DECKS_BACKEND_URL__
    ? await bootstrapExtensions(__DECKS_BACKEND_URL__, { allowedOrigins: [__DECKS_BACKEND_URL__] })
    : await bootstrapExtensions(window.location.origin);
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemedProvider useStore={useThemeStore}>
        <App remotes={remotes} />
      </ThemedProvider>
    </React.StrictMode>,
  );
}

void main();
