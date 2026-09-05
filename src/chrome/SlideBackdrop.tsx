/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import type { JSX } from 'react';
import { deckComponent } from '../registry/components';

/**
 * The layer behind a slide's content, filled by a registered component.
 *
 * Inert on purpose — `pointer-events: none` in the stylesheet — so a drawing
 * with its own links or hover states cannot intercept a click meant for the
 * slide. An unknown name draws nothing: a missing backdrop is a slide with
 * no atmosphere, which is not worth an error box over the content.
 */
export const SlideBackdrop = ({ name }: { name?: string }): JSX.Element | null => {
  if (!name) {
    return null;
  }
  const Backdrop = deckComponent(name);
  if (!Backdrop) {
    return null;
  }
  return (
    <div className="dla-slide-backdrop" aria-hidden>
      <Backdrop />
    </div>
  );
};

export default SlideBackdrop;
