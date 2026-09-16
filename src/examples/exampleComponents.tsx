/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The components the example decks name — the other half of the escape hatch.
 *
 * A spec cannot import a component; it names one, and the host's registry
 * decides whether the name means anything (`registry/components`). That keeps
 * a deck *data*, and it leaves every example that wants a live component with
 * a second thing to ship: the map. This module is that map, and a host turns
 * the example's component slides on in one line:
 *
 * ```ts
 * import { exampleDecks, exampleDeckComponents } from '@datalayer/decks/examples';
 * registerDecks(exampleDecks);
 * registerDeckComponents(exampleDeckComponents);
 * ```
 *
 * Nothing here is invented for the example: the appearance chooser is the
 * control the Datalayer header wears, and the hero is the drawing the agents
 * home page opens with. That is the point of the slide they sit on — what
 * goes on a slide is a real component out of the application, running, not a
 * screenshot of one.
 *
 * Frames are drawn in `--dla-deck-*`, the tokens the stylesheet uses, so the
 * chrome around a component belongs to whichever template is on. The
 * components inside wear the application's own theme, which is exactly the
 * seam being demonstrated.
 *
 * @module examples/exampleComponents
 */

import type { CSSProperties, JSX } from 'react';
import { AppearanceControlsWithStore, useThemeStore } from '@datalayer/primer-addons';
import { SvgAgentsHomeHero } from '@datalayer/design';

const card: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '18px',
  padding: '24px',
  border: '1px solid var(--dla-deck-border)',
  borderRadius: '14px',
  background: 'color-mix(in srgb, var(--dla-deck-surface) 90%, transparent)',
};

const label: CSSProperties = {
  fontSize: '15px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--dla-deck-muted)',
};

const note: CSSProperties = {
  fontSize: '17px',
  lineHeight: 1.4,
  color: 'var(--dla-deck-muted)',
};

/**
 * The appearance chooser out of `@datalayer/primer-addons`, on a slide.
 *
 * The same control as the one in the shell's header, bound to the same store —
 * so it is not a copy of the header's chooser, it *is* it, and what reads that
 * store changes under the audience as it is used. The hero beside it is one
 * such reader (`useColorPalette`), and so is any deck on a palette template:
 * `datalayer-brand` resolves its colours from the palette in JavaScript and
 * repaints wholesale. A deck on `datalayer` wears Primer's own tokens instead,
 * so it turns when the host re-applies them for the chosen variant — which the
 * standalone shell does for the colour mode but not, today, for the variant.
 * Both are worth seeing; the slide that mounts this says which is which.
 */
export const AppearanceChooser = (): JSX.Element => (
  <div style={card}>
    <div style={label}>Appearance</div>
    <AppearanceControlsWithStore useStore={useThemeStore} />
    <div style={note}>
      The shell’s own control, on the slide — writing to the theme store the
      header writes to. Pick one: the drawing beside it is reading the same
      store.
    </div>
  </div>
);

/**
 * The agents hero out of `@datalayer/design`, filling whatever box it is given.
 *
 * The drawing places itself `absolute; inset: 0`, so it needs a positioned
 * parent with a height of its own — which is what this adds and all it adds.
 * With that, the same component works in the three places a spec may name one:
 * as the body of a `component` slide, as an `artifact` visual, and as a
 * `backdrop`, where the stylesheet's wash already expects a drawing that
 * carries detail to its edges.
 *
 * `labels` is passed straight through to the drawing — seven words, one per
 * node — so a spec can retell the picture in its own story through `props`.
 */
export const AgentsHero = ({ labels }: { labels?: string[] }): JSX.Element => (
  <div
    style={{
      position: 'relative',
      width: '100%',
      // Both, on purpose: the three boxes this lands in are a grid cell, a
      // column flex item and the backdrop layer, and between them `height`
      // and `flex` each cover a case the other leaves at zero.
      height: '100%',
      flex: '1 1 auto',
      minHeight: 0,
      overflow: 'hidden',
    }}
  >
    <SvgAgentsHomeHero labels={labels} />
  </div>
);

/**
 * Both of them, side by side: the slide the `component` type exists for.
 *
 * A registered component may be as small as a logo or as big as the whole
 * body, and this is the big end — a live control and a live drawing, laid out
 * together, under the template's own title, subtitle and footer. Changing the
 * theme on the left redraws the hero on the right while the audience watches,
 * which is the one thing a screenshot of this slide could never show.
 */
export const LiveAppearance = (): JSX.Element => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.45fr)',
      gap: '34px',
      // The slide body is a column flex container, so growing into it is a
      // flex question, not a percentage one.
      flex: '1 1 auto',
      minHeight: 0,
      alignItems: 'stretch',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
      <AppearanceChooser />
    </div>
    <div
      style={{
        position: 'relative',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        border: '1px solid var(--dla-deck-border)',
        borderRadius: '14px',
      }}
    >
      <AgentsHero labels={['Deck', 'Spec', 'Template', 'Reveal', 'Print', 'Catalog', 'Plugin']} />
    </div>
  </div>
);

/** The map a host registers to make the example's component slides work. */
export const exampleDeckComponents = {
  AppearanceChooser,
  AgentsHero,
  LiveAppearance,
};
