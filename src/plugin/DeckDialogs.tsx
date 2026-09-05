/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The plugin's dialogs, in the host's dialog slot: new, rename, delete.
 *
 * One component in the slot rather than three, so a host renders the slot
 * once and gets whichever dialog the store says is open. Each is driven by
 * the store — a command, a menu row or a button sets the state — which is
 * what lets the palette and the list share them.
 *
 * @module plugin/DeckDialogs
 */

import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { Box, Dialog, FormControl, Text, TextInput } from '@primer/react';
import { deckById } from '../registry/catalog';
import { NewDeckDialog } from './NewDeckDialog';
import {
  cancelDelete,
  cancelRename,
  removeDeck,
  renameDeck,
  slugify,
  useDeckEntries,
  useDecksState,
} from './store';

export const RenameDeckDialog = (): JSX.Element | null => {
  const { renaming } = useDecksState();
  useDeckEntries();
  const entry = renaming ? deckById(renaming) : undefined;
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [collection, setCollection] = useState('');
  // Whether the address still follows the title. Typing an address by hand
  // takes over; clearing it hands back.
  const [slugFollows, setSlugFollows] = useState(false);

  useEffect(() => {
    if (entry) {
      setTitle(entry.spec.deck.title);
      setSlug(entry.slug);
      setCollection(entry.collection ?? '');
      setSlugFollows(false);
    }
  }, [entry]);

  if (!entry || !renaming) {
    return null;
  }

  const address = `/decks/${collection.trim() ? `${collection.trim()}/` : ''}${slugify(slug || title)}`;
  const submit = (): void => {
    if (!title.trim()) {
      return;
    }
    void renameDeck(renaming, { title, slug: slug || title, collection });
  };

  return (
    <Dialog
      title="Rename the deck"
      subtitle={`Now “${entry.spec.deck.title}”, at /decks/${renaming}.`}
      onClose={cancelRename}
      footerButtons={[
        { buttonType: 'default', content: 'Cancel', onClick: cancelRename },
        {
          buttonType: 'primary',
          content: 'Rename',
          onClick: submit,
          disabled: !title.trim(),
        },
      ]}
    >
      <Box
        as="form"
        onSubmit={(event: React.FormEvent) => {
          event.preventDefault();
          submit();
        }}
        sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
      >
        <FormControl required>
          <FormControl.Label>Title</FormControl.Label>
          <TextInput
            block
            autoFocus
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (slugFollows) {
                setSlug(slugify(event.target.value));
              }
            }}
          />
        </FormControl>
        <FormControl>
          <FormControl.Label>Address</FormControl.Label>
          <TextInput
            block
            value={slug}
            onChange={(event) => {
              setSlug(event.target.value);
              setSlugFollows(event.target.value === '');
            }}
            placeholder={slugify(title) || 'the-address'}
          />
          <FormControl.Caption>
            The deck will be at <code>{address}</code>; links to the old address stop working.
          </FormControl.Caption>
        </FormControl>
        <FormControl>
          <FormControl.Label>Family</FormControl.Label>
          <TextInput
            block
            value={collection}
            onChange={(event) => setCollection(event.target.value)}
            placeholder="Optional — groups decks in the list and the address"
          />
        </FormControl>
      </Box>
    </Dialog>
  );
};

export const DeleteDeckDialog = (): JSX.Element | null => {
  const { deleting, backendUrl } = useDecksState();
  useDeckEntries();
  const entry = deleting ? deckById(deleting) : undefined;
  if (!entry || !deleting) {
    return null;
  }
  const confirm = (): void => {
    void removeDeck(deleting);
  };
  return (
    <Dialog
      title="Delete the deck"
      onClose={cancelDelete}
      footerButtons={[
        { buttonType: 'default', content: 'Cancel', onClick: cancelDelete },
        { buttonType: 'danger', content: 'Delete', onClick: confirm },
      ]}
    >
      <Text as="p" sx={{ m: 0 }}>
        Delete <strong>{entry.spec.deck.title}</strong> ({entry.spec.slides.length} slides, at{' '}
        <code>/decks/{deleting}</code>)? It leaves the list
        {backendUrl && entry.source !== 'bundled' ? ' and the server' : ''}. There is no undo.
      </Text>
    </Dialog>
  );
};

/** All three, for the dialog slot. */
export const DeckDialogs = (): JSX.Element => (
  <>
    <NewDeckDialog />
    <RenameDeckDialog />
    <DeleteDeckDialog />
  </>
);

export default DeckDialogs;
