/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import { describe, expect, it } from 'vitest';
import { registerDeckComponents } from '../registry/components';
import {
  ArtifactSlide,
  ClosingSlide,
  DEFAULT_LAYOUTS,
  SLIDE_TYPES,
} from '../slides';
import type { DeckSpec } from '../types';
import { validateDeck } from '../validation';

describe('closing and artifact slides', () => {
  it('registers and validates the closing layout', () => {
    const spec: DeckSpec = {
      deck: { title: 'Close', template: 'datalayer' },
      slides: [
        { type: 'closing', title: 'Thank You', contact: 'hello@example.com' },
      ],
    };

    expect(SLIDE_TYPES).toContain('closing');
    expect(DEFAULT_LAYOUTS.closing).toBe(ClosingSlide);
    expect(validateDeck(spec)).toEqual([]);
  });

  it('accepts image artifacts and validates component artifacts', () => {
    const imageSpec: DeckSpec = {
      deck: { title: 'Artifact', template: 'datalayer' },
      slides: [
        {
          type: 'artifact',
          title: 'A real result',
          visual: { src: '/result.png', alt: 'Result' },
          items: ['Inspectable'],
        },
      ],
    };
    expect(SLIDE_TYPES).toContain('artifact');
    expect(DEFAULT_LAYOUTS.artifact).toBe(ArtifactSlide);
    expect(validateDeck(imageSpec)).toEqual([]);

    const componentSpec = {
      ...imageSpec,
      slides: [
        {
          type: 'artifact',
          title: 'Reserved capture',
          visual: { component: 'Placeholder' },
        },
      ],
    } as DeckSpec;
    expect(validateDeck(componentSpec)).toHaveLength(1);
    const undo = registerDeckComponents({ Placeholder: () => null });
    expect(validateDeck(componentSpec)).toEqual([]);
    undo();
  });
});
