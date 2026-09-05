/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import { datalayerColors } from '@datalayer/primer-addons';
import type { DeckTemplate, DeckTheme } from '../types';
import {
  DATALAYER_FOOTER,
  DECK_FONT_FIXED,
  DECK_FONT_MONO_FIXED,
} from './datalayerTemplate';

/**
 * A dark deck that stays dark.
 *
 * The one template that does not follow the application, and deliberately: a
 * deck projected in a lit room, or exported to PDF and sent on, has an
 * audience who never chose a theme and a surface that is not a screen. That is
 * a visual identity of its own, which is exactly what a template is for.
 *
 * It is also the proof that the layer works: the same spec renders here and in
 * `datalayer` with nothing changed but the one word in `deck.template`.
 */
const theme: DeckTheme = {
  colorScheme: 'dark',
  // Fixed, unlike the templates that follow the page: this deck is projected
  // or exported, and a typeface that changed with the presenter's theme
  // would reflow every slide between the rehearsal and the room.
  fontFamily: DECK_FONT_FIXED,
  fontFamilyMono: DECK_FONT_MONO_FIXED,
  background: '#0b0f14',
  surface: '#141b23',
  foreground: '#f0f6fc',
  muted: '#9bb0c0',
  accent: datalayerColors.greenBright,
  accentSoft: 'rgb(46 204 113 / 16%)',
  accentContrast: '#06131a',
  border: 'rgb(155 176 192 / 26%)',
  codeBackground: '#070b0f',
  shadow: 'rgb(0 0 0 / 55%)',
  danger: '#ff8080',
  code: {
    keyword: '#ff7b9c',
    string: '#7ee2b8',
    comment: '#6b8296',
    number: '#f7c26b',
    name: '#79c0ff',
  },
  logo: {
    colored: true,
    primaryColor: datalayerColors.greenBright,
    secondaryColor: datalayerColors.greenBrand,
    textColor: '#f0f6fc',
  },
  // Larger than the shared sizes: a projected deck is read from further away.
  titleSize: '84px',
  headingSize: '48px',
  bodySize: '25px',
  headingWeight: 640,
};

export const inkTemplate: DeckTemplate = {
  name: 'datalayer-ink',
  label: 'Datalayer Ink',
  description:
    'Fixed dark palette, larger type. For a projector, a lit room, or a PDF ' +
    'that will be read on somebody else’s screen.',
  theme,
  footer: DATALAYER_FOOTER,
  config: { transition: 'slide', transitionSpeed: 'fast' },
};

export default inkTemplate;
