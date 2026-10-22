/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * A deck made into a video, in the reader's browser — nothing installed,
 * nothing uploaded:
 *
 * 1. each slide is drawn into a 1920×1080 picture (`html-to-image`), from the
 *    deck on screen moved to it, every fragment shown, its fonts, pictures
 *    and Mermaid diagrams waited for;
 * 2. each sentence of the notes is voiced by the host (`DeckNarrator.
 *    synthesize`) and decoded, which gives its length and so the timeline
 *    (`timeline.ts`);
 * 3. the timeline is played onto a canvas — the slide, and the sentence being
 *    said as a caption in *Play*'s look — while the sentences sound into the
 *    same stream, and `MediaRecorder` records both: MP4 where the browser
 *    records MP4, WebM otherwise. In real time; a timer in a worker keeps the
 *    frames coming while the tab is in the background, where the page's own
 *    timers and animation frames are held back. The sentences sound through
 *    the speakers too (`sound.ts`): the reader hears what is recorded, and
 *    *Sound off* silences the speakers only.
 *
 * The captions file (`vtt.ts`) is written from the same timeline.
 *
 * @module video/record
 */

import { getFontEmbedCSS, toCanvas } from 'html-to-image';
import type { RevealApi } from 'reveal.js';
import type { DeckNarrator } from '../host';
import { fitCaption } from './captions';
import { narrationBus } from './sound';
import { buildTimeline, followAt, frameAt, type VideoTimeline } from './timeline';
import { toVtt } from './vtt';

export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;
export const VIDEO_FPS = 30;

/** Asked of the host at once: under what its speech service lets one reader have. */
const VOICES_AT_ONCE = 2;

/** How long a slide's pictures and diagrams may take to be ready. */
const SLIDE_READY_MS = 15_000;

/** How long the sound may take to start once recording begins. */
const SOUND_START_MS = 3_000;

/**
 * In order of preference: MP4 first, which every player and video host
 * opens — H.264 with AAC where the browser encodes AAC (Chrome on macOS and
 * Windows), H.264 with Opus where it does not (Chrome on Linux, checked on
 * 152) — then WebM.
 */
const MIME_TYPES = [
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a',
  'video/mp4;codecs=avc1,opus',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
];

/** What the browser records, MP4 when it can; none means it records no video. */
export const videoMimeType = (): string | undefined =>
  typeof MediaRecorder === 'undefined'
    ? undefined
    : MIME_TYPES.find(type => MediaRecorder.isTypeSupported(type));

/** Where making the video is. */
export type VideoProgress =
  | { phase: 'slides'; done: number; total: number }
  | { phase: 'voice'; done: number; total: number }
  | {
      phase: 'recording';
      slide: number;
      /** The sentence being said on that slide, or the last one said (`followAt`). */
      sentence: number;
      slides: number;
      time: number;
      duration: number;
    };

export type DeckVideo = {
  video: Blob;
  /** `mp4` or `webm`, what the browser recorded. */
  extension: 'mp4' | 'webm';
  /** The captions, as a WebVTT file. */
  vtt: string;
  /**
   * The first slide as the video draws it, 1920×1080, without a caption: a
   * PNG for the video's poster and the picture its shared link shows.
   */
  poster: Blob;
  timeline: VideoTimeline;
};

/** A picture as a PNG file. */
export const pngOf = (picture: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) =>
    picture.toBlob(
      blob =>
        blob ? resolve(blob) : reject(new Error('The first slide could not be made a picture.')),
      'image/png',
    ),
  );

/** Thrown when the reader cancelled; nothing is said about it. */
export class VideoCancelled extends Error {
  constructor() {
    super('Making the video was cancelled.');
    this.name = 'VideoCancelled';
  }
}

const check = (signal: AbortSignal): void => {
  if (signal.aborted) {
    throw new VideoCancelled();
  }
};

/** A pause that a hidden tab still honours (late, but it ends). */
const pause = (ms: number): Promise<void> =>
  new Promise(resolve => window.setTimeout(resolve, ms));

// --- 1. The slides as pictures ---------------------------------------------

/** What is on the deck element but not part of a slide. */
const NOT_SLIDE = [
  'controls',
  'progress',
  'slide-number',
  'pause-overlay',
  'dla-deck-captions',
  'dla-deck-speaker-notes',
];

const onSlide = (node: HTMLElement): boolean =>
  !(node.classList && NOT_SLIDE.some(name => node.classList.contains(name)));

