/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSilentNarrator, readingMs } from '../client/silentNarrator';

const timers = {
  set: (run: () => void, ms: number) => setTimeout(run, ms),
  clear: (timer: unknown) => clearTimeout(timer as ReturnType<typeof setTimeout>),
};

describe('the silent narrator', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('gives a sentence the time it takes to read, within bounds', () => {
    expect(readingMs('Hi.')).toBe(2000);
    expect(readingMs('one two three four five six seven eight nine ten')).toBe(3800);
    expect(readingMs('word '.repeat(100))).toBe(12000);
  });

  it('shows each sentence in turn, then ends the slide, saying nothing aloud', () => {
    const narrator = createSilentNarrator(timers);
    const seen: string[] = [];
    narrator.speak(['First one.', 'one two three four five six seven eight nine ten'], {
      onSentence: index => seen.push(`sentence ${index}`),
      onEnd: () => seen.push('end'),
      onRefused: reason => seen.push(`refused ${reason}`),
    });
    vi.advanceTimersByTime(0);
    expect(seen).toEqual(['sentence 0']);
    vi.advanceTimersByTime(readingMs('First one.'));
    expect(seen).toEqual(['sentence 0', 'sentence 1']);
    vi.advanceTimersByTime(3800);
    expect(seen).toEqual(['sentence 0', 'sentence 1', 'end']);
    expect(narrator.synthesize).toBeUndefined();
    expect(narrator.unavailable).toBeUndefined();
  });

  it('stops at once: nothing arrives after stop, and a new slide replaces the old', () => {
    const narrator = createSilentNarrator(timers);
    const seen: string[] = [];
    const events = (slide: string) => ({
      onSentence: (index: number) => seen.push(`${slide} ${index}`),
      onEnd: () => seen.push(`${slide} end`),
      onRefused: () => undefined,
    });
    narrator.speak(['A.', 'B.'], events('one'));
    vi.advanceTimersByTime(0);
    narrator.stop();
    vi.advanceTimersByTime(60_000);
    expect(seen).toEqual(['one 0']);
    narrator.speak(['A.'], events('one'));
    narrator.speak(['C.'], events('two'));
    vi.advanceTimersByTime(60_000);
    expect(seen).toEqual(['one 0', 'two 0', 'two end']);
  });
});
