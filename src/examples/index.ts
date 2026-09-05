/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The decks shipped with the package, as catalog entries — for the
 * standalone app, and for any host that wants something on screen before
 * anyone has made a deck. Examples of the slide library, not of a product.
 *
 * @module examples
 */

import type { DeckEntry } from '../registry/catalog';
import { reactorInFiveSlides } from './reactorInFiveSlides';
import { quarterlyReview } from './quarterlyReview';

export const exampleDecks: DeckEntry[] = [
  {
    collection: 'examples',
    slug: 'reactor-in-five-slides',
    spec: reactorInFiveSlides,
    source: 'bundled',
  },
  { collection: 'examples', slug: 'quarterly-review', spec: quarterlyReview, source: 'bundled' },
];

export { reactorInFiveSlides, quarterlyReview };
