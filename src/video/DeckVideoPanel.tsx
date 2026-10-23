/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * What `DeckView` draws for *Video*: `useDeckVideo`, the state of making the
 * deck into a video (`record.ts`), and `DeckVideoPanel`, its progress with
 * *Sound on/off* and *Cancel* while it is made, then the video and its
 * captions to download. The narration is heard as it is recorded; *Sound
 * off* silences the speakers only, never the recording (`sound.ts`). While
 * it records, the deck on screen follows it as *Play* does — the slide being
 * recorded, its sentence as a caption (`following`) — and goes back to where
 * the reader was at the end.
 *
 * A host that keeps the video somewhere — the landing, with the deck in its
 * space for whoever may change it, and on a published deck's Library page
 * for its owner — passes a `DeckVideoPublisher` (to `DeckView`, or once for
 * every deck under it through `DecksHost.videoPublisher`): *Video* then reads
 * as the publisher's label, and the video is handed to it as soon as it is
 * made, with the spec it was made from, the files still offered for download.
 *
 * @module video/DeckVideoPanel
 */

import type { JSX, RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Flash, ProgressBar, Text } from '@primer/react';
import { DownloadIcon, MuteIcon, UnmuteIcon, XIcon } from '@primer/octicons-react';
import type { RevealApi } from 'reveal.js';
import type { DeckNarrator } from '../host';
import { noteSentences, scriptOf, type NarrationState } from '../narration';
import type { DeckSpec } from '../types';
import {
  makeDeckVideo,
  showWhole,
  VideoCancelled,
  type DeckVideo,
  type VideoProgress,
} from './record';
import { setHeard, speakersGain } from './sound';
import { formatClock, videoFileStem } from './timeline';

/** Where a host keeps the video once it is made. */
export type DeckVideoPublisher = {
  /** What *Video* reads instead, e.g. "Make the video". */
  label: string;
  /**
   * Keep the video, its captions and its poster. `spec` is the deck as it
   * was when the video was made — what a host compares with the deck it
   * holds to say whether the video is still the deck's. Rejects with an
   * `Error` whose message is shown to the reader as it is.
   */
  publish: (made: DeckVideo, spec: DeckSpec) => Promise<void>;
  /** Said once it is kept, e.g. "It now plays on the deck's Library page." */
  published: string;
};

/** Where handing the video to the publisher is. */
export type DeckVideoKept =
  | { status: 'keeping' }
  | { status: 'kept' }
  | { status: 'refused'; reason: string };

export type DeckVideoState =
  | { status: 'idle' }
  | { status: 'making'; progress: VideoProgress }
  | {
      status: 'done';
      videoUrl: string;
      videoName: string;
      captionsUrl: string;
      captionsName: string;
      duration: number;
      /** With a publisher: whether it has the video yet. */
      kept?: DeckVideoKept;
    }
  | { status: 'failed'; reason: string };

/** What the panel says when the video is done. */
export const doneText = (
  duration: number,
  kept: DeckVideoKept | undefined,
  publisher: DeckVideoPublisher | undefined,
): string => {
  const made = `The video is ready: ${formatClock(duration)}, with its captions.`;
  if (!kept || !publisher) {
    return made;
  }
  switch (kept.status) {
    case 'keeping':
      return `${made} Uploading it…`;
    case 'kept':
      return `${made} ${publisher.published}`;
    case 'refused':
      return `${made} It could not be uploaded: ${kept.reason}`;
  }
};

export type DeckVideoControl = {
  state: DeckVideoState;
  /** Make the video; called from the press on *Video*. */
  start: () => void;
  cancel: () => void;
  /** Whether the narration sounds through the speakers while it is recorded. */
  heard: boolean;
  /** *Sound on/off*: the speakers only, the recording keeps its sound. */
  setHeard: (heard: boolean) => void;
  /**
   * While recording, what the deck on screen shows, in *Play*'s terms: the
   * slide being recorded and its sentence, for `PlaybackCaptions`.
   */
  following?: NarrationState;
  /** Put the result or the failure away, and free the files. */
  dismiss: () => void;
  /** The host's publisher, when it keeps the video. */
  publisher?: DeckVideoPublisher;
  /** Hand the video made to the publisher again, after it refused it. */
  keep: () => void;
};

