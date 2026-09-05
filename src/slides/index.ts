/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import type { SlideComponent, SlideType } from '../types';
import { ColumnsSlide } from './ColumnsSlide';
import { ComponentSlide } from './ComponentSlide';
import {
  ChartSlide,
  ComparisonSlide,
  MetricsSlide,
  TimelineSlide,
} from './DataSlides';
import { CodeSlide, ImageSlide, LogosSlide } from './MediaSlides';
import { BulletsSlide, QuoteSlide, StatementSlide } from './TextSlides';
import { SectionSlide, TitleSlide } from './TitleSlides';

export * from './Blocks';
export * from './ColumnsSlide';
export * from './ComponentSlide';
export * from './DataSlides';
export * from './MediaSlides';
export * from './TextSlides';
export * from './TitleSlides';

/**
 * The default implementation of every semantic slide type.
 *
 * A template overrides the handful it wants drawn its own way and inherits
 * the rest, so a new template is a palette and a couple of components — not
 * sixteen. Everything here is written against the `--dla-deck-*` tokens, so
 * "inherited" still means "wearing this template's colours".
 */
export const DEFAULT_LAYOUTS: Record<SlideType, SlideComponent> = {
  title: TitleSlide,
  section: SectionSlide,
  statement: StatementSlide,
  bullets: BulletsSlide,
  columns: ColumnsSlide,
  'two-columns': ColumnsSlide,
  'three-columns': ColumnsSlide,
  metrics: MetricsSlide,
  image: ImageSlide,
  screenshot: ImageSlide,
  quote: QuoteSlide,
  comparison: ComparisonSlide,
  timeline: TimelineSlide,
  chart: ChartSlide,
  logos: LogosSlide,
  code: CodeSlide,
  component: ComponentSlide,
};

export const SLIDE_TYPES = Object.keys(DEFAULT_LAYOUTS) as SlideType[];
