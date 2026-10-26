/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The Docusaurus plugin: Datalayer Decks in a documentation site.
 *
 * A page draws a deck with the `<Deck>` theme component, from a deck written
 * as data in a `.deck.json` file the page imports:
 *
 * ```mdx
 * import Deck from '@theme/Deck';
 * import sessionKeys from '@site/decks/session-keys.deck.json';
 *
 * <Deck spec={sessionKeys} />
 * ```
 *
 * The plugin checks every `.deck.json` under `decksDir` when the site builds
 * (and again when one changes under `docusaurus start`), so a deck that cannot
 * be drawn stops the build rather than reaching a reader. It keeps the deck
 * engine out of the server bundle: decks draw in the browser only.
 */

import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkDeckFile, describeProblems, type DeckFileProblem } from './check.js';

export { checkDeckFile, describeProblems, SLIDE_TYPES } from './check.js';
export type { DeckFileProblem, DeckFileCheck } from './check.js';

/** The plugin's name, under which the client reads its options. */
export const PLUGIN_NAME = 'docusaurus-plugin-decks';

/** The module the theme loads the deck from: the real one in the browser, nothing on the server. */
const CLIENT_MODULE = '@datalayer/decks-docusaurus/client';

export type DecksPluginOptions = {
  /** Where the site's decks are, from the site's directory. `decks` when absent. */
  decksDir?: string;
  /** The most slides a deck may have; no limit when absent. */
  maxSlides?: number;
  /**
   * The toolbar's controls of every deck (`notes`, `play`, `present`, and
   * the engine's `pdf` and `video`), unless a `<Deck controls="…">` says
   * otherwise. `notes`, `play` and `present` when absent. *Play* shows each
   * slide's notes as captions at reading pace, with no voice; `pdf` needs a
   * print route and `video` a voice, which a documentation site lacks.
   */
  controls?: string[];
  /**
   * The primer-addons theme variant the decks wear: `loop` (what datalayer.ai
   * wears) when absent, or `datalayer`, `spatial` and the others. Its face is
   * loaded with it when it is `loop`'s Inter.
   */
  theme?: string;
};

/**
 * The modules there must be one copy of in a page: the site's own. A deck
 * engine resolved from elsewhere in a workspace would otherwise bring its own
 * React, which is a broken-hooks error rather than a duplicated byte.
 */
const SHARED = ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client'];

/** Where `name` resolves from the site: an alias that pins every import of it there. */
const sharedAliases = (siteDir: string): Record<string, string> => {
  const fromSite = createRequire(path.join(siteDir, 'package.json'));
  const aliases: Record<string, string> = {};
  for (const name of SHARED) {
    try {
      // `name$` so that only the bare name is pinned, never `react-dom/…` by prefix.
      aliases[`${name}$`] = fromSite.resolve(name);
    } catch {
      // A module the site does not have (an older React): nothing to pin.
    }
  }
  return aliases;
};

/** What the client reads (`usePluginData`). */
export type DecksGlobalData = {
  controls: string[];
  theme: string;
};

export const DEFAULT_THEME = 'loop';

export const DEFAULT_CONTROLS: readonly string[] = ['notes', 'play', 'present'];

type LoadContext = { siteDir: string };

type ContentLoadedArgs = {
  content: unknown;
  actions: { setGlobalData: (data: DecksGlobalData) => void };
};

/** Every `.deck.json` under `dir`, recursively; none when it does not exist. */
const deckFiles = async (dir: string): Promise<string[]> => {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true, recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.deck.json'))
    .map(entry => path.join(entry.parentPath, entry.name))
    .sort();
};

export default function decksPlugin(
  context: LoadContext,
  options: DecksPluginOptions = {},
) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const decksDir = path.resolve(context.siteDir, options.decksDir ?? 'decks');
  const controls = options.controls ?? [...DEFAULT_CONTROLS];
  const theme = options.theme ?? DEFAULT_THEME;
  if (options.maxSlides !== undefined && !(options.maxSlides >= 1)) {
    throw new Error(`${PLUGIN_NAME}: maxSlides must be at least 1`);
  }

  return {
    name: PLUGIN_NAME,

    getThemePath() {
      return path.join(here, 'theme');
    },

    getPathsToWatch() {
      return [path.join(decksDir, '**', '*.deck.json')];
    },

    async loadContent() {
      const files = await deckFiles(decksDir);
      const problems: DeckFileProblem[] = [];
      for (const file of files) {
        const text = await readFile(file, 'utf8');
        problems.push(
          ...checkDeckFile(path.relative(context.siteDir, file), text, {
            maxSlides: options.maxSlides,
          }),
        );
      }
      if (problems.length > 0) {
        throw new Error(`${PLUGIN_NAME}: decks that cannot be drawn:\n${describeProblems(problems)}`);
      }
      return { decks: files.length };
    },

    async contentLoaded({ actions }: ContentLoadedArgs) {
      actions.setGlobalData({ controls, theme });
    },

    configureWebpack(_config: unknown, isServer: boolean) {
      return {
        resolve: {
          alias: {
            ...sharedAliases(context.siteDir),
            // The deck engine is React and Reveal, with a design system: there
            // is nothing for a prerender to gain by compiling it, and the
            // theme draws it only in the browser (`BrowserOnly`).
            [CLIENT_MODULE]: isServer ? false : path.join(here, 'client', 'DeckClient.js'),
          },
        },
        module: {
          rules: [
            {
              // Packages compiled by `tsc` import their siblings without a
              // file extension, which webpack refuses in an ES module.
              test: /\.m?js$/,
              resolve: { fullySpecified: false },
            },
          ],
        },
      };
    },
  };
}
