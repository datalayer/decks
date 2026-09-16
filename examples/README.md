[![Datalayer](https://assets.datalayer.tech/datalayer-25.svg)](https://datalayer.io)

# 📊 Example decks

Decks written as data, to show the slide library rather than any product:

| Deck | Shows |
| --- | --- |
| `src/examples/reactorInFiveSlides.ts` | title, bullets with inline markup, two columns, code, statement |
| `src/examples/quarterlyReview.ts` | metrics, chart, timeline, comparison, section, fragments |
| `examples/welcome/welcome.yaml` | the file-based CLI flow, Mermaid slides and blocks, and the principal semantic layouts |

Run the YAML example directly:

```bash
make example
# equivalent to: datalayer decks serve examples/welcome/welcome.yaml
```

They ship in the package as `@datalayer/decks/examples` (`exampleDecks`). The
app registers both at start-up (`app/src/App.tsx`), so `datalayer decks serve`
opens with them in the list beside whatever the server holds; the Loop's
DecksAgent example does the same. To register your
own in any host:

```ts
import { registerDecks } from '@datalayer/decks';
registerDecks([{ collection: 'talks', slug: 'hello', spec }]);
```

or contribute them from a plugin through the `DeckCatalog` point.
