/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * A video a host keeps: what the panel says while it is handed over, once it
 * is kept, and when it is refused.
 */

import { describe, expect, it } from 'vitest';
import { doneText, type DeckVideoPublisher } from '../video/DeckVideoPanel';

const publisher: DeckVideoPublisher = {
  label: 'Make the video',
  publish: async () => undefined,
  published: "It now plays on the deck's Library page.",
};

describe('doneText', () => {
  it('says the video is ready when no host keeps it', () => {
    expect(doneText(75, undefined, undefined)).toBe(
      'The video is ready: 1:15, with its captions.',
    );
  });

  it('says it is uploading while the host takes it', () => {
    expect(doneText(75, { status: 'keeping' }, publisher)).toBe(
      'The video is ready: 1:15, with its captions. Uploading it…',
    );
  });

  it("says the host's words once kept", () => {
    expect(doneText(75, { status: 'kept' }, publisher)).toBe(
      "The video is ready: 1:15, with its captions. It now plays on the deck's Library page.",
    );
  });

  it("gives the host's reason when refused", () => {
    expect(doneText(75, { status: 'refused', reason: 'The video is larger than 500 MB.' }, publisher)).toBe(
      'The video is ready: 1:15, with its captions. It could not be uploaded: The video is larger than 500 MB.',
    );
  });
});
