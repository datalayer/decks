[![Datalayer](https://assets.datalayer.tech/datalayer-25.svg)](https://datalayer.io)

# 📊 Example decks

Decks written as data, to show the slide library rather than any product:

| Deck | Shows |
| --- | --- |
| `src/examples/everyLayout.ts` | **every** semantic slide type, one slide each — including the live-component slide, the component artifact visual and the component backdrop |
| `src/examples/reactorInFiveSlides.ts` | title, bullets with inline markup, two columns, code, statement |
| `src/examples/quarterlyReview.ts` | metrics, chart, timeline, comparison, section, fragments |
| `examples/welcome/welcome.yaml` | the file-based CLI flow, Mermaid slides and blocks, the principal semantic layouts, and two live components — the appearance chooser and a Jupyter cell on a Pyodide kernel |

`everyLayout` is the reference deck: `src/__tests__/examples.test.ts` asserts it
covers `SLIDE_TYPES` exactly, so a slide type added to the library and not to
that deck fails the suite rather than going quietly undocumented.

Run the YAML example directly:

```bash
make example
# equivalent to: datalayer decks serve examples/welcome/welcome.yaml
```

They ship in the package as `@datalayer/decks/examples` (`exampleDecks`). The
app registers them all at start-up (`app/src/App.tsx`), so `datalayer decks serve`
opens with them in the list beside whatever the server holds; the Loop's
DecksAgent example does the same. To register your
own in any host:

```ts
import { registerDecks } from '@datalayer/decks';
registerDecks([{ collection: 'talks', slug: 'hello', spec }]);
```

or contribute them from a plugin through the `DeckCatalog` point.

## Components a spec may name

A spec names a component; it never imports one, so the host decides what a name
means. `everyLayout` names three — the appearance chooser out of
`@datalayer/primer-addons` and the hero out of `@datalayer/design`, wrapped in
`src/examples/exampleComponents.tsx` — and ships them as a map beside the decks:

```ts
import { exampleDecks, exampleDeckComponents } from '@datalayer/decks/examples';
import { registerDeckComponents, registerDecks } from '@datalayer/decks';

registerDecks(exampleDecks);
registerDeckComponents(exampleDeckComponents);
```

Register the decks without the components and nothing breaks: the three slides
that name one show the engine's "unknown component" notice instead. Do register
them and the `component` slide is a live control — pick a theme on the slide and
the drawing beside it repaints, reading the same store.

The welcome deck names one more, `JupyterPyodideCell`, which the **app**
registers rather than the package (`app/src/deckComponents.tsx`): a Jupyter cell
whose kernel is Pyodide, running Python in the tab with no server behind it.
It lives there because JupyterLab, Lumino and CodeMirror are a fair thing for a
Jupyter host to carry and an unfair thing to put in a deck engine — which is the
registry's whole point: the spec names a capability, and each host decides what
it can offer. It loads lazily and only once its slide is on screen, so a reader
who stops at slide three never downloads Pyodide.
