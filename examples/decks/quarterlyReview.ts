/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/** A business deck, to show the data slides: metrics, a chart, a timeline. */

import type { DeckSpec } from '@datalayer/decks';

export const quarterlyReview: DeckSpec = {
  deck: {
    title: 'Q2 review',
    subtitle: 'Numbers first, then what they mean',
    template: 'datalayer-brand',
    transition: 'fade',
    footer: { since: 2026, note: 'Example deck — figures are invented' },
  },
  slides: [
    { type: 'title', title: 'Q2 review', subtitle: 'Revenue, pipeline and what changed.', meta: 'Example' },
    {
      type: 'metrics',
      title: 'The quarter in four numbers',
      metrics: [
        { value: '$1.2M', label: 'Revenue', detail: '+18% QoQ' },
        { value: '312', label: 'Active teams', detail: '+41' },
        { value: '96.4%', label: 'Uptime' },
        { value: '11 d', label: 'Median time to value', detail: '−3 d' },
      ],
    },
    {
      type: 'chart',
      title: 'Revenue by region',
      series: [
        { label: 'North', value: 480 },
        { label: 'South', value: 210 },
        { label: 'West', value: 510 },
      ],
      max: 600,
      notes: 'South is the story: half of last quarter. Ask what happened before drawing conclusions.',
    },
    {
      type: 'timeline',
      title: 'What changed',
      items: [
        { when: 'April', title: 'Self-serve sign-up', detail: 'Removed the demo call from the funnel.' },
        { when: 'May', title: 'Usage-based pricing', detail: 'Small teams stopped churning at the seat cliff.' },
        { when: 'June', title: 'EU region', detail: 'Three enterprise deals unblocked.' },
      ],
    },
    {
      type: 'comparison',
      title: 'Against the plan',
      columns: ['Plan', 'Actual'],
      rows: [
        { label: 'Revenue', values: ['$1.0M', '$1.2M'] },
        { label: 'New teams', values: ['30', '41'] },
        { label: 'Churn', values: ['4%', '2.6%'] },
      ],
      highlight: 1,
    },
    { type: 'section', title: 'Next quarter' },
    {
      type: 'bullets',
      title: 'Three bets',
      items: ['Ship the marketplace', 'Two more regions', 'Halve time to value again'],
      fragments: true,
    },
  ],
};
