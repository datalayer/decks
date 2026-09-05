/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import type { JSX } from 'react';
import type { ReactNode } from 'react';
import type { DeckFooterSpec, DeckTheme, SlideLayout } from '../types';
import { DeckFooter } from './DeckFooter';
import { SlideBackdrop } from './SlideBackdrop';

type SlideFrameProps = {
  theme: DeckTheme;
  footer: DeckFooterSpec | null;
  index: number;
  total: number;
  /** A small label above the title — the section, the chapter, the ask. */
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  layout?: SlideLayout;
  /** Extra class on the frame, for the slide types that want their own rules. */
  variant?: string;
  /** A registered component drawn behind everything else on the slide. */
  backdrop?: string;
  children?: ReactNode;
};

/**
 * The scaffold every slide is built in: head, body, footer.
 *
 * Reveal is configured with `center: false` and each section is given the full
 * deck height, so this frame is what actually places things — a fixed head, a
 * body that takes the rest, and a footer pinned to the bottom of the slide
 * rather than to the bottom of the content. Slide components fill the body and
 * are spared all of it.
 */
export const SlideFrame = ({
  theme,
  footer,
  index,
  total,
  eyebrow,
  title,
  subtitle,
  layout,
  variant,
  backdrop,
  children,
}: SlideFrameProps): JSX.Element => {
  const classes = ['dla-slide'];
  if (variant) {
    classes.push(`dla-slide--${variant}`);
  }
  if (layout === 'centered' || layout === 'full-bleed') {
    classes.push(`dla-slide--${layout}`);
  }
  return (
    <div className={classes.join(' ')}>
      <SlideBackdrop name={backdrop} />
      <div className="dla-slide-head">
        {eyebrow && <div className="dla-slide-eyebrow">{eyebrow}</div>}
        {title && <h2 className="dla-slide-title">{title}</h2>}
        {subtitle && <p className="dla-slide-subtitle">{subtitle}</p>}
      </div>
      <div className="dla-slide-body">{children}</div>
      {footer && (
        <DeckFooter footer={footer} theme={theme} index={index} total={total} />
      )}
    </div>
  );
};

export default SlideFrame;
