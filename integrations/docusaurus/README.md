[![Datalayer](https://images.datalayer.io/legacy/datalayer-25.svg)](https://datalayer.ai)

# ☰ 🃏 🦕 Datalayer Decks Integrations for Docusaurus

`@datalayer/decks-docusaurus` draws [Datalayer Decks](../../README.md) in a
[Docusaurus](https://docusaurus.io) site: a deck written as data, in a
`.deck.json` file beside the docs, shown in any MDX page with `<Deck>`.

- **Checked when the site builds.** Every `.deck.json` under the site's
  `decks` directory is checked by `docusaurus build` and `docusaurus start`:
  JSON, a deck's shape, slide types the engine knows, and no more slides than
  the site allows. A deck that cannot be drawn stops the build.
- **Drawn in the browser only.** The deck engine (React, Reveal.js and
  Datalayer's design system) is kept out of the server bundle; the page holds
  the deck's place with a box of the slides' shape until it arrives.
- **In Datalayer's look, in the site's colour mode.** The deck and its
  toolbar wear a primer-addons theme — `loop`, what datalayer.ai wears, with
  its Inter face, unless the site names another — in the colour mode the
  site's own switch chose, following it when the reader switches. There is no
  appearance chooser on the deck.
- **Play, without a voice.** **Play** walks through the deck on its own:
  each slide's speaker notes shown as captions, sentence by sentence, at
  reading pace, the deck moving on when a slide's notes are read. Nothing is
  said aloud — a voice, and making a video of the deck, are features of the
  Datalayer platform.
- **One React.** React is pinned to the site's own copy, so a deck engine
  resolved from elsewhere in a workspace never brings a second one.

## Install

```bash
npm install @datalayer/decks-docusaurus @datalayer/decks @datalayer/primer-addons @primer/react
```

## Configure

```js
// docusaurus.config.js
export default {
  plugins: [
    ['@datalayer/decks-docusaurus', { decksDir: 'decks', maxSlides: 10 }],
  ],
};
```

| Option      | Default                 | What it does                                                                                                        |
| ----------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `decksDir`  | `decks`                 | Where the site's `.deck.json` files are, from the site's directory, searched recursively.                            |
| `maxSlides` | no limit                | The most slides a deck may have: a longer one fails the build.                                                       |
| `controls`  | `['notes', 'play', 'present']` | The toolbar's buttons on every deck. `pdf` and `video` need a print route and a voice a docs site lacks. |
| `theme`     | `loop`                  | The primer-addons theme variant the decks wear: `loop`, `datalayer`, `spatial` and the rest.                         |

## Write a deck

A deck is a `deck` and its `slides`, each slide a semantic type — `title`,
`statement`, `flow`, `two-columns`, `mermaid`, `bullets`, `closing` and the
rest of `SlideType` in [`src/types.ts`](../../src/types.ts). Speaker notes,
on every slide, are what the **Notes** button shows.

```json
{
  "deck": { "title": "Session Keys", "template": "datalayer" },
  "slides": [
    { "type": "title", "title": "Session Keys", "notes": "Each Session has its own key." },
    {
      "type": "flow",
      "title": "Starting a Session",
      "items": [
        { "label": "1", "title": "New key", "detail": "One per Session" },
        { "label": "2", "title": "Prove", "detail": "A DPoP proof signed with it" }
      ],
      "notes": "The key's thumbprint names the Session."
    }
  ]
}
```

## Show it in a page

```mdx
import Deck from '@theme/Deck';
import sessionKeys from '@site/decks/session-keys.deck.json';

# Session Keys

<Deck spec={sessionKeys} />
```

`<Deck controls="present">` shows other buttons than the site's default.
Space pauses and resumes *Play*, Escape stops it. A
deck that fails the engine's own check (`validateDeckSpec`) is not drawn: the
page says what is wrong with it instead.

## Develop

```bash
npm run build   # tsc → lib/
npm test        # vitest
```

The package is released with `@datalayer/decks`, at the same version
([RELEASE.md](../../RELEASE.md)).
