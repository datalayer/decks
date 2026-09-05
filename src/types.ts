/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import type { ComponentType } from 'react';
import type { ColorPalette } from '@datalayer/primer-addons';
import type { RevealConfig, TransitionStyle } from 'reveal.js';

/**
 * The schema of a deck.
 *
 * A deck is written as data — the shape below is the YAML a deck would be if
 * it were a file, expressed in TypeScript so the compiler checks it and the
 * editor completes it. Nothing here describes how anything looks: a spec says
 * `type: 'metrics'`, never `display: grid; font-size: 64px`. What a metrics
 * slide looks like is the template's business, which is what makes the same
 * spec renderable as an investor deck, a conference talk or a sales deck by
 * changing one line.
 *
 * The layers, from content to pixels:
 *
 *   spec (this file)  ->  template  ->  slide library  ->  @revealjs/react
 */

// --- Slides ---------------------------------------------------------------

/**
 * The semantic slide types.
 *
 * Each names an *intent* — "this slide states one thing", "this slide compares
 * two things" — and every template must be able to render all of them.
 */
export type SlideType =
  | 'title'
  | 'section'
  | 'statement'
  | 'bullets'
  | 'columns'
  | 'two-columns'
  | 'three-columns'
  | 'metrics'
  | 'image'
  | 'screenshot'
  | 'quote'
  | 'comparison'
  | 'timeline'
  | 'chart'
  | 'logos'
  | 'code'
  | 'component';

/**
 * How the body of a slide is arranged.
 *
 * A modifier, not a type: `two-columns` with `layout: 'wide-left'` is still a
 * two-column slide, it just gives the left column the room. Templates that do
 * not honour a layout fall back to their own default arrangement.
 */
export type SlideLayout =
  | '1-column'
  | '2-columns'
  | '3-columns'
  | 'wide-left'
  | 'wide-right'
  | 'centered'
  | 'full-bleed';

/** What every slide may say, whatever its type. */
export type SlideBase = {
  /** Stable identifier, used for the deck outline and for deep links. */
  id?: string;
  title?: string;
  subtitle?: string;
  /**
   * Speaker notes.
   *
   * Carried to Reveal as `data-notes` on the slide, where its notes plugin or
   * `showNotes` would pick them up. Neither is registered here — the notes
   * plugin opens a speaker window by fetching an HTML file relative to its own
   * script, which a bundled build does not serve — so today these are read in
   * the spec rather than on screen. Written anyway: they are the argument the
   * slide is making, and the slide is only the evidence.
   */
  notes?: string;
  layout?: SlideLayout;
  /** Slide background, as Reveal understands it (colour, gradient or image). */
  background?: string;
  backgroundImage?: string;
  transition?: TransitionStyle;
  /** Hide the deck footer on this slide — for a full-bleed image, say. */
  footer?: boolean;
  /**
   * A registered component drawn behind the slide, edge to edge.
   *
   * For the design system's hero drawings, which position themselves to fill
   * whatever box they are given. The slide's own content sits on top, so the
   * backdrop is atmosphere, not information — nothing a reader needs may be
   * only in it.
   */
  backdrop?: string;
  /** Reveal each body element in turn rather than all at once. */
  fragments?: boolean;
};

/** A block of content, used wherever a slide holds more than one thing. */
export type BlockSpec =
  | { type: 'text'; content: string }
  | { type: 'bullets'; items: string[]; icon?: BulletIcon }
  | {
      type: 'image';
      src: string;
      alt?: string;
      caption?: string;
      fit?: 'contain' | 'cover';
    }
  | {
      type: 'code';
      code: string;
      language?: string;
      lineNumbers?: boolean | string;
      caption?: string;
    }
  | { type: 'metrics'; metrics: MetricSpec[] }
  | { type: 'component'; component: string; props?: Record<string, unknown> }
  /** Several blocks, one above the other — a picture and the words under it. */
  | { type: 'stack'; blocks: BlockSpec[] };

