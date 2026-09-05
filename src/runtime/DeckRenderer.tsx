/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import type { JSX } from 'react';
import { useEffect, useMemo, useRef, type CSSProperties, type Ref } from 'react';
import { Deck } from '@revealjs/react';
import RevealHighlight from 'reveal.js/plugin/highlight';
import type { RevealApi, RevealConfig } from 'reveal.js';
import { getColorPalette } from '@datalayer/primer-addons';
// The APPLICATION's store, not the one of primer-addons: a deck may ask to
// be drawn in a theme of its own, and that override lives beside the
// persisted store — see `views/decks/deckThemeOverride`. Reading the base
// store here is what left the footer logo in the reader's own theme while
// everything around it had moved.
import { useDecksTheme } from '../host';
import { resolveTemplate, resolveTheme } from '../templates';
import { validateDeck } from '../validation';
import type { DeckFooterSpec, DeckSpec, DeckTheme } from '../types';
import { SlideRenderer } from './SlideRenderer';

// Reveal's stylesheet, imported the ordinary way: it lives in reveal's own
// package, whose policy keeps it.
import 'reveal.js/reveal.css';
// Ours, as a string. A bare `import '../decks.css'` compiles to nothing here:
// `sideEffects` in package.json names only `style/*.css`, so webpack treats
// this file as pure and tree-shakes the import away — the deck rendered as
// unstyled text and the sourcemap still showed the import. A string that is
// *used* cannot be shaken, so the component mounts it as a `<style>` below,
// after reveal's, which is also the order the overrides want.
import { decksCss } from '../decksCss';

const STYLE_ID = 'dla-decks-stylesheet';

/**
 * Put the deck stylesheet in the document while any deck is mounted.
 *
 * One element shared by every deck on the page, counted rather than owned, so
 * two decks do not inject it twice and the first to unmount does not strip it
 * from the second.
 */
let mounted = 0;
const useDeckStylesheet = (): void => {
  useEffect(() => {
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    // Assigned every time, not only on creation: the element outlives a single
    // deck, and on a hot reload the module's CSS changes underneath it.
    if (style.textContent !== decksCss) {
      style.textContent = decksCss;
    }
    mounted += 1;
    return () => {
      mounted -= 1;
      if (mounted === 0) {
        document.getElementById(STYLE_ID)?.remove();
      }
    };
  }, []);
};

/**
 * What the application decides, and a deck may not.
 *
 * A deck here is a *view*: it renders under the anonymous header, and under
 * the authenticated header and sidebar. Everything in this object follows from
 * that, and a spec that sets any of it is overruled — which is why these are
 * applied last.
 *
 * - `embedded` keeps Reveal inside its own box. Without it Reveal claims the
 *   document element, sets `overflow: hidden` on the page and scrolls the
 *   header out of reach.
 * - `hash` and `history` are off because the URL belongs to react-router.
 *   Reveal would otherwise rewrite the fragment on every slide change and the
 *   router would answer.
 * - `center` is off because the slide layouts do their own placing; Reveal's
 *   vertical centring would fight the footer for the bottom of the slide.
 */
const APPLICATION_CONFIG: RevealConfig = {
  embedded: true,
  hash: false,
  history: false,
  center: false,
  view: null,
  // The coordinate space every slide is designed in. Reveal scales it to
  // whatever the box turns out to be, so these are not pixels on a screen.
  width: 1280,
  height: 720,
  margin: 0,
  minScale: 0.1,
  maxScale: 2,
};

/**
 * What printing decides.
 *
 * Reveal's print view is how a deck becomes a PDF: it lays every slide out as
 * a page of the slide's own proportions, sizes `@page` to match, and fires
 * `pdf-ready` when the browser may print. It needs to *be* the page — it
 * measures the window, sizes the body and tags the document element — which
 * is why it is not embedded, and why the page that asks for it holds nothing
 * else. `controls` and `progress` off: a page has no next button.
 */
const PRINT_CONFIG: RevealConfig = {
  embedded: false,
  hash: false,
  history: false,
  center: false,
  view: 'print',
  controls: false,
  progress: false,
  slideNumber: false,
  width: 1280,
  height: 720,
  margin: 0,
  // Every fragment shown on one page: a printed slide has no "next".
  pdfSeparateFragments: false,
};

