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
  /** The deck the rename dialog is open for, by id. */
  renaming?: string;
  /** The deck the delete confirmation is open for, by id. */
  deleting?: string;
  /** Where decks are saved and loaded, when the plugin was given one. */
  backendUrl?: string;
  /** The last thing the backend said that went wrong, for the list to show. */
  error?: string;
  /**
   * Bumped whenever someone asks to *see* decks — a deck opened, the list
   * shown — even when nothing else changed. A host with its own notion of
   * what is on screen (a Loop with the deck as one editor among several)
   * follows this to bring the decks into view; a "show the decks" command
   * that only cleared a selection already clear had nothing for it to follow.
   */
  revealed: number;
};

let state: DecksState = { slide: 1, creating: false, revealed: 0 };
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

export const openDeck = (id: string, slide = 1): void =>
  set({ selected: id, slide, revealed: state.revealed + 1 });
export const closeDeck = (): void =>
  set({ selected: undefined, slide: 1, revealed: state.revealed + 1 });
export const goToSlide = (slide: number): void => set({ slide: Math.max(1, slide) });
export const nextSlide = (): void => {
  const entry = state.selected ? deckById(state.selected) : undefined;
  const total = entry?.spec.slides.length ?? 0;
  set({ slide: Math.min(total || 1, state.slide + 1) });
};
export const previousSlide = (): void => set({ slide: Math.max(1, state.slide - 1) });
export const beginNewDeck = (): void => set({ creating: true });
export const cancelNewDeck = (): void => set({ creating: false });
/** Open the rename dialog for a deck — the open one when none is named. */
export const beginRename = (id?: string): void => {
  const target = id ?? state.selected;
  if (target && deckById(target)) {
    set({ renaming: target });
  }
};
export const cancelRename = (): void => set({ renaming: undefined });
/** Open the delete confirmation for a deck — the open one when none is named. */
export const beginDelete = (id?: string): void => {
  const target = id ?? state.selected;
  if (target && deckById(target)) {
    set({ deleting: target });
  }
};
export const cancelDelete = (): void => set({ deleting: undefined });
export const configureDecksBackend = (backendUrl: string | undefined): void =>
  set({ backendUrl: backendUrl?.replace(/\/+$/, '') || undefined });

/** For tests: back to the first frame. */
export const resetDecksState = (): void => {
  state = { slide: 1, creating: false, revealed: 0 };
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
    {
      type: 'title',
      title,
      subtitle,
      meta: new Date().toISOString().slice(0, 10),
    },
    { type: 'section', title: 'First section' },
    {
      type: 'bullets',
      title: 'Where to start',
      items: ['Replace this slide', 'Add a `metrics` or `chart` slide', 'Present with `f`'],
    },
  ];
  return {
    deck: {
      title,
      subtitle,
      template: template ?? 'datalayer',
      transition: 'slide',
    },
    slides,
  } as DeckSpec;
};

/** What the backend stores and returns for one deck. */
export type DeckRecord = {
  id: string;
  collection?: string;
  slug: string;
  spec: DeckSpec;
};

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
    // Opened, and an ask to see it — a deck just made and not on screen is
    // a "create" that looks like it did nothing.
    set({
      creating: false,
      selected: deckId(entry),
      slide: 1,
      revealed: state.revealed + 1,
    });
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
    set({
      selected: deckId(entry),
      slide: Math.min(state.slide, spec.slides.length || 1),
    });
  }
  await persist(
    'PUT',
    `/decks/${id}`,
    { collection: entry.collection ?? '', slug: entry.slug, spec },
    'The change is on screen but was not saved',
  );
  return { entry, issues: validateDeck(spec) };
};

/** What a rename may change: the title on the deck, and its address. */
export type RenameInput = {
  title?: string;
  slug?: string;
  collection?: string;
};

/**
 * Rename a deck: a new title, a new address, or both.
 *
 * The same record, moved: `replaceDeck` re-registers it under the new id and
 * the server moves the file. The dialog closes whatever happened to the save;
 * a backend that is down leaves a message in the list, as every write does.
 */
export const renameDeck = async (id: string, input: RenameInput): Promise<DeckWriteResult> => {
  const current = deckById(id);
  if (!current) {
    throw new Error(`There is no deck ${id} to rename.`);
  }
  const title = input.title?.trim() || current.spec.deck.title;
  const result = await replaceDeck(id, {
    collection: input.collection === undefined ? undefined : input.collection.trim(),
    slug: input.slug?.trim() || undefined,
    spec: { ...current.spec, deck: { ...current.spec.deck, title } },
  });
  set({ renaming: undefined });
  return result;
};

