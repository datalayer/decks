[![Datalayer](https://assets.datalayer.tech/datalayer-25.svg)](https://datalayer.io)

# ☰ 🃏 Datalayer Decks Plugins

Optional plugins for a Reactor host that mounts the decks. The `datalayer
decks` interface bundles them and activates the ones the server names:

```bash
datalayer decks serve talk.yaml --reactor-plugins ai-agents
```

| Plugin | Name for `--reactor-plugins` | What it adds |
| --- | --- | --- |
| [`ai-agents`](./ai-agents) | `ai-agents` | The Decks agent (`example-decks`) beside the decks, on a temporary key, driving the decks commands |
