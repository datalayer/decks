/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The "new deck" dialog: a title, a subtitle, a family, a template.
 *
 * Mounted in the host's `root` slot and shown when the store says so, which is
 * how a command or a keystroke opens it from outside React.
 *
 * @module plugin/NewDeckDialog
 */

import type { JSX } from 'react';
import { useState } from 'react';
import { Box, Dialog, FormControl, Select, TextInput } from '@primer/react';
import { deckTemplates } from '../templates';
import { cancelNewDeck, createDeck, useDecksState } from './store';

export const NewDeckDialog = (): JSX.Element | null => {
  const { creating } = useDecksState();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [collection, setCollection] = useState('');
  const [template, setTemplate] = useState('datalayer');

  if (!creating) {
    return null;
  }

  const submit = (): void => {
    if (!title.trim()) {
      return;
    }
    void createDeck({
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      collection: collection.trim() || undefined,
      template,
    });
    setTitle('');
    setSubtitle('');
  };

  return (
    <Dialog
      title="New deck"
      subtitle="A title slide to start from; everything else is data you write."
      onClose={cancelNewDeck}
      footerButtons={[
        { buttonType: 'default', content: 'Cancel', onClick: cancelNewDeck },
        {
          buttonType: 'primary',
          content: 'Create',
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
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Quarterly review"
          />
        </FormControl>
        <FormControl>
          <FormControl.Label>Subtitle</FormControl.Label>
          <TextInput
            block
            value={subtitle}
            onChange={(event) => setSubtitle(event.target.value)}
            placeholder="What this deck is for"
          />
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
        <FormControl>
          <FormControl.Label>Template</FormControl.Label>
          <Select block value={template} onChange={(event) => setTemplate(event.target.value)}>
            {Object.values(deckTemplates).map((candidate) => (
              <Select.Option key={candidate.name} value={candidate.name}>
                {candidate.label}
              </Select.Option>
            ))}
          </Select>
        </FormControl>
      </Box>
    </Dialog>
  );
};

export default NewDeckDialog;
