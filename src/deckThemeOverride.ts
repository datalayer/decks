/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The theme a deck asks for, while it is on screen.
 *
 * A deck may be drawn in a theme of its own — an architecture deck in matrix
 * dark, say — and it has to be the theme of the WHOLE page, not of the deck
 * box: a dark deck inside a light header reads as a bug rather than as a
 * decision.
 *
 * Which rules out the obvious implementation. The theme store persists what
 * it is set to, so setting it here would rewrite the reader's own preference,
 * and closing the tab on a deck would leave them in the deck's theme
 * afterwards — the one thing this must not do. So nothing is set: this module
 * holds an override beside the store, the application's `useThemeStore`
 * reports it in place of the stored value while it is present, and the stored
 * value is never touched. Leaving the deck clears the override and the reader
 * has their own theme back, because it was never taken away.
 *
 * A module-level value rather than a context: the reader of it is the theme
 * hook, which every layout calls from above the router, so a provider inside
 * the deck view would be below the pages that need to know.
 */

import { useSyncExternalStore } from 'react';
import type { ColorMode, ThemeVariant } from '@datalayer/primer-addons';

export type DeckThemeOverride = {
  variant?: ThemeVariant;
  colorMode?: ColorMode;
};

/** Nothing overridden. Shared so subscribers can compare by identity. */
const NONE: DeckThemeOverride = {};

let current: DeckThemeOverride = NONE;
const listeners = new Set<() => void>();

const emit = (): void => {
  listeners.forEach(listener => listener());
};

/**
 * Ask for a theme, or drop the request.
 *
 * Called from an effect: it is a render-visible change, and a component that
 * set it while rendering would be telling React something has changed in the
 * middle of being told what to draw.
 */
export const setDeckThemeOverride = (override: DeckThemeOverride | null): void => {
  const next = override && (override.variant || override.colorMode) ? override : NONE;
  if (next === current) {
    return;
  }
  if (
    next.variant === current.variant &&
    next.colorMode === current.colorMode
  ) {
    return;
  }
  current = next;
  emit();
};

export const getDeckThemeOverride = (): DeckThemeOverride => current;

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The override, as a hook that re-renders its caller when it changes. */
export const useDeckThemeOverride = (): DeckThemeOverride =>
  useSyncExternalStore(subscribe, getDeckThemeOverride, getDeckThemeOverride);
