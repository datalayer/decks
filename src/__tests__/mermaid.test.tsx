/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Block } from '../slides';
import type { DeckSpec } from '../types';
import { validateDeck } from '../validation';

describe('Mermaid content', () => {
  it('is accepted as a semantic slide and requires diagram source', () => {
    const spec: DeckSpec = {
      deck: { title: 'Diagram', template: 'datalayer' },
      slides: [{ type: 'mermaid', title: 'Pipeline', diagram: 'flowchart LR\nA --> B' }],
    };
    expect(validateDeck(spec)).toEqual([]);
    spec.slides[0] = { type: 'mermaid', diagram: '' };
    expect(validateDeck(spec)).toEqual([
      { where: 'slides[0]', message: 'A "mermaid" slide needs `diagram`.' },
    ]);
  });

  it('can be composed as a content block without importing Mermaid on the server', () => {
    const markup = renderToStaticMarkup(
      <Block
        block={{
          type: 'mermaid',
          diagram: 'sequenceDiagram\nAuthor->>Deck: YAML',
          caption: 'A portable diagram',
        }}
      />,
    );
    expect(markup).toContain('class="dla-mermaid"');
    expect(markup).toContain('A portable diagram');
  });
});
