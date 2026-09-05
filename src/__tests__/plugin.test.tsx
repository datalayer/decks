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
import { buildReactorFromPlugins, configurePlugin } from '@datalayer/reactor';
import { DECKS_COMMANDS, DECKS_PLUGIN_NAME, DecksPlugin, ShellView, type DecksPluginConfig } from '../plugin';
import { getDecksState, openDeck, resetDecksState, createDeck } from '../plugin/store';
import { clearDecks, deckById, listDecks, registerDecks, type DeckEntry } from '../registry/catalog';
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
    const reactor = await startReactor({ listSlot: 'left', slot: 'centre', dialogSlot: 'top' });
    const output = reactor.getOutput<Output>(DECKS_PLUGIN_NAME);
    expect(output?.components.map((c) => [c.id, c.slot])).toEqual([
      ['decks-list', 'left'],
      ['decks-view', 'centre'],
      ['decks-new-dialog', 'top'],
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
      keybindings: { list: 'Mod+L', create: '', open: '', goTo: '', next: 'Alt+ArrowRight', previous: 'Alt+ArrowLeft', present: 'F5', print: 'Mod+P' },
    });
    const commands = reactor.listCommands().filter((c) => c.plugin === DECKS_PLUGIN_NAME);
    expect(commands.map((c) => c.id).sort()).toEqual(Object.values(DECKS_COMMANDS).sort());
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

  it('opens a deck and goes to a slide from a command argument', async () => {
    const reactor = await startReactor();
    await reactor.executeCommand(DECKS_COMMANDS.open, { id: 'tests/three', slide: 2 });
    expect(getDecksState()).toMatchObject({ selected: 'tests/three', slide: 2 });
    await reactor.executeCommand(DECKS_COMMANDS.goTo, { slide: 3 });
    expect(getDecksState().slide).toBe(3);
    // Nonsense arguments change nothing rather than throwing.
    await reactor.executeCommand(DECKS_COMMANDS.open, {} as never);
    expect(getDecksState().selected).toBe('tests/three');
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
        return new Response(JSON.stringify({ id: 'talks/hello', slug: 'hello', collection: 'talks', spec }), { status: 201 });
      }
      return new Response(JSON.stringify([{ id: 'served/one', collection: 'served', slug: 'one', spec }]), { status: 200 });
    });
    vi.stubGlobal('fetch', fetch);
    await startReactor({ backendUrl: 'http://backend/' });
    await vi.waitFor(() => expect(deckById('served/one')?.source).toBe('server'));
    expect(fetch).toHaveBeenCalledWith('http://backend/decks');

    const made = await createDeck({ title: 'Hello, World!', collection: 'talks' });
    expect(made.slug).toBe('hello-world');
    expect(getDecksState()).toMatchObject({ selected: 'talks/hello-world', creating: false, slide: 1 });
    expect(listDecks().map((d) => d.slug)).toContain('hello-world');
    const [, init] = fetch.mock.calls.find(([, i]) => i?.method === 'POST')!;
    expect(JSON.parse(init!.body as string)).toMatchObject({ collection: 'talks', slug: 'hello-world' });
  });

  it('keeps the deck and reports when the backend is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await startReactor({ backendUrl: 'http://backend' });
    await vi.waitFor(() => expect(getDecksState().error).toMatch(/Could not load/));
    await createDeck({ title: 'Offline' });
    expect(deckById('offline')).toBeDefined();
    expect(getDecksState().error).toMatch(/was not saved/);
  });
});
