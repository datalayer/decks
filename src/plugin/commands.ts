/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/** The ids of the plugin's commands, for a host that binds or lists them itself. */
export const DECKS_COMMANDS = {
  list: 'decks.list',
  create: 'decks.new',
  rename: 'decks.rename',
  remove: 'decks.delete',
  open: 'decks.open',
  goTo: 'decks.goToSlide',
  next: 'decks.nextSlide',
  previous: 'decks.previousSlide',
  present: 'decks.present',
  print: 'decks.print',
} as const;

/**
 * The plugin's data as commands: what an agent reads and writes decks with.
 *
 * Not keystrokes — each takes an argument and answers with a value — but
 * commands all the same, in the same registry as the ones above, so the
 * plugin's `AgentTools` bundle names them and a host that mounts the plugin
 * has them without declaring any. Run on the page, against the catalog and
 * the store, which saves to the decks server when the plugin was given one.
 */
export const DECKS_DATA_COMMANDS = {
  listDecks: 'decks.listDecks',
  getDeck: 'decks.getDeck',
  createDeck: 'decks.createDeck',
  updateDeck: 'decks.updateDeck',
  updateSlide: 'decks.updateSlide',
  insertSlide: 'decks.insertSlide',
  deleteSlide: 'decks.deleteSlide',
  deleteDeck: 'decks.deleteDeck',
} as const;
