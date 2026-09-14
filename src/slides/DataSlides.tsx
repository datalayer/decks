/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import type { JSX } from 'react';
import { SlideFrame } from '../chrome/SlideFrame';
import { inline } from '../inline';
import { Metrics, stepped } from './Blocks';
import type {
  ChartSlideSpec,
  ComparisonSlideSpec,
  FeatureShowcaseSlideSpec,
  FlowSlideSpec,
  MetricsSlideSpec,
  SlideComponentProps,
  TimelineSlideSpec,
} from '../types';

/** Five products, arranged around the one substrate they share. */
export const FeatureShowcaseSlide = ({
  slide,
  theme,
  footer,
  index,
  total,
}: SlideComponentProps<FeatureShowcaseSlideSpec>): JSX.Element => (
  <SlideFrame
    theme={theme}
    footer={footer}
    index={index}
    total={total}
    title={slide.title}
    backdrop={slide.backdrop}
    subtitle={slide.subtitle}
    variant="feature-showcase"
  >
    <div className="dla-feature-showcase">
      <div className="dla-feature-core">
        <div className="dla-feature-core-kicker">One shared substrate</div>
        <div className="dla-feature-core-title">{inline(slide.coreTitle)}</div>
        {slide.coreDetail && (
          <div className="dla-feature-core-detail">{inline(slide.coreDetail)}</div>
        )}
      </div>
      {slide.features.map((feature, position) => {
        const className = `dla-feature-card dla-feature-card--${position + 1}`;
        const body = (
          <>
            <div className="dla-feature-status">{inline(feature.status)}</div>
            <div className="dla-feature-title">{inline(feature.title)}</div>
            {feature.detail && <div className="dla-feature-detail">{inline(feature.detail)}</div>}
          </>
        );
        return stepped(
          feature.href ? (
            <a className={className} href={feature.href} key={feature.title}>
              {body}
            </a>
          ) : (
            <div className={className} key={feature.title}>
              {body}
            </div>
          ),
          slide.fragments,
          `${position}-${feature.title}`,
        );
      })}
      {slide.channels?.length ? (
        <div className="dla-feature-channels">
          <span>Reachable from</span>
          {slide.channels.map((channel) => (
            <strong key={channel}>{channel}</strong>
          ))}
        </div>
      ) : null}
    </div>
  </SlideFrame>
);

/**
 * A causal sequence: the product loop, a funnel, or how value compounds.
 *
 * Unlike a timeline, the stages are connected by directional arrows and do
 * not imply dates. This is the missing shape for "A leads to B leads to C".
 */
export const FlowSlide = ({
  slide,
  theme,
  footer,
  index,
  total,
}: SlideComponentProps<FlowSlideSpec>): JSX.Element => (
  <SlideFrame
    theme={theme}
    footer={footer}
    index={index}
    total={total}
    title={slide.title}
    backdrop={slide.backdrop}
    subtitle={slide.subtitle}
    layout={slide.layout}
    variant="flow"
  >
    <ol
      className="dla-flow"
      style={{ '--dla-flow-columns': Math.min(slide.items.length, 5) } as never}
    >
      {slide.items.map((item, position) => {
        const key = `${position}-${item.title}`;
        return stepped(
          <li key={key} className={`dla-flow-item${item.current ? ' dla-flow-item--current' : ''}`}>
            <div className="dla-flow-marker">{item.label ?? position + 1}</div>
            <div className="dla-flow-title">{inline(item.title)}</div>
            {item.detail && <div className="dla-flow-detail">{inline(item.detail)}</div>}
          </li>,
          slide.fragments,
          key,
        );
      })}
    </ol>
  </SlideFrame>
);

/** The numbers, big enough to read from the back of the room. */
export const MetricsSlide = ({
  slide,
  theme,
  footer,
  index,
  total,
}: SlideComponentProps<MetricsSlideSpec>): JSX.Element => (
  <SlideFrame
    theme={theme}
    footer={footer}
    index={index}
    total={total}
    title={slide.title}
    backdrop={slide.backdrop}
    subtitle={slide.subtitle}
    layout={slide.layout ?? 'centered'}
    variant="metrics"
  >
    <Metrics metrics={slide.metrics} fragments={slide.fragments} />
  </SlideFrame>
);

