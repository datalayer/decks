/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import type { DeckTemplate, DeckThemeContext, DeckTheme } from '../types';
import {
  DATALAYER_FOOTER,
  DECK_FONT,
  DECK_FONT_MONO,
  DECK_SIZES,
} from './datalayerTemplate';

/**
 * The branded template: the *theme's* colours rather than Primer's neutrals.
 *
 * Where `datalayer` spends Primer tokens and comes out looking like the rest
 * of the application, this one asks the theme store what palette is on and
 * paints with it — the panel background, the brand green (or indigo, or
 * whichever of the eight the reader picked) as the accent. Same content, more
 * of the brand, which is what a deck shown to an outside audience wants.
 *
 * This is what `theme` being a function is for. Eight variants times two
 * colour modes is sixteen palettes; asking for the one that is on is one line,
 * and hard-coding sixteen would be sixteen things to keep in step.
 */
const theme = ({ palette, colorMode }: DeckThemeContext): DeckTheme => ({
  colorScheme: colorMode,
  fontFamily: DECK_FONT,
  fontFamilyMono: DECK_FONT_MONO,
  background: palette.bgPanel,
  surface: palette.bgAlt,
  foreground: palette.textLight,
  muted: palette.textMuted,
  accent: palette.primary,
  // A wash of the accent, mixed rather than listed: `color-mix` keeps this one
  // line per theme instead of sixteen hand-picked tints.
  accentSoft: `color-mix(in srgb, ${palette.primary} 14%, transparent)`,
  accentContrast: palette.isLight ? '#ffffff' : palette.bg,
  border: `color-mix(in srgb, ${palette.textMuted} 34%, transparent)`,
  codeBackground: palette.bg,
  shadow: palette.isLight ? 'rgb(0 0 0 / 16%)' : 'rgb(0 0 0 / 44%)',
  danger: 'var(--fgColor-danger)',
  // The theme's own bright colours, which every variant defines.
  code: {
    keyword: palette.pop,
    string: palette.accent,
    comment: palette.textMuted,
    number: palette.gold,
    name: palette.spark,
  },
  // The palette decides the logo here, so it is told rather than left to read
  // the store: on `bgPanel` the wordmark wants the palette's own text colour.
  logo: {
    colored: true,
    primaryColor: palette.primary,
    secondaryColor: palette.secondary,
    textColor: palette.textLight,
  },
  ...DECK_SIZES,
});

export const brandTemplate: DeckTemplate = {
  name: 'datalayer-brand',
  label: 'Datalayer Brand',
  description:
    'The active theme palette rather than Primer neutrals — the brand accent ' +
    'on the theme panel colour. For an outside audience.',
  theme,
  footer: DATALAYER_FOOTER,
  config: { transition: 'fade' },
};

export default brandTemplate;