/** The mark in front of a bullet. `none` gives a plain list of lines. */
export type BulletIcon = 'dot' | 'check' | 'arrow' | 'none';

export type MetricSpec = {
  value: string;
  label: string;
  detail?: string;
};

export type ColumnSpec = BlockSpec & {
  /** A heading above the column, when the column is a thing of its own. */
  heading?: string;
};

export type TimelineItemSpec = {
  /** When — a year, a quarter, a step number. */
  when: string;
  title: string;
  detail?: string;
  /** Marks the step the story is at now. */
  current?: boolean;
};

export type ComparisonRowSpec = {
  label: string;
  /** One cell per column of the comparison, in the columns' own order. */
  values: Array<string | boolean>;
};

export type ChartSeriesSpec = {
  label: string;
  value: number;
  /** Overrides the accent, for the one bar that is the point of the chart. */
  color?: string;
  /** What to print on the bar; defaults to the value itself. */
  display?: string;
};

export type LogoSpec = {
  name: string;
  /** An image, when there is one; otherwise the name is set as a wordmark. */
  src?: string;
  href?: string;
};

export type TitleSlideSpec = SlideBase & {
  type: 'title';
  title: string;
  /** A line under the title — the date, the venue, the audience. */
  meta?: string;
  /**
   * A registered component beside the title — the marks of the two parties,
   * on a deck that is about a partnership.
   */
  visual?: string;
  visualProps?: Record<string, unknown>;
};

export type SectionSlideSpec = SlideBase & { type: 'section'; title: string };

export type StatementSlideSpec = SlideBase & {
  type: 'statement';
  /** The one sentence the slide exists to make. */
  statement: string;
  attribution?: string;
};

export type BulletsSlideSpec = SlideBase & {
  type: 'bullets';
  items: string[];
  icon?: BulletIcon;
};

export type ColumnsSlideSpec = SlideBase & {
  type: 'columns' | 'two-columns' | 'three-columns';
  /** The columns, in reading order. */
  columns?: ColumnSpec[];
  /** The two-column spelling, which reads better for exactly two. */
  left?: ColumnSpec;
  right?: ColumnSpec;
};

export type MetricsSlideSpec = SlideBase & {
  type: 'metrics';
  metrics: MetricSpec[];
};

export type ImageSlideSpec = SlideBase & {
  type: 'image' | 'screenshot';
  src: string;
  alt?: string;
  caption?: string;
  fit?: 'contain' | 'cover';
};

export type QuoteSlideSpec = SlideBase & {
  type: 'quote';
  quote: string;
  author?: string;
  role?: string;
};

export type ComparisonSlideSpec = SlideBase & {
  type: 'comparison';
  /** The headers of the things being compared. */
  columns: string[];
  rows: ComparisonRowSpec[];
  /** Index of the column to highlight — ours, usually. */
  highlight?: number;
};

export type TimelineSlideSpec = SlideBase & {
  type: 'timeline';
  items: TimelineItemSpec[];
};

export type ChartSlideSpec = SlideBase & {
  type: 'chart';
  /** Bars, drawn in CSS: a deck chart is a shape, not a visualisation. */
  chart?: 'bars' | 'columns';
  series: ChartSeriesSpec[];
  /** The top of the scale; defaults to the largest value. */
  max?: number;
  caption?: string;
};

export type LogosSlideSpec = SlideBase & { type: 'logos'; logos: LogoSpec[] };

export type CodeSlideSpec = SlideBase & {
  type: 'code';
  code: string;
  language?: string;
  lineNumbers?: boolean | string;
  caption?: string;
};

/**
 * The escape hatch: an arbitrary React component, by name.
 *
 * By name and not by reference, so a spec stays data. What the name may be is
 * decided by `deckComponents` — a spec cannot reach for anything the registry
 * does not offer.
 */
export type ComponentSlideSpec = SlideBase & {
  type: 'component';
  component: string;
  props?: Record<string, unknown>;
};

