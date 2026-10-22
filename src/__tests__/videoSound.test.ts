/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * Where a video's narration goes: always into the recording, and to the
 * speakers through a gain that *Sound on/off* turns — which never reaches the
 * recording.
 */

import { describe, expect, it } from 'vitest';
import { narrationBus, setHeard, speakersGain, type SoundContext } from '../video/sound';

type FakeNode = {
  name: string;
  gain: { value: number };
  outputs: FakeNode[];
  connect: (to: FakeNode) => void;
};

const node = (name: string): FakeNode => {
  const made: FakeNode = {
    name,
    gain: { value: 1 },
    outputs: [],
    connect: to => {
      made.outputs.push(to);
    },
  };
  return made;
};

const fakeContext = () => {
  const destination = node('speakers-out');
  let gains = 0;
  const audio = {
    destination,
    createGain: () => node(`gain-${++gains}`),
  } as unknown as SoundContext;
  return { audio, destination };
};

/** The gain from `from` to `to` along the first path, or undefined if none. */
const gainTo = (from: FakeNode, to: FakeNode): number | undefined => {
  if (from === to) {
    return 1;
  }
  for (const next of from.outputs) {
    const rest = gainTo(next, to);
    if (rest !== undefined) {
      return (next.name.startsWith('gain') ? next.gain.value : 1) * rest;
    }
  }
  return undefined;
};

describe('the narration while a video is made', () => {
  it('is recorded and heard, sound on', () => {
    const { audio, destination } = fakeContext();
    const recording = node('recording');
    const speakers = speakersGain(audio, true) as unknown as FakeNode;
    const bus = narrationBus(
      audio,
      recording as unknown as AudioNode,
      speakers as unknown as AudioNode,
    ) as unknown as FakeNode;
    expect(gainTo(bus, recording)).toBe(1);
    expect(gainTo(bus, destination)).toBe(1);
  });

  it('is still recorded whole when the speakers are silenced, and heard again after', () => {
    const { audio, destination } = fakeContext();
    const recording = node('recording');
    const speakers = speakersGain(audio, true);
    const bus = narrationBus(
      audio,
      recording as unknown as AudioNode,
      speakers,
    ) as unknown as FakeNode;
    setHeard(speakers, false);
    expect(gainTo(bus, destination)).toBe(0);
    expect(gainTo(bus, recording)).toBe(1);
    // The recording is fed straight from the bus, not through the speakers' gain.
    expect(bus.outputs).toContain(recording);
    setHeard(speakers, true);
    expect(gainTo(bus, destination)).toBe(1);
  });

  it('starts silenced when Sound off was chosen before Video', () => {
    const { audio, destination } = fakeContext();
    const speakers = speakersGain(audio, false) as unknown as FakeNode;
    expect(speakers.gain.value).toBe(0);
    expect(speakers.outputs).toEqual([destination]);
  });

  it('is only recorded without speakers', () => {
    const { audio } = fakeContext();
    const recording = node('recording');
    const bus = narrationBus(
      audio,
      recording as unknown as AudioNode,
      undefined,
    ) as unknown as FakeNode;
    expect(bus.outputs).toEqual([recording]);
  });
});
