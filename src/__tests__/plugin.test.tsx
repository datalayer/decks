/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The plugin, driven the way a shell drives it: built into a platform,
 * started, and then asked what it registered and told to run its commands.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentTools, buildReactorFromPlugins, configurePlugin } from '@datalayer/reactor';
import {
  DECKS_AGENT_TOOLS,
  DECKS_COMMANDS,
  DECKS_DATA_COMMANDS,
  DECKS_PLUGIN_NAME,
  DecksPlugin,
  ShellView,
  type DecksPluginConfig,
} from '../plugin';
import { getDecksState, openDeck, resetDecksState, createDeck } from '../plugin/store';
import {
  clearDecks,
  deckById,
  listDecks,
  registerDecks,
  type DeckEntry,
} from '../registry/catalog';
import type { DeckSpec } from '../types';

const spec: DeckSpec = {
  deck: { title: 'Three slides', template: 'datalayer' },
  slides: [
    { type: 'title', title: 'One' },
    { type: 'section', title: 'Two' },
    { type: 'section', title: 'Three' },
  ],
} as DeckSpec;
const entry: DeckEntry = { collection: 'tests', slug: 'three', spec };

type Output = { components: Array<{ id: string; slot: string }> };

const startReactor = async (config: Partial<DecksPluginConfig> = {}) => {
  const reactor = buildReactorFromPlugins([configurePlugin(DecksPlugin, config)]);
  reactor.start();
  await reactor.whenReady();
  return reactor;
};

