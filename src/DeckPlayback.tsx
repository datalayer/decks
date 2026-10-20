/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * What `DeckView` draws for speaker notes and for playing a deck:
 *
 * - `useDeckPlayback` — the narration state (`narration.ts`), the deck moved
 *   to the slide being played, the host's narrator given its sentences, a
 *   slide without notes shown for `SILENT_SLIDE_MS`, and the keyboard
 *   (space pauses and resumes, Escape stops) while it plays;
 * - `PlaybackCaptions` — the notes as captions at the bottom of the slide,
 *   the sentence being said highlighted;
 * - `SpeakerNotes` — the current slide's notes for the presenter, under the
 *   deck or, presenting, over its bottom edge.
 *
 * Captions and presenting notes are drawn *inside* the deck element (a
 * portal), because that is the element Present puts in fullscreen.
 *
 * @module DeckPlayback
 */

import type { CSSProperties, JSX, RefObject } from 'react';
import { useCallback, useEffect, useReducer } from 'react';
import { createPortal } from 'react-dom';
import type { RevealApi } from 'reveal.js';
import type { DeckNarrator } from './host';
import {
  IDLE,
  SILENT_SLIDE_MS,
  SLIDE_SETTLE_MS,
  captionWindow,
  narrate,
  noteSentences,
  scriptOf,
  sentencesToSay,
  type NarrationState,
} from './narration';
import type { DeckSpec } from './types';

export type DeckPlayback = {
  state: NarrationState;
  /** Play from this slide (0-based). */
  play: (slide: number) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  /** The reader moved the deck (0-based): playing follows. */
  moved: (slide: number) => void;
};

export const useDeckPlayback = (
  spec: DeckSpec,
  narrator: DeckNarrator | undefined,
  api: RefObject<RevealApi | null>,
): DeckPlayback => {
  const [state, dispatch] = useReducer(narrate, IDLE);

  // A slide being played: the deck on it, then its sentences said — or, with
  // none, the slide shown for a while. Restarted on every `run`.
  useEffect(() => {
    if (state.status !== 'playing' || !narrator) {
      return undefined;
    }
    const deck = api.current;
    const moving = !!deck && deck.getIndices().h !== state.slide;
    if (moving) {
      deck.slide(state.slide);
    }
    const sentences = sentencesToSay(state);
    const offset = state.sentence;
    if (!sentences.length) {
      const timer = window.setTimeout(() => dispatch({ type: 'slideDone' }), SILENT_SLIDE_MS);
      return () => window.clearTimeout(timer);
    }
    let speaking = false;
    const speak = () => {
      speaking = true;
      narrator.speak(sentences, {
        onSentence: index => dispatch({ type: 'sentence', index: offset + index }),
        onEnd: () => dispatch({ type: 'slideDone' }),
        onRefused: reason => dispatch({ type: 'refused', reason }),
      });
    };
    // On a new slide, the voice waits for the transition; otherwise at once.
    const timer = moving ? window.setTimeout(speak, SLIDE_SETTLE_MS) : undefined;
    if (!moving) {
      speak();
    }
    return () => {
      window.clearTimeout(timer);
      if (speaking) {
        narrator.stop();
      }
    };
    // `run` is what restarts it; the rest of `state` is read as of that run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.run, state.status, narrator]);

  // Leaving the page stops the voice.
  useEffect(() => () => narrator?.stop(), [narrator]);

  const play = useCallback(
    (slide: number) => {
      narrator?.unlock?.();
      dispatch({
        type: 'play',
        slide,
        script: scriptOf(spec.slides, narrator?.sentences ?? noteSentences),
      });
    },
    [narrator, spec.slides],
  );
  const pause = useCallback(() => dispatch({ type: 'pause' }), []);
  const resume = useCallback(() => {
    narrator?.unlock?.();
    dispatch({ type: 'resume' });
  }, [narrator]);
  const stop = useCallback(() => dispatch({ type: 'stop' }), []);
  const moved = useCallback((slide: number) => dispatch({ type: 'moved', slide }), []);

  // Space pauses and resumes, Escape stops — taken before Reveal, whose
  // space would otherwise move the deck under the voice.
  const active = state.status === 'playing' || state.status === 'paused';
  const paused = state.status === 'paused';
  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) {
        return;
      }
      if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        event.stopPropagation();
        if (paused) {
          resume();
        } else {
          pause();
        }
      } else if (event.key === 'Escape') {
        stop();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [active, paused, pause, resume, stop]);

  return { state, play, pause, resume, stop, moved };
};

