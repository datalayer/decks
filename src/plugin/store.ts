/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * What the decks plugin remembers: which deck is open, at which slide, and
 * whether the "new deck" dialog is up.
 *
 * A plain external store rather than React state, because commands run from
 * outside React — the palette, a keystroke — and the store is what they
 * change. Components subscribe with `useSyncExternalStore`.
 *
 * The catalog itself lives in `registry/catalog`: this store only points into
 * it. Creating a deck registers it there (source `session`) and, when the
 * plugin was given a backend, saves it through the API so it is there after a
 * refresh.
 *
 * @module plugin/store
 */

import { useSyncExternalStore } from 'react';
import {
  deckById,
  deckId,
  deckPrintPath,
  listDecks,
  registerDecks,
  subscribeDecks,
  unregisterDeck,
  type DeckEntry,
} from '../registry/catalog';
import type { DeckSpec, SlideSpec } from '../types';
import { validateDeck, type DeckIssue } from '../validation';

export type DecksState = {
  /** The id of the open deck, or none — the list is shown instead. */
  selected?: string;
  /** 1-based slide of the open deck. */
  slide: number;
  /** Whether the "new deck" dialog is on screen. */
  creating: boolean;
  /** Where decks are saved and loaded, when the plugin was given one. */
  backendUrl?: string;
  /** The last thing the backend said that went wrong, for the list to show. */
  error?: string;
};

let state: DecksState = { slide: 1, creating: false };
const listeners = new Set<() => void>();

const set = (patch: Partial<DecksState>): void => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
};

export const getDecksState = (): DecksState => state;

export const subscribeDecksState = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useDecksState = (): DecksState =>
  useSyncExternalStore(subscribeDecksState, getDecksState, getDecksState);

/** The catalog, live. */
export const useDeckEntries = (): DeckEntry[] =>
  useSyncExternalStore(subscribeDecks, listDecks, listDecks);

/** The open deck's entry, if the id still resolves. */
export const useOpenDeck = (): DeckEntry | undefined => {
  const { selected } = useDecksState();
  useDeckEntries();
  return selected ? deckById(selected) : undefined;
};

export const openDeck = (id: string, slide = 1): void => set({ selected: id, slide });
export const closeDeck = (): void => set({ selected: undefined, slide: 1 });
export const goToSlide = (slide: number): void => set({ slide: Math.max(1, slide) });
export const nextSlide = (): void => {
  const entry = state.selected ? deckById(state.selected) : undefined;
  const total = entry?.spec.slides.length ?? 0;
  set({ slide: Math.min(total || 1, state.slide + 1) });
};
export const previousSlide = (): void => set({ slide: Math.max(1, state.slide - 1) });
export const beginNewDeck = (): void => set({ creating: true });
export const cancelNewDeck = (): void => set({ creating: false });
export const configureDecksBackend = (backendUrl: string | undefined): void =>
  set({ backendUrl: backendUrl?.replace(/\/+$/, '') || undefined });

/** For tests: back to the first frame. */
export const resetDecksState = (): void => {
  state = { slide: 1, creating: false };
  listeners.forEach((listener) => listener());
};

/** A URL-safe slug from a title: what the address and the file are named. */
export const slugify = (title: string): string =>
  title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'deck';

export type NewDeckInput = {
  title: string;
  subtitle?: string;
  template?: string;
  collection?: string;
};

/**
 * The spec a new deck starts as: a title slide and one section to replace.
 *
 * Small on purpose. A deck is written as data, and the useful thing a "new"
 * command can do is produce a valid document with the author's title on it —
 * not guess at content.
 */
export const newDeckSpec = ({ title, subtitle, template }: NewDeckInput): DeckSpec => {
  const slides: SlideSpec[] = [
    { type: 'title', title, subtitle, meta: new Date().toISOString().slice(0, 10) },
    { type: 'section', title: 'First section' },
    {
      type: 'bullets',
      title: 'Where to start',
      items: ['Replace this slide', 'Add a `metrics` or `chart` slide', 'Present with `f`'],
    },
  ];
  return {
    deck: { title, subtitle, template: template ?? 'datalayer', transition: 'slide' },
    slides,
  } as DeckSpec;
};

/** What the backend stores and returns for one deck. */
export type DeckRecord = { id: string; collection?: string; slug: string; spec: DeckSpec };

const toEntry = (record: DeckRecord): DeckEntry => ({
  collection: record.collection || undefined,
  slug: record.slug,
  spec: record.spec,
  source: 'server',
});