beforeEach(() => {
  resetDecksState();
  clearDecks();
  registerDecks([entry]);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('DecksPlugin', () => {
  it('renders its list, view and dialog in the configured slots', async () => {
    const reactor = await startReactor({
      listSlot: 'left',
      slot: 'centre',
      dialogSlot: 'top',
    });
    const output = reactor.getOutput<Output>(DECKS_PLUGIN_NAME);
    expect(output?.components.map((c) => [c.id, c.slot])).toEqual([
      ['decks-list', 'left'],
      ['decks-view', 'centre'],
      ['decks-dialogs', 'top'],
    ]);
  });

  it('joins the shell view selector, unless told not to', async () => {
    const withView = await startReactor();
    expect(withView.getContributions(ShellView).map((c) => c.value)).toEqual([
      { id: 'decks', title: 'Decks', order: 40 },
    ]);
    const without = await startReactor({ shellView: false });
    expect(without.getContributions(ShellView)).toEqual([]);
  });

  it('registers every command with the configured keystrokes', async () => {
    const reactor = await startReactor({
      keybindings: {
        list: 'Mod+L',
        create: '',
        open: '',
        goTo: '',
        rename: 'F2',
        remove: '',
        next: 'Alt+ArrowRight',
        previous: 'Alt+ArrowLeft',
        present: 'F5',
        print: 'Mod+P',
      },
    });
    const commands = reactor.listCommands().filter((c) => c.plugin === DECKS_PLUGIN_NAME);
    expect(commands.map((c) => c.id).sort()).toEqual(
      [...Object.values(DECKS_COMMANDS), ...Object.values(DECKS_DATA_COMMANDS)].sort(),
    );
    const byId = Object.fromEntries(commands.map((c) => [c.id, c.keybinding]));
    expect(byId[DECKS_COMMANDS.list]).toBe('Mod+L');
    expect(byId[DECKS_COMMANDS.create]).toBeUndefined();
    expect(byId[DECKS_COMMANDS.present]).toBe('F5');
  });

  it('moves through the open deck and back to the list from the commands', async () => {
    const reactor = await startReactor();
    openDeck('tests/three');
    await reactor.executeCommand(DECKS_COMMANDS.next);
    await reactor.executeCommand(DECKS_COMMANDS.next);
    await reactor.executeCommand(DECKS_COMMANDS.next); // clamps at the last slide
    expect(getDecksState().slide).toBe(3);
    await reactor.executeCommand(DECKS_COMMANDS.previous);
    expect(getDecksState().slide).toBe(2);
    await reactor.executeCommand(DECKS_COMMANDS.list);
    expect(getDecksState()).toMatchObject({ selected: undefined, slide: 1 });
    await reactor.executeCommand(DECKS_COMMANDS.create);
    expect(getDecksState().creating).toBe(true);
  });

  it('declares its agent tools, one per command an agent may call', async () => {
    const reactor = await startReactor();
    const [bundle] = reactor.getContributions(AgentTools).map((c) => c.value);
    expect(bundle).toBe(DECKS_AGENT_TOOLS);
    const commandIds = new Set(reactor.listCommands().map((c) => c.id));
    for (const tool of bundle.commands) {
      expect(commandIds.has(tool.command), tool.command).toBe(true);
    }
    expect(bundle.toolset).toEqual(bundle.commands.map((c) => c.name));
  });

  it('opens a deck and goes to a slide from a command argument', async () => {
    const reactor = await startReactor();
    await reactor.executeCommand(DECKS_COMMANDS.open, {
      id: 'tests/three',
      slide: 2,
    });
    expect(getDecksState()).toMatchObject({
      selected: 'tests/three',
      slide: 2,
    });
    await reactor.executeCommand(DECKS_COMMANDS.goTo, { slide: 3 });
    expect(getDecksState().slide).toBe(3);
    // Nonsense arguments change nothing rather than throwing.
    await reactor.executeCommand(DECKS_COMMANDS.open, {} as never);
    expect(getDecksState().selected).toBe('tests/three');
  });

  it('opens the rename and delete dialogs for the open deck, or the one named', async () => {
    const reactor = await startReactor();
    await reactor.executeCommand(DECKS_COMMANDS.rename);
    expect(getDecksState().renaming).toBeUndefined(); // nothing open, nothing named
    openDeck('tests/three');
    await reactor.executeCommand(DECKS_COMMANDS.rename);
    expect(getDecksState().renaming).toBe('tests/three');
    await reactor.executeCommand(DECKS_COMMANDS.remove, { id: 'tests/three' });
    expect(getDecksState().deleting).toBe('tests/three');
    await reactor.executeCommand(DECKS_COMMANDS.remove, { id: 'nope' });
    expect(getDecksState().deleting).toBe('tests/three');
  });

  it('opens the print view of the open deck in a new tab', async () => {
    const reactor = await startReactor();
    const open = vi.fn();
    vi.stubGlobal('open', open);
    await reactor.executeCommand(DECKS_COMMANDS.print);
    expect(open).not.toHaveBeenCalled();
    openDeck('tests/three');
    await reactor.executeCommand(DECKS_COMMANDS.print);
    expect(open).toHaveBeenCalledWith('/decks/tests/three/print', '_blank', 'noopener');
  });

  it('loads the backend catalog on start and saves a new deck to it', async () => {
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            id: 'talks/hello',
            slug: 'hello',
            collection: 'talks',
            spec,
          }),
          { status: 201 },
        );
      }
      return new Response(
        JSON.stringify([{ id: 'served/one', collection: 'served', slug: 'one', spec }]),
        { status: 200 },
      );
    });
    vi.stubGlobal('fetch', fetch);
    await startReactor({ backendUrl: 'http://backend/' });
    await vi.waitFor(() => expect(deckById('served/one')?.source).toBe('server'));
    expect(fetch).toHaveBeenCalledWith('http://backend/decks');

    const made = await createDeck({
      title: 'Hello, World!',
      collection: 'talks',
    });
    expect(made.slug).toBe('hello-world');
    expect(getDecksState()).toMatchObject({
      selected: 'talks/hello-world',
      creating: false,
      slide: 1,
    });
    expect(listDecks().map((d) => d.slug)).toContain('hello-world');
    const [, init] = fetch.mock.calls.find(([, i]) => i?.method === 'POST')!;
    expect(JSON.parse(init!.body as string)).toMatchObject({
      collection: 'talks',
      slug: 'hello-world',
    });
  });

  it('keeps the deck and reports when the backend is down', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    await startReactor({ backendUrl: 'http://backend' });
    await vi.waitFor(() => expect(getDecksState().error).toMatch(/Could not load/));
    await createDeck({ title: 'Offline' });
    expect(deckById('offline')).toBeDefined();
    expect(getDecksState().error).toMatch(/was not saved/);
  });
});

