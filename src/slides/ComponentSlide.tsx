/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import type { JSX } from 'react';
import { SlideFrame } from '../chrome/SlideFrame';
import { Block } from './Blocks';
import type { ComponentSlideSpec, SlideComponentProps } from '../types';

/**
 * A whole slide handed over to a React component.
 *
 * The frame stays — title, subtitle and footer are still the template's — so
 * a live demo is a slide of the deck rather than a hole in it. A component
 * that wants the whole surface says `layout: 'full-bleed'` and gets a frame
 * with no padding.
 */
export const ComponentSlide = ({
  slide,
  theme,
  footer,
  index,
  total,
}: SlideComponentProps<ComponentSlideSpec>): JSX.Element => (
  <SlideFrame
    theme={theme}
    footer={footer}
    index={index}
    total={total}
    title={slide.title}
    backdrop={slide.backdrop}
    subtitle={slide.subtitle}
    layout={slide.layout}
    variant="component"
  >
    <Block
      block={{
        type: 'component',
        component: slide.component,
        props: slide.props,
      }}
    />
  </SlideFrame>
);
