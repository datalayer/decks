/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * What an AI agent may do with the decks plugin: its commands, as tools.
 *
 * Declared once, in `agentTools.json`, and contributed to the reactor's
 * `AgentTools` point — not written in any agent's own specification. The
 * bundle names the plugin's data commands (list, read, create, replace, edit a
 * slide, delete) as much as the ones that steer the deck on screen (open,
 * move, present, print); each is a command this plugin registers, and each
 * answers the agent with what the command returned. A host that mounts the
 * plugin reads the bundle and hands the agent these tools, run on the page.
 *
 * The file is JSON so the Python half serves the same one: the build copies
 * it to `datalayer_decks/agent_tools.json`, and a test keeps the two equal.
 *
 * @module plugin/agentTools
 */

import { defineAgentTools } from '@datalayer/reactor';
import bundle from './agentTools.json';

export const DECKS_AGENT_TOOLS = defineAgentTools(bundle as Parameters<typeof defineAgentTools>[0]);
