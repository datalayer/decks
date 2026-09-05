/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The main area: the open deck, or an invitation to open one.
 *
 * @module plugin/DecksView
 */

import type { JSX } from 'react';
import { useEffect } from 'react';
import { Button, Heading, Text } from '@primer/react';
import { Box } from '@datalayer/primer-addons';
import { PlusIcon } from '@primer/octicons-react';
import { useContributions } from '@datalayer/reactor/react';
import { DeckAccess } from '../DeckAccess';
import { DeckView } from '../DeckView';
import { deckPath, deckPrintPath, registerDecks, type DeckEntry } from '../registry/catalog';
import { useDecksTheme } from '../host';
import { DeckCatalog } from './points';
import { beginNewDeck, goToSlide, useDeckEntries, useDecksState, useOpenDeck } from './store';

/** Decks other plugins contributed, folded into the catalog while they are. */
const useContributedDecks = (): void => {
  const contributed = useContributions(DeckCatalog);
  useEffect(() => {
    const entries = contributed.map((entry) => entry.value as DeckEntry);
    return registerDecks(entries);
  }, [contributed]);
};

export const DecksView = (): JSX.Element => {
  useContributedDecks();
  const entries = useDeckEntries();
  const open = useOpenDeck();
  const { slide } = useDecksState();
  const { theme, colorMode } = useDecksTheme();

  if (!open) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          py: [6, 8],
          px: 4,
          textAlign: 'center',
        }}
      >
        <Heading as="h1" sx={{ fontSize: 4 }}>
          Decks
        </Heading>
        <Text sx={{ color: 'fg.muted', maxWidth: 520 }}>
          Presentations described as data. {entries.length > 0 ? 'Pick one from the list, or' : 'There is nothing to open yet;'}{' '}
          start a new one.
        </Text>
        <Button variant="primary" leadingVisual={PlusIcon} onClick={beginNewDeck}>
          New deck
        </Button>
      </Box>
    );
  }

  return (
    <DeckAccess deckId={deckPath(open)} title={open.spec.deck.title} access={open.spec.deck.access}>
      <DeckView
        spec={open.spec}
        printPath={deckPrintPath(open, {
          variant: open.spec.deck.theme ?? theme,
          colorMode: open.spec.deck.colorMode ?? colorMode,
        })}
        slide={slide}
        onSlideChange={goToSlide}
      />
    </DeckAccess>
  );
};

export default DecksView;
