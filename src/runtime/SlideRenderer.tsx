/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import type { JSX } from 'react';
import { Slide } from '@revealjs/react';
import { resolveLayout } from '../templates';
import type {
  DeckFooterSpec,
  DeckTemplate,
  DeckTheme,
  SlideSpec,
} from '../types';

type SlideRendererProps = {
  slide: SlideSpec;
  template: DeckTemplate;
  theme: DeckTheme;
  footer: DeckFooterSpec;
  index: number;
  total: number;
};

/**
 * One slide: the `<section>` Reveal wants, filled by whichever component the
 * template says draws this type.
 *
 * This is the whole of the resolution the spec asked for —
 * `template.layouts[slide.type] ?? library[slide.type]` — and it is the only
 * place that knows a slide has a type at all.
 */
export const SlideRenderer = ({
  slide,
  template,
  theme,
  footer,
  index,
  total,
}: SlideRendererProps): JSX.Element => {
  const Layout = resolveLayout(template, slide.type);
  return (
    <Slide
      id={slide.id}
      notes={slide.notes}
      background={slide.background}
      backgroundImage={slide.backgroundImage}
      transition={slide.transition}
    >
      {Layout ? (
        <Layout
          slide={slide}
          template={template}
          theme={theme}
          // `footer: false` on a slide turns it off for that slide alone; the
          // spec's other footer settings are the deck's and are already merged.
          footer={slide.footer === false || !footer.enabled ? null : footer}
          index={index}
          total={total}
        />
      ) : (
        <div className="dla-slide">
          <div className="dla-slide-error">
            No layout for slide type <code>{slide.type}</code>.
          </div>
        </div>
      )}
    </Slide>
  );
};

export default SlideRenderer;
