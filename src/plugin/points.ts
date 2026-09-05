/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The contribution points the decks plugin opens and the one it joins.
 *
 * @module plugin/points
 */

import { defineContributionPoint } from '@datalayer/reactor';
import type { DeckEntry } from '../registry/catalog';

/**
 * Where other plugins hand in decks.
 *
 * A plugin that ships a deck contributes an entry here; the view folds it into
 * the catalog while the contribution stands, so switching that plugin off
 * takes its decks off the list. A host can also call `registerDecks` directly.
 */
export const DeckCatalog = defineContributionPoint<DeckEntry>('datalayer.decks.catalog');

/**
 * The reactor shell's view point, by id.
 *
 * `@datalayer/reactor-shell` declares it as `reactor.shell.view`; points are
 * keyed by id, so this plugin can contribute a "Decks" view to whichever shell
 * is mounted without depending on the shell package. A host with no shell
 * simply has nobody reading the point.
 */
export const ShellView = defineContributionPoint<{
  id: string;
  title: string;
  order?: number;
}>('reactor.shell.view');
