/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The captions of a deck's video as a WebVTT file: the sentences and timings
 * the video itself shows (`timeline.ts`), for a player, a host such as a
 * video platform, or a reader who wants the words.
 *
 * @module video/vtt
 */

import type { VideoCue } from './timeline';

/** `hh:mm:ss.mmm`, as WebVTT writes a time. */
export const vttTime = (seconds: number): string => {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const rest = ms % 1000;
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(h)}:${two(m)}:${two(s)}.${String(rest).padStart(3, '0')}`;
};

/** A cue's text as WebVTT reads it: `&`, `<` and `>` escaped, on one line. */
const vttText = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * The WebVTT file of these cues. Each cue is numbered and carries the slide
 * it belongs to in its identifier (`3 · slide 2`), so a reader of the file
 * can find the slide.
 */
export const toVtt = (cues: ReadonlyArray<VideoCue>, title?: string): string => {
  const header = title ? `WEBVTT - ${vttText(title)}` : 'WEBVTT';
  const blocks = cues.map(
    (cue, index) =>
      `${index + 1} · slide ${cue.slide + 1}\n` +
      `${vttTime(cue.start)} --> ${vttTime(cue.end)}\n` +
      vttText(cue.text),
  );
  return [header, ...blocks].join('\n\n') + '\n';
};