/** Pull every deck the backend has into the catalog. Quiet when there is none. */
export const loadDecksFromBackend = async (): Promise<DeckEntry[]> => {
  const base = state.backendUrl;
  if (!base) {
    return [];
  }
  try {
    const response = await fetch(`${base}/decks`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const records = (await response.json()) as DeckRecord[];
    const entries = records.map(toEntry);
    registerDecks(entries);
    set({ error: undefined });
    return entries;
  } catch (error) {
    set({ error: `Could not load decks from ${base}: ${String(error)}` });
    return [];
  }
};

/** What a deck is made from: where it goes, and what it says. */
export type DeckInput = {
  collection?: string;
  slug: string;
  spec: DeckSpec;
};

/** What adding or replacing a deck answers with. */
export type DeckWriteResult = {
  entry: DeckEntry;
  /** What validation noticed. Advisory: the deck is registered regardless. */
  issues: DeckIssue[];
};

const assertSpec = (spec: unknown): DeckSpec => {
  const candidate = spec as DeckSpec | undefined;
  if (
    !candidate ||
    typeof candidate !== 'object' ||
    typeof candidate.deck?.title !== 'string' ||
    !Array.isArray(candidate.slides)
  ) {
    throw new Error('A deck spec needs `deck.title` and a `slides` array.');
  }
  return candidate;
};

/**
 * Save through the API when the plugin was given one; report, never throw.
 *
 * The catalog is already updated by the time this runs, so a backend that is
 * down costs a message in the list rather than the deck on screen.
 */
const persist = async (
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body: unknown,
  failure: string,
): Promise<void> => {
  const base = state.backendUrl;
  if (!base) {
    return;
  }
  try {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    set({ error: undefined });
  } catch (error) {
    set({ error: `${failure}: ${String(error)}` });
  }
};

/**
 * Add a deck from a complete spec: register it, open it, save it if there is
 * somewhere to. What an agent's "create deck" tool calls, and what the dialog
 * calls with a starter spec.
 *
 * Registered first and saved after, so the author sees their deck at once and
 * a backend that is down costs a message rather than the deck.
 */
export const addDeck = async (
  input: DeckInput,
  options: { open?: boolean } = {},
): Promise<DeckWriteResult> => {
  const spec = assertSpec(input.spec);
  const slug = slugify(input.slug || spec.deck.title);
  const entry: DeckEntry = {
    collection: input.collection || undefined,
    slug,
    spec,
    source: state.backendUrl ? 'server' : 'session',
  };
  registerDecks([entry]);
  if (options.open !== false) {
    set({ creating: false, selected: deckId(entry), slide: 1 });
  }
  await persist(
    'POST',
    '/decks',
    { collection: entry.collection ?? '', slug, spec },
    'The deck is open but was not saved',
  );
  return { entry, issues: validateDeck(spec) };
};

/**
 * Replace a deck: the same address unless the input moves it, a new spec.
 *
 * Keeps the reader's place when the replaced deck is the open one, clamped to
 * the new length — an agent that rewrote slide three should leave them on
 * slide three.
 */
export const replaceDeck = async (
  id: string,
  input: Partial<DeckInput> & { spec: DeckSpec },
): Promise<DeckWriteResult> => {
  const current = deckById(id);
  if (!current) {
    throw new Error(`There is no deck ${id} to replace.`);
  }
  const spec = assertSpec(input.spec);
  const entry: DeckEntry = {
    collection: input.collection === undefined ? current.collection : input.collection || undefined,
    slug: input.slug ? slugify(input.slug) : current.slug,
    spec,
    source: current.source,
  };
  const moved = deckId(entry) !== id;
  if (moved) {
    unregisterDeck(id);
  }
  registerDecks([entry]);
  if (state.selected === id) {
    set({ selected: deckId(entry), slide: Math.min(state.slide, spec.slides.length || 1) });
  }
  await persist(
    'PUT',
    `/decks/${id}`,
    { collection: entry.collection ?? '', slug: entry.slug, spec },
    'The change is on screen but was not saved',
  );
  return { entry, issues: validateDeck(spec) };
};

/** Remove a deck from the catalog, and from the server when there is one. */
export const removeDeck = async (id: string): Promise<boolean> => {
  if (!deckById(id)) {
    return false;
  }
  unregisterDeck(id);
  if (state.selected === id) {
    closeDeck();
  }
  await persist(
    'DELETE',
    `/decks/${id}`,
    undefined,
    'The deck was removed here but not on the server',
  );
  return true;
};

/**
 * Present: the browser's own fullscreen, on the element Reveal measures.
 * Returns whether there was a deck on screen to present.
 */
export const presentOpenDeck = (): boolean => {
  if (typeof document === 'undefined') {
    return false;
  }
  const deck = document.querySelector('.dla-deck') as HTMLElement | null;
  if (!deck) {
    return false;
  }
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  } else {
    void deck.requestFullscreen?.();
    // An embedded deck ignores the keyboard until it has been clicked;
    // Reveal takes focus on a `pointerdown`. Tell it what the click would.
    deck.dispatchEvent(new Event('pointerdown'));
  }
  return true;
};

/** Print: the print view of the open deck in a tab of its own; its address, or none. */
export const printOpenDeck = (): string | undefined => {
  const entry = state.selected ? deckById(state.selected) : undefined;
  if (!entry || typeof window === 'undefined') {
    return undefined;
  }
  const path = deckPrintPath(entry);
  window.open(path, '_blank', 'noopener');
  return path;
};

/**
 * Create a deck from a title: the dialog's path. A starter spec, added and
 * opened like any other.
 */
export const createDeck = async (input: NewDeckInput): Promise<DeckEntry> => {
  const { entry } = await addDeck({
    collection: input.collection,
    slug: slugify(input.title),
    spec: newDeckSpec(input),
  });
  return entry;
};