export type SlideSpec =
  | TitleSlideSpec
  | SectionSlideSpec
  | StatementSlideSpec
  | BulletsSlideSpec
  | ColumnsSlideSpec
  | MetricsSlideSpec
  | ImageSlideSpec
  | QuoteSlideSpec
  | ComparisonSlideSpec
  | TimelineSlideSpec
  | ChartSlideSpec
  | LogosSlideSpec
  | CodeSlideSpec
  | ComponentSlideSpec;

// --- Decks ----------------------------------------------------------------

export type DeckMeta = {
  title: string;
  subtitle?: string;
  /** The name of a template in `deckTemplates`. */
  template: string;
  transition?: TransitionStyle;
  /** Overrides for the footer the template defines. */
  footer?: Partial<DeckFooterSpec>;
  /** Anything Reveal takes, for the deck that needs one thing changed. */
  config?: Omit<RevealConfig, 'plugins'>;
  /** Who may read it. Absent means anyone with the address. */
  access?: DeckAccessSpec;
  /**
   * The theme variant to draw the deck — and the page around it — in.
   *
   * One of the application's own: `datalayer`, `matrix`, `ivory`, `sun`, and
   * the rest. Absent means the reader's own theme, which is the right default:
   * a deck is a view of the application and should look like the rest of it
   * unless it has a reason not to.
   *
   * The override lasts exactly as long as the deck is on screen. It is never
   * written to the reader's preference, so leaving the deck — or closing the
   * tab on it — gives them their own theme back untouched.
   */
  theme?: string;
  /** The colour mode to draw it in: `light`, `dark`, or `auto`. */
  colorMode?: 'light' | 'dark' | 'auto';
};

/**
 * Who may read a deck.
 *
 * Both of these are DOORMATS, not locks, and the distinction matters enough to
 * write down: a deck is a bundle of JavaScript served to the browser, so its
 * text and its password are readable by anyone willing to open the network
 * tab. They keep a link from being idly forwarded and opened; they do not keep
 * a determined reader out. A deck that must not be read by the wrong person
 * needs a server that refuses to send it, which is a different thing from
 * this.
 */
export type DeckAccessSpec = {
  /**
   * A shared password the reader types once.
   *
   * Also accepted as `?deckPassword=…` on the address, so a link can be sent
   * ready to open; the parameter is taken off the URL once it has been used,
   * so it is not left in the history or in the next link the reader copies.
   * A correct password is remembered in a cookie, per deck.
   */
  password?: string;
  /**
   * Whether the reader has to be signed in.
   *
   * An anonymous reader is shown the way in rather than the deck.
   */
  authenticated?: boolean;
};

export type DeckFooterSpec = {
  /** Draw the footer at all. */
  enabled: boolean;
  /** The Datalayer lines-and-wordmark logo, bottom left. */
  logo: boolean;
  /** Where the logo links to. */
  href: string;
  /** The name in the copyright line. */
  holder: string;
  /**
   * The first year of the copyright range. The last is always the current
   * year, which is read at render time rather than written into a spec, so a
   * deck reused next year does not date itself.
   */
  since?: number;
  /** Print `3 / 17` at the bottom right. */
  slideNumbers: boolean;
  /** A line of text between the logo and the copyright. */
  note?: string;
};

export type DeckSpec = {
  deck: DeckMeta;
  slides: SlideSpec[];
};

// --- Templates ------------------------------------------------------------

/**
 * The visual identity of a deck, as tokens.
 *
 * These become CSS custom properties on the deck root — `--dla-deck-accent`
 * and friends — which is how a slide component stays template-agnostic: it
 * spends a token and never knows which template funded it.
 *
 * Every value is a CSS colour *expression*, so a token may just as well be
 * `var(--fgColor-default)`. That is not a detail: a deck is a view of the
 * application, sitting under the same header as everything else, and a deck
 * that ignored the theme the reader picked would look like a foreign object
 * on the page. The templates that follow the application say so in `var()`;
 * the templates that are their own thing name their colours outright.
 */
