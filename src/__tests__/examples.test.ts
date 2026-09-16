/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * What the examples promise: that `everyLayout` really is every layout, and
 * that the decks the package ships are valid decks.
 *
 * The first assertion is the one that matters over time. A new slide type is
 * a new entry in `DEFAULT_LAYOUTS`, and nothing else in the repository would
 * notice that the reference deck never learned to show it — so this does.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { everyLayout, exampleDeckComponents, exampleDecks } from '../examples';
import { registerDeckComponents } from '../registry/components';
import { SLIDE_TYPES } from '../slides';
import { validateDeck } from '../validation';
import type { SlideSpec } from '../types';

const typesOf = (slides: SlideSpec[]): Set<string> => new Set(slides.map((slide) => slide.type));

describe('the example decks', () => {
  let undo: (() => void) | undefined;

  afterEach(() => {
    undo?.();
    undo = undefined;
  });

  it('shows every semantic slide type in the reference deck', () => {
    const shown = typesOf(everyLayout.slides);
    expect([...SLIDE_TYPES].filter((type) => !shown.has(type))).toEqual([]);
  });

  it('names nothing in the reference deck it does not also ship', () => {
    // Unregistered first: the engine is expected to say so rather than draw
    // a blank, and this is the notice a host sees before it registers them.
    const before = validateDeck(everyLayout);
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((issue) => /Unknown (component|backdrop|artifact component)/.test(issue.message))).toBe(true);

    undo = registerDeckComponents(exampleDeckComponents);
    expect(validateDeck(everyLayout)).toEqual([]);
  });

  it('ships decks that validate', () => {
    undo = registerDeckComponents(exampleDeckComponents);
    for (const entry of exampleDecks) {
      expect({ [entry.slug]: validateDeck(entry.spec) }).toEqual({ [entry.slug]: [] });
    }
  });
});
