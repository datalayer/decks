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
 *   "New deck" button and, on each row, rename and delete;
 * - **a view** that shows the open deck — the same `DeckView` the landing page
 *   uses — in the main slot, and joins the shell's view selector as "Decks";
 * - **commands**: list, new, open, go to slide, next and previous slide,
 *   present and print — with keystrokes where a keystroke makes sense — so a
 *   palette, a keyboard or an agent drives a deck without a mouse; and the
 *   plugin's data as commands too — list, read, create, replace, edit a
 *   slide, delete — each answering with a value. What an agent may call,
 *   data and screen alike, is declared as one `AgentTools` bundle, by this
 *   plugin: no agent's own specification names a deck tool.
 *
 * Where decks come from is not the plugin's business, and it accepts them
 * three ways: a host registers them (`registerDecks`), another plugin
 * contributes them (`DeckCatalog`), or a backend lists them (`backendUrl`,
 * which is also where a new deck is saved). All three land in one catalog.
 *
 * @module plugin
 */

import type { JSX } from 'react';
import { AgentTools, contribution, definePlugin } from '@datalayer/reactor';
import type { ReactorReactOutput } from '@datalayer/reactor/react';
import { DeckList } from './DeckList';
import { DeckDialogs } from './DeckDialogs';
import { DecksView } from './DecksView';
import { DeckCatalog, ShellView } from './points';
import { DECKS_COMMANDS, DECKS_DATA_COMMANDS } from './commands';
import { DECKS_AGENT_TOOLS } from './agentTools';
import { deckById, deckId, listDecks } from '../registry/catalog';
import type { DeckSpec, SlideSpec } from '../types';
import {
  deckDetails,
  deckSummary,
  describeWrite,
  existingDeck,
  idOf,
  slideOf,
  textOf,
  type DeckDetails,
  type DeckSummary,
  type DeckWritten,
} from './answers';
import {
  addDeck,
  beginDelete,
  beginNewDeck,
  beginRename,
  closeDeck,
  configureDecksBackend,
  deleteSlide,
  getDecksState,
  goToSlide,
  insertSlide,
  loadDecksFromBackend,
  nextSlide,
  openDeck,
  presentOpenDeck,
  previousSlide,
  printOpenDeck,
  removeDeck,
  replaceDeck,
  updateSlide,
} from './store';

/** What a screen command answers: it ran, or why it could not. */
type Outcome = {
  ok: boolean;
  slide?: number;
  error?: string;
  [key: string]: unknown;
};

