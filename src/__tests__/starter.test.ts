/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/** The starter a new deck opens on: valid, named, and with something to say. */

import { describe, expect, it } from 'vitest';
import { newDeckSpec } from '../plugin/store';
import { validateDeckSpec } from '../validation';

describe('the starter of a new deck', () => {
  it('is a deck the engine accepts, named as its author named it', () => {
    const spec = newDeckSpec({ title: 'Quarterly review' });
    const { valid, issues } = validateDeckSpec(spec);
    expect(issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
    expect(valid).toBe(true);
    expect(spec.deck.title).toBe('Quarterly review');
    expect(spec.slides[0]).toMatchObject({ type: 'title', title: 'Quarterly review' });
  });

  it('gives every slide notes, so Play and Video have something to say', () => {
    const { slides } = newDeckSpec({ title: 'Quarterly review' });
    expect(slides.every((slide) => (slide.notes ?? '').trim().length > 0)).toBe(true);
    expect(slides[0].notes).toContain('Quarterly review');
    expect(new Set(slides.map((slide) => slide.type)).size).toBeGreaterThanOrEqual(7);
  });

  it('takes the subtitle its author gave', () => {
    const spec = newDeckSpec({ title: 'Q3', subtitle: 'For the board' });
    expect(spec.slides[0]).toMatchObject({ subtitle: 'For the board' });
    expect(spec.deck.subtitle).toBe('For the board');
  });
});