export const useDeckVideo = (
  spec: DeckSpec,
  narrator: DeckNarrator | undefined,
  api: RefObject<RevealApi | null>,
  publisher?: DeckVideoPublisher,
): DeckVideoControl => {
  const [state, setState] = useState<DeckVideoState>({ status: 'idle' });
  const running = useRef<AbortController | null>(null);
  const [heard, setHeardState] = useState(true);
  const heardNow = useRef(true);
  const speakers = useRef<GainNode | null>(null);
  const [script, setScript] = useState<string[][]>([]);
  const urls = useRef<string[]>([]);
  const made = useRef<DeckVideo | null>(null);
  // The deck as it was when the video was made: it may change meanwhile.
  const madeFrom = useRef<DeckSpec>(spec);
  const publishing = useRef(publisher);
  publishing.current = publisher;

  const free = useCallback(() => {
    urls.current.forEach(url => URL.revokeObjectURL(url));
    urls.current = [];
    made.current = null;
  }, []);

  const keep = useCallback(() => {
    const video = made.current;
    const keeper = publishing.current;
    if (!video || !keeper) {
      return;
    }
    const settle = (kept: DeckVideoKept) =>
      setState(current =>
        current.status === 'done' && made.current === video ? { ...current, kept } : current,
      );
    settle({ status: 'keeping' });
    keeper
      .publish(video, madeFrom.current)
      .then(() => settle({ status: 'kept' }))
      .catch((error: unknown) =>
        settle({
          status: 'refused',
          reason: error instanceof Error ? error.message : String(error),
        }),
      );
  }, []);

  const start = useCallback(() => {
    const synthesize = narrator?.synthesize;
    const deck = api.current;
    if (!synthesize || !deck || running.current) {
      return;
    }
    free();
    madeFrom.current = spec;
    // Where the reader was: the deck is put back there at the end.
    const was = deck.getIndices();
    const lines = scriptOf(spec.slides, narrator?.sentences ?? noteSentences);
    setScript(lines);
    let shown = -1;
    const controller = new AbortController();
    running.current = controller;
    // Made here, in the press: a browser starts sound only after a gesture.
    const audio = new AudioContext();
    // Resumed in the press too, or the speakers stay silent.
    void audio.resume();
    speakers.current = speakersGain(audio, heardNow.current);
    setState({ status: 'making', progress: { phase: 'slides', done: 0, total: spec.slides.length } });
    const title = spec.deck.title;
    void makeDeckVideo({
      deck,
      script: lines,
      synthesize,
      audio,
      speakers: speakers.current,
      title,
      signal: controller.signal,
      onProgress: progress => {
        if (controller.signal.aborted) {
          return;
        }
        // The deck on screen follows the recording, slide by slide; the
        // video itself is drawn from the pictures taken before.
        if (progress.phase === 'recording' && progress.slide !== shown) {
          shown = progress.slide;
          showWhole(deck, progress.slide);
        }
        setState({ status: 'making', progress });
      },
    })
      .then(video => {
        const stem = videoFileStem(title);
        const videoUrl = URL.createObjectURL(video.video);
        const captionsUrl = URL.createObjectURL(
          new Blob([video.vtt], { type: 'text/vtt;charset=utf-8' }),
        );
        urls.current = [videoUrl, captionsUrl];
        made.current = video;
        setState({
          status: 'done',
          videoUrl,
          videoName: `${stem}.${video.extension}`,
          captionsUrl,
          captionsName: `${stem}.vtt`,
          duration: video.timeline.duration,
        });
        keep();
      })
      .catch((error: unknown) => {
        setState(
          error instanceof VideoCancelled
            ? { status: 'idle' }
            : {
                status: 'failed',
                reason: error instanceof Error ? error.message : String(error),
              },
        );
      })
      .finally(() => {
        running.current = null;
        speakers.current = null;
        if (shown >= 0) {
          try {
            deck.slide(was.h, was.v, was.f);
          } catch {
            // The deck is gone with the page.
          }
        }
        void audio.close();
      });
  }, [api, free, keep, narrator, spec]);

  const cancel = useCallback(() => running.current?.abort(), []);
  const hear = useCallback((on: boolean) => {
    heardNow.current = on;
    setHeardState(on);
    if (speakers.current) {
      setHeard(speakers.current, on);
    }
  }, []);
  const dismiss = useCallback(() => {
    free();
    setState({ status: 'idle' });
  }, [free]);

  // Leaving the page cancels, and frees the files.
  useEffect(
    () => () => {
      running.current?.abort();
      free();
    },
    [free],
  );

  const following: NarrationState | undefined =
    state.status === 'making' && state.progress.phase === 'recording'
      ? {
          status: 'playing',
          script,
          slide: state.progress.slide,
          sentence: state.progress.sentence,
          run: 0,
        }
      : undefined;

  return { state, start, cancel, heard, setHeard: hear, following, dismiss, publisher, keep };
};

