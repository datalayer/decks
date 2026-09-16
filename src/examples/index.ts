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
 * `everyLayout` is the reference deck: one slide of every semantic type,
 * including the three that name a component. Those names are the map in
 * `exampleComponents`, which a host registers beside the decks:
 *
 * ```ts
 * registerDecks(exampleDecks);
 * registerDeckComponents(exampleDeckComponents);
 * ```
 *
 * Registering the decks without the components is a fair thing to do — the
 * component slides then show the engine's own "unknown component" notice, and
 * nothing else changes.
 *
 * @module examples
 */

import type { DeckEntry } from '../registry/catalog';
import { reactorInFiveSlides } from './reactorInFiveSlides';
import { quarterlyReview } from './quarterlyReview';
import { everyLayout } from './everyLayout';

export const exampleDecks: DeckEntry[] = [
  {
    collection: 'examples',
    slug: 'reactor-in-five-slides',
    spec: reactorInFiveSlides,
    source: 'bundled',
  },
  { collection: 'examples', slug: 'quarterly-review', spec: quarterlyReview, source: 'bundled' },
  { collection: 'examples', slug: 'every-layout', spec: everyLayout, source: 'bundled' },
];

export { reactorInFiveSlides, quarterlyReview, everyLayout };
export {
  AgentsHero,
  AppearanceChooser,
  LiveAppearance,
  exampleDeckComponents,
} from './exampleComponents';