export type DeckTheme = {
  /**
   * Which end of the scale this template's own colours sit at.
   *
   * Only used for the things that cannot be expressed as a token — the
   * `color-scheme` of form controls and scrollbars inside the deck. A
   * template that follows the application leaves it `'inherit'`.
   */
  colorScheme: 'light' | 'dark' | 'inherit';
  fontFamily: string;
  fontFamilyMono: string;
  /** The page behind the slides. */
  background: string;
  /** A second surface, for cards and panels laid on the background. */
  surface: string;
  foreground: string;
  /** Secondary text: captions, labels, the footer. */
  muted: string;
  accent: string;
  /** A wash of the accent, for fills behind text. */
  accentSoft: string;
  /** What is legible *on* the accent. */
  accentContrast: string;
  border: string;
  /** Behind a code block, which wants to sit apart from the slide. */
  codeBackground: string;
  /** Under a screenshot, to lift it off the slide. */
  shadow: string;
  /** What a spec that does not add up is drawn in. */
  danger: string;
  /**
   * Syntax colours for code slides.
   *
   * Written here rather than imported from one of Reveal's highlight themes:
   * those are stylesheets of literal colours that would sit in the page for
   * as long as the tab is open, contradict every template but the one they
   * happen to suit, and — being scoped to `.hljs` rather than to the deck —
   * reach code blocks that are not on a slide at all.
   */
  code: {
    keyword: string;
    string: string;
    comment: string;
    number: string;
    /** Function and type names. */
    name: string;
  };
  /** Titles, in the deck's 1280x720 coordinate space. */
  titleSize: string;
  headingSize: string;
  bodySize: string;
  headingWeight: number;
  /**
   * How the Datalayer logo is drawn.
   *
   * Left empty by the templates that follow the application: the logo reads
   * the theme store itself and comes out right in all eight variants. Only a
   * template with a palette of its own has to say.
   */
  logo: {
    inverse?: boolean;
    colored?: boolean;
    primaryColor?: string;
    secondaryColor?: string;
    textColor?: string;
  };
};

/** What the application is wearing, when a template wants to know. */
export type DeckThemeContext = {
  palette: ColorPalette;
  colorMode: 'light' | 'dark';
};

/**
 * A template's theme: fixed, or asked for at render time.
 *
 * The function form is what lets a template say "the application's accent,
 * whichever of the eight themes is on" without hard-coding eight palettes.
 */
export type DeckThemeResolver = DeckTheme | ((context: DeckThemeContext) => DeckTheme);

/** What a slide component is handed. */
export type SlideComponentProps<S extends SlideSpec = SlideSpec> = {
  slide: S;
  template: DeckTemplate;
  /**
   * The template's theme, already resolved against the application's — so a
   * slide component never has to know that a theme can be a function.
   */
  theme: DeckTheme;
  /**
   * The footer as it applies to *this* slide — the template's, with the deck's
   * overrides on top, and `null` when the slide turned it off. Resolved once
   * by the renderer so no slide component has to know the precedence.
   */
  footer: DeckFooterSpec | null;
  /** 1-based, over the whole deck. */
  index: number;
  total: number;
};

export type SlideComponent = ComponentType<SlideComponentProps<any>>;

export type DeckTemplate = {
  /** The name a spec refers to it by. */
  name: string;
  label: string;
  description: string;
  theme: DeckThemeResolver;
  footer: DeckFooterSpec;
  /**
   * Per-type overrides of the slide library.
   *
   * A template that wants its title slides drawn differently names a
   * component here; every type it leaves out falls back to the default
   * library, so a template is a few tokens and the handful of slides it
   * genuinely wants its own version of.
   */
  layouts?: Partial<Record<SlideType, SlideComponent>>;
  /** Reveal options this template implies, e.g. a slower transition. */
  config?: Omit<RevealConfig, 'plugins'>;
};
