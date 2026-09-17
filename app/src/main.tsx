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
import App, { type DecksHostConfig } from './App';
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

const BACKEND_URL: string = __DECKS_BACKEND_URL__ || window.location.origin;

/**
 * What the host was started with: which optional plugins to activate, and
 * where the inference service is. Asked of the server before the first
 * render, because the reactor is built once and its plugin list is part of
 * building it. A server that has no answer — an older one, or none at all in
 * a static preview — means the defaults, not a broken page.
 */
async function hostConfig(): Promise<DecksHostConfig> {
  try {
    const response = await fetch(`${BACKEND_URL}/config`, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      return {};
    }
    const body = (await response.json()) as {
      reactor_plugins?: unknown;
      ai_inference_url?: unknown;
    };
    return {
      reactorPlugins: Array.isArray(body.reactor_plugins)
        ? body.reactor_plugins.filter((name): name is string => typeof name === 'string')
        : [],
      aiInferenceUrl: typeof body.ai_inference_url === 'string' ? body.ai_inference_url : undefined,
    };
  } catch {
    return {};
  }
}

async function main() {
  // This is the standalone Decks product, whose plugins are bundled above.
  // Generic extension discovery belongs to a generic Reactor host; doing it
  // here started every unrelated extension installed in the Python environment.
  // What the server *names* among the bundled optional plugins is activated.
  const config = await hostConfig();
  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemedProvider useStore={useThemeStore}>
        <App config={config} />
      </ThemedProvider>
    </React.StrictMode>,
  );
}

void main();
