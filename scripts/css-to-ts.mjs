/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * `src/decks.css` → `src/decksCss.ts`, and a copy under `style/`.
 *
 * The renderer mounts the stylesheet as a `<style>` element from a string, so
 * it cannot be tree-shaken away by a host whose `sideEffects` does not name
 * it — the failure the ui hit, where the deck rendered as unstyled text. A
 * string module is a string module in every bundler; a `?raw` import is not.
 * `style/decks.css` is the same text for a host that would rather link it.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src', 'decks.css'), 'utf8');
const banner =
  '/* Generated from src/decks.css by scripts/css-to-ts.mjs — edit the CSS, not this file. */\n';
writeFileSync(
  join(root, 'src', 'decksCss.ts'),
  `${banner}export const decksCss: string = ${JSON.stringify(css)};\nexport default decksCss;\n`,
);
mkdirSync(join(root, 'style'), { recursive: true });
writeFileSync(join(root, 'style', 'decks.css'), css);