/** The slide's pictures loaded, its fonts in, its Mermaid diagrams drawn. */
const slideReady = async (section: HTMLElement, number: number): Promise<void> => {
  await document.fonts.ready;
  const deadline = Date.now() + SLIDE_READY_MS;
  for (;;) {
    const images = [...section.querySelectorAll('img')].every(image => image.complete);
    const diagrams = [...section.querySelectorAll('.dla-mermaid-svg')].every(
      diagram =>
        diagram.querySelector('svg') !== null ||
        diagram.classList.contains('dla-mermaid-svg--hidden'),
    );
    if (images && diagrams) {
      return;
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Slide ${number} did not finish drawing its ${images ? 'diagram' : 'pictures'} in ${
          SLIDE_READY_MS / 1000
        } seconds.`,
      );
    }
    await pause(100);
  }
};

const TRANSPARENT = /^(transparent|rgba\(.*,\s*0\))$/;

/**
 * The colour the reader sees behind the slides: the deck's own, else the
 * nearest ancestor's that paints one, else the page's white. A video has no
 * transparency, and a slide drawn on nothing would come out black.
 */
const paintBehind = (element: HTMLElement): string => {
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const painted = getComputedStyle(node).backgroundColor;
    if (painted && !TRANSPARENT.test(painted)) {
      return painted;
    }
  }
  return '#ffffff';
};

/** Move the deck to a slide at once, every fragment shown: as the video shows it. */
export const showWhole = (deck: RevealApi, index: number): HTMLElement => {
  deck.slide(index, 0);
  const section = deck.getCurrentSlide() as HTMLElement;
  const fragments = [...section.querySelectorAll('.fragment')]
    .map(fragment => Number(fragment.getAttribute('data-fragment-index')))
    .filter(Number.isFinite);
  if (fragments.length) {
    deck.slide(index, 0, Math.max(...fragments));
  }
  return section;
};

const CAPTURING = 'dla-deck--capturing';

/**
 * Nothing in motion while the slides are drawn: Reveal's slide, background
 * and fragment transitions are CSS, and a picture taken during one catches
 * the slide half-way in (seen: every slide drawn as the one before it, faded).
 */
const STILL_CSS =
  `.${CAPTURING}, .${CAPTURING} *, .${CAPTURING} *::before, .${CAPTURING} *::after ` +
  '{ transition: none !important; animation: none !important; }';

/**
 * Every slide of the deck on screen, as a 1920×1080 picture. The deck is
 * moved through them, with every transition off, and put back where it was.
 */
export const drawSlides = async (
  deck: RevealApi,
  count: number,
  signal: AbortSignal,
  onProgress: (progress: VideoProgress) => void,
): Promise<HTMLCanvasElement[]> => {
  const element = deck.getRevealElement();
  if (!element) {
    throw new Error('The deck is not on screen.');
  }
  const was = deck.getIndices();
  const still = document.createElement('style');
  still.textContent = STILL_CSS;
  document.head.appendChild(still);
  element.classList.add(CAPTURING);
  try {
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (!width || !height) {
      throw new Error('The deck has no size on screen.');
    }
    const backgroundColor = paintBehind(element);
    const fontEmbedCSS = await getFontEmbedCSS(element, { filter: onSlide });
    const pictures: HTMLCanvasElement[] = [];
    for (let index = 0; index < count; index++) {
      check(signal);
      onProgress({ phase: 'slides', done: index, total: count });
      const section = showWhole(deck, index);
      await slideReady(section, index + 1);
      // Two frames' worth for the layout to settle, by timer: a hidden tab
      // gives no animation frames.
      await pause(80);
      const drawn = await toCanvas(element, {
        filter: onSlide,
        fontEmbedCSS,
        backgroundColor,
        pixelRatio: VIDEO_WIDTH / width,
        width,
        height,
        skipAutoScale: true,
      });
      const picture = document.createElement('canvas');
      picture.width = VIDEO_WIDTH;
      picture.height = VIDEO_HEIGHT;
      const context = picture.getContext('2d');
      if (!context) {
        throw new Error('This browser gives no canvas to draw the slides on.');
      }
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
      context.drawImage(drawn, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
      pictures.push(picture);
    }
    onProgress({ phase: 'slides', done: count, total: count });
    return pictures;
  } finally {
    deck.slide(was.h, was.v, was.f);
    window.setTimeout(() => {
      element.classList.remove(CAPTURING);
      still.remove();
    }, 100);
  }
};

// --- 2. The sentences as sound ---------------------------------------------

/**
 * Every sentence of the script voiced by the host and decoded, slide by slide
 * in the script's shape. A refusal from the host is said as it is.
 */
export const voiceScript = async (
  script: string[][],
  synthesize: NonNullable<DeckNarrator['synthesize']>,
  audio: AudioContext,
  signal: AbortSignal,
  onProgress: (progress: VideoProgress) => void,
): Promise<AudioBuffer[][]> => {
  const jobs = script.flatMap((sentences, slide) =>
    sentences.map((text, sentence) => ({ slide, sentence, text })),
  );
  const voiced: AudioBuffer[][] = script.map(() => []);
  let next = 0;
  let done = 0;
  onProgress({ phase: 'voice', done, total: jobs.length });
  const work = async (): Promise<void> => {
    while (next < jobs.length) {
      check(signal);
      const job = jobs[next++];
      const sound = await synthesize(job.text);
      check(signal);
      try {
        voiced[job.slide][job.sentence] = await audio.decodeAudioData(sound.slice(0));
      } catch (error) {
        throw new Error(
          `The voice of slide ${job.slide + 1} could not be decoded: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      done += 1;
      onProgress({ phase: 'voice', done, total: jobs.length });
    }
  };
  await Promise.all(Array.from({ length: Math.min(VOICES_AT_ONCE, jobs.length) }, work));
  return voiced;
};

