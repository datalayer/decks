/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The reading view: the deck in a 16:9 frame with its title, a Present button
 * and a way to the print view. Which deck, and at which slide, is the host's
 * to decide — from a route, from a list, from a command. This only draws.
 *
 * @module DeckView
 */

import type { JSX } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box, Button, Heading, Text } from '@primer/react';
import { themeConfigs, type ColorMode, type ThemeVariant } from '@datalayer/primer-addons';
import { DownloadIcon, ScreenFullIcon, ScreenNormalIcon } from '@primer/octicons-react';
import { DeckRenderer } from './runtime/DeckRenderer';
import { useDecksTheme } from './host';
import { setDeckThemeOverride } from './deckThemeOverride';
import type { DeckSpec } from './types';

/**
 * How much of the window the application is using around the deck.
 *
 * Measured rather than assumed, because this page renders under two different
 * chromes: the anonymous header alone, and the authenticated header with a
 * sidebar and whatever the layout puts around a view. The deck is 16:9 and
 * capped at the room that is left, and this is what "the room that is left"
 * comes to on this particular page.
 *
 * Safe against a feedback loop: the value only ever changes the deck's width
 * and height, and neither moves the frame's own top edge.
 */
const useChromeHeight = (element: React.RefObject<HTMLElement | null>): number => {
  const [chrome, setChrome] = useState(260);
  useLayoutEffect(() => {
    const measure = () => {
      const node = element.current;
      if (!node) {
        return;
      }
      // The top of the deck, plus the same amount of air underneath it.
      const top = node.getBoundingClientRect().top + window.scrollY;
      setChrome(Math.max(120, Math.round(top + 48)));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [element]);
  return chrome;
};

/**
 * Presenting: the deck itself filling the screen.
 *
 * The element is `.dla-deck` inside the frame, not the frame — that is the one
 * Reveal measures and the one its own `f` shortcut fullscreens, and a Present
 * button that picked a different element would put the two out of step.
 */
const useFullscreen = (
  frame: React.RefObject<HTMLElement | null>,
): [boolean, () => void] => {
  const [full, setFull] = useState(false);
  const deck = useCallback(
    () => frame.current?.querySelector('.dla-deck') as HTMLElement | null,
    [frame],
  );
  useEffect(() => {
    // Listened for rather than assumed: Escape and the browser's own controls
    // leave fullscreen without going through the button.
    const sync = () => setFull(document.fullscreenElement === deck());
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [deck]);
  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    const node = deck();
    void node?.requestFullscreen?.();
    // An embedded deck ignores the keyboard until it has been clicked; Reveal
    // takes focus on a `pointerdown` on the deck itself. Pressing a button
    // beside the deck is not that, so a presenter would land in fullscreen
    // with dead arrow keys. Tell Reveal what the click would have told it.
    node?.dispatchEvent(new Event('pointerdown'));
  }, [deck]);
  return [full, toggle];
};

type DeckViewProps = {
  spec: DeckSpec;
  /**
   * Where the deck prints itself, when it has such a place. Opened in a tab of
   * its own by the Download PDF button; see `DeckPrintPage` for why a tab.
   */
  printPath?: string;
  /** The slide to show, 1-based; the first when absent. */
  slide?: number;
  /** The reader moved to another slide. */
  onSlideChange?: (slide: number) => void;
};

/**
 * One deck, with the little chrome that belongs to the page rather than to the
 * deck: its name, and a way to present it.
 *
 * That chrome is Primer components and no CSS of its own, so it is themed by
 * the application exactly like every other view. The deck below it is themed
 * by whichever template its spec names — which, for the default `datalayer`
 * template, comes to the same thing: Primer tokens throughout, so the slides
 * wear whichever primer-addons theme and colour mode the reader picked.
 *
 * There is deliberately no template switcher here. Which template a deck wears
 * is the spec's decision, made once by whoever wrote it; a control offering to
 * change it is three unexplained words above somebody else's presentation.
 */
/**
 * Draw the page in the theme the deck asked for, for as long as it is shown.
 *
 * Checked against the registry rather than cast: a spec naming a theme that
 * does not exist should leave the reader's own alone rather than send the
 * provider to its default, which is neither.
 */
const useDeckTheme = (spec: DeckSpec): void => {
  const asked = spec.deck.theme;
  const mode = spec.deck.colorMode;
  useEffect(() => {
    const variant =
      asked && asked in themeConfigs ? (asked as ThemeVariant) : undefined;
    const colorMode =
      mode === 'light' || mode === 'dark' || mode === 'auto'
        ? (mode as ColorMode)
        : undefined;
    if (!variant && !colorMode) {
      return undefined;
    }
    setDeckThemeOverride({ variant, colorMode });
    // Cleared on the way out — and on a spec change, which is what makes
    // moving from one deck to another land in the right theme.
    return () => setDeckThemeOverride(null);
  }, [asked, mode]);
};

export const DeckView = ({
  spec,
  printPath,
  slide,
  onSlideChange,
}: DeckViewProps): JSX.Element => {
  const frame = useRef<HTMLDivElement>(null);
  const chrome = useChromeHeight(frame);
  const [full, toggleFullscreen] = useFullscreen(frame);
  useDeckTheme(spec);

  return (
    // The same column the header and the home page keep to: 1280 wide,
    // centred, with the page gutter. The layout hands a view the full
    // width, and a deck that took it ran edge to edge under a header that
    // does not.
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        maxWidth: 1280,
        mx: 'auto',
        px: 4,
        py: 4,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 3,
        }}
      >
        <Box>
          <Heading as="h1" sx={{ fontSize: 4 }}>
            {spec.deck.title}
          </Heading>
          {spec.deck.subtitle && (
            <Text sx={{ color: 'fg.muted', fontSize: 1 }}>{spec.deck.subtitle}</Text>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {printPath && (
            <Button
              leadingVisual={DownloadIcon}
              onClick={() => window.open(printPath, '_blank', 'noopener')}
            >
              Download PDF
            </Button>
          )}
          <Button
            leadingVisual={full ? ScreenNormalIcon : ScreenFullIcon}
            onClick={toggleFullscreen}
          >
            {full ? 'Exit' : 'Present'}
          </Button>
        </Box>
      </Box>

      <DeckRenderer
        spec={spec}
        frameRef={frame}
        chrome={chrome}
        slide={slide}
        onSlideChange={onSlideChange}
      />

      <Text sx={{ color: 'fg.muted', fontSize: 0, textAlign: 'center' }}>
        Click the deck to steer it, then arrow keys or space to move ·{' '}
        <strong>f</strong> or Present for fullscreen · <strong>o</strong> for the
        overview · <strong>?</strong> for the rest · Download PDF opens the print
        dialog, where “Save as PDF” keeps the text and the links
      </Text>
    </Box>
  );
};

export default DeckView;
