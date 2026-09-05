/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import type { JSX } from 'react';
import { SlideFrame } from '../chrome/SlideFrame';
import { Column, stepped } from './Blocks';
import type {
  ColumnSpec,
  ColumnsSlideSpec,
  SlideComponentProps,
  SlideLayout,
} from '../types';

/**
 * The columns of a slide, whichever way the spec spelled them.
 *
 * `two-columns` reads better with `left:` and `right:` than with a list of
 * two, so both spellings exist and both land here as an ordered list.
 */
export const columnsOf = (slide: ColumnsSlideSpec): ColumnSpec[] => {
  if (slide.columns?.length) {
    return slide.columns;
  }
  return [slide.left, slide.right].filter(Boolean) as ColumnSpec[];
};

/**
 * The grid a spec asked for, or the one its column count implies.
 *
 * The type is a hint too: `three-columns` means three even columns whatever
 * the layout says about width, because a spec that says both has already made
 * up its mind twice.
 */
const gridOf = (slide: ColumnsSlideSpec, count: number): string => {
  if (slide.type === 'three-columns') {
    return '3';
  }
  if (slide.type === 'two-columns' && !slide.layout) {
    return '2';
  }
  const layout: SlideLayout | undefined = slide.layout;
  switch (layout) {
    case '1-column':
      return '1';
    case '2-columns':
      return '2';
    case '3-columns':
      return '3';
    case 'wide-left':
      return 'wide-left';
    case 'wide-right':
      return 'wide-right';
    default:
      return String(Math.min(Math.max(count, 1), 3));
  }
};

/**
 * Two or three things side by side — the shape most of a deck ends up being.
 *
 * Each column is a block, so a column can be prose, a list, a picture, a code
 * sample or a registered component, and the two need not be the same kind.
 */
export const ColumnsSlide = ({
  slide,
  theme,
  footer,
  index,
  total,
}: SlideComponentProps<ColumnsSlideSpec>): JSX.Element => {
  const columns = columnsOf(slide);
  return (
    <SlideFrame
      theme={theme}
      footer={footer}
      index={index}
      total={total}
      title={slide.title}
    backdrop={slide.backdrop}
      subtitle={slide.subtitle}
      variant="columns"
    >
      <div className={`dla-columns dla-columns--${gridOf(slide, columns.length)}`}>
        {columns.map((column, position) => {
          const key = `${position}-${column.heading ?? column.type}`;
          return stepped(
            <Column key={key} column={column} />,
            slide.fragments,
            key,
          );
        })}
      </div>
    </SlideFrame>
  );
};
