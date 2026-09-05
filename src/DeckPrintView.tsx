/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The deck as pages, for the browser to print to PDF.
 *
 * Reveal's print view needs to *be* the page — it measures the window, sizes
 * the body and tags the document element — so this is meant to be the only
 * thing rendered, on an address of its own that the reading view opens in a
 * new tab. It calls `window.print()` once Reveal reports `pdf-ready`, with a
 * fallback in case it never does. "Save as PDF" in that dialog gives a vector
 * PDF: selectable text, working links, `@page` sized to the slide.
 *
 * @module DeckPrintView
 */

import type { JSX } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { DatalayerThemeProvider } from '@datalayer/primer-addons/lib/theme';
import {
  getThemeConfig,
  themeConfigs,
  type ColorMode,
  type ThemeVariant,
} from '@datalayer/primer-addons';
import { DeckRenderer } from './runtime/DeckRenderer';
import { deckPath, type DeckEntry } from './registry/catalog';
import { DeckAccess } from './DeckAccess';
import { useDecksTheme } from './host';

const PRINT_FALLBACK_MS = 6000;

/**
 * The deck as pages, printing itself: `/decks/:collection/:slug/print`.
 *
 * Opened by the Download PDF button in a tab of its own, because Reveal's
 * print view needs the whole page — it sizes the body, tags the document
 * element and lays every slide out as a page of the slide's proportions. Once
 * Reveal reports the pages ready the print dialog opens, where "Save as PDF"
 * produces a vector PDF: selectable text, working links, the theme's colours.
 *
 * The page carries no application chrome, but it does carry the application's
 * theme — the same provider the layouts use, fed from the same store — so the
 * PDF is the deck as the reader saw it, not a default-themed cousin of it.
 */
export type DeckPrintViewProps = {
  entry: DeckEntry | undefined;
  /** The theme to print in, as the reading view put it on the address. */
  theme?: string | null;
  colorMode?: string | null;
};

/** The theme and mode asked for on a print address, `?theme=…&mode=…`. */
export const printThemeFromAddress = (): { theme: string | null; colorMode: string | null } => {
  if (typeof window === 'undefined') {
    return { theme: null, colorMode: null };
  }
  const params = new URLSearchParams(window.location.search);
  return { theme: params.get('theme'), colorMode: params.get('mode') };
};

export const DeckPrintView = ({
  entry,
  theme: asked,
  colorMode: askedMode,
}: DeckPrintViewProps): JSX.Element => {
  const stored = useDecksTheme();

  // The reading view names the theme it is showing on the address. Trust that
  // over the store: this tab has no layout to activate a variant context, so
  // the store here answers with whichever one happened to be persisted last —
  // which is how a PDF comes out in a theme the reader never chose. The stored
  // value remains the fallback, for a `/print` address typed by hand. Checked
  // against the registry rather than cast: an unknown name would leave the
  // provider on its own default, which is not the reader's either.
  const variant: ThemeVariant =
    asked && asked in themeConfigs ? (asked as ThemeVariant) : stored.theme;
  const colorMode: ColorMode =
    askedMode === 'light' || askedMode === 'dark' || askedMode === 'auto'
      ? askedMode
      : stored.colorMode;

  const themeConfig = getThemeConfig(variant);
  const printed = useRef(false);

  const print = useCallback(() => {
    if (printed.current) {
      return;
    }
    printed.current = true;
    window.print();
  }, []);

  useEffect(() => {
    if (!entry) {
      return undefined;
    }
    // The browser names the PDF after the document, so the document is named
    // after the deck.
    const previous = document.title;
    document.title = entry.spec.deck.title;
    const fallback = window.setTimeout(print, PRINT_FALLBACK_MS);
    return () => {
      window.clearTimeout(fallback);
      document.title = previous;
      // The renderer paints the root in the deck's colour so the printed
      // canvas is not white; it is this page's, and goes with it.
      document.documentElement.style.removeProperty('background');
    };
  }, [entry, print]);

  if (!entry) {
    return <p>There is no deck at this address.</p>;
  }

  return (
    <DatalayerThemeProvider
      colorMode={colorMode}
      theme={themeConfig.primerTheme}
      themeStyles={themeConfig.themeStyles}
    >
      {/*
        The same gate as the reading page. Printing is another way of asking
        for the deck, and a `/print` address that answered without it would
        hand the whole thing over as a PDF.
      */}
      <DeckAccess
        deckId={deckPath(entry)}
        title={entry.spec.deck.title}
        access={entry.spec.deck.access}
      >
        <DeckRenderer spec={entry.spec} mode="print" onPdfReady={print} />
      </DeckAccess>
    </DatalayerThemeProvider>
  );
};

export default DeckPrintView;
