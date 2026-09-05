/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * One declaration of the deck tools, served by both halves.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DECKS_AGENT_TOOLS, DECKS_COMMANDS, DECKS_DATA_COMMANDS } from '../plugin';

const root = resolve(__dirname, '../..');
const read = (path: string) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

describe('the agent tools bundle', () => {
  it('is the file the Python half serves', () => {
    expect(read('datalayer_decks/agent_tools.json')).toEqual(read('src/plugin/agentTools.json'));
  });

  it('names every data command and every screen command the plugin registers, once', () => {
    const commands = DECKS_AGENT_TOOLS.commands.map((tool) => tool.command);
    const registered = [...Object.values(DECKS_DATA_COMMANDS), ...Object.values(DECKS_COMMANDS)]
      // The two dialogs — new deck, rename, delete-with-a-question — are a
      // person's, not an agent's: the agent creates from a spec and deletes
      // without a dialog through the data commands.
      .filter(
        (id) =>
          ![DECKS_COMMANDS.create, DECKS_COMMANDS.rename, DECKS_COMMANDS.remove].includes(
            id as never,
          ),
      );
    expect([...commands].sort()).toEqual([...registered].sort());
    expect(new Set(DECKS_AGENT_TOOLS.toolset).size).toBe(DECKS_AGENT_TOOLS.commands.length);
  });
});