// --- 3. The video ----------------------------------------------------------

/** The caption box, in *Play*'s look, at 1920×1080. */
const CAPTION = {
  side: VIDEO_WIDTH * 0.06,
  bottom: VIDEO_HEIGHT * 0.05,
  padX: 44,
  padY: 24,
  radius: 15,
  lineHeight: 1.45,
  maxLines: 3,
  sizes: [44, 40, 36, 32, 28],
  background: 'rgba(15, 18, 24, 0.82)',
  color: '#f6f8fa',
  weight: 600,
};

/** Draw the slide, and the sentence being said over its bottom. */
const drawFrame = (
  context: CanvasRenderingContext2D,
  picture: HTMLCanvasElement,
  text: string | undefined,
  font: string,
): void => {
  context.drawImage(picture, 0, 0);
  if (!text) {
    return;
  }
  const width = VIDEO_WIDTH - 2 * CAPTION.side;
  const fontAt = (size: number) => `${CAPTION.weight} ${size}px ${font}`;
  const { size, lines } = fitCaption(
    text,
    width - 2 * CAPTION.padX,
    CAPTION.maxLines,
    CAPTION.sizes,
    (line, at) => {
      context.font = fontAt(at);
      return context.measureText(line).width;
    },
  );
  const step = size * CAPTION.lineHeight;
  const height = lines.length * step + 2 * CAPTION.padY;
  const top = VIDEO_HEIGHT - CAPTION.bottom - height;
  context.fillStyle = CAPTION.background;
  context.beginPath();
  context.roundRect(CAPTION.side, top, width, height, CAPTION.radius);
  context.fill();
  context.font = fontAt(size);
  context.fillStyle = CAPTION.color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  lines.forEach((line, index) => {
    context.fillText(line, VIDEO_WIDTH / 2, top + CAPTION.padY + step * (index + 0.5));
  });
};

/**
 * A timer that keeps its pace in a background tab: a worker's, whose
 * intervals a browser does not stretch the way it stretches the page's.
 */
const workerTicker = (ms: number, onTick: () => void, onError: (reason: string) => void) => {
  const url = URL.createObjectURL(
    new Blob([`setInterval(() => postMessage(0), ${ms});`], { type: 'text/javascript' }),
  );
  const worker = new Worker(url);
  worker.onmessage = onTick;
  worker.onerror = () => onError('The page would not start the timer that paces the video.');
  return () => {
    worker.terminate();
    URL.revokeObjectURL(url);
  };
};