/**
 * Us against the alternatives, one row per thing that differs.
 *
 * A boolean cell is drawn as a mark rather than the word, and `highlight`
 * names the column that is the point of the slide.
 */
export const ComparisonSlide = ({
  slide,
  theme,
  footer,
  index,
  total,
}: SlideComponentProps<ComparisonSlideSpec>): JSX.Element => {
  const highlighted = (column: number): string =>
    column === slide.highlight ? 'dla-comparison-highlight' : '';
  return (
    <SlideFrame
      theme={theme}
      footer={footer}
      index={index}
      total={total}
      title={slide.title}
      backdrop={slide.backdrop}
      subtitle={slide.subtitle}
      variant="comparison"
    >
      <table className="dla-comparison">
        <thead>
          <tr>
            <th />
            {slide.columns.map((column, position) => (
              <th key={`${position}-${column}`} className={highlighted(position)}>
                {inline(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slide.rows.map((row, position) => {
            const key = `${position}-${row.label}`;
            return stepped(
              <tr key={key}>
                <th scope="row">{inline(row.label)}</th>
                {slide.columns.map((column, cell) => {
                  const value = row.values[cell];
                  return (
                    <td key={`${cell}-${column}`} className={highlighted(cell)}>
                      {typeof value === 'boolean' ? (
                        <span className={value ? 'dla-comparison-yes' : 'dla-comparison-no'}>
                          {value ? '✓' : '—'}
                        </span>
                      ) : (
                        inline(value ?? '—')
                      )}
                    </td>
                  );
                })}
              </tr>,
              slide.fragments,
              key,
            );
          })}
        </tbody>
      </table>
    </SlideFrame>
  );
};

/** Where this has been and where it is going, left to right. */
export const TimelineSlide = ({
  slide,
  theme,
  footer,
  index,
  total,
}: SlideComponentProps<TimelineSlideSpec>): JSX.Element => (
  <SlideFrame
    theme={theme}
    footer={footer}
    index={index}
    total={total}
    title={slide.title}
    backdrop={slide.backdrop}
    subtitle={slide.subtitle}
    variant="timeline"
  >
    <ol className="dla-timeline">
      {slide.items.map((item, position) => {
        const key = `${position}-${item.when}`;
        return stepped(
          <li
            key={key}
            className={`dla-timeline-item${item.current ? ' dla-timeline-item--current' : ''}`}
          >
            <div className="dla-timeline-when">{item.when}</div>
            <div className="dla-timeline-title">{inline(item.title)}</div>
            {item.detail && <div className="dla-timeline-detail">{inline(item.detail)}</div>}
          </li>,
          slide.fragments,
          key,
        );
      })}
    </ol>
  </SlideFrame>
);

/**
 * Bars, drawn in CSS.
 *
 * Deliberately not a charting library: what a deck needs from a chart is the
 * shape of a comparison, and a shape is a div with a width. Anything that
 * genuinely needs axes and a legend is a picture, or the `component` hatch.
 */
export const ChartSlide = ({
  slide,
  theme,
  footer,
  index,
  total,
}: SlideComponentProps<ChartSlideSpec>): JSX.Element => {
  const values = slide.series.map((series) => series.value);
  // A zero floor and a positive scale, so a series of zeroes renders as empty
  // bars rather than dividing by nothing.
  const max = Math.max(slide.max ?? 0, ...values, Number.EPSILON);
  return (
    <SlideFrame
      theme={theme}
      footer={footer}
      index={index}
      total={total}
      title={slide.title}
      backdrop={slide.backdrop}
      subtitle={slide.subtitle}
      variant="chart"
    >
      <div className="dla-chart">
        {slide.series.map((series, position) => {
          const key = `${position}-${series.label}`;
          const width = Math.max(0, Math.min(1, series.value / max)) * 100;
          return stepped(
            <div className="dla-chart-row" key={key}>
              <div className="dla-chart-label">{inline(series.label)}</div>
              <div className="dla-chart-track">
                <div
                  className="dla-chart-bar"
                  style={
                    {
                      width: `${width}%`,
                      '--dla-chart-bar-color': series.color,
                    } as never
                  }
                >
                  {series.display ?? series.value}
                </div>
              </div>
            </div>,
            slide.fragments,
            key,
          );
        })}
      </div>
      {slide.caption && <div className="dla-chart-caption">{inline(slide.caption)}</div>}
    </SlideFrame>
  );
};
