/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import type { ReactNode } from 'react';

/**
 * The three bits of markup a slide is allowed: `**bold**`, `` `code` `` and
 * `[label](href)`.
 *
 * Not markdown, deliberately. A slide is a handful of words and a full
 * markdown renderer would let a spec smuggle in headings, tables and images
 * that the template has no say over — which is exactly the split this whole
 * layer exists to keep. Anything a spec cannot say in these three marks is a
 * slide type, or the `component` escape hatch.
 */
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

export const inline = (text: string): ReactNode[] =>
  text.split(INLINE).map((part, position) => {
    const key = `${position}-${part}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      // Bold may wrap the other two — `**\`daytona\`**` is a bold code span,
      // not bold text with backticks in it — so the inside is read again.
      return <strong key={key}>{inline(part.slice(2, -2))}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={key}>{part.slice(1, -1)}</code>;
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      return (
        <a key={key} href={link[2]} target="_blank" rel="noopener noreferrer">
          {link[1]}
        </a>
      );
    }
    return part;
  });

/**
 * A paragraph per blank-line-separated block, so a spec can write prose in a
 * template literal and have it come out as paragraphs.
 */
export const paragraphs = (text: string): ReactNode =>
  text
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph, position) => (
      <p key={`${position}-${paragraph.slice(0, 24)}`}>
        {inline(paragraph.trim())}
      </p>
    ));
