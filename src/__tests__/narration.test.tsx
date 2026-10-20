/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * Speaker notes and playing a deck: notes on every slide type, shown to the
 * presenter and never printed, and the rules by which Play reads them aloud
 * and moves the deck on.
 */

import { act, createElement, type RefObject } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RevealApi } from 'reveal.js';
import { SpeakerNotes, useDeckPlayback, type DeckPlayback } from '../DeckPlayback';
import type { DeckNarrator, NarrationCallbacks } from '../host';
import {
  IDLE,
  SILENT_SLIDE_MS,
  SLIDE_SETTLE_MS,
  captionWindow,
  narrate,
  noteSentences,
  scriptOf,
  sentencesToSay,
} from '../narration';
import { SLIDE_TYPES } from '../slides';
import type { DeckSpec, SlideSpec } from '../types';
import { validateDeck } from '../validation';

// Every slide type takes `notes`: a type missing it fails to compile here.
type NotesOn<T extends SlideSpec['type']> =
  Extract<SlideSpec, { type: T }> extends { notes?: string } ? true : false;
const EVERY_TYPE_HAS_NOTES: { [T in SlideSpec['type']]: NotesOn<T> } = {
  title: true,
  section: true,
  statement: true,
  bullets: true,
  columns: true,
  'two-columns': true,
  'three-columns': true,
  metrics: true,
  artifact: true,
  image: true,
  screenshot: true,
  quote: true,
  comparison: true,
  timeline: true,
  flow: true,
  'feature-showcase': true,
  chart: true,
  logos: true,
  code: true,
  mermaid: true,
  component: true,
  closing: true,
};

describe('speaker notes', () => {
  it('are part of every slide type', () => {
    expect(Object.keys(EVERY_TYPE_HAS_NOTES).sort()).toEqual([...SLIDE_TYPES].sort());
  });

  it('must be text', () => {
    const spec = {
      deck: { title: 'Notes', template: 'datalayer' },
      slides: [
        { type: 'section', title: 'Fine', notes: 'Say this.' },
        { type: 'section', title: 'Not fine', notes: ['a', 'list'] },
      ],
    } as unknown as DeckSpec;
    expect(validateDeck(spec)).toEqual([
      { where: 'slides[1]', message: 'A slide’s `notes` are text (a string).' },
    ]);
  });

  it('reach the presenter, under the deck', () => {
    const markup = renderToStaticMarkup(
      <SpeakerNotes notes="Pause here for questions." presenting={false} target={null} />,
    );
    expect(markup).toContain('Speaker notes');
    expect(markup).toContain('Pause here for questions.');
  });

  it('reach the presenter in fullscreen, inside the deck element', async () => {
    const deck = document.createElement('div');
    const host = document.createElement('div');
    document.body.append(deck, host);
    const root = createRoot(host);
    await act(async () => {
      root.render(<SpeakerNotes notes="Only the speaker reads this." presenting target={deck} />);
    });
    expect(deck.querySelector('[data-speaker-notes]')?.textContent).toBe(
      'Only the speaker reads this.',
    );
    await act(async () => root.unmount());
  });

  it('say so when a slide has none', () => {
    const markup = renderToStaticMarkup(
      <SpeakerNotes notes={undefined} presenting={false} target={null} />,
    );
    expect(markup).toContain('No speaker notes on this slide.');
  });
});

describe('noteSentences', () => {
  it('cuts notes into the sentences to show and say', () => {
    expect(
      noteSentences(`Datalayer runs agents.   It runs them **where the data is**!
        Ask me why? Version 3.5 shipped.`),
    ).toEqual([
      'Datalayer runs agents.',
      'It runs them where the data is!',
      'Ask me why? Version 3.5 shipped.',
    ]);
  });

  it('keeps a very short sentence with the next', () => {
    expect(noteSentences('Yes. We do run on your cloud.')).toEqual([
      'Yes. We do run on your cloud.',
    ]);
  });

  it('gives nothing for no notes', () => {
    expect(noteSentences(undefined)).toEqual([]);
    expect(noteSentences('   ')).toEqual([]);
  });
});

