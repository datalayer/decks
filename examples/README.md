[![Datalayer](https://assets.datalayer.tech/datalayer-25.svg)](https://datalayer.io)

# 📊 Example decks

Two decks written as data, to show the slide library rather than any product:

| Deck | Shows |
| --- | --- |
| `reactorInFiveSlides.ts` | title, bullets with inline markup, two columns, code, statement |
| `quarterlyReview.ts` | metrics, chart, timeline, comparison, section, fragments |

The app registers both at start-up (`app/src/App.tsx`), so `datalayer-decks`
opens with them in the list beside whatever the server holds. To register your
own in any host:

```ts
import { registerDecks } from '@datalayer/decks';
registerDecks([{ collection: 'talks', slug: 'hello', spec }]);
```

or contribute them from a plugin through the `DeckCatalog` point.