/** Remove a deck from the catalog, and from the server when there is one. */
export const removeDeck = async (id: string): Promise<boolean> => {
  if (!deckById(id)) {
    return false;
  }
  unregisterDeck(id);
  set({
    deleting: undefined,
    renaming: state.renaming === id ? undefined : state.renaming,
  });
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

/** A 1-based slide number that exists in a deck of `total` slides. */
const assertSlideNumber = (slide: number, total: number): void => {
  if (!Number.isInteger(slide) || slide < 1 || slide > total) {
    throw new Error(`There is no slide ${slide}; the deck has ${total}.`);
  }
};

/**
 * Change a deck's slides and open it on the slide that changed.
 *
 * The three per-slide writes below are this with a different edit: copy the
 * slides, apply the edit — which says where it landed — replace the deck,
 * which saves it, then open it there. An agent's change is on screen, not
 * only on disk; a "replace slide 3" that left the deck closed would look
 * like it did nothing.
 */
const changeSlides = async (
  id: string,
  change: (slides: SlideSpec[]) => number,
): Promise<DeckWriteResult> => {
  const current = deckById(id);
  if (!current) {
    throw new Error(`There is no deck ${id}.`);
  }
  const slides = [...current.spec.slides];
  const focus = change(slides);
  const result = await replaceDeck(id, { spec: { ...current.spec, slides } });
  openDeck(deckId(result.entry), Math.min(Math.max(1, focus), slides.length || 1));
  return result;
};

/** Replace one slide, by its 1-based number, leaving the rest as they are. */
export const updateSlide = (
  id: string,
  slide: number,
  slideSpec: SlideSpec,
): Promise<DeckWriteResult> =>
  changeSlides(id, (slides) => {
    assertSlideNumber(slide, slides.length);
    slides[slide - 1] = slideSpec;
    return slide;
  });

/** Insert a slide before the given 1-based position; past the end appends. */
export const insertSlide = (
  id: string,
  position: number,
  slideSpec: SlideSpec,
): Promise<DeckWriteResult> =>
  changeSlides(id, (slides) => {
    const at = Math.max(1, Math.min(Math.trunc(position) || 1, slides.length + 1));
    slides.splice(at - 1, 0, slideSpec);
    return at;
  });

/** Remove one slide by its 1-based number. A deck keeps at least one. */
export const deleteSlide = (id: string, slide: number): Promise<DeckWriteResult> =>
  changeSlides(id, (slides) => {
    assertSlideNumber(slide, slides.length);
    if (slides.length === 1) {
      throw new Error('A deck needs at least one slide; delete the deck instead.');
    }
    slides.splice(slide - 1, 1);
    return Math.max(1, slide - 1);
  });

/** What presenting came to. Browsers grant fullscreen only from a person's click. */
export type PresentOutcome = 'entered' | 'exited' | 'blocked' | 'none';

/**
 * Present: the browser's own fullscreen, on the element Reveal measures.
 *
 * Honest about the one thing a page cannot decide: fullscreen needs a
 * person's gesture, so a call made by an agent's tool rather than a click is
 * refused by the browser. That comes back as `blocked` — for the caller to
 * say "press F" — rather than as a silent nothing.
 */
export const presentOpenDeck = async (): Promise<PresentOutcome> => {
  if (typeof document === 'undefined') {
    return 'none';
  }
  const deck = document.querySelector('.dla-deck') as HTMLElement | null;
  if (!deck) {
    return 'none';
  }
  if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => undefined);
    return 'exited';
  }
  if (typeof deck.requestFullscreen !== 'function') {
    return 'blocked';
  }
  try {
    await deck.requestFullscreen();
  } catch {
    return 'blocked';
  }
  // An embedded deck ignores the keyboard until it has been clicked; Reveal
  // takes focus on a `pointerdown`. Tell it what the click would.
  deck.dispatchEvent(new Event('pointerdown'));
  return 'entered';
};

/**
 * Print: the print view of the open deck in a tab of its own.
 *
 * Returns the address and whether the tab opened — a popup blocker refuses a
 * `window.open` that no click asked for, and the address is then the thing
 * to hand over.
 */
export const printOpenDeck = (): { path: string; opened: boolean } | undefined => {
  const entry = state.selected ? deckById(state.selected) : undefined;
  if (!entry || typeof window === 'undefined') {
    return undefined;
  }
  const path = deckPrintPath(entry);
  const opened = window.open(path, '_blank', 'noopener') !== null;
  return { path, opened };
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
