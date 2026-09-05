/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * A deck about the thing that renders it: Reactor, in five slides.
 *
 * YAML in every respect but the file extension — the same keys, the same
 * nesting — written as a TypeScript literal so the compiler checks the slide
 * types and the editor completes the fields.
 */

import type { DeckSpec } from '../types';

export const reactorInFiveSlides: DeckSpec = {
  deck: {
    title: 'Reactor in five slides',
    subtitle: 'A plugin platform for applications with two tiers',
    template: 'datalayer',
    transition: 'slide',
    footer: { since: 2026, note: 'Example deck — shipped with @datalayer/decks' },
  },
  slides: [
    {
      type: 'title',
      title: 'Reactor in five slides',
      subtitle: 'Plugins, contribution points, and one install for both tiers.',
      meta: 'reactor.datalayer.tech',
    },
    {
      type: 'bullets',
      title: 'Three constructs',
      icon: 'arrow',
      items: [
        'A **plugin** declares what it needs and what it offers',
        'A **contribution point** is where offers land',
        'An **extension** is what you would uninstall to lose a capability',
      ],
      notes: 'Everything else on this site is one of these three, seen from a distance.',
    },
    {
      type: 'two-columns',
      title: 'Two tiers, one model',
      layout: 'wide-left',
      left: {
        type: 'text',
        heading: 'TypeScript',
        content:
          '`@datalayer/reactor` runs in the browser: slots, commands, keybindings, lazy and remote plugins.',
      },
      right: {
        type: 'bullets',
        icon: 'check',
        items: ['`datalayer_reactor` on pluggy and FastAPI', 'the same manifest, across the wire'],
      },
    },
    {
      type: 'code',
      title: 'One `pip install`, both halves',
      language: 'python',
      code: `def extension() -> ReactorExtension:
    return ReactorExtension(
        manifest=ExtensionManifest(name="decks"),
        plugins=[(MANIFEST, DecksPlugin())],       # the server half
        frontend=FrontendExtension(               # the browser half
            directory=_FRONTEND, entry="remoteEntry.js",
            kind="federated", remote_name="datalayer_decks", module="./plugin",
        ),
    )`,
    },
    {
      type: 'statement',
      statement: 'A plugin should be installable by somebody who is not building the application.',
      attribution: 'The roadmap, now shipped',
    },
  ],
};
