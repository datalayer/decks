/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * A deck as a video: the timeline its notes' audio makes, the captions file
 * written from it, and the captions cut to fit the frame.
 */

import { describe, expect, it } from 'vitest';
import { fitCaption, wrapCaption } from '../video/captions';
import {
  SENTENCE_GAP_S,
  SILENT_SLIDE_S,
  SLIDE_LEAD_S,
  SLIDE_TAIL_S,
  buildTimeline,
  followAt,
  formatClock,
  frameAt,
  videoFileStem,
} from '../video/timeline';
import { toVtt, vttTime } from '../video/vtt';

const close = (value: number, expected: number) => expect(value).toBeCloseTo(expected, 6);

describe('buildTimeline', () => {
  const script = [['One sentence here.', 'And a second one.'], [], ['Last slide said.']];
  const timeline = buildTimeline(script, [[2, 1.5], [], [3]]);

  it('says a slide’s sentences back to back, after a lead and before a tail', () => {
    const [first, second] = timeline.slides[0].cues;
    close(first.start, SLIDE_LEAD_S);
    close(first.end, SLIDE_LEAD_S + 2);
    close(second.start, SLIDE_LEAD_S + 2 + SENTENCE_GAP_S);
    close(second.end, SLIDE_LEAD_S + 2 + SENTENCE_GAP_S + 1.5);
    close(timeline.slides[0].end, second.end + SLIDE_TAIL_S);
  });

  it('keeps a slide without notes as long as Play does', () => {
    const silent = timeline.slides[1];
    expect(silent.cues).toEqual([]);
    close(silent.end - silent.start, SILENT_SLIDE_S);
    expect(SILENT_SLIDE_S).toBe(4);
  });

  it('chains the slides and adds up to the whole', () => {
    timeline.slides.slice(1).forEach((slide, index) => {
      close(slide.start, timeline.slides[index].end);
    });
    close(
      timeline.duration,
      SLIDE_LEAD_S + 2 + SENTENCE_GAP_S + 1.5 + SLIDE_TAIL_S +
        SILENT_SLIDE_S +
        SLIDE_LEAD_S + 3 + SLIDE_TAIL_S,
    );
    expect(timeline.cues.map(cue => [cue.slide, cue.sentence])).toEqual([
      [0, 0],
      [0, 1],
      [2, 0],
    ]);
  });

  it('refuses audio that does not match the script', () => {
    expect(() => buildTimeline(script, [[2, 1.5], []])).toThrow(/3 slides but 2/);
    expect(() => buildTimeline(script, [[2], [], [3]])).toThrow(/Slide 1 has 2 sentences but 1/);
    expect(() => buildTimeline([['A sentence.']], [[Number.NaN]])).toThrow(/no length/);
  });

  it('says what is on screen at a time', () => {
    expect(frameAt(timeline, 0)).toEqual({ slide: 0, cue: undefined });
    expect(frameAt(timeline, SLIDE_LEAD_S + 0.1).cue?.text).toBe('One sentence here.');
    // Between two sentences: the slide, no caption.
    expect(frameAt(timeline, SLIDE_LEAD_S + 2 + SENTENCE_GAP_S / 2).cue).toBeUndefined();
    expect(frameAt(timeline, timeline.slides[1].start + 1)).toEqual({ slide: 1, cue: undefined });
    expect(frameAt(timeline, timeline.duration + 10).slide).toBe(2);
    expect(frameAt(buildTimeline([], []), 3)).toEqual({ slide: 0 });
  });
});

describe('the captions file', () => {
  it('writes WebVTT times', () => {
    expect(vttTime(0)).toBe('00:00:00.000');
    expect(vttTime(61.2345)).toBe('00:01:01.235');
    expect(vttTime(3723.5)).toBe('01:02:03.500');
  });

  it('writes the cues of the timeline, numbered, with their slide', () => {
    const timeline = buildTimeline([['Fish & <chips> are good.'], ['Second   slide\nhere.']], [
      [1],
      [2],
    ]);
    const vtt = toVtt(timeline.cues, 'A deck');
    expect(vtt).toBe(
      'WEBVTT - A deck\n\n' +
        '1 · slide 1\n00:00:00.600 --> 00:00:01.600\nFish &amp; &lt;chips&gt; are good.\n\n' +
        `2 · slide 2\n${vttTime(timeline.cues[1].start)} --> ${vttTime(timeline.cues[1].end)}\n` +
        'Second slide here.\n',
    );
    expect(toVtt([])).toBe('WEBVTT\n');
  });
});

