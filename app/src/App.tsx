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
 * pulled in by the plugin and shown beside them. Their components are
 * registered in the same breath, since a spec may only name what the host
 * has offered.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  buildReactorFromPlugins,
  configurePlugin,
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
  deckPath,
  printThemeFromAddress,
  registerDeckComponents,
  registerDecks,
  resolveDeckRoute,
  resolveSlide,
} from '@datalayer/decks';
import {
  DecksPlugin,
  closeDeck,
  configureDecksBackend,
  loadDecksFromBackend,
  openDeck,
  useDeckEntries,
  useDecksState,
  useOpenDeck,
} from '@datalayer/decks/plugin';
import { exampleDecks } from '../../examples';
import { appDeckComponents } from './deckComponents';

// Once, at module load: the list is complete on the first frame.
registerDecks(exampleDecks);
// And the components those decks name — the reference deck's `component`
// slide, artifact visual and backdrop, plus this host's own live Jupyter
// cell. The engine ships the registry empty on purpose; this is the host
// filling it, which is the one line a host copies to make its own components
// nameable from a spec.
registerDeckComponents(appDeckComponents);

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

/** Put a path in the bar without navigating, and only when it changed. */
function replacePath(path: string): void {
  const current = window.location.pathname + window.location.search;
  const next = path + window.location.search;
  if (current !== next) {
    window.history.replaceState(window.history.state, '', next);
  }
}

/**
 * The address bar and the open deck, kept in step, both ways.
 *
 * Reading, `/decks/<id>[/<slide>]` opens that deck there — at load, once the
 * catalog has the deck (the server's arrive after the first paint), and again
 * on `popstate`, for a reader who goes back or edits the address by hand.
 *
 * Writing, every move through the deck puts the slide it landed on in the
 * bar, so what is in the address is always a link to what is on screen —
 * which is the whole point: a slide worth pointing at is worth being able to
 * copy the URL of. Reveal's own `hash` and `history` are off for this reason
 * (`DeckRenderer`): the address is the host's to write, and this is the host.
 *
 * Replaced rather than pushed. Arrowing through a twenty-slide deck should
 * not bury the page the reader came from under twenty history entries; Back
 * leaves the deck, as it did before there was a slide in the address.
 *
 * The writer stays quiet until something has been opened from here, because
 * at first paint `selected` is empty while a deep link is still waiting for
 * its deck to load — and a writer that spoke then would replace the very
 * address it is waiting on with a bare `/decks`.
 */
function useAddressBar(): void {
  const entries = useDeckEntries();
  const open = useOpenDeck();
  const { slide } = useDecksState();
  const resolved = useRef(false);
  const wrote = useRef(false);

  const apply = useCallback((): void => {
    const { segments } = readAddress();
    const [first, second, third] = segments;
    const { entry, slideSegment } = resolveDeckRoute(first, second, third);
    if (entry) {
      resolved.current = true;
      openDeck(deckId(entry), resolveSlide(slideSegment, entry.spec.slides.length));
    } else if (segments.length === 0 && wrote.current) {
      // Back, to a `/decks` this hook wrote when the deck was closed.
      resolved.current = true;
      closeDeck();
    }
  }, []);

  // Read: at load, retried as decks arrive, until the address resolves.
  useEffect(() => {
    if (!resolved.current) {
      apply();
    }
  }, [apply, entries]);

  // Read: and whenever the reader moves through their own history.
  useEffect(() => {
    window.addEventListener('popstate', apply);
    return () => window.removeEventListener('popstate', apply);
  }, [apply]);

  // Write: the open deck and slide, as the address for them.
  useEffect(() => {
    if (open) {
      wrote.current = true;
      replacePath(deckPath(open, slide));
    } else if (wrote.current) {
      // The root, and not `/decks`: that address belongs to the API on this
      // host — it answers the deck list as JSON, whatever the browser asked
      // for (`datalayer_decks/api.py`) — so a reader who closed a deck and
      // reloaded would get a page of JSON. `/` is where the interface is
      // mounted, and it opens on the list.
      replacePath('/');
    }
  }, [open, slide]);
}

function createReactor() {
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
  ]);
}

export default function App() {
  const address = useMemo(readAddress, []);
  if (address.print) {
    return <PrintPage segments={address.segments} />;
  }
  return <Shell />;
}

function Shell() {
  const reactor = useMemo(createReactor, []);
  useReactor(reactor);
  useAddressBar();
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
