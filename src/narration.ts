/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * Playing a deck: its speaker notes read aloud, slide after slide.
 *
 * The rules only — no React, no Reveal, no sound — so that they can be read
 * and tested on their own. `DeckView` holds the state, moves the deck, and
 * hands each slide's sentences to the host's narrator (`DecksHost.narrator`).
 *
 * - A slide's notes are cut into sentences: those are the captions shown at
 *   the bottom of the slide, one highlighted at a time, and what the voice
 *   says, in the same order.
 * - When the voice has said a slide's last sentence, the deck moves on.
 * - A slide without notes is shown for `SILENT_SLIDE_MS`, then the deck moves
 *   on — the captions say so.
 * - Playing stops after the last slide, on Stop, and when the narrator
 *   refuses (its reason is kept and shown).
 *
 * @module narration
 */

/** How long a slide without notes stays on screen while playing. */
export const SILENT_SLIDE_MS = 4000;

/** How long the voice waits on a new slide, for the transition to finish. */
export const SLIDE_SETTLE_MS = 700;

/** Below this many characters, a sentence is said with the one after it. */
const SHORTEST = 12;

/** Where a sentence ends: its stop, then a space or the end of the notes. */
const END = /[.!?…](?=["'»”’)\]]*(\s|$))/g;

/**
 * A slide's notes, as the sentences to show and say.
 *
 * Whitespace is folded, Markdown emphasis dropped, and a sentence is cut at
 * its stop followed by a space. A very short sentence (*Yes.*) is kept with
 * the next one, so a caption is never a single word flashing past.
 */
export const noteSentences = (notes: string | undefined): string[] => {
  const words = (notes ?? '')
    .replace(/[*_`]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!words) {
    return [];
  }
  const sentences: string[] = [];
  let start = 0;
  END.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = END.exec(words)) !== null) {
    const stop = match.index + match[0].length;
    const sentence = words.slice(start, stop).trim();
    if (sentence.length >= SHORTEST) {
      sentences.push(sentence);
      start = stop;
    }
  }
  const rest = words.slice(start).trim();
  if (rest) {
    sentences.push(rest);
  }
  return sentences;
};

/** What playing is doing. */
export type NarrationStatus = 'idle' | 'playing' | 'paused' | 'ended' | 'refused';

export type NarrationState = {
  status: NarrationStatus;
  /** Each slide's sentences, from the notes, in the deck's order. */
  script: string[][];
  /** The slide being played, 0-based. */
  slide: number;
  /** The sentence being said on that slide, 0-based. */
  sentence: number;
  /**
   * Bumped whenever the voice must (re)start: a new slide, a resume. What
   * plays the slide watches it, so that resuming the same slide restarts it.
   */
  run: number;
  /** Why the narrator could not speak, when `status` is `refused`. */
  reason?: string;
};

export type NarrationEvent =
  /** Play from this slide, with the deck's sentences. */
  | { type: 'play'; slide: number; script: string[][] }
  /** The voice began this sentence of the current slide. */
  | { type: 'sentence'; index: number }
  /** The voice finished the slide, or a slide without notes was shown long enough. */
  | { type: 'slideDone' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' }
  /** The narrator could not speak; the reason is said to the reader. */
  | { type: 'refused'; reason: string }
  /** The reader moved the deck while it played: play from there. */
  | { type: 'moved'; slide: number };

export const IDLE: NarrationState = {
  status: 'idle',
  script: [],
  slide: 0,
  sentence: 0,
  run: 0,
};

const active = (state: NarrationState): boolean =>
  state.status === 'playing' || state.status === 'paused';

/** The next state of playing, given what happened. */
export const narrate = (state: NarrationState, event: NarrationEvent): NarrationState => {
  switch (event.type) {
    case 'play': {
      const last = event.script.length - 1;
      if (last < 0) {
        return { ...IDLE, status: 'ended', run: state.run + 1 };
      }
      return {
        status: 'playing',
        script: event.script,
        slide: Math.min(Math.max(0, event.slide), last),
        sentence: 0,
        run: state.run + 1,
      };
    }
    case 'sentence':
      if (state.status !== 'playing') {
        return state;
      }
      return {
        ...state,
        sentence: Math.min(
          Math.max(0, event.index),
          Math.max(0, (state.script[state.slide]?.length ?? 1) - 1),
        ),
      };
    case 'slideDone':
      if (state.status !== 'playing') {
        return state;
      }
      if (state.slide + 1 >= state.script.length) {
        return { ...state, status: 'ended', sentence: 0 };
      }
      return { ...state, slide: state.slide + 1, sentence: 0, run: state.run + 1 };
    case 'pause':
      return state.status === 'playing' ? { ...state, status: 'paused' } : state;
    case 'resume':
      // From the sentence it was on: the voice cannot pick up mid-sentence.
      return state.status === 'paused'
        ? { ...state, status: 'playing', run: state.run + 1 }
        : state;
    case 'stop':
      return active(state) ? { ...state, status: 'idle', reason: undefined } : state;
    case 'refused':
      return active(state) ? { ...state, status: 'refused', reason: event.reason } : state;
    case 'moved':
      if (!active(state) || event.slide === state.slide) {
        return state;
      }
      if (event.slide < 0 || event.slide >= state.script.length) {
        return state;
      }
      return { ...state, slide: event.slide, sentence: 0, run: state.run + 1 };
    default:
      return state;
  }
};

/** The sentences still to say on the current slide, from where it is. */
export const sentencesToSay = (state: NarrationState): string[] =>
  (state.script[state.slide] ?? []).slice(state.sentence);

/**
 * The captions to show: the sentence said, with the one before and the one
 * after it for context, dimmed. Empty when the slide has no notes.
 */
export const captionWindow = (
  state: NarrationState,
): Array<{ text: string; index: number; current: boolean }> => {
  const sentences = state.script[state.slide] ?? [];
  const from = Math.max(0, state.sentence - 1);
  return sentences
    .slice(from, state.sentence + 2)
    .map((text, offset) => ({
      text,
      index: from + offset,
      current: from + offset === state.sentence,
    }));
};

/** The deck's sentences, slide by slide: what `play` is given. */
export const scriptOf = (
  slides: ReadonlyArray<{ notes?: string }>,
  cut: (notes: string | undefined) => string[] = noteSentences,
): string[][] => slides.map(slide => cut(slide.notes));
