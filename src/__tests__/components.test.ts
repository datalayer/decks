/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import { describe, expect, it, vi } from 'vitest';
import {
  deckComponent,
  deckComponentNames,
  hasDeckComponent,
  registerDeckComponents,
  subscribeDeckComponents,
} from '../registry/components';
import { validateDeck } from '../validation';
import type { DeckSpec } from '../types';

const Chart = (): null => null;
const Logo = (): null => null;

describe('the component registry', () => {
  it('ships empty, fills by name, and undoes only its own registrations', () => {
    expect(hasDeckComponent('Chart')).toBe(false);
    const undo = registerDeckComponents({ Chart, Logo });
    expect(deckComponent('Chart')).toBe(Chart);
    expect(deckComponentNames()).toEqual(['Chart', 'Logo']);

    // Somebody else re-registers Logo; the first undo must not take theirs.
    const Other = (): null => null;
    registerDeckComponents({ Logo: Other });
    undo();
    expect(hasDeckComponent('Chart')).toBe(false);
    expect(deckComponent('Logo')).toBe(Other);
  });

  it('tells subscribers when the map changes', () => {
    const listener = vi.fn();
    const off = subscribeDeckComponents(listener);
    const undo = registerDeckComponents({ Chart });
    undo();
    expect(listener).toHaveBeenCalledTimes(2);
    off();
  });

  it('is what validation consults for a `component` slide', () => {
    const spec = {
      deck: { title: 'T', template: 'datalayer' },
      slides: [{ type: 'component', component: 'Unregistered' }],
    } as unknown as DeckSpec;
    const before = validateDeck(spec);
    expect(before.some((issue) => /Unregistered/.test(issue.message))).toBe(true);
    const undo = registerDeckComponents({ Unregistered: Chart });
    const after = validateDeck(spec);
    expect(after.some((issue) => /Unregistered/.test(issue.message))).toBe(false);
    undo();
  });
});
