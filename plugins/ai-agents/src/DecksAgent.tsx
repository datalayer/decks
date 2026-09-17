/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The chat, with the deck agent in it.
 *
 * Loaded lazily by the plugin entry: this is where agent-runtimes' chat and
 * browser harness come in. What it needs from the page it asks the reactor
 * for — the decks plugin's `AgentTools` bundle, as frontend tools bound to
 * the command registry — and what it needs from the network it gets from
 * `useBrowserInference`: a temporary key when nobody is signed in, the
 * person's own token when somebody is.
 *
 * @module DecksAgent
 */

import type { JSX } from 'react';
import { useMemo } from 'react';
import { Flash } from '@primer/react';
import { useThemeStore } from '@datalayer/primer-addons';
import { AnonymousKeyTimer } from '@datalayer/core/lib/components/anonymous/AnonymousKeyTimer';
import { ChatFloating } from '@datalayer/agent-runtimes/lib/chat/ChatFloating.js';
import { useBrowserInference } from '@datalayer/agent-runtimes/lib/hooks/useBrowserInference.js';
import { browserProtocolConfig } from '@datalayer/agent-runtimes/lib/runtimes/browser/protocol.js';
import { getAgentspecs } from '@datalayer/agent-runtimes/lib/specs/agents/index.js';
import { useAgentCommandTools } from '@datalayer/agent-runtimes/lib/tools/adapters/commands/frontendCommandTools.js';

export type DecksAgentProps = {
  /** The agentspec to build the chat from. */
  agentId: string;
};

export function DecksAgent({ agentId }: DecksAgentProps): JSX.Element {
  const spec = useMemo(() => getAgentspecs(agentId), [agentId]);
  const { inference, anonymous, needsSignIn } = useBrowserInference(true);
  // Every command the plugins on this page offer an agent — the decks
  // plugin's bundle, on this host — run through the reactor.
  const tools = useAgentCommandTools();
  const { colorMode, theme } = useThemeStore();

  const protocol = useMemo(
    () =>
      spec
        ? browserProtocolConfig({
            agentId: spec.id,
            instructions: spec.systemPrompt,
            model: spec.model,
            frontendTools: tools,
            inference,
          })
        : undefined,
    [inference, spec, tools],
  );
  const suggestions = useMemo(
    () =>
      (spec?.suggestions ?? []).map((item) => ({
        title: item.summary || item.text,
        message: item.text,
      })),
    [spec],
  );

  if (!spec) {
    return (
      <Flash variant="danger" sx={{ position: 'fixed', right: 20, bottom: 20, zIndex: 1001 }}>
        The agentspec “{agentId}” is not in this build of agent-runtimes.
      </Flash>
    );
  }

  // `useBrowserInference` is backed by the visitor's temporary key or by a
  // signed-in member's token; `needsSignIn` covers both, where reading the
  // anonymous token alone would leave a signed-in person stuck launching.
  const inferenceReady = !needsSignIn;
  const inferenceFailed = anonymous.status === 'failed';
  const timer = anonymous.expiresAt ? (
    <AnonymousKeyTimer expiresAt={anonymous.expiresAt} grantedMs={anonymous.grantedMs} label="AI key" />
  ) : null;

  return (
    <>
      {inferenceFailed && (
        <Flash
          variant="danger"
          sx={{ position: 'fixed', right: 20, bottom: 88, zIndex: 1001, maxWidth: 460 }}
        >
          The {spec.name} could not obtain a temporary AI key.
        </Flash>
      )}
      <ChatFloating
        protocol={protocol}
        useStore={false}
        themeVariant={theme}
        colorMode={colorMode}
        title={spec.name}
        description={spec.welcomeMessage ?? spec.description}
        suggestions={suggestions}
        position="bottom-right"
        defaultViewMode="floating-small"
        width={440}
        height={620}
        showModelSelector={false}
        showToolsMenu={tools.length > 0}
        showSkillsMenu={false}
        showTokenUsage
        enableEphemeralNotebook={false}
        launching={!inferenceReady}
        launchingMessage={
          inferenceFailed ? 'Temporary AI access is unavailable.' : 'Preparing secure AI access…'
        }
        panelProps={{ headerContent: timer }}
        buttonTooltip={`${spec.name}: write and drive a deck with AI`}
      />
    </>
  );
}

export default DecksAgent;
