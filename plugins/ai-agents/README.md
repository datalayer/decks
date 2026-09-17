[![Datalayer](https://assets.datalayer.tech/datalayer-25.svg)](https://datalayer.io)

# ☰ 🃏 Datalayer Decks Plugin AI Agents

An AI agent beside the decks: a frontend plugin for a Reactor host that
already mounts `@datalayer/decks/plugin`. It puts a floating chat in the
host's root slot with the **Pitcher** in it — the `worker-pitcher` agentspec
from [agentspecs](https://github.com/datalayer/agentspecs), the deck agent
tailored to pitch decks.

```bash
datalayer decks serve talk.yaml --reactor-plugins ai-agents
```

## What it does, and does not, declare

The plugin declares **no tools**. The decks plugin contributes its commands
to the reactor's `AgentTools` point — list, read, create, replace, edit a
slide, open, move through, present, print — and this plugin reads that point
and hands the agent every one of them, run on the page through the reactor's
command registry (`useAgentCommandTools` from agent-runtimes). Switch the
decks plugin off and the agent has no tools; that is the point of reading
rather than declaring.

## The agent

- **Spec**: `worker-pitcher` — its prompt (the investor arc mapped to slide
  types, action titles, numbers as metrics), model, name, icon, welcome and
  suggestions. Another agentspec can be named through the plugin's `agentId`
  configuration.
- **Harness**: agent-runtimes' browser harness — the loop runs in the page,
  no runtime is started.
- **Key**: a **temporary key** — an anonymous session the Datalayer inference
  service grants a visitor for a while, shown counting down in the chat's
  header — or the signed-in person's own token when there is one
  (`useBrowserInference`). Which service: `DATALAYER_AI_INFERENCE_URL` on the
  host, passed to the interface through `GET /config`; the harness's default
  otherwise.

The same shape as the reactor's `examples/cms-astro/ai-agents`, as a plugin
rather than a mount hook: the host names it and the reactor does the rest.

## How a host activates it

The `datalayer decks` app bundles the plugin but leaves it off. The server
answers `GET /config` with the plugins it was started with
(`--reactor-plugins`, repeatable or comma-separated), and `app/src/App.tsx`
builds the named ones into the reactor (`OPTIONAL_PLUGINS`). A name this
build does not know is logged and skipped.

## Layout

```
plugins/ai-agents/
├── src/index.tsx        the plugin: definePlugin, a root-slot component, lazy runtime
├── src/PitcherAgent.tsx the chat: spec, tools from the reactor, temporary key, ChatFloating
└── package.json         @datalayer/decks-plugin-ai-agents
```
