/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The build-time check of a site's deck files.
 *
 * It runs in Node, where the deck engine cannot (its templates are React), so
 * it checks what a broken file breaks first — that it is JSON, shaped like a
 * deck, with slide types the engine knows, and no longer than the site
 * allows — and leaves the rest to `validateDeckSpec`, which the page runs
 * when it draws the deck. A file that fails here fails the build: a page
 * whose slides cannot be drawn is a bug, not a warning.
 */

/** The slide types of `@datalayer/decks` (`SlideType`); a test holds the two together. */
export const SLIDE_TYPES: readonly string[] = [
  'title',
  'section',
  'statement',
  'bullets',
  'columns',
  'two-columns',
  'three-columns',
  'metrics',
  'artifact',
  'image',
  'screenshot',
  'quote',
  'comparison',
  'flow',
  'feature-showcase',
  'timeline',
  'chart',
  'logos',
  'code',
  'mermaid',
  'component',
  'closing',
];

/** One thing wrong with a deck file, where it is. */
export type DeckFileProblem = {
  /** The file, as the caller named it. */
  file: string;
  /** Where in the deck: `deck.title`, `slides[3].type`, or `file`. */
  where: string;
  message: string;
};

export type DeckFileCheck = {
  /** The most slides a deck may have; no limit when absent. */
  maxSlides?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** What is wrong with one deck file's text; nothing when it is fine. */
export const checkDeckFile = (
  file: string,
  text: string,
  { maxSlides }: DeckFileCheck = {},
): DeckFileProblem[] => {
  const problems: DeckFileProblem[] = [];
  const problem = (where: string, message: string) =>
    problems.push({ file, where, message });
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    problem('file', `not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return problems;
  }
  if (!isRecord(data) || !isRecord(data.deck) || !Array.isArray(data.slides)) {
    problem('file', 'a deck is { "deck": { "title": …, "template": … }, "slides": [ … ] }');
    return problems;
  }
  if (typeof data.deck.title !== 'string' || !data.deck.title.trim()) {
    problem('deck.title', 'the deck needs a title');
  }
  if (typeof data.deck.template !== 'string' || !data.deck.template.trim()) {
    problem('deck.template', 'the deck needs a template, such as "datalayer"');
  }
  if (data.slides.length === 0) {
    problem('slides', 'the deck has no slide');
  }
  if (maxSlides !== undefined && data.slides.length > maxSlides) {
    problem('slides', `${data.slides.length} slides, more than the ${maxSlides} this site allows`);
  }
  data.slides.forEach((slide, index) => {
    if (!isRecord(slide)) {
      problem(`slides[${index}]`, 'a slide is an object');
      return;
    }
    if (typeof slide.type !== 'string' || !SLIDE_TYPES.includes(slide.type)) {
      problem(
        `slides[${index}].type`,
        `"${String(slide.type)}" is not a slide type (${SLIDE_TYPES.join(', ')})`,
      );
    }
  });
  return problems;
};

/** The problems as the build prints them, one per line. */
export const describeProblems = (problems: readonly DeckFileProblem[]): string =>
  problems.map(({ file, where, message }) => `${file} (${where}): ${message}`).join('\n');
