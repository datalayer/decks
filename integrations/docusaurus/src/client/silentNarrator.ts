/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * A narrator with no voice, for *Play* in a documentation site.
 *
 * The deck engine plays a deck through its host's narrator: each slide's
 * speaker notes, sentence by sentence, as captions, the deck moving on when
 * the last is said. Datalayer's own voice is a feature of the Datalayer
 * platform, not of a public site, so here nothing is said aloud: each
 * sentence stays on screen for the time it takes to read it, then the next.
 * With no `synthesize`, the deck offers no *Video* either.
 */

import type { DeckNarrator, NarrationCallbacks } from '@datalayer/decks';

/** How long a reader is given per word: about 200 words a minute. */
const MS_PER_WORD = 300;
/** Added to every sentence, so a short one is still seen. */
const MS_PER_SENTENCE = 800;
/** The shortest and longest a sentence stays on screen. */
const MIN_MS = 2000;
const MAX_MS = 12000;

/** How long `sentence` stays on screen. */
export const readingMs = (sentence: string): number => {
  const words = sentence.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(MAX_MS, Math.max(MIN_MS, words * MS_PER_WORD + MS_PER_SENTENCE));
};

type Timers = {
  set: (run: () => void, ms: number) => unknown;
  clear: (timer: unknown) => void;
};

const WINDOW_TIMERS: Timers = {
  set: (run, ms) => window.setTimeout(run, ms),
  clear: timer => window.clearTimeout(timer as number),
};

/**
 * One deck's narrator: each deck needs its own, since stopping one must
 * never cut short another deck playing on the same page.
 */
export const createSilentNarrator = (timers: Timers = WINDOW_TIMERS): DeckNarrator => {
  let pending: unknown[] = [];
  const stop = () => {
    pending.forEach(timer => timers.clear(timer));
    pending = [];
  };
  return {
    speak: (sentences: string[], events: NarrationCallbacks) => {
      stop();
      let at = 0;
      sentences.forEach((sentence, index) => {
        pending.push(timers.set(() => events.onSentence(index), at));
        at += readingMs(sentence);
      });
      pending.push(timers.set(() => events.onEnd(), at));
    },
    stop,
  };
};
