/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * A deck as a video: when each slide is on screen and when each sentence of
 * its notes is said — the rules only, no browser, so that they can be read
 * and tested on their own. `record.ts` measures the sentences' audio, asks
 * for the timeline, and records it; the captions file is written from the
 * same timeline (`vtt.ts`), so what the video says and what the file says
 * cannot drift apart.
 *
 * - A slide's sentences are said back to back, `SENTENCE_GAP_S` apart, after
 *   `SLIDE_LEAD_S` of the slide alone and followed by `SLIDE_TAIL_S`.
 * - A slide without notes stays `SILENT_SLIDE_MS`, as *Play* keeps it.
 *
 * @module video/timeline
 */

import { SILENT_SLIDE_MS } from '../narration';

/** The slide alone, before its first sentence: the eye lands first. */
export const SLIDE_LEAD_S = 0.6;

/** Between two sentences of a slide. */
export const SENTENCE_GAP_S = 0.35;

/** After a slide's last sentence, before the next slide. */
export const SLIDE_TAIL_S = 0.9;

/** A slide without notes, as long as *Play* shows it. */
export const SILENT_SLIDE_S = SILENT_SLIDE_MS / 1000;

/** One sentence on screen and heard, in seconds from the start. */
export type VideoCue = {
  /** 0-based slide. */
  slide: number;
  /** 0-based sentence of that slide. */
  sentence: number;
  text: string;
  start: number;
  end: number;
};

/** One slide on screen, in seconds from the start. */
export type VideoSlide = {
  slide: number;
  start: number;
  end: number;
  cues: VideoCue[];
};

export type VideoTimeline = {
  slides: VideoSlide[];
  /** Every cue, in order: what the captions file holds. */
  cues: VideoCue[];
  /** The whole video, in seconds. */
  duration: number;
};

/**
 * The timeline of a deck, from each slide's sentences and how long each
 * sentence's audio lasts (seconds), slide by slide and in the same shape.
 * A shape that does not match is a bug in the caller, and throws.
 */
export const buildTimeline = (
  script: ReadonlyArray<ReadonlyArray<string>>,
  durations: ReadonlyArray<ReadonlyArray<number>>,
): VideoTimeline => {
  if (script.length !== durations.length) {
    throw new Error(
      `The deck has ${script.length} slides but ${durations.length} were voiced.`,
    );
  }
  const slides: VideoSlide[] = [];
  const cues: VideoCue[] = [];
  let at = 0;
  script.forEach((sentences, slide) => {
    const lengths = durations[slide];
    if (lengths.length !== sentences.length) {
      throw new Error(
        `Slide ${slide + 1} has ${sentences.length} sentences but ${lengths.length} were voiced.`,
      );
    }
    const start = at;
    if (!sentences.length) {
      at += SILENT_SLIDE_S;
      slides.push({ slide, start, end: at, cues: [] });
      return;
    }
    at += SLIDE_LEAD_S;
    const own: VideoCue[] = sentences.map((text, sentence) => {
      const length = lengths[sentence];
      if (!Number.isFinite(length) || length < 0) {
        throw new Error(`Slide ${slide + 1}, sentence ${sentence + 1} has no length.`);
      }
      if (sentence > 0) {
        at += SENTENCE_GAP_S;
      }
      const cue = { slide, sentence, text, start: at, end: at + length };
      at += length;
      return cue;
    });
    at += SLIDE_TAIL_S;
    slides.push({ slide, start, end: at, cues: own });
    cues.push(...own);
  });
  return { slides, cues, duration: at };
};

/**
 * What is on screen at `time`: the slide, and the sentence being said if one
 * is. Before the start, the first slide; after the end, the last.
 */
export const frameAt = (
  timeline: VideoTimeline,
  time: number,
): { slide: number; cue?: VideoCue } => {
  const { slides } = timeline;
  if (!slides.length) {
    return { slide: 0 };
  }
  const current =
    slides.find(slide => time < slide.end) ?? slides[slides.length - 1];
  const cue = current.cues.find(one => time >= one.start && time < one.end);
  return { slide: current.slide, cue };
};

/** `m:ss`, or `h:mm:ss` past an hour: a duration as the reader reads it. */
export const formatClock = (seconds: number): string => {
  const whole = Math.max(0, Math.floor(seconds));
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = String(whole % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

/** The files' name, from the deck's title: `My deck!` → `my-deck`. */
export const videoFileStem = (title: string): string =>
  title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'deck';
