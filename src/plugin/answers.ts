/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * What the data commands read from their argument, and answer with.
 *
 * A command an agent calls is judged on its answer: `decks_get_deck` has to
 * come back with an outline the model can find "the metrics slide" in, and a
 * write has to say what it made and what validation noticed. These are those
 * shapes, and the readers that turn a bad argument into a sentence the model
 * can act on rather than a stack trace.
 *
 * @module plugin/answers
 */

import { deckById, deckId, type DeckEntry } from '../registry/catalog';
import type { DeckSpec } from '../types';
import type { DeckWriteResult } from './store';

/** A deck in a list: enough to choose it and to address it. */
export type DeckSummary = {
  id: string;
  collection?: string;
  slug: string;
  title: string;
  subtitle?: string;
  /** How many slides. */
  slides: number;
  source?: DeckEntry['source'];
};

export const deckSummary = (entry: DeckEntry): DeckSummary => ({
  id: deckId(entry),
  collection: entry.collection,
  slug: entry.slug,
  title: entry.spec.deck.title,
  subtitle: entry.spec.deck.subtitle,
  slides: entry.spec.slides.length,
  source: entry.source,
});

/** One line per slide: number, type, title. */
export type OutlineEntry = { slide: number; type: string; title: string };

/** Slide number, type and title of every slide: what "the metrics slide" resolves against. */
export const deckOutline = (spec: DeckSpec): OutlineEntry[] =>
  spec.slides.map((slide, index) => {
    const raw = slide as unknown as Record<string, unknown>;
    const title = raw.title ?? raw.statement ?? raw.quote ?? '';
    return {
      slide: index + 1,
      type: slide.type,
      title: String(title).slice(0, 80),
    };
  });

/** The whole deck, for reading before changing it. */
export type DeckDetails = DeckSummary & {
  spec: DeckSpec;
  outline: OutlineEntry[];
};

export const deckDetails = (entry: DeckEntry): DeckDetails => ({
  ...deckSummary(entry),
  spec: entry.spec,
  outline: deckOutline(entry.spec),
});

/** What a write answers: the deck as it now is, and what validation noticed. */
export type DeckWritten = DeckSummary & {
  outline: OutlineEntry[];
  issues: string[];
};

export const describeWrite = ({ entry, issues }: DeckWriteResult): DeckWritten => ({
  ...deckSummary(entry),
  outline: deckOutline(entry.spec),
  issues: issues.map((issue) => `${issue.where}: ${issue.message}`),
});

/** The `id` of a command's argument, or a sentence about what is missing. */
export const idOf = (argument: { id?: unknown } | undefined): string => {
  const id = argument?.id;
  if (typeof id !== 'string' || !id) {
    throw new Error('Which deck? Pass its `id`, as listed by decks_list_decks.');
  }
  return id;
};

/** The `slide` of a command's argument: a 1-based number. */
export const slideOf = (argument: { slide?: unknown } | undefined): number => {
  const slide = argument?.slide;
  if (typeof slide !== 'number' || !Number.isFinite(slide)) {
    throw new Error("Pass the 1-based `slide` number, from the deck's outline.");
  }
  return slide;
};

/** The deck an id names, or a sentence saying there is none. */
export const existingDeck = (id: string): DeckEntry => {
  const entry = deckById(id);
  if (!entry) {
    throw new Error(`There is no deck ${id}.`);
  }
  return entry;
};

/** A string argument, or nothing: what an optional `slug` or `collection` reads as. */
export const textOf = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;
