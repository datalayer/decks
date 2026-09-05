/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import { DEFAULT_LAYOUTS } from '../slides';
import type {
  DeckTemplate,
  DeckTheme,
  DeckThemeContext,
  SlideComponent,
  SlideType,
} from '../types';
import { brandTemplate } from './brandTemplate';
import { datalayerTemplate } from './datalayerTemplate';
import { inkTemplate } from './inkTemplate';

export * from './brandTemplate';
export * from './datalayerTemplate';
export * from './inkTemplate';

/**
 * Every template a spec may name.
 *
 * The same deck content renders as any of these by changing one line of the
 * spec, which is the point of separating the two.
 */
export const deckTemplates: Record<string, DeckTemplate> = {
  [datalayerTemplate.name]: datalayerTemplate,
  [brandTemplate.name]: brandTemplate,
  [inkTemplate.name]: inkTemplate,
};

/** The one used when a spec names a template that does not exist. */
export const DEFAULT_TEMPLATE = datalayerTemplate;

export const deckTemplate = (name: string): DeckTemplate | undefined =>
  deckTemplates[name];

/** The template a spec asked for, or the default — never nothing. */
export const resolveTemplate = (name: string): DeckTemplate =>
  deckTemplates[name] ?? DEFAULT_TEMPLATE;

/**
 * The template's theme, whether it is fixed or asked for at render time.
 */
export const resolveTheme = (
  template: DeckTemplate,
  context: DeckThemeContext,
): DeckTheme =>
  typeof template.theme === 'function' ? template.theme(context) : template.theme;

/**
 * The component that draws a slide of this type under this template.
 *
 * The template's own first, the library's otherwise — which is what lets a
 * template be three tokens and one overridden slide rather than sixteen
 * components.
 */
export const resolveLayout = (
  template: DeckTemplate,
  type: SlideType,
): SlideComponent | undefined =>
  template.layouts?.[type] ?? DEFAULT_LAYOUTS[type];
