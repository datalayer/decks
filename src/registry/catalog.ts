/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The decks a host knows about, as a live catalog.
 *
 * The landing kept its decks in a static array beside their specs. Here the
 * array is a store: a host registers the decks it ships, a plugin registers
 * the ones it fetched from a server, a "new deck" dialog registers the one it
 * just made — and everything that lists decks re-renders. The definitions
 * themselves stay wherever they were written; this only knows they exist.
 *
 * A deck of a family is `<route>/startups/x`, one that stands alone is
 * `<route>/investors`, a slide is a trailing number. The route is `/decks`
 * unless the host says otherwise with `setDecksRoute` — the landing serves its
 * presentations under `/visitors/decks`.
 *
 * @module registry/catalog
 */

import type { DeckSpec } from '../types';

/** The engine's own route prefix, the one its app and server serve. */
export const DECKS_ROUTE = '/decks';

let route = DECKS_ROUTE;

/**
 * Where this host serves its decks: what `deckPath`, `deckPrintPath` and the
 * print command build on. Call it once, before anything builds an address.
 *
 * Throws on a prefix that is not an absolute path of plain segments —
 * `/visitors/decks`, never `decks`, `/decks/`, `//decks` or one with a query —
 * rather than build addresses that go nowhere.
 */
export const setDecksRoute = (prefix: string): void => {
  if (typeof prefix !== 'string' || !/^(\/[A-Za-z0-9._~-]+)+$/.test(prefix)) {
    throw new Error(
      `The decks route must be an absolute path such as "/visitors/decks", not ${JSON.stringify(prefix)}.`,
    );
  }
  route = prefix;
};

/** The route prefix in use: `DECKS_ROUTE` unless a host set another. */
export const decksRoute = (): string => route;

export type DeckEntry = {
  /** A family of decks, for the address and for grouping. Optional. */
  collection?: string;
  slug: string;
  spec: DeckSpec;
  /**
   * Where it came from, for a list that wants to say. `bundled` is the
   * host's own code, `server` a backend, `session` something made just now.
   */
  source?: 'bundled' | 'server' | 'session';
};

/** The stable identity of an entry: its address without the route prefix. */
export const deckId = (entry: Pick<DeckEntry, 'collection' | 'slug'>): string =>
  entry.collection ? `${entry.collection}/${entry.slug}` : entry.slug;

let entries: DeckEntry[] = [];
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((listener) => listener());

/** Every deck registered, in registration order. A fresh array per change. */
export const listDecks = (): DeckEntry[] => entries;

/**
 * Register decks. An entry whose id is already known replaces the old one, so
 * a server's copy can supersede a bundled placeholder. Returns an undo that
 * removes exactly what was added.
 */
export const registerDecks = (added: DeckEntry[]): (() => void) => {
  if (added.length === 0) {
    return () => undefined;
  }
  const ids = new Set(added.map(deckId));
  entries = [...entries.filter((entry) => !ids.has(deckId(entry))), ...added];
  emit();
  return () => {
    entries = entries.filter((entry) => !added.includes(entry));
    emit();
  };
};

export const unregisterDeck = (id: string): void => {
  const before = entries.length;
  entries = entries.filter((entry) => deckId(entry) !== id);
  if (entries.length !== before) {
    emit();
  }
};

/** Forget everything. For tests, and for a host that reloads its catalog. */
export const clearDecks = (): void => {
  entries = [];
  emit();
};

export const subscribeDecks = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const deckPath = (
  entry: Pick<DeckEntry, 'collection' | 'slug'>,
  slide?: number,
): string => {
  const base = `${route}/${deckId(entry)}`;
  return slide && slide > 1 ? `${base}/${slide}` : base;
};

/**
 * The key a deck's remembered password is kept under: `/decks/<id>`, whatever
 * the route. An identity, not an address — it was the address when the route
 * was fixed, and a host that moves its route must not forget every password
 * its readers saved.
 */
export const deckAccessKey = (entry: Pick<DeckEntry, 'collection' | 'slug'>): string =>
  `${DECKS_ROUTE}/${deckId(entry)}`;

/** A slide number from an address segment: `9`, `-1` for the last, else 1. */
export const resolveSlide = (segment: string | undefined, total: number): number => {
  if (total < 1) {
    return 1;
  }
  const n = segment && /^-?\d+$/.test(segment) ? Number(segment) : NaN;
  if (!Number.isFinite(n) || n === 0) {
    return 1;
  }
  const fromEnd = n < 0 ? total + n + 1 : n;
  return Math.min(Math.max(fromEnd, 1), total);
};

export const deckPrintPath = (
  entry: Pick<DeckEntry, 'collection' | 'slug'>,
  theme?: { variant?: string; colorMode?: string },
): string => {
  const query = new URLSearchParams();
  if (theme?.variant) {
    query.set('theme', theme.variant);
  }
  if (theme?.colorMode) {
    query.set('mode', theme.colorMode);
  }
  const search = query.toString();
  return `${deckPath(entry)}/print${search ? `?${search}` : ''}`;
};

export const deckAt = (
  collection: string | undefined,
  slug: string | undefined,
): DeckEntry | undefined =>
  entries.find((entry) => entry.collection === collection && entry.slug === slug);

export const deckById = (id: string): DeckEntry | undefined =>
  entries.find((entry) => deckId(entry) === id);

/**
 * Resolve the ambiguous segments of a deck address against the catalog.
 *
 * `<route>/a/b` is either a family and a deck, or a deck and a slide; a router
 * pattern cannot tell them apart and the catalog can. The nested reading wins
 * when it exists, so a family whose name is also a standalone deck's slide
 * number is the one case this cannot serve — and nobody names a family `9`.
 */
export const resolveDeckRoute = (
  first: string | undefined,
  second: string | undefined,
  third: string | undefined,
): { entry?: DeckEntry; slideSegment?: string } => {
  const nested = deckAt(first, second);
  if (nested) {
    return { entry: nested, slideSegment: third };
  }
  const standalone = deckAt(undefined, first);
  if (standalone) {
    return { entry: standalone, slideSegment: second };
  }
  return {};
};
