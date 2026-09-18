/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import { hasDeckComponent } from './registry/components';
import { DEFAULT_LAYOUTS, columnsOf } from './slides';
import { deckTemplates } from './templates';
import type { BlockSpec, ColumnsSlideSpec, DeckSpec, SlideSpec } from './types';

/**
 * How much an issue matters.
 *
 * `error` — the spec cannot be drawn as written, and a host should not save
 * it. `warning` — it names something this host has not registered, a
 * component or a backdrop: another host may have it, and the slide draws a
 * notice where it would be, so the deck is still a deck.
 */
export type DeckIssueSeverity = 'error' | 'warning';

export type DeckIssue = {
  /** `deck`, or `slides[3]`, or `slides[3].columns[1]`, or `line 4, column 7`. */
  where: string;
  message: string;
  /** `error` unless said otherwise; see {@link DeckIssueSeverity}. */
  severity?: DeckIssueSeverity;
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
  artifact: ['title', 'visual'],
  image: ['src'],
  screenshot: ['src'],
  quote: ['quote'],
  comparison: ['columns', 'rows'],
  flow: ['items'],
  'feature-showcase': ['title', 'coreTitle', 'features'],
  timeline: ['items'],
  chart: ['series'],
  logos: ['logos'],
  code: ['code'],
  mermaid: ['diagram'],
  component: ['component'],
  closing: ['title'],
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

    if (
      slide.type === 'feature-showcase' &&
      Array.isArray(slide.features) &&
      slide.features.length !== 5
    ) {
      issues.push({
        where,
        message: 'A "feature-showcase" slide needs exactly five features.',
      });
    }

    if (slide.type === 'title' && slide.visual && !hasDeckComponent(slide.visual)) {
      issues.push({
        where,
        message:
          `Unknown visual "${slide.visual}". Register it in ` + 'registry/componentsRegistry.ts.',
        severity: 'warning',
      });
    }

    if (slide.backdrop && !hasDeckComponent(slide.backdrop)) {
      issues.push({
        where,
        message:
          `Unknown backdrop "${slide.backdrop}". Register it in ` +
          'registry/componentsRegistry.ts.',
        severity: 'warning',
      });
    }

    if (slide.type === 'component' && !hasDeckComponent(slide.component)) {
      issues.push({
        where,
        message:
          `Unknown component "${slide.component}". Register it in ` +
          'registry/componentsRegistry.ts.',
        severity: 'warning',
      });
    }

    if (
      slide.type === 'artifact' &&
      slide.visual?.component &&
      !hasDeckComponent(slide.visual.component)
    ) {
      issues.push({
        where,
        message:
          `Unknown artifact component "${slide.visual.component}". Register it in ` +
          'registry/componentsRegistry.ts.',
        severity: 'warning',
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
              severity: 'warning',
            });
          }
        }
      }
    }
  });

  return issues;
};

/** What {@link validateDeckSpec} makes of a specification. */
export type DeckSpecValidation = {
  /**
   * The spec, when there is one to draw: parsed if it came as text, and
   * shaped like a deck. Present even when there are issues, so a host can
   * show what it would look like while saying what is wrong.
   */
  spec?: DeckSpec;
  /** Everything wrong with it, the errors before the warnings. */
  issues: DeckIssue[];
  /** Whether it may be used: no issue is an error. Warnings do not count. */
  valid: boolean;
};

/**
 * Where a JSON parser stopped, as a person counts it.
 *
 * Engines say it differently: V8 as a `position` in the text, and lately as
 * `line … column …`; Firefox as `line … column …` too. Whichever came, it is
 * turned into a line and a column, which is what somebody editing the text
 * can find.
 */
const whereParsingStopped = (text: string, message: string): string => {
  const lineColumn = /line (\d+) column (\d+)/i.exec(message);
  if (lineColumn) {
    return `line ${lineColumn[1]}, column ${lineColumn[2]}`;
  }
  const position = /position (\d+)/i.exec(message);
  if (position) {
    const before = text.slice(0, Number(position[1]));
    const lines = before.split('\n');
    return `line ${lines.length}, column ${lines[lines.length - 1].length + 1}`;
  }
  return 'text';
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Validate a deck specification as a host receives one: as text somebody
 * typed or uploaded, or as data from anywhere.
 *
 * {@link validateDeck} takes a `DeckSpec` and trusts its shape; this is what
 * comes before it. Text is parsed as JSON and a parse error is reported with
 * the line and column it stopped at. The result must be a deck — a `deck`
 * object and a `slides` array, each slide an object with a `type` — and only
 * then is it validated slide by slide. Every issue carries a severity, the
 * errors come first, and `valid` says whether any of them is an error.
 *
 * What a host does with it: refuse to save what is not `valid`, show every
 * issue, and — when `spec` is there — keep drawing it, since a deck with one
 * unusable slide is still a deck.
 */
export const validateDeckSpec = (input: unknown): DeckSpecValidation => {
  let data: unknown = input;
  if (typeof input === 'string') {
    if (!input.trim()) {
      return {
        issues: [{ where: 'text', message: 'The specification is empty.', severity: 'error' }],
        valid: false,
      };
    }
    try {
      data = JSON.parse(input);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        issues: [
          {
            where: whereParsingStopped(input, message),
            message: `Not valid JSON: ${message}`,
            severity: 'error',
          },
        ],
        valid: false,
      };
    }
  }

  if (!isRecord(data) || !isRecord(data.deck) || !Array.isArray(data.slides)) {
    return {
      issues: [
        {
          where: 'deck',
          message: 'A deck is `{ "deck": { "title": … }, "slides": [ … ] }`.',
          severity: 'error',
        },
      ],
      valid: false,
    };
  }

  // A slide that is not an object with a type cannot even be looked up.
  const malformed: DeckIssue[] = [];
  data.slides.forEach((slide, index) => {
    if (!isRecord(slide) || typeof slide.type !== 'string' || !slide.type) {
      malformed.push({
        where: `slides[${index}]`,
        message: 'A slide is an object with a `type`.',
        severity: 'error',
      });
    }
  });
  if (malformed.length > 0) {
    return { issues: malformed, valid: false };
  }

  const spec = data as unknown as DeckSpec;
  const issues = validateDeck(spec).map(issue => ({
    ...issue,
    severity: issue.severity ?? ('error' as const),
  }));
  // Errors first: they are what stands between the author and a save.
  issues.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
  return {
    spec,
    issues,
    valid: !issues.some(issue => issue.severity === 'error'),
  };
};
