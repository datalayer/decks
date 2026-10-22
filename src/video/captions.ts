/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * A caption laid out to be drawn on a video frame: cut into lines that fit the
 * caption box, at the largest size that keeps it to a few lines. The
 * measuring is given (a canvas's `measureText` in the browser), so the rules
 * are tested without one.
 *
 * @module video/captions
 */

/** How wide `text` is drawn at `size` pixels. */
export type MeasureText = (text: string, size: number) => number;

/** Words into lines no wider than `maxWidth`; a word wider than that has a line of its own. */
export const wrapCaption = (
  text: string,
  maxWidth: number,
  size: number,
  measure: MeasureText,
): string[] => {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const tried = line ? `${line} ${word}` : word;
    if (!line || measure(tried, size) <= maxWidth) {
      line = tried;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
};

export type CaptionLayout = { size: number; lines: string[] };

/**
 * The caption at the first of `sizes` (largest first) whose lines number no
 * more than `maxLines`; a sentence too long for any is set at the smallest
 * size, in as many lines as it takes.
 */
export const fitCaption = (
  text: string,
  maxWidth: number,
  maxLines: number,
  sizes: ReadonlyArray<number>,
  measure: MeasureText,
): CaptionLayout => {
  if (!sizes.length) {
    throw new Error('A caption needs at least one size.');
  }
  for (const size of sizes) {
    const lines = wrapCaption(text, maxWidth, size, measure);
    if (lines.length <= maxLines) {
      return { size, lines };
    }
  }
  const smallest = sizes[sizes.length - 1];
  return { size: smallest, lines: wrapCaption(text, maxWidth, smallest, measure) };
};
