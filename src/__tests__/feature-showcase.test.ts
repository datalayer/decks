/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUTS, FeatureShowcaseSlide, SLIDE_TYPES } from '../slides';
import type { DeckSpec } from '../types';
import { validateDeck } from '../validation';

const features = ['Agents', 'Sandboxes', 'Evals', 'Documents', 'Library'].map((title) => ({
  title,
  status: 'Available',
}));

describe('feature showcase slide', () => {
  it('registers and validates exactly five capabilities', () => {
    const spec: DeckSpec = {
      deck: { title: 'Features', template: 'datalayer' },
      slides: [
        {
          type: 'feature-showcase',
          title: 'One substrate, five capabilities',
          coreTitle: 'Live Jupyter sandbox',
          features,
        },
      ],
    };

    expect(SLIDE_TYPES).toContain('feature-showcase');
    expect(DEFAULT_LAYOUTS['feature-showcase']).toBe(FeatureShowcaseSlide);
    expect(validateDeck(spec)).toEqual([]);
  });

  it('rejects a showcase that cannot form the five-node composition', () => {
    const spec = {
      deck: { title: 'Features', template: 'datalayer' },
      slides: [
        {
          type: 'feature-showcase',
          title: 'Too few',
          coreTitle: 'Sandbox',
          features: features.slice(0, 4),
        },
      ],
    } as DeckSpec;

    expect(validateDeck(spec)).toEqual([
      {
        where: 'slides[0]',
        message: 'A "feature-showcase" slide needs exactly five features.',
      },
    ]);
  });
});
