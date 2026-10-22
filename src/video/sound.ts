/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * Where the narration goes while a video is made: into the recording, always,
 * and to the speakers, so that the reader hears what is recorded. *Sound off*
 * silences the speakers only — the recording keeps every sentence.
 *
 * @module video/sound
 */

/** What these use of an `AudioContext`: gains and the speakers. */
export type SoundContext = Pick<BaseAudioContext, 'createGain' | 'destination'>;

/**
 * The speakers' gain: 1 heard, 0 silenced. Made when *Video* is pressed, so
 * that *Sound on/off* has something to turn before the recording starts.
 */
export const speakersGain = (audio: SoundContext, heard: boolean): GainNode => {
  const speakers = audio.createGain();
  speakers.gain.value = heard ? 1 : 0;
  speakers.connect(audio.destination);
  return speakers;
};

/** Heard or silenced, at once. */
export const setHeard = (speakers: GainNode, heard: boolean): void => {
  speakers.gain.value = heard ? 1 : 0;
};

/**
 * The node every sentence is played into: it feeds the recording directly
 * and the speakers through their gain, so that silencing the one never
 * touches the other.
 */
export const narrationBus = (
  audio: SoundContext,
  recording: AudioNode,
  speakers: AudioNode | undefined,
): GainNode => {
  const bus = audio.createGain();
  bus.connect(recording);
  if (speakers) {
    bus.connect(speakers);
  }
  return bus;
};
