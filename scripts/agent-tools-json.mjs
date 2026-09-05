/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * Give the Python half the plugin's agent tools.
 *
 * `src/plugin/agentTools.json` is the one declaration of what an agent may do
 * with the decks plugin; `@datalayer/decks/plugin` contributes it to the
 * reactor, and `datalayer_decks` serves it from `GET /plugins/agent-tools`.
 * The Python package cannot import from `src/`, so the build copies the file
 * into it — verbatim, and a test fails when the two differ.
 */

import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'src/plugin/agentTools.json');
const target = resolve(root, 'datalayer_decks/agent_tools.json');
mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(`agent tools: ${source} → ${target}`);
