[![Datalayer](https://assets.datalayer.tech/datalayer-25.svg)](https://datalayer.io)

# 📊 Datalayer Decks

Presentations, described as data — and the [Reactor](https://reactor.datalayer.tech)
plugin that puts them in any Reactor shell.

```
spec (.ts, YAML-shaped)
   ↓  validation
template            branding, palette, type scale, layout overrides
   ↓
slide library       reusable semantic slide types
   ↓
@revealjs/react → Reveal.js
```

A spec says `type: metrics`; how a metrics slide looks is the template's
business. That is what lets one deck be an application deck, a conference talk
and a dark projection deck by changing one word.

## Two halves, one install

```bash
pip install datalayer_decks
datalayer-decks                # http://127.0.0.1:8797
```

`datalayer-decks` serves the decks API (`/decks`, JSON specs on disk) and the
interface built from [`app/`](app/) from one origin. Set `DATALAYER_DECKS_DIR`
to choose where decks are stored (`~/.datalayer/decks` otherwise). Installed
beside any other Reactor host, the same package publishes itself as an
extension: the routes join that host, and — once `app/` has been built as a
container — so does the Decks view.

## The package

```ts
import { registerDecks, DeckView, DecksHostProvider } from '@datalayer/decks';
import { DecksPlugin } from '@datalayer/decks/plugin';
```

- **`@datalayer/decks`** — the engine: types, `validateDeck`, the slide
  library, the templates (`datalayer`, `datalayer-brand`, `datalayer-ink`),
  `DeckRenderer`, `DeckView`, `DeckPrintView`, `DeckAccess`, and two
  registries the host fills — the deck catalog (`registerDecks`) and the
  components a spec may name (`registerDeckComponents`).
- **`@datalayer/decks/plugin`** — `DecksPlugin`: a list in the `sidebar` slot,
  the open deck in `main`, a "Decks" entry in the shell's view selector, and
  commands with keystrokes.

| Command | Keystroke | Does |
| --- | --- | --- |
| `decks.list` | Mod+Shift+D | close the open deck, show the list |
| `decks.new` | Mod+Alt+N | the "new deck" dialog |
| `decks.open` | — | open a deck by id (`{ id, slide? }`) |
| `decks.goToSlide` | — | move the open deck to a slide (`{ slide }`) |
| `decks.nextSlide` / `decks.previousSlide` | Alt+→ / Alt+← | move through the open deck |
| `decks.present` | Mod+Shift+F | the open deck, fullscreen |
| `decks.print` | Mod+Shift+P | the print view, for Save as PDF |

What the engine needs from the application around it — the theme, a footer
logo, whether the reader is signed in — arrives through `DecksHostProvider`,
with defaults that make a bare mount work.

## Agents

The plugin's commands and its backend are also an agent's tools. The
`decks` bundle in [agentspecs](https://github.com/datalayer/agentspecs)
(`reactor-tools/decks.yaml`) lists every command above as a frontend tool —
executed on the reactor the page is mounted in — and every route of the API
as a backend tool; `worker-decks` is the agent that takes it.

In a Loop (`@datalayer/agent-runtimes`), `@datalayer/loop-plugin-decks`
mounts this plugin beside the chat — the list in the sidebar, a **Deck**
editor view, a menu on the composer — and implements the whole bundle in the
page (`addDeck`, `replaceDeck`, `removeDeck`, `presentOpenDeck`,
`printOpenDeck` from `@datalayer/decks/plugin`), so an agent writes and
drives a deck with no server behind it. The `DecksAgent` example shows it.

## Development

```bash
make install        # pip install -e ".[test]"
make build-lib      # tsc → lib/
make build-app      # the interface → share/datalayer/reactor/apps/decks
make test
make dev-app        # Rsbuild on :5190, against `datalayer-decks` on :8797
```

The deck *definitions* of a product stay with that product: the Datalayer
landing keeps its specs, its registry entries and its design-system
illustrations, and mounts this package around them.
