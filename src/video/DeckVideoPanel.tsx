/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * What `DeckView` draws for *Video*: `useDeckVideo`, the state of making the
 * deck into a video (`record.ts`), and `DeckVideoPanel`, its progress with
 * *Cancel* while it is made, then the video and its captions to download.
 *
 * @module video/DeckVideoPanel
 */

import type { JSX, RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Flash, ProgressBar, Text } from '@primer/react';
import { DownloadIcon, XIcon } from '@primer/octicons-react';
import type { RevealApi } from 'reveal.js';
import type { DeckNarrator } from '../host';
import { noteSentences, scriptOf } from '../narration';
import type { DeckSpec } from '../types';
import { makeDeckVideo, VideoCancelled, type VideoProgress } from './record';
import { formatClock, videoFileStem } from './timeline';

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
    }
  | { status: 'failed'; reason: string };

export type DeckVideoControl = {
  state: DeckVideoState;
  /** Make the video; called from the press on *Video*. */
  start: () => void;
  cancel: () => void;
  /** Put the result or the failure away, and free the files. */
  dismiss: () => void;
};

export const useDeckVideo = (
  spec: DeckSpec,
  narrator: DeckNarrator | undefined,
  api: RefObject<RevealApi | null>,
): DeckVideoControl => {
  const [state, setState] = useState<DeckVideoState>({ status: 'idle' });
  const running = useRef<AbortController | null>(null);
  const urls = useRef<string[]>([]);

  const free = useCallback(() => {
    urls.current.forEach(url => URL.revokeObjectURL(url));
    urls.current = [];
  }, []);

  const start = useCallback(() => {
    const synthesize = narrator?.synthesize;
    const deck = api.current;
    if (!synthesize || !deck || running.current) {
      return;
    }
    free();
    const controller = new AbortController();
    running.current = controller;
    // Made here, in the press: a browser starts sound only after a gesture.
    const audio = new AudioContext();
    setState({ status: 'making', progress: { phase: 'slides', done: 0, total: spec.slides.length } });
    const title = spec.deck.title;
    void makeDeckVideo({
      deck,
      script: scriptOf(spec.slides, narrator?.sentences ?? noteSentences),
      synthesize,
      audio,
      title,
      signal: controller.signal,
      onProgress: progress => {
        if (!controller.signal.aborted) {
          setState({ status: 'making', progress });
        }
      },
    })
      .then(made => {
        const stem = videoFileStem(title);
        const videoUrl = URL.createObjectURL(made.video);
        const captionsUrl = URL.createObjectURL(
          new Blob([made.vtt], { type: 'text/vtt;charset=utf-8' }),
        );
        urls.current = [videoUrl, captionsUrl];
        setState({
          status: 'done',
          videoUrl,
          videoName: `${stem}.${made.extension}`,
          captionsUrl,
          captionsName: `${stem}.vtt`,
          duration: made.timeline.duration,
        });
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
        void audio.close();
      });
  }, [api, free, narrator, spec]);

  const cancel = useCallback(() => running.current?.abort(), []);
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

  return { state, start, cancel, dismiss };
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
  const { state, cancel, dismiss } = control;
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
        variant="success"
        data-deck-video="done"
        sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}
      >
        <Text sx={{ flex: 1 }}>
          The video is ready: {formatClock(state.duration)}, with its captions.
        </Text>
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
