/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The Decks shell: the reactor shell plugin, the decks plugin, and the two
 * plugins every Reactor host is better with — the manager and the palette.
 *
 * The layout is three slots: `header` for the shell's view selector and, at
 * its right edge, the appearance menu — color mode, theme, description and
 * preview, the control the public Datalayer header wears — `sidebar` for the
 * list of decks, `main` for the open deck.
 * `root` is rendered once for plugins that position themselves — the palette
 * and the "new deck" dialog.
 *
 * The example decks are registered here so a fresh `datalayer-decks` has
 * something to show before anyone has made a deck; what the backend holds is
 * pulled in by the plugin and shown beside them.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import {
  buildReactorFromPlugins,
  configurePlugin,
  type LazyPluginRef,
  type ReactorExtension,
} from '@datalayer/reactor';
import { ReactorSlot, useReactor } from '@datalayer/reactor/react';
import { Box } from '@datalayer/primer-addons';
import { AppearancePlugin, ThemePlugin } from '@datalayer/primer-addons/lib/reactor';
import { ShellPlugin } from '@datalayer/reactor-shell';
import { PluginsManagerPlugin } from '@datalayer/reactor-manager';
import { CommandsPlugin } from '@datalayer/reactor-commands';
import {
  DECKS_ROUTE,
  DeckPrintView,
  DecksHostProvider,
  deckId,
  printThemeFromAddress,
  registerDecks,
  resolveDeckRoute,
  resolveSlide,
} from '@datalayer/decks';
import {
  DecksPlugin,
  configureDecksBackend,
  loadDecksFromBackend,
  openDeck,
  useDeckEntries,
} from '@datalayer/decks/plugin';
import { exampleDecks } from '../../examples';

// Once, at module load: the list is complete on the first frame.
registerDecks(exampleDecks);

const BACKEND_URL: string = __DECKS_BACKEND_URL__ || window.location.origin;

/**
 * What the address asks for.
 *
 * `/decks/<id>/print` is the print view on its own; `/decks/<id>[/<slide>]`
 * is the shell with that deck open. The server hands a browser this page for
 * both — the API owns the same prefix for JSON — and the page reads the rest.
 */
function readAddress(): { print?: boolean; segments: string[] } {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (!path.startsWith(`${DECKS_ROUTE}/`)) {
    return { segments: [] };
  }
  const segments = path
    .slice(DECKS_ROUTE.length + 1)
    .split('/')
    .filter(Boolean);
  if (segments.at(-1) === 'print') {
    return { print: true, segments: segments.slice(0, -1) };
  }
  return { segments };
}

/**
 * The print view, bare: no shell, no reactor — the page *is* the deck, which
 * is what Reveal's print mode needs. The catalog is the bundled decks plus
 * whatever the server holds, loaded before the address is resolved.
 */
function PrintPage({ segments }: { segments: string[] }) {
  const entries = useDeckEntries();
  const loaded = useRef(false);
  useEffect(() => {
    configureDecksBackend(BACKEND_URL);
    void loadDecksFromBackend().finally(() => {
      loaded.current = true;
    });
  }, []);
  const [first, second] = segments;
  const { entry } = resolveDeckRoute(first, second, undefined);
  const { theme, colorMode } = printThemeFromAddress();
  // `entries` is read so the page re-renders when the server's decks land.
  void entries;
  return (
    <DecksHostProvider host={{}}>
      <DeckPrintView entry={entry} theme={theme} colorMode={colorMode} />
    </DecksHostProvider>
  );
}

/** Open the deck the address names once the catalog has it. */
function useDeepLink(segments: string[]) {
  const entries = useDeckEntries();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || segments.length === 0) {
      return;
    }
    const [first, second, third] = segments;
    const { entry, slideSegment } = resolveDeckRoute(first, second, third);
    if (entry) {
      done.current = true;
      openDeck(deckId(entry), resolveSlide(slideSegment, entry.spec.slides.length));
    }
  }, [entries, segments]);
}

function createReactor(remotes: (LazyPluginRef | ReactorExtension)[]) {
  return buildReactorFromPlugins([
    // The decks *are* this application, so "none" is not a view of it: the
    // selector stays out of the header until an extension contributes a
    // second view, and the cycle command wraps among the views there are.
    configurePlugin(ShellPlugin, { defaultView: 'decks', allowNone: false }),
    configurePlugin(DecksPlugin, { backendUrl: BACKEND_URL }),
    PluginsManagerPlugin,
    CommandsPlugin,
    ThemePlugin,
    // The appearance menu, in the header slot after the view selector: the
    // theme plugin above is its dependency, listed anyway so the portals
    // follow the mode even in a host that drops the menu.
    AppearancePlugin,
    ...remotes,
  ]);
}

export default function App({ remotes = [] }: { remotes?: (LazyPluginRef | ReactorExtension)[] }) {
  const address = useMemo(readAddress, []);
  if (address.print) {
    return <PrintPage segments={address.segments} />;
  }
  return <Shell remotes={remotes} segments={address.segments} />;
}

function Shell({
  remotes,
  segments,
}: {
  remotes: (LazyPluginRef | ReactorExtension)[];
  segments: string[];
}) {
  const reactor = useMemo(() => createReactor(remotes), [remotes]);
  useReactor(reactor);
  useDeepLink(segments);
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
      <Box
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          minHeight: 'calc(100% - 49px)',
        }}
      >
        <Box
          as="aside"
          sx={{
            flex: '0 0 280px',
            // A flex item's minimum is its content's width unless told
            // otherwise, and the plugins list truncates against *this* width:
            // without the zero the column grows to the longest description.
            minWidth: 0,
            borderRight: '1px solid',
            borderColor: 'border.default',
          }}
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
