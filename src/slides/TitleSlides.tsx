/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import type { JSX } from 'react';
import { DeckFooter } from '../chrome/DeckFooter';
import { SlideBackdrop } from '../chrome/SlideBackdrop';
import { inline } from '../inline';
import { deckComponent } from '../registry/components';
import type {
  SectionSlideSpec,
  SlideComponentProps,
  TitleSlideSpec,
} from '../types';

/**
 * The first slide: the name of the thing, and who is saying it.
 *
 * It does not use `SlideFrame`, because the frame's job is a head above a body
 * and a title slide is one block, vertically centred, with the footer under
 * it. Everything else in the library goes through the frame.
 */
export const TitleSlide = ({
  slide,
  theme,
  footer,
  index,
  total,
}: SlideComponentProps<TitleSlideSpec>): JSX.Element => {
  const Visual = slide.visual ? deckComponent(slide.visual) : undefined;
  return (
  <div className="dla-slide dla-slide--title">
    <SlideBackdrop name={slide.backdrop} />
    <div className="dla-slide-hero">
      <div className="dla-slide-hero-rule" />
      <h1 className="dla-slide-hero-title">{inline(slide.title)}</h1>
      {slide.subtitle && (
        <p className="dla-slide-hero-subtitle">{inline(slide.subtitle)}</p>
      )}
      {slide.meta && <div className="dla-slide-hero-meta">{inline(slide.meta)}</div>}
      {Visual && (
        // Under the words, in their column: the title is the slide and the
        // visual is its signature, not a second subject beside it.
        <div className="dla-slide-hero-visual">
          <Visual {...(slide.visualProps ?? {})} />
        </div>
      )}
    </div>
    {footer && (
      <DeckFooter
        footer={footer}
        theme={theme}
        index={index}
        total={total}
      />
    )}
  </div>
  );
};

/**
 * A divider: the deck changing subject, with nothing else on the slide.
 */
export const SectionSlide = ({
  slide,
  theme,
  footer,
  index,
  total,
}: SlideComponentProps<SectionSlideSpec>): JSX.Element => (
  <div className="dla-slide dla-slide--section">
    <SlideBackdrop name={slide.backdrop} />
    <div className="dla-slide-hero">
      <div className="dla-slide-eyebrow">
        {String(index).padStart(2, '0')}
      </div>
      <h2 className="dla-slide-hero-title">{inline(slide.title)}</h2>
      {slide.subtitle && (
        <p className="dla-slide-hero-subtitle">{inline(slide.subtitle)}</p>
      )}
    </div>
    {footer && (
      <DeckFooter
        footer={footer}
        theme={theme}
        index={index}
        total={total}
      />
    )}
  </div>
);