describe('narrate', () => {
  const script = [['One first.', 'One second.'], [], ['Three only.']];

  it('plays slide after slide and stops at the end', () => {
    let state = narrate(IDLE, { type: 'play', slide: 0, script });
    expect(state).toMatchObject({ status: 'playing', slide: 0, sentence: 0 });
    state = narrate(state, { type: 'sentence', index: 1 });
    expect(sentencesToSay(state)).toEqual(['One second.']);
    state = narrate(state, { type: 'slideDone' });
    expect(state).toMatchObject({ slide: 1, sentence: 0 });
    state = narrate(state, { type: 'slideDone' });
    state = narrate(state, { type: 'slideDone' });
    expect(state.status).toBe('ended');
    expect(narrate(state, { type: 'slideDone' })).toBe(state);
  });

  it('pauses, resumes from the sentence it was on, and stops', () => {
    let state = narrate(IDLE, { type: 'play', slide: 0, script });
    state = narrate(state, { type: 'sentence', index: 1 });
    const run = state.run;
    state = narrate(state, { type: 'pause' });
    expect(state.status).toBe('paused');
    // A late callback from the voice that was stopped changes nothing.
    expect(narrate(state, { type: 'slideDone' })).toBe(state);
    state = narrate(state, { type: 'resume' });
    expect(state).toMatchObject({ status: 'playing', sentence: 1 });
    expect(state.run).toBeGreaterThan(run);
    state = narrate(state, { type: 'stop' });
    expect(state.status).toBe('idle');
  });

  it('follows the reader who moves the deck, and keeps the narrator’s refusal', () => {
    let state = narrate(IDLE, { type: 'play', slide: 0, script });
    state = narrate(state, { type: 'moved', slide: 2 });
    expect(state).toMatchObject({ slide: 2, sentence: 0 });
    expect(narrate(state, { type: 'moved', slide: 2 })).toBe(state);
    state = narrate(state, { type: 'refused', reason: 'Sign in first.' });
    expect(state).toMatchObject({ status: 'refused', reason: 'Sign in first.' });
  });

  it('starts at the slide on screen, clamped to the deck', () => {
    expect(narrate(IDLE, { type: 'play', slide: 9, script }).slide).toBe(2);
    expect(narrate(IDLE, { type: 'play', slide: 0, script: [] }).status).toBe('ended');
  });

  it('shows the sentence said, with its neighbours for context', () => {
    let state = narrate(IDLE, { type: 'play', slide: 0, script });
    expect(captionWindow(state)).toEqual([
      { text: 'One first.', index: 0, current: true },
      { text: 'One second.', index: 1, current: false },
    ]);
    state = narrate(state, { type: 'sentence', index: 1 });
    expect(captionWindow(state).find(line => line.current)?.text).toBe('One second.');
  });

  it('reads the deck’s notes with the host’s cutter when it has one', () => {
    expect(scriptOf([{ notes: 'A b c. D e f.' }, {}], notes => (notes ? [notes] : []))).toEqual([
      ['A b c. D e f.'],
      [],
    ]);
  });
});

describe('useDeckPlayback', () => {
  type Spoken = { sentences: string[]; events: NarrationCallbacks };
  let spoken: Spoken[];
  let stops: number;
  let narrator: DeckNarrator;
  let indices: number;
  let api: RefObject<RevealApi | null>;
  let playback: DeckPlayback;

  const spec: DeckSpec = {
    deck: { title: 'Played', template: 'datalayer' },
    slides: [
      { type: 'title', title: 'One', notes: 'First sentence here. Second sentence here.' },
      { type: 'section', title: 'Two' },
      { type: 'section', title: 'Three', notes: 'The last thing said.' },
    ],
  };

  const Probe = () => {
    playback = useDeckPlayback(spec, narrator, api);
    return null;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    spoken = [];
    stops = 0;
    indices = 0;
    narrator = {
      speak: (sentences, events) => spoken.push({ sentences, events }),
      stop: () => {
        stops += 1;
      },
    };
    api = {
      current: {
        getIndices: () => ({ h: indices, v: 0 }),
        slide: (h: number) => {
          indices = h;
        },
      } as unknown as RevealApi,
    };
  });
  afterEach(() => vi.useRealTimers());

  it('says each slide’s notes, waits on a silent slide, and stops after the last', async () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    await act(async () => root.render(createElement(Probe)));

    await act(async () => playback.play(0));
    expect(spoken).toHaveLength(1);
    expect(spoken[0].sentences).toEqual(['First sentence here.', 'Second sentence here.']);

    await act(async () => spoken[0].events.onSentence(1));
    expect(playback.state.sentence).toBe(1);

    // Said: the deck moves to the silent slide, which waits, then moves on.
    await act(async () => spoken[0].events.onEnd());
    expect(indices).toBe(1);
    expect(spoken).toHaveLength(1);
    await act(async () => vi.advanceTimersByTime(SILENT_SLIDE_MS));
    expect(indices).toBe(2);
    await act(async () => vi.advanceTimersByTime(SLIDE_SETTLE_MS));
    expect(spoken[1].sentences).toEqual(['The last thing said.']);

    await act(async () => spoken[1].events.onEnd());
    expect(playback.state.status).toBe('ended');
    await act(async () => root.unmount());
  });

  it('stops the voice on pause and on Escape, and space resumes', async () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    await act(async () => root.render(createElement(Probe)));
    await act(async () => playback.play(0));

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    });
    expect(playback.state.status).toBe('paused');
    expect(stops).toBeGreaterThan(0);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    });
    expect(playback.state.status).toBe('playing');
    expect(spoken).toHaveLength(2);

    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(playback.state.status).toBe('idle');
    await act(async () => root.unmount());
  });
});
