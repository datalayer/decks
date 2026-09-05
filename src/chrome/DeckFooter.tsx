/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import type { JSX } from 'react';
import { getLogoColors } from '@datalayer/primer-addons';
// The theme in force and the logo both come from the host: a deck may have
// asked for a theme of its own, and a mark that read the application's store
// directly stayed in the reader's colours while the slide around it moved.
// The colours are worked out here and handed to whichever mark the host gave.
import { useDecksHost, useDecksTheme } from '../host';
import type { DeckFooterSpec, DeckTheme } from '../types';

type DeckFooterProps = {
  footer: DeckFooterSpec;
  theme: DeckTheme;
  /** 1-based. */
  index: number;
  total: number;
};

/**
 * The strip at the bottom of every slide: the mark, a note, the copyright.
 *
 * The year is read now rather than written into a spec, so a deck reused next
 * January does not announce that it is a year old. `since` turns it into a
 * range, and a range that would read `2026–2026` is printed as the one year.
 */
export const DeckFooter = ({
  footer,
  theme,
  index,
  total,
}: DeckFooterProps): JSX.Element => {
  const { colorMode, theme: themeVariant } = useDecksTheme();
  const { Logo } = useDecksHost();
  // `auto` is a preference, and a logo wants a side of the scale.
  const mode: 'light' | 'dark' =
    colorMode === 'auto'
      ? typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : colorMode;
  const logoColors = getLogoColors(themeVariant, mode);
  const year = new Date().getFullYear();
  const years = footer.since && footer.since < year ? `${footer.since}–${year}` : `${year}`;
  return (
    <div className="dla-slide-footer">
      {footer.logo && (
        <a
          className="dla-slide-footer-logo"
          href={footer.href}
          target="_blank"
          rel="noopener noreferrer"
          // The logo is the link, so it needs a name of its own for anyone
          // reading the deck with a screen reader.
          aria-label={`${footer.holder} — ${footer.href}`}
        >
          {Logo ? (
            <Logo
              height={26}
              // The theme in force rather than the stored one: a wordmark's
              // gradients are picked by the variant, so colours alone would
              // leave it in the reader's theme on a deck drawn in another.
              variant={themeVariant}
              colorMode={colorMode}
              inverse={theme.logo.inverse}
              colored={theme.logo.colored}
              // The template's own colours win where it names any; otherwise
              // the theme in force, which is the deck's when it asked for one
              // and the reader's when it did not.
              primaryColor={theme.logo.primaryColor ?? logoColors.primary}
              secondaryColor={theme.logo.secondaryColor ?? logoColors.secondary}
              textColor={theme.logo.textColor ?? logoColors.textColor}
            />
          ) : (
            <span className="dla-slide-footer-holder">{footer.holder}</span>
          )}
        </a>
      )}
      {footer.note && <div className="dla-slide-footer-note">{footer.note}</div>}
      <div className="dla-slide-footer-legal">
        <a href={footer.href} target="_blank" rel="noopener noreferrer">
          {footer.href.replace(/^https?:\/\//, '')}
        </a>
        <span>
          © {years} {footer.holder}
        </span>
        {footer.slideNumbers && (
          <span className="dla-slide-footer-number">
            {index} / {total}
          </span>
        )}
      </div>
    </div>
  );
};

export default DeckFooter;
