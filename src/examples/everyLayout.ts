/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * One slide of every semantic type the library draws — the reference deck.
 *
 * The other two examples are decks that happen to use layouts. This one is
 * the catalogue: `SLIDE_TYPES` in order, each slide saying something true
 * about the engine while it demonstrates itself, so the deck is a page of
 * documentation that can be presented. `examples.test.ts` asserts the
 * coverage is complete, which is what keeps this honest when a type is added.
 *
 * Three slides name components rather than content — the `component` slide,
 * the `artifact` visual and the `section` backdrop. Those are the escape
 * hatch, and what they name lives in `exampleComponents.tsx`: the appearance
 * chooser the shell wears and the hero the agents page opens with, both real,
 * both running. A host that has not registered them sees the engine's own
 * "unknown component" notice instead of a blank slide, which is the behaviour
 * worth seeing too.
 */

import type { DeckSpec } from '../types';

/** A product capture that is public, so the media slides point at something real. */
const SCREENSHOT = 'https://images.datalayer.io/products/benchmarks/benchmark-result.png';

export const everyLayout: DeckSpec = {
  deck: {
    title: 'Every layout',
    subtitle: 'One slide of each semantic type, and what each is for',
    template: 'datalayer',
    transition: 'slide',
    footer: { since: 2026, note: 'Example deck — the slide library, slide by slide' },
  },
  slides: [
    {
      id: 'title',
      type: 'title',
      title: 'Every layout',
      subtitle: 'A deck is a list of slides, and a slide is a type and its fields.',
      meta: '@datalayer/decks · the reference deck',
      notes:
        'Present this one by scrolling rather than reading: the point is the ' +
        'range, and the next slide is always a different shape.',
    },

    {
      id: 'words',
      type: 'section',
      title: 'Words',
      subtitle: 'The types that carry a sentence rather than a structure.',
      backdrop: 'AgentsHero',
      notes:
        'The `backdrop` field names a registered component drawn edge to edge ' +
        'behind everything, under the stylesheet\'s own wash so the heading ' +
        'still reads. Atmosphere, never information: a reader who cannot see ' +
        'it has lost nothing.',
    },

    {
      id: 'statement',
      type: 'statement',
      statement: 'The specification owns the content. The template owns the pixels.',
      attribution: 'Which is why the same deck renders in three templates unchanged.',
    },

    {
      id: 'bullets',
      type: 'bullets',
      title: 'A list, with the marks it asks for',
      subtitle: 'Bullets can arrive together or one at a time.',
      icon: 'check',
      fragments: true,
      items: [
        '`icon` picks the mark: **dot**, **check**, **arrow**, or **none**',
        '`fragments: true` reveals the items in turn',
        'Inline marks are `**bold**`, `` `code` `` and [links](https://datalayer.ai)',
      ],
    },

    {
      id: 'quote',
      type: 'quote',
      title: 'Somebody else’s words',
      quote:
        'A deck you cannot diff is a deck nobody can review — and every deck that matters gets reviewed.',
      author: 'The argument for specs',
      role: 'Why this library exists',
    },

    {
      id: 'shapes',
      type: 'section',
      title: 'Shapes',
      subtitle: 'The types that put things beside each other, or in order.',
    },

    {
      id: 'two-columns',
      type: 'two-columns',
      title: 'Two columns, one wide',
      subtitle: '`left` and `right` read better than a list of two.',
      layout: 'wide-left',
      left: {
        type: 'bullets',
        heading: 'A column is a block',
        icon: 'arrow',
        items: [
          'Text, bullets, metrics, an image, code, a diagram, or a component',
          'The two columns need not be the same kind of thing',
          '`layout` gives one of them the room: `wide-left` or `wide-right`',
        ],
      },
      right: {
        type: 'text',
        heading: 'Or prose',
        content:
          'A `text` block takes paragraphs, separated by a blank line, with the ' +
          'same inline marks the rest of the deck has.',
      },
    },

    {
      id: 'three-columns',
      type: 'three-columns',
      title: 'Three columns, always even',
      subtitle: 'The type decides the grid, whatever `layout` says.',
      columns: [
        {
          type: 'text',
          heading: 'Spec',
          content: 'Plain data: YAML on disk, or a checked TypeScript literal.',
        },
        {
          type: 'text',
          heading: 'Template',
          content: 'Tokens and a handful of overridden slide types.',
        },
        {
          type: 'bullets',
          heading: 'Renderer',
          icon: 'dot',
          items: ['Reveal.js in the browser', 'The same frame in print'],
        },
      ],
    },

    {
      id: 'columns',
      type: 'columns',
      title: 'The generic spelling, and the other blocks',
      subtitle: 'A column can be code, or a picture, without being a slide about either.',
      layout: '2-columns',
      columns: [
        {
          type: 'code',
          heading: 'A code block',
          language: 'yaml',
          code: `- type: two-columns
  title: Two columns, one wide
  layout: wide-left
  left: { type: bullets, items: [ … ] }
  right: { type: text, content: … }`,
        },
        {
          type: 'image',
          heading: 'An image block',
          src: SCREENSHOT,
          alt: 'A Datalayer benchmark result',
          caption: 'Blocks take a caption; the slide keeps its own title.',
        },
      ],
    },

    {
      id: 'metrics',
      type: 'metrics',
      title: 'Numbers get room to breathe',
      metrics: [
        { value: '22', label: 'semantic slide types', detail: 'all of them in this deck' },
        { value: '3', label: 'templates', detail: 'datalayer, brand, ink' },
        { value: '1', label: 'spec per deck', detail: 'YAML or TypeScript' },
        { value: '0', label: 'CSS in the spec', detail: 'the template owns the pixels' },
      ],
    },

    {
      id: 'comparison',
      type: 'comparison',
      title: 'A table where the cells are verdicts',
      columns: ['Slides by hand', 'Slides as data'],
      highlight: 1,
      rows: [
        { label: 'Reviewable in a pull request', values: [false, true] },
        { label: 'Restyled centrally', values: [false, true] },
        { label: 'Readable by an agent', values: [false, true] },
        { label: 'Takes an afternoon to nudge', values: ['Often', 'Never'] },
      ],
      notes: 'Cells may be booleans, which draw as marks, or strings, which draw as text.',
    },

    {
      id: 'chart',
      type: 'chart',
      title: 'A chart without a charting dependency',
      subtitle: 'Bars in CSS: a deck chart is a shape, not a visualisation.',
      max: 100,
      series: [
        { label: 'Writing the content', value: 85, display: '85%' },
        { label: 'Choosing a layout', value: 12, display: '12%' },
        { label: 'Fighting the layout', value: 3, display: '3%' },
      ],
      caption: 'Illustrative — `max` fixes the scale so two charts can be compared.',
    },

    {
      id: 'timeline',
      type: 'timeline',
      title: 'Things in order, with a you-are-here',
      items: [
        { when: '01', title: 'Outline', detail: 'Decide what each slide has to say.' },
        { when: '02', title: 'Specify', detail: 'Write it as data.' },
        { when: '03', title: 'Review', detail: 'Serve it, read it, change words not pixels.', current: true },
        { when: '04', title: 'Present', detail: 'Share the URL, or print it.' },
      ],
    },

    {
      id: 'flow',
      type: 'flow',
      title: 'A sequence where each step causes the next',
      subtitle: 'Unlike a timeline, the stages are connected — and one may be the point.',
      items: [
        { label: '01', title: 'Spec', detail: 'A deck is a value.' },
        { label: '02', title: 'Validate', detail: 'Types first, then what a type cannot check.' },
        { label: '03', title: 'Template', detail: 'Tokens, and the types it draws its own way.', current: true },
        { label: '04', title: 'Render', detail: 'Reveal in the browser, the same frame in print.' },
      ],
    },

    {
      id: 'feature-showcase',
      type: 'feature-showcase',
      title: 'Five things around the one they share',
      subtitle: 'Exactly five — the layout is a composition, not a list.',
      coreTitle: 'One deck spec',
      coreDetail: 'data · portable · diffable',
      features: [
        { title: 'Reveal', status: 'Available', detail: 'Present in any browser.' },
        { title: 'Print', status: 'Available', detail: 'The same frame, paginated.' },
        { title: 'Catalog', status: 'Available', detail: 'Decks a host lists and opens.' },
        { title: 'Plugin', status: 'Available', detail: 'Decks inside a Reactor shell.' },
        { title: 'CLI', status: 'Available', detail: '`datalayer decks serve deck.yaml`.' },
      ],
      channels: ['Browser', 'CLI', 'Reactor shell'],
    },

    {
      id: 'pictures',
      type: 'section',
      title: 'Pictures',
      subtitle: 'The types whose body is an image, a diagram, or a component.',
    },

    {
      id: 'artifact',
      type: 'artifact',
      title: 'A real thing, with only the callouts it needs',
      subtitle: 'The visual is a file — or a registered component, as here.',
      visual: {
        component: 'AgentsHero',
        alt: 'The agents hero drawing, relabelled for this deck',
        caption: '`SvgAgentsHomeHero` from `@datalayer/design`, relabelled through `props`.',
        props: {
          labels: ['Deck', 'Spec', 'Template', 'Reveal', 'Print', 'Catalog', 'Plugin'],
        },
      },
      items: [
        '`visual.src` for a capture, `visual.component` for something live.',
        '`props` reach the component unchanged — these seven labels, for instance.',
        'Callouts stay beside it, so the picture keeps its own size.',
      ],
      icon: 'check',
    },

    {
      id: 'screenshot',
      type: 'screenshot',
      title: 'A capture, with the frame a capture wants',
      src: SCREENSHOT,
      fit: 'contain',
      alt: 'A Datalayer benchmark result: score, status, and the investigation beside it',
      caption: '`screenshot` is `image` with a border and a shadow — the same fields.',
    },

    {
      id: 'image',
      type: 'image',
      layout: 'full-bleed',
      footer: false,
      src: SCREENSHOT,
      fit: 'cover',
      alt: 'The same capture, filling the slide',
      notes:
        '`layout: full-bleed` drops the padding and `footer: false` drops the ' +
        'footer, for the one slide that is only a picture. `fit: cover` fills ' +
        'the frame and crops; `contain` fits and letterboxes.',
    },

    {
      id: 'logos',
      type: 'logos',
      title: 'Who else is in the picture',
      subtitle: 'A name is enough; a `src` makes it a mark.',
      logos: [
        { name: 'Datalayer', src: 'https://assets.datalayer.tech/datalayer-25.svg', href: 'https://datalayer.ai' },
        { name: 'Reveal.js', href: 'https://revealjs.com' },
        { name: 'Reactor' },
        { name: 'Primer' },
        { name: 'Mermaid' },
      ],
    },

    {
      id: 'code',
      type: 'code',
      title: 'Code, with the lines a reader is meant to follow',
      language: 'typescript',
      lineNumbers: '2-4',
      code: `registerDecks([{ collection: 'talks', slug: 'hello', spec }]);
registerDeckComponents({ AgentsHero, AppearanceChooser });
// A spec names a component; the registry decides whether the name
// means anything. That is what keeps a deck data.`,
      caption: '`lineNumbers` takes `true`, or a range to highlight.',
    },

    {
      id: 'mermaid',
      type: 'mermaid',
      title: 'A diagram is a first-class slide',
      subtitle: 'Mermaid source in the spec, SVG in the browser.',
      diagram: `flowchart LR
  S[Spec] --> V[Validate]
  V --> T[Template]
  T --> R[Reveal]
  T --> P[Print]`,
      caption: 'Mermaid is also a block, so a column can hold one.',
    },

    {
      id: 'component',
      type: 'component',
      title: 'The escape hatch, running',
      subtitle:
        'A real component on the slide: the shell’s appearance chooser, and the hero it repaints.',
      component: 'LiveAppearance',
      notes:
        'The one slide that cannot be a screenshot of itself. The chooser on ' +
        'the left is the control out of `@datalayer/primer-addons` that the ' +
        'Datalayer header wears, bound to the same theme store; the drawing on ' +
        'the right is `SvgAgentsHomeHero` out of `@datalayer/design`, reading ' +
        'that same store through `useColorPalette`. Pick a theme and the ' +
        'drawing repaints while the room watches — that is the demo. What the ' +
        'deck itself does depends on its template, and is worth saying aloud: ' +
        'this deck is on `datalayer`, whose colours are Primer\'s own tokens, ' +
        'so it turns when the host re-applies them — which the standalone ' +
        'shell does for the colour mode but not for the variant, so the frame ' +
        'here stays put. Open the Q2 review example after clicking and the ' +
        'difference is the whole argument: it is on `datalayer-brand`, which ' +
        'resolves its colours from the palette in JavaScript, and it will have ' +
        'repainted end to end (measured: accent #00FF41 to #D4B85E, background ' +
        '#0A1F0A to #2A2118, on picking Sand here).',
    },

    {
      id: 'closing',
      type: 'closing',
      title: 'Now pick the one that fits',
      subtitle: 'Every slide in this deck is four or five lines of data.',
      cta: 'Copy a slide, change the words, keep the layout.',
      contact: 'datalayer.ai',
    },
  ],
};
