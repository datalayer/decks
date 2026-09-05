/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import type { JSX } from 'react';
import { SlideFrame } from '../chrome/SlideFrame';
import { inline } from '../inline';
import { Bullets } from './Blocks';
import type {
  BulletsSlideSpec,
  QuoteSlideSpec,
  SlideComponentProps,
  StatementSlideSpec,
} from '../types';

/**
 * One sentence, large, and nothing to read it against.
 *
 * Centred unless the spec says otherwise: a statement slide that is left
 * aligned still works, and a spec that wants that says `layout: '1-column'`.
 */
export const StatementSlide = ({
  slide,
  theme,
  footer,
  index,
  total,
}: SlideComponentProps<StatementSlideSpec>): JSX.Element => (
  <SlideFrame
    theme={theme}
    footer={footer}
    index={index}
    total={total}
    title={slide.title}
    backdrop={slide.backdrop}
    subtitle={slide.subtitle}
    layout={slide.layout ?? 'centered'}
    variant="statement"
  >
    <div>
      <p className="dla-statement">{inline(slide.statement)}</p>
      {slide.attribution && (
        <p className="dla-statement-attribution">{inline(slide.attribution)}</p>
      )}
    </div>
  </SlideFrame>
);

/** The workhorse: a title and a handful of points under it. */
export const BulletsSlide = ({
  slide,
  theme,
  footer,
  index,
  total,
}: SlideComponentProps<BulletsSlideSpec>): JSX.Element => (
  <SlideFrame
    theme={theme}
    footer={footer}
    index={index}
    total={total}
    title={slide.title}
    backdrop={slide.backdrop}
    subtitle={slide.subtitle}
    layout={slide.layout}
    variant="bullets"
  >
    <Bullets items={slide.items} icon={slide.icon} fragments={slide.fragments} />
  </SlideFrame>
);

/** Somebody else's words, with their name under them. */
export const QuoteSlide = ({
  slide,
  theme,
  footer,
  index,
  total,
}: SlideComponentProps<QuoteSlideSpec>): JSX.Element => (
  <SlideFrame
    theme={theme}
    footer={footer}
    index={index}
    total={total}
    title={slide.title}
    backdrop={slide.backdrop}
    layout={slide.layout ?? 'centered'}
    variant="quote"
  >
    <figure style={{ margin: 0 }}>
      <blockquote className="dla-quote">{inline(slide.quote)}</blockquote>
      {slide.author && (
        <figcaption>
          <div className="dla-quote-author">{inline(slide.author)}</div>
          {slide.role && <div className="dla-quote-role">{inline(slide.role)}</div>}
        </figcaption>
      )}
    </figure>
  </SlideFrame>
);
