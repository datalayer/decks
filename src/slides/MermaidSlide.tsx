/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import type { JSX } from 'react';
import { SlideFrame } from '../chrome/SlideFrame';
import type { MermaidSlideSpec, SlideComponentProps } from '../types';
import { MermaidDiagram } from './Blocks';

/** A Mermaid specification, rendered as a theme-aware SVG. */
export const MermaidSlide = ({
  slide,
  theme,
  footer,
  index,
  total,
}: SlideComponentProps<MermaidSlideSpec>): JSX.Element => (
  <SlideFrame
    theme={theme}
    footer={footer}
    index={index}
    total={total}
    title={slide.title}
    backdrop={slide.backdrop}
    subtitle={slide.subtitle}
    layout={slide.layout ?? 'centered'}
    variant="mermaid"
  >
    <MermaidDiagram diagram={slide.diagram} caption={slide.caption} />
  </SlideFrame>
);
