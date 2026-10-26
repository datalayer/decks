/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * `<Deck>` — a deck in an MDX page.
 *
 * Drawn in the browser only: during the prerender, and until the engine has
 * loaded, the page holds the deck's place with a box of the slides' shape, so
 * nothing moves when the slides arrive. The engine itself is loaded from a
 * module the server build is given nothing for (see the plugin's
 * `configureWebpack`).
 */

import type { CSSProperties, JSX } from 'react';
import { lazy, Suspense } from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import { usePluginData } from '@docusaurus/useGlobalData';

const DeckClient = lazy(() => import('@datalayer/decks-docusaurus/client'));

export type DeckProps = {
  /** The deck, as data: usually a `.deck.json` the page imports. */
  spec: unknown;
  /**
   * The toolbar's controls, comma-separated (`notes,present`); the site's
   * default (the plugin's `controls` option) when absent.
   */
  controls?: string;
};

const PLACEHOLDER: CSSProperties = {
  aspectRatio: '16 / 9',
  width: '100%',
  margin: '1.5rem 0',
  border: '1px solid var(--ifm-color-emphasis-300)',
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--ifm-color-emphasis-600)',
};

const Placeholder = ({ title }: { title?: string }): JSX.Element => (
  <div style={PLACEHOLDER} aria-busy="true">
    {title ? `${title} — loading the slides…` : 'Loading the slides…'}
  </div>
);

const titleOf = (spec: unknown): string | undefined => {
  const deck = (spec as { deck?: { title?: unknown } } | null)?.deck;
  return typeof deck?.title === 'string' ? deck.title : undefined;
};

export default function Deck({ spec, controls }: DeckProps): JSX.Element {
  const site = usePluginData('docusaurus-plugin-decks') as { controls?: string[]; theme?: string } | undefined;
  const shown = controls ?? (site?.controls ?? []).join(',');
  const placeholder = <Placeholder title={titleOf(spec)} />;
  return (
    <BrowserOnly fallback={placeholder}>
      {() => (
        <Suspense fallback={placeholder}>
          <DeckClient spec={spec} controls={shown} theme={site?.theme ?? 'loop'} />
        </Suspense>
      )}
    </BrowserOnly>
  );
}
