/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * `@datalayer/decks` — presentations described as data.
 *
 * The engine: types, validation, the slide library, the templates, the
 * renderer, the reading and print views, and the catalog and component
 * registries a host fills. The Reactor plugin that puts all of it in a shell
 * is `@datalayer/decks/plugin`.
 *
 * @module index
 */

export * from './types';
export * from './validation';
export * from './slides';
export * from './templates';
export * from './runtime/DeckRenderer';
export * from './runtime/SlideRenderer';
export * from './DeckView';
export * from './DeckPrintView';
export * from './DeckAccess';
export * from './deckThemeOverride';
export * from './host';
export * from './registry/catalog';
export * from './registry/components';
export { decksCss } from './decksCss';
