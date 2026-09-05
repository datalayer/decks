/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The decks shipped with the package, as catalog entries.
 *
 * Registered by the app so a fresh `datalayer-decks` has something on screen.
 * They are examples of the slide library, not of any product.
 */

import type { DeckEntry } from '@datalayer/decks';
import { reactorInFiveSlides } from './decks/reactorInFiveSlides';
import { quarterlyReview } from './decks/quarterlyReview';

export const exampleDecks: DeckEntry[] = [
  { collection: 'examples', slug: 'reactor-in-five-slides', spec: reactorInFiveSlides, source: 'bundled' },
  { collection: 'examples', slug: 'quarterly-review', spec: quarterlyReview, source: 'bundled' },
];

export { reactorInFiveSlides, quarterlyReview };