export const DECKS_PLUGIN_NAME = '@datalayer/decks';

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
      rename: 'F2',
      remove: '',
      next: 'Alt+ArrowRight',
      previous: 'Alt+ArrowLeft',
      present: 'Mod+Shift+F',
      print: 'Mod+Shift+P',
    },
  },
  contributionPoints: [DeckCatalog],
  // What an agent may do with this plugin, declared by the plugin: see
  // `agentTools.ts`. A host reads the reactor's `AgentTools` point; the agent's
  // own spec names no deck command.
  contributes: [contribution(AgentTools, DECKS_AGENT_TOOLS, { id: 'decks' })],
  register: ({ config, registerCommand }) => {
    const undo = [
      registerCommand<void, Outcome>({
        id: DECKS_COMMANDS.list,
        name: 'Show the decks',
        description: 'Close the open deck and show the list',
        category: 'Decks',
        emoji: '\u{1F4CA}',
        keybinding: config.keybindings.list || undefined,
        execute: () => {
          closeDeck();
          return { ok: true, decks: listDecks().map(deckSummary) };
        },
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
      registerCommand<{ id?: string } | undefined>({
        id: DECKS_COMMANDS.rename,
        name: 'Rename the deck',
        description: 'A new title or address for the open deck, or the one named',
        category: 'Decks',
        keybinding: config.keybindings.rename || undefined,
        execute: (argument) => beginRename(argument?.id),
      }),
      registerCommand<{ id?: string } | undefined>({
        id: DECKS_COMMANDS.remove,
        name: 'Delete the deck',
        description: 'Remove the open deck, or the one named, after asking',
        category: 'Decks',
        keybinding: config.keybindings.remove || undefined,
        execute: (argument) => beginDelete(argument?.id),
      }),
      registerCommand<{ id: string; slide?: number } | undefined, Outcome>({
        id: DECKS_COMMANDS.open,
        name: 'Open a deck',
        description: 'Open a deck by id — `collection/slug` or `slug` — optionally at a slide',
        category: 'Decks',
        keybinding: config.keybindings.open || undefined,
        execute: (argument) => {
          // Answers rather than throws: the palette and a host call this with
          // nothing, and an agent reads `error` as readily as a rejection.
          const id = textOf(argument?.id);
          if (!id) {
            return {
              ok: false,
              error: 'Which deck? Pass its `id`, as listed by decks_list_decks.',
            };
          }
          if (!deckById(id)) {
            return { ok: false, error: `There is no deck ${id}.` };
          }
          openDeck(id, argument?.slide ?? 1);
          return { ok: true, id, slide: getDecksState().slide };
        },
      }),
      registerCommand<{ slide: number } | undefined, Outcome>({
        id: DECKS_COMMANDS.goTo,
        name: 'Go to slide',
        description: 'Move the open deck to a slide number',
        category: 'Decks',
        keybinding: config.keybindings.goTo || undefined,
        execute: (argument) => {
          if (typeof argument?.slide !== 'number') {
            return {
              ok: false,
              error: "Pass the 1-based `slide` number, from the deck's outline.",
            };
          }
          goToSlide(argument.slide);
          return { ok: true, slide: getDecksState().slide };
        },
      }),
      registerCommand<void, Outcome>({
        id: DECKS_COMMANDS.next,
        name: 'Next slide',
        category: 'Decks',
        keybinding: config.keybindings.next || undefined,
        execute: () => {
          nextSlide();
          return { ok: true, slide: getDecksState().slide };
        },
      }),
      registerCommand<void, Outcome>({
        id: DECKS_COMMANDS.previous,
        name: 'Previous slide',
        category: 'Decks',
        keybinding: config.keybindings.previous || undefined,
        execute: () => {
          previousSlide();
          return { ok: true, slide: getDecksState().slide };
        },
      }),
      // The two the browser has a say in answer with what happened rather
      // than throwing: a keystroke with no deck open is not an error worth a
      // stack trace, and an agent reads `error` as readily as a rejection.
      registerCommand<void, Outcome>({
        id: DECKS_COMMANDS.present,
        name: 'Present',
        description: 'The open deck, fullscreen',
        category: 'Decks',
        keybinding: config.keybindings.present || undefined,
        execute: async () => {
          const state = await presentOpenDeck();
          if (state === 'none') {
            return {
              ok: false,
              state,
              error: 'No deck is on screen to present. Open one first.',
            };
          }
          if (state === 'blocked') {
            return {
              ok: false,
              state,
              error:
                'The browser allows fullscreen only from a click: ask the person to press F or the Present button.',
            };
          }
          return { ok: true, state };
        },
      }),
      registerCommand<void, Outcome>({
        id: DECKS_COMMANDS.print,
        name: 'Print to PDF',
        description: 'Open the print view of the open deck',
        category: 'Decks',
        keybinding: config.keybindings.print || undefined,
        execute: () => {
          const printed = printOpenDeck();
          if (!printed) {
            return { ok: false, error: 'No deck is open to print.' };
          }
          return printed.opened
            ? { ok: true, path: printed.path }
            : {
                ok: false,
                path: printed.path,
                error: 'The browser blocked the new tab: give the person the address to open.',
              };
        },
      }),
      /*
       * The data, as commands. Each answers with what the model needs next —
       * a list, a spec and an outline, the deck as it now is — and a missing
       * or wrong argument throws a sentence it can act on. Writes open the
       * deck where they landed, so a change is on screen and not only saved.
       * They are listed by a palette like any command, and ask for an
       * argument there.
       */
      registerCommand<void, DeckSummary[]>({
        id: DECKS_DATA_COMMANDS.listDecks,
        name: 'List the decks',
        description: 'Every deck in the catalog: id, title, slide count',
        category: 'Decks',
        execute: () => listDecks().map(deckSummary),
      }),
      registerCommand<{ id: string } | undefined, DeckDetails>({
        id: DECKS_DATA_COMMANDS.getDeck,
        name: 'Read a deck',
        description: "A deck's spec and outline, by id",
        category: 'Decks',
        execute: (argument) => deckDetails(existingDeck(idOf(argument))),
      }),
      registerCommand<
        { slug?: string; collection?: string; spec: DeckSpec } | undefined,
        DeckWritten
      >({
        id: DECKS_DATA_COMMANDS.createDeck,
        name: 'Create a deck',
        description: 'A deck from a complete spec, under a slug, opened',
        category: 'Decks',
        execute: async (argument) =>
          describeWrite(
            await addDeck({
              collection: textOf(argument?.collection),
              slug: textOf(argument?.slug) ?? '',
              spec: argument?.spec as DeckSpec,
            }),
          ),
      }),
      registerCommand<
        { id: string; slug?: string; collection?: string; spec: DeckSpec } | undefined,
        DeckWritten
      >({
        id: DECKS_DATA_COMMANDS.updateDeck,
        name: 'Replace a deck',
        description: "A deck's whole record — collection, slug, spec — by id",
        category: 'Decks',
        execute: async (argument) => {
          const id = idOf(argument);
          const result = await replaceDeck(id, {
            collection: textOf(argument?.collection),
            slug: textOf(argument?.slug),
            spec: argument?.spec as DeckSpec,
          });
          const next = deckId(result.entry);
          const state = getDecksState();
          openDeck(next, state.selected === next ? state.slide : 1);
          return describeWrite(result);
        },
      }),
      registerCommand<
        { id: string; slide: number; slide_spec: SlideSpec } | undefined,
        DeckWritten
      >({
        id: DECKS_DATA_COMMANDS.updateSlide,
        name: 'Replace a slide',
        description: 'One slide of a deck, by its 1-based number',
        category: 'Decks',
        execute: async (argument) =>
          describeWrite(
            await updateSlide(idOf(argument), slideOf(argument), argument?.slide_spec as SlideSpec),
          ),
      }),
      registerCommand<
        { id: string; slide: number; slide_spec: SlideSpec } | undefined,
        DeckWritten
      >({
        id: DECKS_DATA_COMMANDS.insertSlide,
        name: 'Insert a slide',
        description: 'A slide before the given 1-based position; past the end appends',
        category: 'Decks',
        execute: async (argument) =>
          describeWrite(
            await insertSlide(idOf(argument), slideOf(argument), argument?.slide_spec as SlideSpec),
          ),
      }),
      registerCommand<{ id: string; slide: number } | undefined, DeckWritten>({
        id: DECKS_DATA_COMMANDS.deleteSlide,
        name: 'Delete a slide',
        description: 'Remove one slide of a deck, by its 1-based number',
        category: 'Decks',
        execute: async (argument) =>
          describeWrite(await deleteSlide(idOf(argument), slideOf(argument))),
      }),
      registerCommand<{ id: string } | undefined, { ok: true; id: string }>({
        id: DECKS_DATA_COMMANDS.deleteDeck,
        name: 'Delete a deck now',
        description: 'Remove a deck by id, without asking — the palette\'s "Delete the deck" asks',
        category: 'Decks',
        execute: async (argument) => {
          const id = idOf(argument);
          if (!(await removeDeck(id))) {
            throw new Error(`There is no deck ${id}.`);
          }
          return { ok: true, id };
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
        {
          id: 'decks-view',
          slot: config.slot,
          Component: DecksView as () => JSX.Element,
        },
        {
          id: 'decks-dialogs',
          slot: config.dialogSlot,
          Component: DeckDialogs as () => JSX.Element | null,
        },
      ],
    };
  },
});

export { DeckCatalog, ShellView } from './points';
export { DECKS_COMMANDS, DECKS_DATA_COMMANDS } from './commands';
export { DECKS_AGENT_TOOLS } from './agentTools';
export * from './answers';
export { DeckList } from './DeckList';
export { DecksView } from './DecksView';
export { NewDeckDialog } from './NewDeckDialog';
export { DeckDialogs, RenameDeckDialog, DeleteDeckDialog } from './DeckDialogs';
export * from './store';
export default DecksPlugin;
