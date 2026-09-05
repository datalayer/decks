/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import { hasDeckComponent } from './registry/components';
import { DEFAULT_LAYOUTS, columnsOf } from './slides';
import { deckTemplates } from './templates';
import type { BlockSpec, ColumnsSlideSpec, DeckSpec, SlideSpec } from './types';

export type DeckIssue = {
  /** `deck`, or `slides[3]`, or `slides[3].columns[1]`. */
  where: string;
  message: string;
};

/**
 * What a slide must say before it can be drawn.
 *
 * TypeScript already refuses most of this at the keyboard. This exists for
 * what a type cannot check — that the template exists, that the named
 * component is registered — and for the specs that arrive as plain data rather
 * than as a checked literal.
 */
const REQUIRED: Partial<Record<SlideSpec['type'], string[]>> = {
  title: ['title'],
  section: ['title'],
  statement: ['statement'],
  bullets: ['items'],
  metrics: ['metrics'],
  image: ['src'],
  screenshot: ['src'],
  quote: ['quote'],
  comparison: ['columns', 'rows'],
  timeline: ['items'],
  chart: ['series'],
  logos: ['logos'],
  code: ['code'],
  component: ['component'],
};

/** Every component a block names, through any stacks it is made of. */
const namedComponents = (block: BlockSpec): string[] => {
  if (block.type === 'component') {
    return [block.component];
  }
  if (block.type === 'stack') {
    return block.blocks.flatMap(namedComponents);
  }
  return [];
};

const isEmpty = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

/**
 * Everything wrong with a spec, rather than the first thing.
 *
 * A list, because the caller shows all of them at once: finding one problem
 * per reload is how a ten-slide deck takes an afternoon.
 */
export const validateDeck = (spec: DeckSpec): DeckIssue[] => {
  const issues: DeckIssue[] = [];

  if (!spec.deck?.title) {
    issues.push({ where: 'deck', message: 'A deck needs a `title`.' });
  }
  if (spec.deck?.template && !deckTemplates[spec.deck.template]) {
    issues.push({
      where: 'deck',
      message:
        `Unknown template "${spec.deck.template}". Known: ` +
        `${Object.keys(deckTemplates).join(', ')}.`,
    });
  }
  if (!spec.slides?.length) {
    issues.push({ where: 'slides', message: 'A deck needs at least one slide.' });
    return issues;
  }

  spec.slides.forEach((slide, index) => {
    const where = `slides[${index}]`;
    if (!DEFAULT_LAYOUTS[slide.type]) {
      issues.push({
        where,
        message:
          `Unknown slide type "${slide.type}". Known: ` +
          `${Object.keys(DEFAULT_LAYOUTS).join(', ')}.`,
      });
      return;
    }

    for (const field of REQUIRED[slide.type] ?? []) {
      if (isEmpty((slide as unknown as Record<string, unknown>)[field])) {
        issues.push({
          where,
          message: `A "${slide.type}" slide needs \`${field}\`.`,
        });
      }
    }

    if (slide.type === 'title' && slide.visual && !hasDeckComponent(slide.visual)) {
      issues.push({
        where,
        message:
          `Unknown visual "${slide.visual}". Register it in ` +
          'registry/componentsRegistry.ts.',
      });
    }

    if (slide.backdrop && !hasDeckComponent(slide.backdrop)) {
      issues.push({
        where,
        message:
          `Unknown backdrop "${slide.backdrop}". Register it in ` +
          'registry/componentsRegistry.ts.',
      });
    }

    if (slide.type === 'component' && !hasDeckComponent(slide.component)) {
      issues.push({
        where,
        message:
          `Unknown component "${slide.component}". Register it in ` +
          'registry/componentsRegistry.ts.',
      });
    }

    if (
      slide.type === 'columns' ||
      slide.type === 'two-columns' ||
      slide.type === 'three-columns'
    ) {
      // Whichever spelling the spec used, read the way the slide reads it.
      const columns = columnsOf(slide as ColumnsSlideSpec);
      if (columns.length === 0) {
        issues.push({
          where,
          message: 'A columns slide needs `columns`, or `left` and `right`.',
        });
      }
      for (const [position, column] of columns.entries()) {
        for (const name of namedComponents(column)) {
          if (!hasDeckComponent(name)) {
            issues.push({
              where: `${where}.columns[${position}]`,
              message: `Unknown component "${name}".`,
            });
          }
        }
      }
    }
  });

  return issues;
};