const progressText = (progress: VideoProgress): { text: string; percent: number } => {
  switch (progress.phase) {
    case 'slides':
      return {
        text: `Drawing slide ${Math.min(progress.done + 1, progress.total)} of ${progress.total}`,
        percent: (100 * progress.done) / Math.max(1, progress.total),
      };
    case 'voice':
      return {
        text: `Voicing sentence ${Math.min(progress.done + 1, progress.total)} of ${progress.total}`,
        percent: (100 * progress.done) / Math.max(1, progress.total),
      };
    case 'recording':
      return {
        text:
          `Recording slide ${progress.slide + 1} of ${progress.slides} · ` +
          `${formatClock(progress.time)} / ${formatClock(progress.duration)} — ` +
          'in real time; the tab may go to the background',
        percent: (100 * progress.time) / Math.max(1, progress.duration),
      };
    default:
      return { text: '', percent: 0 };
  }
};

/** Making the video, then the files: under the toolbar, never over the deck. */
export const DeckVideoPanel = ({ control }: { control: DeckVideoControl }): JSX.Element | null => {
  const { state, cancel, dismiss, heard, setHeard: hear, publisher, keep } = control;
  if (state.status === 'making') {
    const { text, percent } = progressText(state.progress);
    return (
      <Box
        data-deck-video="making"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          p: 3,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'border.default',
        }}
      >
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Text sx={{ fontSize: 1 }}>{text}</Text>
          <ProgressBar progress={percent} aria-label="Making the video" />
        </Box>
        <Button
          leadingVisual={heard ? UnmuteIcon : MuteIcon}
          aria-pressed={!heard}
          title={
            heard
              ? 'Silence the speakers; the video keeps its sound'
              : 'Hear the narration as it is recorded'
          }
          onClick={() => hear(!heard)}
        >
          {heard ? 'Sound on' : 'Sound off'}
        </Button>
        <Button leadingVisual={XIcon} onClick={cancel}>
          Cancel
        </Button>
      </Box>
    );
  }
  if (state.status === 'done') {
    const download = (url: string, name: string) => {
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
    };
    return (
      <Flash
        variant={state.kept?.status === 'refused' ? 'warning' : 'success'}
        data-deck-video="done"
        data-deck-video-kept={state.kept?.status}
        sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}
      >
        <Text sx={{ flex: 1 }}>{doneText(state.duration, state.kept, publisher)}</Text>
        {state.kept?.status === 'refused' && (
          <Button size="small" onClick={keep}>
            Upload again
          </Button>
        )}
        <Button
          size="small"
          leadingVisual={DownloadIcon}
          onClick={() => download(state.videoUrl, state.videoName)}
        >
          {state.videoName}
        </Button>
        <Button
          size="small"
          leadingVisual={DownloadIcon}
          onClick={() => download(state.captionsUrl, state.captionsName)}
        >
          {state.captionsName}
        </Button>
        <Button size="small" variant="invisible" onClick={dismiss}>
          Close
        </Button>
      </Flash>
    );
  }
  if (state.status === 'failed') {
    return (
      <Flash variant="danger" sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <Text sx={{ flex: 1 }}>The video could not be made: {state.reason}</Text>
        <Button size="small" variant="invisible" onClick={dismiss}>
          Close
        </Button>
      </Flash>
    );
  }
  return null;
};
