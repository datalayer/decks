/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUTS, GRID_MAX_ITEMS, GridSlide, SLIDE_TYPES, gridColumnsOf } from '../slides';
import type { DeckSpec, GridSlideSpec } from '../types';
import { validateDeck } from '../validation';

const items = (count: number) => Array.from({ length: count }, (_, position) => ({ title: `Item ${position + 1}` }));
const grid = (slide: Partial<GridSlideSpec>): DeckSpec => ({
  deck: { title: 'Grid', template: 'datalayer' },
  slides: [{ type: 'grid', title: 'Ten things', items: items(10), ...slide } as GridSlideSpec],
});

describe('grid slide', () => {
  it('is registered and validates ten items in five columns', () => {
    expect(SLIDE_TYPES).toContain('grid');
    expect(DEFAULT_LAYOUTS.grid).toBe(GridSlide);
    expect(
      validateDeck(
        grid({
          columns: 5,
          items: [{ title: 'Studio', kicker: 'A pain', body: 'An answer.', icon: '01', href: '/features/studio' }, ...items(9)],
          footnote: 'A source.',
        }),
      ),
    ).toEqual([]);
  });

  it('arranges the cells: the spec’s columns, or up to five across', () => {
    const of = (count: number, columns?: number) => gridColumnsOf({ type: 'grid', items: items(count), columns });
    expect(of(10, 5)).toBe(5);
    expect(of(3)).toBe(3);
    expect(of(5)).toBe(5);
    expect(of(10)).toBe(5);
    expect(of(8)).toBe(4);
    expect(of(7)).toBe(4);
    expect(of(12)).toBe(4);
    expect(of(4, 9)).toBe(6);
  });

  it('refuses a grid without items, an item without a title, a bad column count and too many items', () => {
    const messages = (spec: DeckSpec) => validateDeck(spec).map(issue => issue.message);
    expect(messages(grid({ items: [] }))).toEqual(['A "grid" slide needs `items`.']);
    expect(messages(grid({ items: [{ title: '' }] }))).toEqual(['A grid item needs a `title`.']);
    expect(messages(grid({ columns: 0 }))).toEqual([expect.stringContaining('`columns` is a whole number')]);
    expect(messages(grid({ columns: 2.5 }))).toEqual([expect.stringContaining('`columns` is a whole number')]);
    expect(messages(grid({ items: items(GRID_MAX_ITEMS + 1) }))).toEqual([expect.stringContaining('at most')]);
  });

  it('fits ten cells: the rows share the height, a dense grid sets smaller words, a cell never spills', () => {
    const css = readFileSync(join(__dirname, '..', 'decks.css'), 'utf8');
    expect(css).toContain('grid-auto-rows: minmax(0, 1fr);');
    expect(css).toMatch(/\.dla-deck \.dla-grid-item \{[^}]*overflow: hidden;/);
    expect(css).toContain('.dla-deck .dla-grid--dense .dla-grid-body');
    // Theme-aware: every colour of the grid is a deck token.
    const rules = css.slice(css.indexOf('/* --- Grid'), css.indexOf('/* --- Flow'));
    expect(rules).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/i);
    expect(rules).toContain('var(--dla-deck-accent)');
  });
});
