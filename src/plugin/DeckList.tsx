/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * Every deck the catalog knows, grouped by family, with a button to make one.
 *
 * Contributed to the host's sidebar slot. It reads the catalog live, so a deck
 * that arrives from the server, from a contribution or from the dialog is in
 * the list the moment it is registered.
 *
 * @module plugin/DeckList
 */

import type { JSX } from 'react';
import { useMemo } from 'react';
import { ActionList, Button, Heading, Text } from '@primer/react';
import { Box } from '@datalayer/primer-addons';
import { PlusIcon, ProjectIcon } from '@primer/octicons-react';
import { deckId, type DeckEntry } from '../registry/catalog';
import { beginNewDeck, openDeck, useDeckEntries, useDecksState } from './store';

const FAMILY_OF_ONE = '';

export const DeckList = (): JSX.Element => {
  const entries = useDeckEntries();
  const { selected, error } = useDecksState();

  const families = useMemo(() => {
    const groups = new Map<string, DeckEntry[]>();
    for (const entry of entries) {
      const key = entry.collection ?? FAMILY_OF_ONE;
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [entries]);

  return (
    <Box
      as="nav"
      aria-label="Decks"
      sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 3, minWidth: 240 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Heading as="h2" sx={{ fontSize: 2 }}>
          Decks
        </Heading>
        <Button size="small" leadingVisual={PlusIcon} onClick={beginNewDeck}>
          New deck
        </Button>
      </Box>
      {error ? (
        <Text sx={{ color: 'attention.fg', fontSize: 0 }}>{error}</Text>
      ) : null}
      {entries.length === 0 ? (
        <Text sx={{ color: 'fg.muted', fontSize: 1 }}>
          No decks yet. Make one, or register some.
        </Text>
      ) : (
        <ActionList selectionVariant="single">
          {families.map(([family, decks]) => (
            <ActionList.Group key={family || '(standalone)'}>
              {family ? (
                <ActionList.GroupHeading as="h3">{family}</ActionList.GroupHeading>
              ) : null}
              {decks.map((entry) => {
                const id = deckId(entry);
                return (
                  <ActionList.Item
                    key={id}
                    selected={id === selected}
                    onSelect={() => openDeck(id)}
                  >
                    <ActionList.LeadingVisual>
                      <ProjectIcon />
                    </ActionList.LeadingVisual>
                    {entry.spec.deck.title}
                    <ActionList.Description variant="block">
                      {entry.spec.slides.length} slides
                      {entry.source === 'session' ? ' · unsaved' : ''}
                    </ActionList.Description>
                  </ActionList.Item>
                );
              })}
            </ActionList.Group>
          ))}
        </ActionList>
      )}
    </Box>
  );
};

export default DeckList;