const DEFAULT_CONFIG: RevealConfig = {
  controls: true,
  progress: true,
  // The footer prints the slide number; Reveal's own would be a second one.
  slideNumber: false,
  transition: 'slide',
  transitionSpeed: 'default',
  overview: true,
  help: true,
};

type DeckRendererProps = {
  spec: DeckSpec;
  /** Reaches the Reveal instance from outside, for a Present button. */
  deckRef?: Ref<RevealApi | null>;
  /**
   * The 16:9 box in the page. The deck itself is the `.dla-deck` inside it —
   * which is also what Reveal measures and what fullscreen should target, so
   * a caller wanting that element asks this one for `.dla-deck`.
   */
  frameRef?: Ref<HTMLDivElement>;
  onSlideChange?: (index: number) => void;
  /**
   * Room the application takes above and below the deck, in pixels. The deck
   * is 16:9 and never taller than what is left of the window; this is what
   * "what is left" means, and it differs between a page under the anonymous
   * header and one that also has a sidebar and a toolbar.
   */
  chrome?: number;
  /**
   * `embedded` (the default) is the deck as a view of the application, in a
   * 16:9 frame under the header. `print` is the deck as pages, for the
   * browser to print to PDF; see `PRINT_CONFIG`.
   */
  mode?: 'embedded' | 'print';
  /** In `print` mode: Reveal has laid the pages out and printing may begin. */
  onPdfReady?: () => void;
  /**
   * The slide to show, 1-based. Honoured when the deck is ready and whenever
   * it changes afterwards, so the URL can drive the deck as well as follow it.
   */
  slide?: number;
};

const cssVariables = (theme: DeckTheme): CSSProperties =>
  ({
    '--dla-deck-color-scheme': theme.colorScheme,
    '--dla-deck-font': theme.fontFamily,
    '--dla-deck-font-mono': theme.fontFamilyMono,
    '--dla-deck-background': theme.background,
    '--dla-deck-surface': theme.surface,
    '--dla-deck-foreground': theme.foreground,
    '--dla-deck-muted': theme.muted,
    '--dla-deck-accent': theme.accent,
    '--dla-deck-accent-soft': theme.accentSoft,
    '--dla-deck-accent-contrast': theme.accentContrast,
    '--dla-deck-border': theme.border,
    '--dla-deck-code-background': theme.codeBackground,
    '--dla-deck-shadow': theme.shadow,
    '--dla-deck-danger': theme.danger,
    '--dla-deck-code-keyword': theme.code.keyword,
    '--dla-deck-code-string': theme.code.string,
    '--dla-deck-code-comment': theme.code.comment,
    '--dla-deck-code-number': theme.code.number,
    '--dla-deck-code-name': theme.code.name,
    '--dla-deck-title-size': theme.titleSize,
    '--dla-deck-heading-size': theme.headingSize,
    '--dla-deck-body-size': theme.bodySize,
    '--dla-deck-heading-weight': theme.headingWeight,
  }) as CSSProperties;

const SVG_NS = 'http://www.w3.org/2000/svg';
const BACKDROP_CLASS = 'dla-page-backdrop';

/**
 * A filled rectangle behind one printed page.
 *
 * Drawn rather than styled, and that is the whole point: "Background graphics"
 * is a switch for *decoration*, and a CSS background is decoration by
 * definition, so a reader who leaves it off gets white pages however loudly
 * the stylesheet asks otherwise. An `<svg><rect>` is content — the same class
 * of thing as the text and the logos, which print for that reader already.
 *
 * It carries its own geometry inline so that it cannot become a stray block in
 * the flow if the stylesheet is ever missing.
 */
const paintPageBackdrop = (page: HTMLElement, colour: string): void => {
  let backdrop = page.querySelector<SVGSVGElement>(`:scope > .${BACKDROP_CLASS}`);
  if (!backdrop) {
    backdrop = document.createElementNS(SVG_NS, 'svg');
    backdrop.setAttribute('class', BACKDROP_CLASS);
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.setAttribute('preserveAspectRatio', 'none');
    backdrop.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    backdrop.appendChild(document.createElementNS(SVG_NS, 'rect'));
    // First child, so the slide that follows it in the DOM paints on top.
    page.insertBefore(backdrop, page.firstChild);
  }
  const rect = backdrop.firstElementChild as SVGRectElement;
  rect.setAttribute('width', '100%');
  rect.setAttribute('height', '100%');
  rect.setAttribute('fill', colour);
};