describe('the data commands', () => {
  const run = <R,>(
    reactor: ReturnType<typeof buildReactorFromPlugins>,
    id: string,
    argument?: unknown,
  ) => reactor.executeCommand<unknown, R>(id, argument);

  it('list, read, create, replace and delete decks, answering the caller', async () => {
    const reactor = await startReactor();
    expect(
      await run<{ id: string; slides: number }[]>(reactor, DECKS_DATA_COMMANDS.listDecks),
    ).toEqual([
      expect.objectContaining({
        id: 'tests/three',
        title: 'Three slides',
        slides: 3,
      }),
    ]);
    const read = await run<{ outline: unknown[]; spec: DeckSpec }>(
      reactor,
      DECKS_DATA_COMMANDS.getDeck,
      {
        id: 'tests/three',
      },
    );
    expect(read.outline).toEqual([
      { slide: 1, type: 'title', title: 'One' },
      { slide: 2, type: 'section', title: 'Two' },
      { slide: 3, type: 'section', title: 'Three' },
    ]);
    const made = await run<{ id: string; issues: string[] }>(
      reactor,
      DECKS_DATA_COMMANDS.createDeck,
      {
        collection: 'talks',
        slug: 'Hello, World',
        spec: {
          deck: { title: 'Hello' },
          slides: [{ type: 'section', title: 'Hi' }],
        },
      },
    );
    expect(made).toMatchObject({
      id: 'talks/hello-world',
      slides: 1,
      issues: [],
    });
    // Made, and on screen: a create that left the deck closed would look like nothing happened.
    expect(getDecksState().selected).toBe('talks/hello-world');
    const replaced = await run<{ id: string; slides: number }>(
      reactor,
      DECKS_DATA_COMMANDS.updateDeck,
      {
        id: 'talks/hello-world',
        slug: 'hello-world',
        spec: {
          deck: { title: 'Hello, again' },
          slides: [
            { type: 'section', title: 'Hi' },
            { type: 'section', title: 'Bye' },
          ],
        },
      },
    );
    expect(replaced).toMatchObject({
      id: 'talks/hello-world',
      title: 'Hello, again',
      slides: 2,
    });
    expect(
      await run(reactor, DECKS_DATA_COMMANDS.deleteDeck, {
        id: 'talks/hello-world',
      }),
    ).toEqual({
      ok: true,
      id: 'talks/hello-world',
    });
    expect(deckById('talks/hello-world')).toBeUndefined();
  });

  it('edit one slide at a time and open the deck where the edit landed', async () => {
    const reactor = await startReactor();
    const updated = await run<{ outline: { type: string }[] }>(
      reactor,
      DECKS_DATA_COMMANDS.updateSlide,
      {
        id: 'tests/three',
        slide: 2,
        slide_spec: { type: 'two-columns', title: 'Compared' },
      },
    );
    expect(updated.outline.map((o) => o.type)).toEqual(['title', 'two-columns', 'section']);
    expect(getDecksState()).toMatchObject({
      selected: 'tests/three',
      slide: 2,
    });
    const inserted = await run<{ outline: { slide: number; title: string }[] }>(
      reactor,
      DECKS_DATA_COMMANDS.insertSlide,
      {
        id: 'tests/three',
        slide: 99,
        slide_spec: { type: 'statement', statement: 'Fin' },
      },
    );
    expect(inserted.outline.at(-1)).toEqual({
      slide: 4,
      type: 'statement',
      title: 'Fin',
    });
    expect(getDecksState().slide).toBe(4);
    const deleted = await run<{ slides: number }>(reactor, DECKS_DATA_COMMANDS.deleteSlide, {
      id: 'tests/three',
      slide: 1,
    });
    expect(deleted.slides).toBe(3);
    await expect(
      run(reactor, DECKS_DATA_COMMANDS.updateSlide, {
        id: 'tests/three',
        slide: 9,
        slide_spec: {},
      }),
    ).rejects.toThrow(/no slide 9/);
  });

  it('answer a bad argument with a sentence the caller can act on', async () => {
    const reactor = await startReactor();
    await expect(run(reactor, DECKS_DATA_COMMANDS.getDeck, {})).rejects.toThrow(/Which deck/);
    expect(await run(reactor, DECKS_COMMANDS.open, { id: 'nope' })).toMatchObject({
      ok: false,
      error: /no deck nope/,
    });
    await expect(
      run(reactor, DECKS_DATA_COMMANDS.createDeck, {
        slug: 'x',
        spec: { deck: {} },
      }),
    ).rejects.toThrow(/deck\.title/);
    // The screen commands the browser has a say in answer rather than throw.
    expect(await run(reactor, DECKS_COMMANDS.present)).toMatchObject({
      ok: false,
      error: /No deck/,
    });
    expect(await run(reactor, DECKS_COMMANDS.print)).toMatchObject({
      ok: false,
      error: /No deck/,
    });
    expect(await run(reactor, DECKS_COMMANDS.open, { id: 'tests/three', slide: 2 })).toEqual({
      ok: true,
      id: 'tests/three',
      slide: 2,
    });
    expect(await run(reactor, DECKS_COMMANDS.next)).toEqual({
      ok: true,
      slide: 3,
    });
  });
});
