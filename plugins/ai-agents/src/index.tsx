/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * `@datalayer/decks-plugin-ai-agents` — an AI agent beside the decks.
 *
 * A frontend plugin for a Reactor host that already mounts
 * `@datalayer/decks/plugin`. It adds one thing: a floating chat, in the
 * host's root slot, with the **Decks agent** in it — the `example-decks`
 * agentspec, the reference deck agent. A host may name another through
 * `agentId`; the landing's deck editor runs `worker-pitcher`, the same agent
 * with a pitch-deck trade, on the same tools.
 *
 * It declares no tools of its own. The decks plugin contributes its commands
 * to the reactor's `AgentTools` point — list, read, create, replace, edit a
 * slide, open, move through, present, print — and this plugin reads that
 * point and hands the agent every one of them, run on this page through the
 * reactor's command registry. Switch the decks plugin off and the agent has
 * no tools; that is the point of reading rather than declaring.
 *
 * The agent runs in the page, on the browser harness of agent-runtimes: no
 * runtime is started. It reaches the model at the Datalayer inference
 * service on a **temporary key** — an anonymous session the service grants
 * a visitor for a while, shown counting down in the chat's header — or on
 * the signed-in person's own token when there is one. Which service is
 * `inferenceUrl`, from the host's configuration; the CLI passes it along
 * from `DATALAYER_AI_INFERENCE_URL`.
 *
 * The same shape as the reactor's `cms-astro/ai-agents` example, as a plugin
 * rather than a mount hook: the host names it (`datalayer decks serve
 * --reactor-plugins ai-agents`) and the reactor does the rest.
 *
 * @module
 */

import type { JSX } from 'react';
import { lazy, Suspense } from 'react';
import { definePlugin } from '@datalayer/reactor';
import type { ReactorReactOutput } from '@datalayer/reactor/react';
import { coreStore } from '@datalayer/agent-runtimes/lib/state/index.js';

// The chat and the harness are the heavy half of the page; they arrive when
// the plugin is on, not with the host's first bytes.
const DecksAgent = lazy(() => import('./DecksAgent'));

export const DECKS_AI_AGENTS_PLUGIN_NAME = '@datalayer/decks-plugin-ai-agents';

/**
 * The agentspec the chat is built from, unless the host names another:
 * the reference deck agent. `worker-pitcher` is its pitch-deck sibling and
 * names the same frontend toolset (`frontend-tools/decks.yaml`).
 */
export const DEFAULT_AGENT_ID = 'example-decks';

/**
 * Where the model is reached when the host names no service: the Datalayer
 * cloud, which is where a temporary key comes from. Named here, as the
 * reactor's cms-astro/ai-agents example names it, rather than left to
 * whatever the core store held before this plugin was built — a value that
 * may have been set by another application on the same origin.
 */
export const DEFAULT_INFERENCE_URL = 'https://r1.datalayer.run';

export type DecksAiAgentsPluginConfig = {
  /** Where the chat renders; a slot the host renders once, at the root. */
  slot: string;
  /** The agentspec: its prompt, model, name, icon, suggestions. */
  agentId: string;
  /**
   * The inference service to reach the model at. Unset, the harness's own
   * default — the Datalayer cloud — which is where a temporary key comes from.
   */
  inferenceUrl?: string;
};

export const DecksAiAgentsPlugin = definePlugin<
  DecksAiAgentsPluginConfig,
  unknown,
  ReactorReactOutput
>({
  name: DECKS_AI_AGENTS_PLUGIN_NAME,
  version: '1.0.0',
  displayName: 'AI Agents',
  description:
    'An agent beside the decks: writes and drives a deck through the decks commands, on a temporary AI key.',
  octicon: 'project',
  emoji: '\u{1F5BC}\uFE0F',
  config: {
    slot: 'root',
    agentId: DEFAULT_AGENT_ID,
    inferenceUrl: undefined,
  },
  build: ({ config }) => {
    // Always, and before the first render: the harness's hook reads the store
    // when the chat mounts, and the store is shared by everything on the
    // page — so the service this plugin was told about (or its default) is
    // what the chat uses, never a value some earlier application left there.
    coreStore
      .getState()
      .setConfiguration({ aiInferenceUrl: config.inferenceUrl || DEFAULT_INFERENCE_URL });
    const Agent = (): JSX.Element => (
      <Suspense fallback={null}>
        <DecksAgent agentId={config.agentId} />
      </Suspense>
    );
    return {
      components: [{ slot: config.slot, id: 'decks-ai-agent', Component: Agent }],
    };
  },
});

export default DecksAiAgentsPlugin;