/**
 * Paint the printed pages in the deck's colour, concretely.
 *
 * Reveal snapshots a background while it builds the pages and writes it inline
 * on each one, so the colour of the instant the deck initialised is baked in —
 * wrong if the theme settles a moment later, and unreachable by any stylesheet.
 * The answer is not to take that inline paint off and hope the cascade covers
 * it: a page background is the one thing here that must not fail, and leaving
 * it to a token means it fails whenever the token does not resolve.
 *
 * So each page is repainted with the colour the deck *actually* resolved to —
 * concrete, so nothing has to resolve at print time; inline, so nothing can
 * outrank it; and redone whenever the theme changes, so nothing goes stale.
 * `print-color-adjust` rides along, because a browser drops backgrounds when
 * "Background graphics" is off unless the element says otherwise.
 */
const paintForPrint = (): void => {
  const deck = document.querySelector('.dla-deck') as HTMLElement | null;
  if (!deck) {
    return;
  }
  const painted = window.getComputedStyle(deck).backgroundColor;
  if (!painted || painted === 'rgba(0, 0, 0, 0)') {
    return;
  }
  // The shorthand, not `background-color`: the application's shell paints a
  // radial gradient on the document element — a blue-to-mint wash, meant to
  // sit behind the shell while it loads — and every layout then covers it
  // with a full-width themed surface. The print page is 1280px of body on an
  // otherwise bare document, so that gradient showed either side of it; and a
  // `background-image` paints *over* a `background-color`, so setting the
  // colour alone left the wash exactly where it was.
  document.documentElement.style.setProperty('background', painted, 'important');
  for (const page of document.querySelectorAll<HTMLElement>('.pdf-page')) {
    // Both: the background for a reader who prints with graphics on, and for
    // the screen; the drawn rectangle for the reader who does not.
    page.style.setProperty('background', painted);
    page.style.setProperty('print-color-adjust', 'exact');
    page.style.setProperty('-webkit-print-color-adjust', 'exact');
    paintPageBackdrop(page, painted);
  }
};

/**
 * Go to a slide without the journey.
 *
 * `slide()` animates from wherever the deck is, which on first show is slide
 * one — so opening a deck at slide nine played eight transitions. Reveal's own
 * `no-transition` class stops that; set for the duration of the move, and
 * taken off once the browser has painted the destination.
 */
const jumpTo = (api: RevealApi, index: number): void => {
  const element = api.getRevealElement();
  element?.classList.add('no-transition');
  api.slide(index);
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => element?.classList.remove('no-transition'));
  });
};

/**
 * A spec, rendered.
 *
 * The four layers meet here and nowhere else: the spec says what the deck is,
 * the template says what it looks like, the slide library draws it, and Reveal
 * runs it. Everything above this line is data.
 */
