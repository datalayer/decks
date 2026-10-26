/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * A host that keeps the video is handed it with the deck it was made from —
 * the spec as it was when *Video* was pressed, not as it is when the video
 * is done — and a host gives its publisher once for every deck under it.
 */

import { act, createElement, type RefObject } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RevealApi } from 'reveal.js';
import type { DeckSpec } from '../types';

const made = {
  video: new Blob(['mp4'], { type: 'video/mp4' }),
  extension: 'mp4' as const,
  vtt: 'WEBVTT\n',
  poster: new Blob(['png'], { type: 'image/png' }),
  timeline: { duration: 3 },
};

vi.mock('../video/record', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  makeDeckVideo: vi.fn(async () => made),
  showWhole: vi.fn(),
}));
vi.mock('../video/sound', () => ({ speakersGain: vi.fn(() => ({})), setHeard: vi.fn() }));

import { DecksHostProvider, useDecksHost } from '../host';
import { useDeckVideo, type DeckVideoControl, type DeckVideoPublisher } from '../video/DeckVideoPanel';

const spec = (title: string): DeckSpec =>
  ({ deck: { title }, slides: [{ type: 'title', title, notes: 'Hello.' }] }) as unknown as DeckSpec;

const api = {
  current: { getIndices: () => ({ h: 0, v: 0, f: 0 }), slide: vi.fn() },
} as unknown as RefObject<RevealApi | null>;
const narrator = { speak: vi.fn(), stop: vi.fn(), synthesize: vi.fn(async () => new ArrayBuffer(8)) };

let host: HTMLDivElement;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as any).AudioContext = class {
    resume = async () => undefined;
    close = async () => undefined;
  };
  URL.createObjectURL = vi.fn(() => 'blob:made');
  URL.revokeObjectURL = vi.fn();
  host = document.createElement('div');
  document.body.appendChild(host);
});
afterEach(() => host.remove());

describe('keeping the video', () => {
  it('hands the publisher the video and the spec it was made from', async () => {
    const publish = vi.fn(async () => undefined);
    const publisher: DeckVideoPublisher = { label: 'Make the video', published: 'Kept.', publish };
    let control: DeckVideoControl | undefined;
    const Probe = ({ deck }: { deck: DeckSpec }) => {
      control = useDeckVideo(deck, narrator, api, publisher);
      return null;
    };
    const root = createRoot(host);
    const before = spec('Before');
    await act(async () => root.render(createElement(Probe, { deck: before })));
    await act(async () => {
      control!.start();
      // Edited while it records: the video is still of the deck before.
      root.render(createElement(Probe, { deck: spec('After') }));
    });
    await act(async () => undefined);

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(made, before);
    expect(control!.state).toMatchObject({ status: 'done', kept: { status: 'kept' } });
    act(() => root.unmount());
  });

  it('is given once by the host, for every deck under it', () => {
    const publisher: DeckVideoPublisher = { label: 'Make again', published: 'Kept.', publish: async () => undefined };
    let seen: DeckVideoPublisher | undefined;
    const Probe = () => {
      seen = useDecksHost().videoPublisher;
      return null;
    };
    const root = createRoot(host);
    act(() =>
      root.render(createElement(DecksHostProvider, { host: { videoPublisher: publisher }, children: createElement(Probe) })),
    );
    expect(seen).toBe(publisher);
    act(() => root.unmount());
  });
});
