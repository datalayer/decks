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
import { ActionList, ActionMenu, Box, Button, Heading, IconButton, Text } from '@primer/react';
import {
  KebabHorizontalIcon,
  PencilIcon,
  PlusIcon,
  ProjectIcon,
  TrashIcon,
} from '@primer/octicons-react';
import { deckId, type DeckEntry } from '../registry/catalog';
import {
  beginDelete,
  beginNewDeck,
  beginRename,
  openDeck,
  useDeckEntries,
  useDecksState,
} from './store';

const FAMILY_OF_ONE = '';

/**
 * Rename and delete, behind a kebab beside the row.
 *
 * `ActionList.TrailingAction` rather than a button inside the item: the item
 * with an `onSelect` *is* a button, and a button nested in it is not one the
 * browser will run — the click went to the row and opened the deck. The
 * trailing action is a sibling of the row's button inside the `li`, and it
 * anchors a controlled menu.
 */
const RowActions = ({ id, title }: { id: string; title: string }): JSX.Element => (
  <ActionMenu>
    <ActionMenu.Anchor>
      <IconButton
        icon={KebabHorizontalIcon}
        aria-label={`Actions for ${title}`}
        size="small"
        variant="invisible"
      />
    </ActionMenu.Anchor>
    <ActionMenu.Overlay width="small">
      <ActionList>
        <ActionList.Item onSelect={() => beginRename(id)}>
          <ActionList.LeadingVisual>
            <PencilIcon />
          </ActionList.LeadingVisual>
          Rename…
        </ActionList.Item>
        <ActionList.Item variant="danger" onSelect={() => beginDelete(id)}>
          <ActionList.LeadingVisual>
            <TrashIcon />
          </ActionList.LeadingVisual>
          Delete…
        </ActionList.Item>
      </ActionList>
    </ActionMenu.Overlay>
  </ActionMenu>
);

/**
 * One deck: a button that opens it, and the kebab beside it — siblings, so
 * neither click reaches the other. Drawn by hand rather than with
 * `ActionList.Item`: its content is itself a button, which is why the kebab
 * inside it used to open the deck, and its description layout put air above
 * and below the title that the icon did not share.
 */
const DeckRow = ({ entry, selected }: { entry: DeckEntry; selected: boolean }): JSX.Element => {
  const id = deckId(entry);
  const title = entry.spec.deck.title;
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        pr: 1,
        borderRadius: 2,
        bg: selected ? 'actionListItem.default.selectedBg' : 'transparent',
        '&:hover': {
          bg: selected ? 'actionListItem.default.selectedBg' : 'actionListItem.default.hoverBg',
        },
      }}
    >
      <Box
        as="button"
        type="button"
        aria-current={selected ? 'true' : undefined}
        onClick={() => openDeck(id)}
        sx={{
          flex: '1 1 auto',
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 2,
          py: '6px',
          border: 0,
          bg: 'transparent',
          color: 'fg.default',
          font: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
          borderRadius: 2,
        }}
      >
        <Box sx={{ display: 'flex', color: 'fg.muted', flex: '0 0 auto' }}>
          <ProjectIcon />
        </Box>
        <Box
          sx={{
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            lineHeight: 'condensed',
          }}
        >
          <Text
            sx={{
              fontSize: 1,
              fontWeight: selected ? 'semibold' : 'normal',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </Text>
          <Text sx={{ fontSize: 0, color: 'fg.muted' }}>
            {entry.spec.slides.length} slides
            {entry.source === 'session' ? ' · unsaved' : ''}
          </Text>
        </Box>
      </Box>
      <RowActions id={id} title={title} />
    </Box>
  );
};

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
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: 3,
        minWidth: 240,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Heading as="h2" sx={{ fontSize: 2 }}>
          Decks
        </Heading>
        <Button size="small" leadingVisual={PlusIcon} onClick={beginNewDeck}>
          New deck
        </Button>
      </Box>
      {error ? <Text sx={{ color: 'attention.fg', fontSize: 0 }}>{error}</Text> : null}
      {entries.length === 0 ? (
        <Text sx={{ color: 'fg.muted', fontSize: 1 }}>
          No decks yet. Make one, or register some.
        </Text>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {families.map(([family, decks]) => (
            <Box
              key={family || '(standalone)'}
              sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
            >
              {family ? (
                <Text
                  as="h3"
                  sx={{
                    m: 0,
                    px: 2,
                    pt: 2,
                    pb: 1,
                    fontSize: 0,
                    fontWeight: 'semibold',
                    color: 'fg.muted',
                  }}
                >
                  {family}
                </Text>
              ) : null}
              {decks.map((entry) => (
                <DeckRow key={deckId(entry)} entry={entry} selected={deckId(entry) === selected} />
              ))}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default DeckList;