export const DeckRenderer = ({
  spec,
  deckRef,
  frameRef,
  onSlideChange,
  chrome = 260,
  mode = 'embedded',
  onPdfReady,
  slide,
}: DeckRendererProps): JSX.Element => {
  useDeckStylesheet();
  const printing = mode === 'print';
  const api = useRef<RevealApi | null>(null);

  // The URL changed under a running deck — back button, or a typed address.
  useEffect(() => {
    const deck = api.current;
    if (!deck || printing || !slide) {
      return;
    }
    if (deck.getIndices().h !== slide - 1) {
      jumpTo(deck, slide - 1);
    }
  }, [slide, printing]);
  const { colorMode, theme: themeVariant } = useDecksTheme();
  const palette = getColorPalette(themeVariant, colorMode);
  const template = resolveTemplate(spec.deck.template);

  // `colorMode` is a preference and may be `auto`; a theme wants the mode that
  // is actually showing.
  const effectiveColorMode: 'light' | 'dark' =
    colorMode === 'auto' ? (palette.isLight ? 'light' : 'dark') : colorMode;

  const theme = useMemo(
    () => resolveTheme(template, { palette, colorMode: effectiveColorMode }),
    [template, palette, effectiveColorMode],
  );

  const footer: DeckFooterSpec = useMemo(
    () => ({ ...template.footer, ...spec.deck.footer }),
    [template.footer, spec.deck.footer],
  );

  const config = useMemo(
    () => ({
      ...DEFAULT_CONFIG,
      ...template.config,
      ...(spec.deck.transition ? { transition: spec.deck.transition } : {}),
      ...spec.deck.config,
      ...(printing ? PRINT_CONFIG : APPLICATION_CONFIG),
    }),
    [template.config, spec.deck.transition, spec.deck.config, printing],
  );

  // Reported rather than thrown: a deck with one unusable slide is still a
  // deck, and whoever is fixing it wants to know which slide and why.
  const issues = useMemo(() => validateDeck(spec), [spec]);

  // Again whenever the theme settles or changes, for the pages Reveal has
  // already built.
  useEffect(() => {
    if (printing) {
      paintForPrint();
    }
  }, [printing, theme]);

  const total = spec.slides.length;

  const slides = spec.slides.map((slide, position) => (
    <SlideRenderer
      key={slide.id ?? `${position}-${slide.type}`}
      slide={slide}
      template={template}
      theme={theme}
      footer={footer}
      index={position + 1}
      total={total}
    />
  ));

  if (printing) {
    // No frame: the print view sizes the body itself, and a 16:9 box capped
    // at the window would be a second opinion. The tokens go on the deck.
    return (
      <Deck
        className="dla-deck dla-deck--print"
        style={cssVariables(theme)}
        config={config}
        plugins={[RevealHighlight]}
        deckRef={deckRef}
        onReady={deck => {
          // Not one of the wrapper's event props, so it is wired by hand; the
          // deck is destroyed with the page, which takes the listener with it.
          deck.on('pdf-ready', () => {
            // Reveal marks every slide but the current one `hidden` and relies
            // on its print stylesheet's `display: block !important` to show
            // them all on paper. Current Chromium (151, checked) lets the
            // attribute win over that rule, so pages two onward printed as
            // blank backgrounds. On paper nothing is hidden; say so.
            deck
              .getRevealElement()
              ?.querySelectorAll('.slides section')
              .forEach(section => {
                section.removeAttribute('hidden');
                section.removeAttribute('aria-hidden');
              });
            // The pages exist by now, so this is where their inline paint
            // comes off and the root takes the deck's colour.
            paintForPrint();
            onPdfReady?.();
          });
        }}
      >
        {slides}
      </Deck>
    );
  }

  return (
    <>
      {issues.length > 0 && (
        <div className="dla-deck-issues" style={cssVariables(theme)} role="alert">
          <strong>This deck has {issues.length} problem(s):</strong>
          <ul>
            {issues.map(issue => (
              <li key={`${issue.where}-${issue.message}`}>
                <code>{issue.where}</code> — {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {/*
        The frame carries the theme and the shape; nothing else. Reveal, when
        embedded, takes the nearest ancestor carrying `reveal-viewport` and
        falls back to its own `.reveal` element — and this frame deliberately
        does not carry it, so `.reveal` is the viewport. Claiming it here
        would work exactly once: `destroy()` takes the class back off, and the
        second mount would leave this element unstyled.
      */}
      <div
        ref={frameRef}
        className="dla-deck-frame"
        style={{ ...cssVariables(theme), '--dla-deck-chrome': `${chrome}px` } as CSSProperties}
      >
        <Deck
          className="dla-deck"
          config={config}
          plugins={[RevealHighlight]}
          deckRef={deckRef}
          onReady={deck => {
            api.current = deck;
            if (slide && slide > 1) {
              jumpTo(deck, slide - 1);
            }
          }}
          onSlideChange={
            onSlideChange
              ? event => onSlideChange(((event as { indexh?: number }).indexh ?? 0) + 1)
              : undefined
          }
        >
          {slides}
        </Deck>
      </div>
    </>
  );
};

export default DeckRenderer;
