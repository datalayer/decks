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
datalayer decks serve          # http://127.0.0.1:8797, opens the browser
datalayer decks list
```

Installing the package adds a `decks` group to the Datalayer CLI — `serve`,
`list`, `show`, `delete` — through the reactor's `datalayer.cli` entry-point
group; `datalayer-decks` is the same group on its own. `serve` runs the decks
API (`/decks`, JSON specs on disk) and the interface built from
[`app/`](app/) from one origin. Set `DATALAYER_DECKS_DIR` (or `--decks-dir`)
to choose where decks are stored (`~/.datalayer/decks` otherwise).

Installed beside any other Reactor host, the same wheel publishes itself as an
extension: the routes join that host, and the Decks plugin — built by
[`extension/`](extension/) as a Module Federation container into
`share/datalayer/reactor/extensions/decks` — is loaded into that host's shell
through [federation](https://reactor.datalayer.tech/federation), no import
needed. See [python-packaged extensions](https://reactor.datalayer.tech/python-packaged-extensions).

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
| `decks.rename` | F2 | rename the open deck (or `{ id }`): title, address, family |
| `decks.delete` | — | delete the open deck (or `{ id }`), after asking |
| `decks.goToSlide` | — | move the open deck to a slide (`{ slide }`) |
| `decks.nextSlide` / `decks.previousSlide` | Alt+→ / Alt+← | move through the open deck |
| `decks.present` | Mod+Shift+F | the open deck, fullscreen |
| `decks.print` | Mod+Shift+P | the print view, for Save as PDF |

What the engine needs from the application around it — the theme, a footer
logo, whether the reader is signed in — arrives through `DecksHostProvider`,
with defaults that make a bare mount work.

## Agents

Everything an agent may do with decks is declared by this plugin, as one
[`AgentTools`](https://reactor.datalayer.tech/agent-tools) bundle
(`src/plugin/agentTools.json`): the data — `decks_list_decks`,
`decks_get_deck`, `decks_create_deck`, `decks_update_deck`, the per-slide
edits, `decks_delete_deck` — and the screen — `decks_open`, `decks_go_to_slide`,
`decks_next_slide`, `decks_previous_slide`, `decks_present`, `decks_print`,
`decks_list`. Each is a command the plugin registers (`DECKS_DATA_COMMANDS`,
`DECKS_COMMANDS`), run on the page against the catalog and the store — saved
to this server when the plugin was given one — and answering with what the
model needs next. No [agentspec](https://github.com/datalayer/agentspecs)
names a deck tool; `worker-decks` declares `tools: []` and gets them all from
the plugin it is mounted beside. The Python half serves the same file from
`GET /plugins/agent-tools`.

In a Loop (`@datalayer/agent-runtimes`), `@datalayer/loop-plugin-decks`
mounts this plugin beside the chat — the list in the sidebar, a **Deck**
editor view, a menu on the composer — and the chat hands the agent the
bundle's commands as tools, so an agent writes and drives a deck with no
server behind it. The `DecksAgent` example shows it.

## Development

```bash
make install          # pip install -e ".[test]"
make build-lib        # tsc → lib/
make build-app        # the interface → share/datalayer/reactor/apps/decks
make build-extension  # the container → share/datalayer/reactor/extensions/decks
make wheel            # both, then the wheel (hatch_build.py builds what is missing)
make test
make dev-app          # Rsbuild on :5190, against `datalayer decks serve` on :8797
```

The container build needs `@module-federation/rsbuild-plugin` (a
devDependency): `npm install` once in this package.

The deck *definitions* of a product stay with that product: the Datalayer
landing keeps its specs, its registry entries and its design-system
illustrations, and mounts this package around them.