const overlay: CSSProperties = {
  position: 'absolute',
  left: '6%',
  right: '6%',
  bottom: '5%',
  zIndex: 40,
  padding: '0.6em 1em',
  borderRadius: 10,
  background: 'rgba(15, 18, 24, 0.82)',
  color: '#f6f8fa',
  fontFamily: 'var(--dla-deck-font, inherit)',
  fontSize: 'clamp(13px, 1.5vw, 30px)',
  lineHeight: 1.45,
  textAlign: 'center',
  pointerEvents: 'none',
};

/** The notes, being read, as captions over the bottom of the slide. */
export const PlaybackCaptions = ({
  state,
  target,
}: {
  state: NarrationState;
  target: HTMLElement | null;
}): JSX.Element | null => {
  if (!target || (state.status !== 'playing' && state.status !== 'paused')) {
    return null;
  }
  const lines = captionWindow(state);
  const body = lines.length ? (
    lines.map(line => (
      <span
        key={line.index}
        data-caption={line.current ? 'current' : 'context'}
        style={{
          opacity: line.current ? 1 : 0.45,
          fontWeight: line.current ? 600 : 400,
        }}
      >
        {line.text}{' '}
      </span>
    ))
  ) : (
    <span data-caption="silent" style={{ opacity: 0.8, fontStyle: 'italic' }}>
      No notes on this slide — the next one follows in {Math.round(SILENT_SLIDE_MS / 1000)}{' '}
      seconds.
    </span>
  );
  return createPortal(
    <div className="dla-deck-captions" role="status" aria-live="polite" style={overlay}>
      {body}
      {state.status === 'paused' && (
        <div style={{ fontSize: '0.7em', opacity: 0.8, marginTop: '0.3em' }}>
          Paused · space resumes · Escape stops
        </div>
      )}
    </div>,
    target,
  );
};

/**
 * The current slide's speaker notes, for whoever presents.
 *
 * Under the deck when reading; over its bottom edge when presenting, since
 * fullscreen shows only the deck. Never in the print view, which draws none
 * of this.
 */
export const SpeakerNotes = ({
  notes,
  presenting,
  target,
}: {
  notes: string | undefined;
  presenting: boolean;
  target: HTMLElement | null;
}): JSX.Element | null => {
  const text = notes?.trim();
  const content = text ? (
    <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>
  ) : (
    <span style={{ fontStyle: 'italic', opacity: 0.75 }}>No speaker notes on this slide.</span>
  );
  if (presenting) {
    return target
      ? createPortal(
          <div
            className="dla-deck-speaker-notes"
            data-speaker-notes=""
            style={{
              ...overlay,
              textAlign: 'left',
              fontSize: 'clamp(13px, 1.1vw, 22px)',
              maxHeight: '30%',
              overflowY: 'auto',
              pointerEvents: 'auto',
            }}
          >
            {content}
          </div>,
          target,
        )
      : null;
  }
  return (
    <div
      className="dla-deck-speaker-notes"
      data-speaker-notes=""
      style={{
        padding: '12px 16px',
        borderRadius: 6,
        border: '1px solid var(--borderColor-default, #d0d7de)',
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      <strong style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Speaker notes</strong>
      {content}
    </div>
  );
};