/** Play the timeline onto a canvas and the sound into one stream, and record it. */
const recordTimeline = async ({
  pictures,
  timeline,
  voiced,
  audio,
  font,
  mimeType,
  speakers,
  signal,
  onProgress,
}: {
  pictures: HTMLCanvasElement[];
  timeline: VideoTimeline;
  voiced: AudioBuffer[][];
  audio: AudioContext;
  font: string;
  mimeType: string;
  speakers?: AudioNode;
  signal: AbortSignal;
  onProgress: (progress: VideoProgress) => void;
}): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  canvas.width = VIDEO_WIDTH;
  canvas.height = VIDEO_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('This browser gives no canvas to draw the video on.');
  }
  // Frames on demand: one per tick, whether or not the tab is shown.
  const track = canvas.captureStream(0).getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const sound = audio.createMediaStreamDestination();
  // Recorded, and heard through the speakers' gain (*Sound on/off*).
  const bus = narrationBus(audio, sound, speakers);
  const recorder = new MediaRecorder(
    new MediaStream([track, ...sound.stream.getAudioTracks()]),
    { mimeType, videoBitsPerSecond: 6_000_000, audioBitsPerSecond: 128_000 },
  );
  const chunks: Blob[] = [];
  recorder.ondataavailable = event => {
    if (event.data.size) {
      chunks.push(event.data);
    }
  };
  const stopped = new Promise<void>(resolve => {
    recorder.onstop = () => resolve();
  });

  // Drawn on every tick, changed or not: a canvas left untouched gives the
  // stream no frame, and a video with a frame only when the slide changes
  // seeks badly.
  const draw = (time: number) => {
    const frame = frameAt(timeline, time);
    drawFrame(context, pictures[frame.slide], frame.cue?.text, font);
    track.requestFrame();
    return frame;
  };

  await audio.resume();
  draw(0);
  recorder.start(1000);
  // The video's 0 is now: the captions file's times are the video's. A first
  // sentence comes `SLIDE_LEAD_S` in at the earliest, ample to schedule it.
  const start = audio.currentTime;
  const sources = timeline.cues.map(cue => {
    const source = audio.createBufferSource();
    source.buffer = voiced[cue.slide][cue.sentence];
    source.connect(bus);
    source.start(start + cue.start);
    return source;
  });

  let stopTicker: (() => void) | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      const began = Date.now();
      const clockAt = audio.currentTime;
      stopTicker = workerTicker(
        1000 / VIDEO_FPS,
        () => {
          if (signal.aborted) {
            reject(new VideoCancelled());
            return;
          }
          if (audio.currentTime === clockAt && Date.now() - began > SOUND_START_MS) {
            reject(new Error('The browser would not start the sound. Press Video again.'));
            return;
          }
          const time = Math.max(0, audio.currentTime - start);
          const frame = draw(time);
          onProgress({
            phase: 'recording',
            slide: frame.slide,
            sentence: followAt(timeline, time).sentence,
            slides: timeline.slides.length,
            time: Math.min(time, timeline.duration),
            duration: timeline.duration,
          });
          if (time >= timeline.duration) {
            resolve();
          }
        },
        reason => reject(new Error(reason)),
      );
    });
  } finally {
    stopTicker?.();
    sources.forEach(source => {
      try {
        source.stop();
      } catch {
        // Never started, or already ended.
      }
      source.disconnect();
    });
    bus.disconnect();
    recorder.stop();
    await stopped;
    track.stop();
  }
  return new Blob(chunks, { type: recorder.mimeType || mimeType });
};

export type MakeDeckVideo = {
  deck: RevealApi;
  /** Each slide's sentences, as *Play* would show and say them. */
  script: string[][];
  synthesize: NonNullable<DeckNarrator['synthesize']>;
  /** Made from the reader's press on *Video*: a browser plays sound only after a gesture. */
  audio: AudioContext;
  /**
   * Where the reader hears the narration (`speakersGain`), its gain being
   * *Sound on/off*; none, and it is only recorded.
   */
  speakers?: AudioNode;
  title: string;
  signal: AbortSignal;
  onProgress: (progress: VideoProgress) => void;
};

/** The deck, voiced and captioned, as a video and its captions file. */
export const makeDeckVideo = async ({
  deck,
  script,
  synthesize,
  audio,
  speakers,
  title,
  signal,
  onProgress,
}: MakeDeckVideo): Promise<DeckVideo> => {
  const mimeType = videoMimeType();
  if (!mimeType) {
    throw new Error('This browser cannot record a video (MediaRecorder records neither MP4 nor WebM).');
  }
  const element = deck.getRevealElement();
  const font =
    (element && getComputedStyle(element).getPropertyValue('--dla-deck-font').trim()) ||
    'system-ui, sans-serif';
  const pictures = await drawSlides(deck, script.length, signal, onProgress);
  const poster = await pngOf(pictures[0]);
  const voiced = await voiceScript(script, synthesize, audio, signal, onProgress);
  check(signal);
  const timeline = buildTimeline(
    script,
    voiced.map(sounds => sounds.map(sound => sound.duration)),
  );
  const video = await recordTimeline({
    pictures,
    timeline,
    voiced,
    audio,
    font,
    mimeType,
    speakers,
    signal,
    onProgress,
  });
  return {
    video,
    extension: mimeType.startsWith('video/mp4') ? 'mp4' : 'webm',
    vtt: toVtt(timeline.cues, title),
    poster,
    timeline,
  };
};
