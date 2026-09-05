/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/** The store's writes: what an agent's create/update/delete tools call. */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addDeck,
  configureDecksBackend,
  getDecksState,
  openDeck,
  presentOpenDeck,
  printOpenDeck,
  removeDeck,
  replaceDeck,
  resetDecksState,
} from '../plugin/store';
import { clearDecks, deckById, listDecks } from '../registry/catalog';
import type { DeckSpec } from '../types';

const spec = (title: string, slides = 3): DeckSpec =>
  ({
    deck: { title, template: 'datalayer' },
    slides: Array.from({ length: slides }, (_, i) => ({ type: 'section', title: `${title} ${i + 1}` })),
  }) as DeckSpec;

beforeEach(() => {
  resetDecksState();
  clearDecks();
});
afterEach(() => vi.unstubAllGlobals());

describe('addDeck', () => {
  it('registers, opens, and reports what validation noticed', async () => {
    const { entry, issues } = await addDeck({ collection: 'talks', slug: 'Hello World!', spec: spec('Hello') });
    expect(entry.slug).toBe('hello-world');
    expect(entry.source).toBe('session');
    expect(deckById('talks/hello-world')).toBe(entry);
    expect(getDecksState()).toMatchObject({ selected: 'talks/hello-world', slide: 1, creating: false });
    expect(issues).toEqual([]);
  });

  it('refuses what is not a deck, and can add without opening', async () => {
    await expect(addDeck({ slug: 'x', spec: { deck: {} } as never })).rejects.toThrow(/deck\.title/);
    await addDeck({ slug: 'quiet', spec: spec('Quiet') }, { open: false });
    expect(getDecksState().selected).toBeUndefined();
    expect(listDecks()).toHaveLength(1);
  });

  it('saves to the backend when there is one, and says so when it fails', async () => {
    const fetch = vi.fn(async () => new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', fetch);
    configureDecksBackend('http://backend/');
    const { entry } = await addDeck({ slug: 'saved', spec: spec('Saved') });
    expect(entry.source).toBe('server');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://backend/decks');
    expect(JSON.parse(init.body as string)).toMatchObject({ collection: '', slug: 'saved' });

    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    await addDeck({ slug: 'unsaved', spec: spec('Unsaved') });
    expect(deckById('unsaved')).toBeDefined();
    expect(getDecksState().error).toMatch(/was not saved/);
  });
});

describe('replaceDeck', () => {
  it('swaps the spec in place and keeps the reader on a slide that still exists', async () => {
    await addDeck({ slug: 'talk', spec: spec('Talk', 5) });
    openDeck('talk', 5);
    const { entry } = await replaceDeck('talk', { spec: spec('Talk, shorter', 2) });
    expect(entry.slug).toBe('talk');
    expect(deckById('talk')?.spec.deck.title).toBe('Talk, shorter');
    expect(getDecksState()).toMatchObject({ selected: 'talk', slide: 2 });
    expect(listDecks()).toHaveLength(1);
  });

  it('moves a deck when the input renames it, and follows it', async () => {
    await addDeck({ slug: 'old', spec: spec('Old') });
    await replaceDeck('old', { collection: 'archive', slug: 'new', spec: spec('New') });
    expect(deckById('old')).toBeUndefined();
    expect(deckById('archive/new')).toBeDefined();
    expect(getDecksState().selected).toBe('archive/new');
    await expect(replaceDeck('nope', { spec: spec('X') })).rejects.toThrow(/no deck nope/);
  });
});

describe('removeDeck', () => {
  it('forgets the deck and closes it if it was open', async () => {
    await addDeck({ slug: 'gone', spec: spec('Gone') });
    expect(await removeDeck('gone')).toBe(true);
    expect(deckById('gone')).toBeUndefined();
    expect(getDecksState().selected).toBeUndefined();
    expect(await removeDeck('gone')).toBe(false);
  });
});

describe('present and print', () => {
  it('do nothing without a deck on screen, and print opens the print address', async () => {
    expect(presentOpenDeck()).toBe(false);
    expect(printOpenDeck()).toBeUndefined();
    const open = vi.fn();
    vi.stubGlobal('open', open);
    await addDeck({ collection: 'c', slug: 'p', spec: spec('P') });
    expect(printOpenDeck()).toBe('/decks/c/p/print');
    expect(open).toHaveBeenCalledWith('/decks/c/p/print', '_blank', 'noopener');
  });
});
