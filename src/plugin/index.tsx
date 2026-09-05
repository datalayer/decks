/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * `@datalayer/decks/plugin` — decks in any Reactor shell.
 *
 * The plugin adds three things to a host built on `@datalayer/reactor`:
 *
 * - **a list** of every deck the catalog knows, in the sidebar slot, with a
 *   "New deck" button;
 * - **a view** that shows the open deck — the same `DeckView` the landing page
 *   uses — in the main slot, and joins the shell's view selector as "Decks";
 * - **commands**: list, new, open, go to slide, next and previous slide,
 *   present and print — with keystrokes where a keystroke makes sense — so a
 *   palette, a keyboard or an agent drives a deck without a mouse.
 *
 * Where decks come from is not the plugin's business, and it accepts them
 * three ways: a host registers them (`registerDecks`), another plugin
 * contributes them (`DeckCatalog`), or a backend lists them (`backendUrl`,
 * which is also where a new deck is saved). All three land in one catalog.
 *
 * @module plugin
 */

import type { JSX } from 'react';
import { definePlugin } from '@datalayer/reactor';
import type { ReactorReactOutput } from '@datalayer/reactor/react';
import { DeckList } from './DeckList';
import { NewDeckDialog } from './NewDeckDialog';
import { DecksView } from './DecksView';
import { DeckCatalog, ShellView } from './points';
import {
  beginNewDeck,
  closeDeck,
  configureDecksBackend,
  goToSlide,
  loadDecksFromBackend,
  nextSlide,
  openDeck,
  presentOpenDeck,
  previousSlide,
  printOpenDeck,
} from './store';

export const DECKS_PLUGIN_NAME = '@datalayer/decks';

/** The ids of the commands, for a host that binds or lists them itself. */
export const DECKS_COMMANDS = {
  list: 'decks.list',
  create: 'decks.new',
  open: 'decks.open',
  goTo: 'decks.goToSlide',
  next: 'decks.nextSlide',
  previous: 'decks.previousSlide',
  present: 'decks.present',
  print: 'decks.print',
} as const;

export type DecksPluginConfig = {
  /** Where the list renders. */
  listSlot: string;
  /** Its place among that slot's components; lower first, 0 by default. */
  listOrder: number;
  /** Where the open deck renders. */
  slot: string;
  /** Where the dialog mounts; a slot the host renders once, at the root. */
  dialogSlot: string;
  /** The Reactor backend serving `/decks`, or none for a catalog-only host. */
  backendUrl?: string;
  /** Whether to contribute a "Decks" view to the shell's selector. */
  shellView: boolean;
  /** Its place in the selector. */
  shellViewOrder: number;
  /** Keystrokes. Empty disables one. */
  keybindings: Record<keyof typeof DECKS_COMMANDS, string>;
};

export const DecksPlugin = definePlugin<DecksPluginConfig, unknown, ReactorReactOutput>({
  name: DECKS_PLUGIN_NAME,
  version: '1.0.0',
  displayName: 'Decks',
  description: 'Presentations described as data: list them, open one, make a new one.',
  octicon: 'project',
  emoji: '\u{1F4CA}',
  config: {
    listSlot: 'sidebar',
    listOrder: 0,
    slot: 'main',
    dialogSlot: 'root',
    backendUrl: undefined,
    shellView: true,
    shellViewOrder: 40,
    keybindings: {
      list: 'Mod+Shift+D',
      create: 'Mod+Alt+N',
      // Open and go-to take an argument, which a keystroke cannot carry;
      // they exist for the palette, a host, and an agent.
      open: '',
      goTo: '',
      next: 'Alt+ArrowRight',
      previous: 'Alt+ArrowLeft',
      present: 'Mod+Shift+F',
      print: 'Mod+Shift+P',
    },
  },
  contributionPoints: [DeckCatalog],
  register: ({ config, registerCommand }) => {
    const undo = [
      registerCommand({
        id: DECKS_COMMANDS.list,
        name: 'Show the decks',
        description: 'Close the open deck and show the list',
        category: 'Decks',
        emoji: '\u{1F4CA}',
        keybinding: config.keybindings.list || undefined,
        execute: closeDeck,
      }),
      registerCommand({
        id: DECKS_COMMANDS.create,
        name: 'New deck',
        description: 'Start a deck from a title slide',
        category: 'Decks',
        emoji: '✨',
        keybinding: config.keybindings.create || undefined,
        execute: beginNewDeck,
      }),
      registerCommand<{ id: string; slide?: number }>({
        id: DECKS_COMMANDS.open,
        name: 'Open a deck',
        description: 'Open a deck by id — `collection/slug` or `slug` — optionally at a slide',
        category: 'Decks',
        keybinding: config.keybindings.open || undefined,
        execute: (argument) => {
          if (argument?.id) {
            openDeck(argument.id, argument.slide ?? 1);
          }
        },
      }),
      registerCommand<{ slide: number }>({
        id: DECKS_COMMANDS.goTo,
        name: 'Go to slide',
        description: 'Move the open deck to a slide number',
        category: 'Decks',
        keybinding: config.keybindings.goTo || undefined,
        execute: (argument) => {
          if (typeof argument?.slide === 'number') {
            goToSlide(argument.slide);
          }
        },
      }),
      registerCommand({
        id: DECKS_COMMANDS.next,
        name: 'Next slide',
        category: 'Decks',
        keybinding: config.keybindings.next || undefined,
        execute: nextSlide,
      }),
      registerCommand({
        id: DECKS_COMMANDS.previous,
        name: 'Previous slide',
        category: 'Decks',
        keybinding: config.keybindings.previous || undefined,
        execute: previousSlide,
      }),
      registerCommand({
        id: DECKS_COMMANDS.present,
        name: 'Present',
        description: 'The open deck, fullscreen',
        category: 'Decks',
        keybinding: config.keybindings.present || undefined,
        execute: () => {
          presentOpenDeck();
        },
      }),
      registerCommand({
        id: DECKS_COMMANDS.print,
        name: 'Print to PDF',
        description: 'Open the print view of the open deck',
        category: 'Decks',
        keybinding: config.keybindings.print || undefined,
        execute: () => {
          printOpenDeck();
        },
      }),
    ];
    return () => undo.forEach((fn) => fn());
  },
  build: ({ config, contribute }) => {
    if (config.shellView) {
      contribute(
        ShellView,
        { id: 'decks', title: 'Decks', order: config.shellViewOrder },
        { id: 'decks-view' },
      );
    }
    // The backend is configured here rather than in `register`: the platform
    // builds every startup plugin before it registers any, so this is the
    // first phase that runs — and the fetch below needs the address.
    configureDecksBackend(config.backendUrl);
    // What the backend has, pulled once the platform is up. Async and
    // unawaited: the list renders empty and fills, rather than the whole
    // platform waiting on a server that may not be there.
    void loadDecksFromBackend();
    return {
      components: [
        {
          id: 'decks-list',
          slot: config.listSlot,
          order: config.listOrder,
          Component: DeckList as () => JSX.Element,
        },
        { id: 'decks-view', slot: config.slot, Component: DecksView as () => JSX.Element },
        {
          id: 'decks-new-dialog',
          slot: config.dialogSlot,
          Component: NewDeckDialog as () => JSX.Element | null,
        },
      ],
    };
  },
});

export { DeckCatalog, ShellView } from './points';
export { DeckList } from './DeckList';
export { DecksView } from './DecksView';
export { NewDeckDialog } from './NewDeckDialog';
export * from './store';
export default DecksPlugin;
