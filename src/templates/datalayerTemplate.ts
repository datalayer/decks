/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import type { DeckFooterSpec, DeckTemplate, DeckTheme } from '../types';

/**
 * The typeface of the application, whichever theme is on.
 *
 * Each primer-addons theme that brings its own face — Palatino for ivory,
 * Georgia for sand — publishes it as `--fontStack-sansSerif` on the themed
 * container (see `buildThemeStyles`), and the themes that do not leave
 * Primer's own system stack there. Spending the token is what makes a deck
 * set in the same type as the page around it; the fallback is Primer's stack,
 * for a deck rendered somewhere no theme reached.
 */
export const DECK_FONT =
  'var(--fontStack-sansSerif, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif)';

export const DECK_FONT_MONO =
  'var(--fontStack-monospace, ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace)';

/**
 * A fixed stack, for the one template that is not meant to follow the page.
 */
export const DECK_FONT_FIXED =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif';

export const DECK_FONT_MONO_FIXED =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/** The footer every Datalayer deck carries, unless a template says otherwise. */
export const DATALAYER_FOOTER: DeckFooterSpec = {
  enabled: true,
  logo: true,
  href: 'https://datalayer.ai',
  holder: 'Datalayer, Inc.',
  slideNumbers: true,
};

/** The sizes, shared by the templates that do not want their own. */
export const DECK_SIZES = {
  titleSize: '76px',
  headingSize: '44px',
  bodySize: '24px',
  headingWeight: 620,
} as const;

/**
 * The default template: the deck wears whatever the application is wearing.
 *
 * Every colour is a Primer token, so this deck is legible in all eight
 * primer-addons theme variants and in both colour modes without knowing that
 * any of them exist — and it goes on looking right if a ninth is added. The
 * accent is `--fgColor-accent`, which each Datalayer theme redefines, so the
 * rules, bullets and numbers come out in the theme's own colour rather than in
 * a green this file guessed at.
 *
 * The logo is given no overrides on purpose: `SvgLinesLogo` reads the theme
 * store itself and is already correct in every variant.
 */
const theme: DeckTheme = {
  colorScheme: 'inherit',
  fontFamily: DECK_FONT,
  fontFamilyMono: DECK_FONT_MONO,
  background: 'var(--bgColor-default)',
  surface: 'var(--bgColor-muted)',
  foreground: 'var(--fgColor-default)',
  muted: 'var(--fgColor-muted)',
  accent: 'var(--fgColor-accent)',
  accentSoft: 'var(--bgColor-accent-muted, rgb(31 111 235 / 12%))',
  accentContrast: 'var(--fgColor-onEmphasis, #ffffff)',
  border: 'var(--borderColor-default)',
  codeBackground: 'var(--bgColor-muted)',
  // A colour, not a shadow: this is spent as the colour of a `box-shadow`, so
  // Primer's `--shadow-*` tokens — which are whole shadow values — do not fit.
  shadow: 'rgb(0 0 0 / 22%)',
  danger: 'var(--fgColor-danger)',
  // The functional tokens the application already colours code with, so a
  // code slide matches a code block anywhere else in any of the themes.
  code: {
    keyword: 'var(--fgColor-danger)',
    string: 'var(--fgColor-accent)',
    comment: 'var(--fgColor-muted)',
    number: 'var(--fgColor-severe)',
    name: 'var(--fgColor-done)',
  },
  logo: {},
  ...DECK_SIZES,
};

export const datalayerTemplate: DeckTemplate = {
  name: 'datalayer',
  label: 'Datalayer',
  description:
    'Follows the application: Primer tokens throughout, so the deck matches ' +
    'the theme and colour mode the reader picked.',
  theme,
  footer: DATALAYER_FOOTER,
  config: { transition: 'slide' },
};

export default datalayerTemplate;
