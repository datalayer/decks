/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * Validating a specification as a host receives one — text or data — and
 * saying how much each issue matters.
 */

import { describe, expect, it } from 'vitest';
import { validateDeck, validateDeckSpec } from '../validation';
import type { DeckSpec } from '../types';

const aDeck = (): DeckSpec => ({
  deck: { title: 'Q3', template: 'datalayer' },
  slides: [
    { type: 'title', title: 'Q3' },
    { type: 'bullets', title: 'Why', items: ['a', 'b'] },
  ],
});

describe('validateDeckSpec', () => {
  it('passes a good deck, as data or as text, and hands the spec back', () => {
    for (const input of [aDeck(), JSON.stringify(aDeck(), null, 2)]) {
      const result = validateDeckSpec(input);
      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
      expect(result.spec?.slides).toHaveLength(2);
    }
  });

  it('says where the text stopped being JSON', () => {
    const text = '{\n  "deck": { "title": "Q3" },\n  "slides": [\n    { "type": "title", }\n  ]\n}';
    const result = validateDeckSpec(text);
    expect(result.valid).toBe(false);
    expect(result.spec).toBeUndefined();
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].severity).toBe('error');
    expect(result.issues[0].where).toMatch(/^line 4, column \d+$/);
    expect(result.issues[0].message).toMatch(/^Not valid JSON/);
  });

  it('refuses what is not a deck, and a slide with no type', () => {
    expect(validateDeckSpec('   ').issues[0].message).toMatch(/empty/);
    expect(validateDeckSpec({ slides: [] }).issues[0].message).toMatch(/A deck is/);
    expect(validateDeckSpec([aDeck()]).valid).toBe(false);
    const untyped = validateDeckSpec({ deck: { title: 'x' }, slides: [{ title: 'no type' }, 'text'] });
    expect(untyped.valid).toBe(false);
    expect(untyped.issues.map(issue => issue.where)).toEqual(['slides[0]', 'slides[1]']);
  });

  it('reports the engine\'s own issues as errors, first', () => {
    const spec = aDeck();
    spec.deck.title = '';
    (spec.slides[1] as { items?: string[] }).items = [];
    spec.slides.push({ type: 'component', component: 'NotRegisteredAnywhere' } as never);
    const result = validateDeckSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.spec).toBeDefined(); // still drawable, still handed back
    expect(result.issues.map(issue => issue.severity)).toEqual(['error', 'error', 'warning']);
    expect(result.issues[0]).toMatchObject({ where: 'deck', message: 'A deck needs a `title`.' });
  });

  it('lets an unregistered component through as a warning: another host may have it', () => {
    const spec = aDeck();
    spec.slides.push({ type: 'component', component: 'NotRegisteredAnywhere' } as never);
    const result = validateDeckSpec(spec);
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([
      expect.objectContaining({ where: 'slides[2]', severity: 'warning' }),
    ]);
  });
});

describe('validateDeck', () => {
  it('marks the issues about unregistered names as warnings, and only those', () => {
    const spec = aDeck();
    spec.slides.push({ type: 'component', component: 'Nope' } as never);
    spec.slides.push({ type: 'wobble' } as never);
    const issues = validateDeck(spec);
    const unregistered = issues.find(issue => issue.message.startsWith('Unknown component "Nope"'));
    const unknownType = issues.find(issue => issue.message.startsWith('Unknown slide type "wobble"'));
    expect(unregistered?.severity).toBe('warning');
    // Everything else is an error, which is what no severity means.
    expect(unknownType).toBeDefined();
    expect(unknownType?.severity).toBeUndefined();
  });
});
