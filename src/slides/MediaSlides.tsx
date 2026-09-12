/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import type { JSX } from 'react';
import { SlideFrame } from '../chrome/SlideFrame';
import { inline } from '../inline';
import { deckComponent } from '../registry/components';
import { Bullets, CodeBlock, stepped } from './Blocks';
import type {
  ArtifactSlideSpec,
  CodeSlideSpec,
  ImageSlideSpec,
  LogosSlideSpec,
  SlideComponentProps,
} from '../types';

/**
 * A real product artifact, large enough to inspect, with only the callouts
 * required to read it. The visual may be an image URL or a registered host
 * component, which lets a deck reserve the composition before captures land.
 */
export const ArtifactSlide = ({
  slide,
  theme,
  footer,
  index,
  total,
}: SlideComponentProps<ArtifactSlideSpec>): JSX.Element => {
  const visual = slide.visual;
  const Visual = visual.component ? deckComponent(visual.component) : undefined;
  const classes = ['dla-artifact'];
  if (slide.layout === 'wide-right') {
    classes.push('dla-artifact--wide-right');
  }
  if (slide.layout === 'centered') {
    classes.push('dla-artifact--centered');
  }
  return (
    <SlideFrame
      theme={theme}
      footer={footer}
      index={index}
      total={total}
      title={slide.title}
      backdrop={slide.backdrop}
      subtitle={slide.subtitle}
      layout={slide.layout}
      variant="artifact"
    >
      <div className={classes.join(' ')}>
        <figure className="dla-artifact-visual">
          {visual.src ? (
            <img
              src={visual.src}
              alt={visual.alt ?? slide.title}
              className={visual.fit === 'cover' ? 'dla-artifact-image--cover' : undefined}
            />
          ) : Visual ? (
            <Visual {...(visual.props ?? {})} />
          ) : (
            <div className="dla-slide-error">
              Unknown component <code>{visual.component}</code>.
            </div>
          )}
          {visual.caption && <figcaption>{inline(visual.caption)}</figcaption>}
        </figure>
        {slide.items?.length ? (
          <div className="dla-artifact-callouts">
            <Bullets
              items={slide.items}
              icon={slide.icon ?? 'check'}
              fragments={slide.fragments}
            />
          </div>
        ) : null}
      </div>
    </SlideFrame>
  );
};

/**
 * A picture, and the option of nothing else.
 *
 * `screenshot` is the same slide with a frame around the image, because a
 * screenshot of an interface needs an edge to read as a window and a diagram
 * does not.
 */
export const ImageSlide = ({
  slide,
  theme,
  footer,
  index,
  total,
}: SlideComponentProps<ImageSlideSpec>): JSX.Element => {
  const classes = ['dla-figure'];
  if (slide.type === 'screenshot') {
    classes.push('dla-figure--screenshot');
  }
  if (slide.fit === 'cover') {
    classes.push('dla-figure--cover');
  }
  if (slide.layout === 'full-bleed') {
    classes.push('dla-figure--full-bleed');
  }
  return (
    <SlideFrame
      theme={theme}
      footer={footer}
      index={index}
      total={total}
      title={slide.title}
    backdrop={slide.backdrop}
      subtitle={slide.subtitle}
      layout={slide.layout}
      variant="image"
    >
      <figure className={classes.join(' ')}>
        <img src={slide.src} alt={slide.alt ?? slide.title ?? ''} />
        {slide.caption && <figcaption>{inline(slide.caption)}</figcaption>}
      </figure>
    </SlideFrame>
  );
};

/** Who else is in the picture: partners, customers, the stack. */
export const LogosSlide = ({
  slide,
  theme,
  footer,
  index,
  total,
}: SlideComponentProps<LogosSlideSpec>): JSX.Element => (
  <SlideFrame
    theme={theme}
    footer={footer}
    index={index}
    total={total}
    title={slide.title}
    backdrop={slide.backdrop}
    subtitle={slide.subtitle}
    layout={slide.layout ?? 'centered'}
    variant="logos"
  >
    <div className="dla-logos">
      {slide.logos.map((logo, position) => {
        const key = `${position}-${logo.name}`;
        const body = logo.src ? (
          <img src={logo.src} alt={logo.name} />
        ) : (
          <span>{logo.name}</span>
        );
        const cell = logo.href ? (
          <a
            key={key}
            className="dla-logo"
            href={logo.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {body}
          </a>
        ) : (
          <div key={key} className="dla-logo">
            {body}
          </div>
        );
        return stepped(cell, slide.fragments, key);
      })}
    </div>
  </SlideFrame>
);

/**
 * Code on a slide, highlighted by Reveal's own plugin.
 *
 * The plugin is registered by the renderer, so a template that never shows
 * code still pays for it — a few kilobytes inside a chunk that is already
 * lazily loaded, against the alternative of a deck whose code slides render
 * as grey text because the plugin was conditional on something.
 */
export const CodeSlide = ({
  slide,
  theme,
  footer,
  index,
  total,
}: SlideComponentProps<CodeSlideSpec>): JSX.Element => (
  <SlideFrame
    theme={theme}
    footer={footer}
    index={index}
    total={total}
    title={slide.title}
    backdrop={slide.backdrop}
    subtitle={slide.subtitle}
    layout={slide.layout}
    variant="code"
  >
    <CodeBlock
      code={slide.code}
      language={slide.language}
      lineNumbers={slide.lineNumbers}
      caption={slide.caption}
    />
  </SlideFrame>
);
