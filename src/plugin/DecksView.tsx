/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The main area: the open deck, or the catalog — every deck as a card, and
 * a button for a new one — so "show the decks" shows decks wherever the
 * list is not otherwise on screen.
 *
 * @module plugin/DecksView
 */

import type { JSX, KeyboardEvent } from 'react';
import { useEffect } from 'react';
import { Button, Heading, Text } from '@primer/react';
import { Box, Card } from '@datalayer/primer-addons';
import { PlusIcon } from '@primer/octicons-react';
import { useContributions } from '@datalayer/reactor/react';
import { DeckAccess } from '../DeckAccess';
import { DeckView } from '../DeckView';
import {
  deckId,
  deckPath,
  deckPrintPath,
  registerDecks,
  type DeckEntry,
} from '../registry/catalog';
import { useDecksTheme } from '../host';
import { DeckCatalog } from './points';
import {
  beginNewDeck,
  goToSlide,
  openDeck,
  useDeckEntries,
  useDecksState,
  useOpenDeck,
} from './store';

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
          gap: 4,
          maxWidth: 1280,
          mx: 'auto',
          px: 4,
          py: [5, 6],
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 3,
          }}
        >
          <Box>
            <Heading as="h2" sx={{ fontSize: 4 }}>
              Decks
            </Heading>
            <Text sx={{ color: 'fg.muted' }}>
              Presentations described as data.{' '}
              {entries.length > 0
                ? 'Open one, or start a new one.'
                : 'There is nothing to open yet; start a new one.'}
            </Text>
          </Box>
          <Button variant="primary" leadingVisual={PlusIcon} onClick={beginNewDeck}>
            New deck
          </Button>
        </Box>
        {entries.length > 0 ? (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 3,
            }}
          >
            {entries.map((entry) => {
              const id = deckId(entry);
              return (
                // The theme's card: its radius, surface and hover (the user, 3 November 2026).
                <Card
                  key={id}
                  role="button"
                  tabIndex={0}
                  aria-label={entry.spec.deck.title}
                  onClick={() => openDeck(id)}
                  onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openDeck(id);
                    }
                  }}
                  interactive
                  border
                  shadow="none"
                  display="flex"
                  flexDirection="column"
                  gap={1}
                  p={3}
                  minWidth={0}
                  overflow="hidden"
                >
                  <Text sx={{ fontSize: 0, color: 'fg.muted' }}>
                    {entry.collection ?? '\u00a0'}
                  </Text>
                  <Text sx={{ fontSize: 2, fontWeight: 'semibold' }}>{entry.spec.deck.title}</Text>
                  {entry.spec.deck.subtitle ? (
                    <Text sx={{ fontSize: 1, color: 'fg.muted' }}>{entry.spec.deck.subtitle}</Text>
                  ) : null}
                  <Text sx={{ fontSize: 0, color: 'fg.muted', mt: 1 }}>
                    {entry.spec.slides.length} slides
                    {entry.source === 'session' ? ' · unsaved' : ''}
                  </Text>
                </Card>
              );
            })}
          </Box>
        ) : null}
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
