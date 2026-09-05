/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The Decks shell: the reactor shell plugin, the decks plugin, and the two
 * plugins every Reactor host is better with — the manager and the palette.
 *
 * The layout is three slots: `header` for the shell's view selector and the
 * theme control, `sidebar` for the list of decks, `main` for the open deck.
 * `root` is rendered once for plugins that position themselves — the palette
 * and the "new deck" dialog.
 *
 * The example decks are registered here so a fresh `datalayer-decks` has
 * something to show before anyone has made a deck; what the backend holds is
 * pulled in by the plugin and shown beside them.
 */

import React, { useMemo } from 'react';
import {
  buildReactorFromPlugins,
  configurePlugin,
  type LazyPluginRef,
  type ReactorExtension,
} from '@datalayer/reactor';
import { ReactorSlot, useReactor } from '@datalayer/reactor/react';
import { Box } from '@datalayer/primer-addons';
import { ThemePlugin } from '@datalayer/primer-addons/lib/reactor';
import { ShellPlugin } from '@datalayer/reactor-shell';
import { PluginsManagerPlugin } from '@datalayer/reactor-manager';
import { CommandsPlugin } from '@datalayer/reactor-commands';
import { DecksHostProvider, registerDecks } from '@datalayer/decks';
import { DecksPlugin } from '@datalayer/decks/plugin';
import { exampleDecks } from '../../examples';

// Once, at module load: the list is complete on the first frame.
registerDecks(exampleDecks);

function createReactor(remotes: (LazyPluginRef | ReactorExtension)[]) {
  return buildReactorFromPlugins([
    ShellPlugin,
    configurePlugin(DecksPlugin, {
      backendUrl: __DECKS_BACKEND_URL__ || window.location.origin,
    }),
    PluginsManagerPlugin,
    CommandsPlugin,
    ThemePlugin,
    ...remotes,
  ]);
}

export default function App({
  remotes = [],
}: {
  remotes?: (LazyPluginRef | ReactorExtension)[];
}) {
  const reactor = useMemo(() => createReactor(remotes), [remotes]);
  useReactor(reactor);
  return (
    <DecksHostProvider host={{}}>
      <ReactorSlot slot="root" />
      <Box
        as="header"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          px: 3,
          py: 2,
          borderBottom: '1px solid',
          borderColor: 'border.default',
          bg: 'canvas.subtle',
        }}
      >
        <Box sx={{ fontWeight: 'bold' }}>Datalayer Decks</Box>
        <Box sx={{ flex: 1 }} />
        <ReactorSlot slot="header" />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'stretch', minHeight: 'calc(100% - 49px)' }}>
        <Box
          as="aside"
          sx={{ flex: '0 0 280px', borderRight: '1px solid', borderColor: 'border.default' }}
        >
          <ReactorSlot slot="sidebar" />
        </Box>
        <Box as="main" sx={{ flex: '1 1 auto', minWidth: 0 }}>
          <ReactorSlot slot="main" />
        </Box>
      </Box>
    </DecksHostProvider>
  );
}
