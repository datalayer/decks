/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DECKS_ROUTE,
  clearDecks,
  deckAccessKey,
  deckById,
  deckId,
  deckPath,
  deckPrintPath,
  decksRoute,
  listDecks,
  registerDecks,
  resolveDeckRoute,
  resolveSlide,
  setDecksRoute,
  subscribeDecks,
  unregisterDeck,
  type DeckEntry,
} from '../registry/catalog';
import type { DeckSpec } from '../types';

const spec = (title: string): DeckSpec =>
  ({ deck: { title, template: 'datalayer' }, slides: [{ type: 'title', title }] }) as DeckSpec;

const startups: DeckEntry = { collection: 'startups', slug: 'seed', spec: spec('Seed') };
const investors: DeckEntry = { slug: 'investors', spec: spec('Investors') };

afterEach(() => {
  clearDecks();
  setDecksRoute(DECKS_ROUTE);
});

describe('the deck catalog', () => {
  it('starts empty and lists what is registered, in order', () => {
    expect(listDecks()).toEqual([]);
    registerDecks([startups, investors]);
    expect(listDecks().map(deckId)).toEqual(['startups/seed', 'investors']);
  });

  it('replaces an entry with the same id, so a server copy supersedes a bundled one', () => {
    registerDecks([investors]);
    const fromServer: DeckEntry = { ...investors, spec: spec('Investors, updated'), source: 'server' };
    registerDecks([fromServer]);
    expect(listDecks()).toHaveLength(1);
    expect(deckById('investors')?.spec.deck.title).toBe('Investors, updated');
  });

  it('undoes exactly what a registration added', () => {
    registerDecks([startups]);
    const undo = registerDecks([investors]);
    undo();
    expect(listDecks()).toEqual([startups]);
    unregisterDeck('startups/seed');
    expect(listDecks()).toEqual([]);
  });

  it('notifies subscribers on every change and not otherwise', () => {
    const listener = vi.fn();
    const off = subscribeDecks(listener);
    registerDecks([]);
    expect(listener).not.toHaveBeenCalled();
    registerDecks([startups]);
    unregisterDeck('nope');
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    clearDecks();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('builds addresses: family, standalone, slide, print', () => {
    expect(deckPath(startups)).toBe('/decks/startups/seed');
    expect(deckPath(investors, 1)).toBe('/decks/investors');
    expect(deckPath(investors, 4)).toBe('/decks/investors/4');
    expect(deckPrintPath(startups)).toBe('/decks/startups/seed/print');
    expect(deckPrintPath(investors, { variant: 'datalayer', colorMode: 'dark' })).toBe(
      '/decks/investors/print?theme=datalayer&mode=dark',
    );
  });

  it('builds addresses under the route a host sets, the print link included', () => {
    expect(decksRoute()).toBe('/decks');
    setDecksRoute('/visitors/decks');
    expect(decksRoute()).toBe('/visitors/decks');
    expect(deckPath(startups, 3)).toBe('/visitors/decks/startups/seed/3');
    expect(deckPrintPath(investors, { variant: 'loop', colorMode: 'light' })).toBe(
      '/visitors/decks/investors/print?theme=loop&mode=light',
    );
  });

  it('keeps the password key /decks/<id> whatever the route, so saved passwords survive a move', () => {
    expect(deckAccessKey(startups)).toBe('/decks/startups/seed');
    setDecksRoute('/visitors/decks');
    expect(deckAccessKey(startups)).toBe('/decks/startups/seed');
    expect(deckAccessKey(investors)).toBe('/decks/investors');
  });

  it('refuses a route that is not an absolute path of plain segments, and keeps the one it had', () => {
    setDecksRoute('/visitors/decks');
    for (const bad of ['', 'decks', '/', '/decks/', '//decks', '/decks?x=1', '/decks#a', '/de cks', 'https://x.io/decks']) {
      expect(() => setDecksRoute(bad)).toThrow(/absolute path/);
    }
    expect(() => setDecksRoute(undefined as unknown as string)).toThrow(/absolute path/);
    expect(decksRoute()).toBe('/visitors/decks');
  });

  it('resolves the ambiguous segments of an address against the catalog', () => {
    registerDecks([startups, investors]);
    expect(resolveDeckRoute('startups', 'seed', '3')).toEqual({ entry: startups, slideSegment: '3' });
    expect(resolveDeckRoute('investors', '2', undefined)).toEqual({ entry: investors, slideSegment: '2' });
    expect(resolveDeckRoute('nobody', 'home', undefined)).toEqual({});
  });

  it('clamps slide segments, and counts negative ones from the end', () => {
    expect(resolveSlide(undefined, 5)).toBe(1);
    expect(resolveSlide('3', 5)).toBe(3);
    expect(resolveSlide('9', 5)).toBe(5);
    expect(resolveSlide('-1', 5)).toBe(5);
    expect(resolveSlide('0', 5)).toBe(1);
    expect(resolveSlide('x', 5)).toBe(1);
    expect(resolveSlide('2', 0)).toBe(1);
  });
});
