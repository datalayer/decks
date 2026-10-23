/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * A deck's theme over the page (`useDeckTheme`): asked while it is drawn, and
 * on the way out the page has what it had before — so a deck drawn over a
 * page that already shows one does not take that one's theme away.
 */

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { useDeckTheme } from '../DeckView';
import { getDeckThemeOverride, setDeckThemeOverride } from '../deckThemeOverride';
import type { DeckSpec } from '../types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const spec = (colorMode: string): DeckSpec =>
  ({ deck: { title: 'T', colorMode }, slides: [] }) as unknown as DeckSpec;

const Themed = ({ asked }: { asked: DeckSpec }) => {
  useDeckTheme(asked);
  return null;
};

const roots: Root[] = [];
const mount = (asked: DeckSpec): Root => {
  const root = createRoot(document.createElement('div'));
  roots.push(root);
  act(() => root.render(createElement(Themed, { asked })));
  return root;
};

afterEach(() => {
  roots.splice(0).forEach(root => act(() => root.unmount()));
  setDeckThemeOverride(null);
});

describe('useDeckTheme', () => {
  it('asks for the deck theme while drawn, and drops it after', () => {
    const root = mount(spec('dark'));
    expect(getDeckThemeOverride().colorMode).toBe('dark');
    act(() => root.unmount());
    expect(getDeckThemeOverride()).toEqual({});
  });

  it('gives back the theme of the deck it was drawn over', () => {
    mount(spec('dark'));
    const inner = mount(spec('light'));
    expect(getDeckThemeOverride().colorMode).toBe('light');
    act(() => inner.unmount());
    expect(getDeckThemeOverride().colorMode).toBe('dark');
  });
});
