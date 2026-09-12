/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUTS, FlowSlide, SLIDE_TYPES } from '../slides';
import type { DeckSpec } from '../types';
import { validateDeck } from '../validation';

describe('flow slide', () => {
  it('is registered and validates a causal sequence', () => {
    const spec: DeckSpec = {
      deck: { title: 'Flow', template: 'datalayer' },
      slides: [
        {
          type: 'flow',
          title: 'Land and expand',
          items: [
            { title: 'Land' },
            { title: 'Convert', current: true },
            { title: 'Expand' },
          ],
        },
      ],
    };

    expect(SLIDE_TYPES).toContain('flow');
    expect(DEFAULT_LAYOUTS.flow).toBe(FlowSlide);
    expect(validateDeck(spec)).toEqual([]);
  });
});