describe('captions on the frame', () => {
  // Every character as wide as the size: easy to reason about.
  const measure = (text: string, size: number) => text.length * size;

  it('wraps words into lines that fit', () => {
    expect(wrapCaption('aa bb cc dd', 50, 10, measure)).toEqual(['aa bb', 'cc dd']);
    expect(wrapCaption('  aa   bb  ', 50, 10, measure)).toEqual(['aa bb']);
    // A word wider than the line has a line of its own.
    expect(wrapCaption('a enormousword b', 50, 10, measure)).toEqual(['a', 'enormousword', 'b']);
    expect(wrapCaption('', 50, 10, measure)).toEqual([]);
  });

  it('takes the largest size that keeps to the lines allowed', () => {
    const text = 'one two three four five six';
    expect(fitCaption(text, 100, 2, [10, 5], measure)).toEqual({
      size: 5,
      lines: ['one two three four', 'five six'],
    });
    expect(fitCaption('short', 100, 2, [10, 5], measure)).toEqual({ size: 10, lines: ['short'] });
  });

  it('sets a sentence too long for every size at the smallest, in all its lines', () => {
    const layout = fitCaption('aaaa bbbb cccc dddd', 40, 1, [10, 8], measure);
    expect(layout.size).toBe(8);
    expect(layout.lines).toEqual(['aaaa', 'bbbb', 'cccc', 'dddd']);
    expect(() => fitCaption('x', 10, 1, [], measure)).toThrow();
  });
});

describe('names and clocks', () => {
  it('names the files after the deck', () => {
    expect(videoFileStem('Welcome to Datalayer!')).toBe('welcome-to-datalayer');
    expect(videoFileStem('Café — Q3 2026')).toBe('cafe-q3-2026');
    expect(videoFileStem('***')).toBe('deck');
  });

  it('reads durations as a reader does', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65.9)).toBe('1:05');
    expect(formatClock(3725)).toBe('1:02:05');
  });
});

describe('followAt: the deck on screen follows the recording', () => {
  // Slide 1: two sentences (2 s, 1.5 s); slide 2 silent; slide 3: one (3 s).
  const timeline = buildTimeline([['One.', 'Two.'], [], ['Three.']], [[2, 1.5], [], [3]]);
  const [first, second, third] = timeline.cues;

  it('shows the first slide and its first sentence before it is said', () => {
    expect(followAt(timeline, 0)).toEqual({ slide: 0, sentence: 0 });
  });

  it('shows the sentence being said, and keeps the last one said between sentences', () => {
    expect(followAt(timeline, first.start + 0.1)).toEqual({ slide: 0, sentence: 0 });
    expect(followAt(timeline, first.end + 0.01)).toEqual({ slide: 0, sentence: 0 });
    expect(followAt(timeline, second.start)).toEqual({ slide: 0, sentence: 1 });
    expect(followAt(timeline, second.end + SLIDE_TAIL_S / 2)).toEqual({ slide: 0, sentence: 1 });
  });

  it('moves to each slide when the timeline enters it, a silent one included', () => {
    expect(followAt(timeline, timeline.slides[1].start)).toEqual({ slide: 1, sentence: 0 });
    expect(followAt(timeline, timeline.slides[2].start)).toEqual({ slide: 2, sentence: 0 });
    expect(followAt(timeline, third.start + 1)).toEqual({ slide: 2, sentence: 0 });
  });

  it('stays on the last slide past the end', () => {
    expect(followAt(timeline, timeline.duration + 5)).toEqual({ slide: 2, sentence: 0 });
  });
});
