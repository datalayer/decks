/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * One slide as a picture (`renderSlideImage`): the slide asked, every
 * fragment shown, at the size asked, and the deck put back where it was.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RevealApi } from 'reveal.js';

const toCanvas = vi.fn();
vi.mock('html-to-image', () => ({
  getFontEmbedCSS: vi.fn(async () => ''),
  toCanvas: (...args: unknown[]) => toCanvas(...args),
}));

import { renderSlideImage } from '../video/record';

const drawn: { args: unknown[] }[] = [];

/** A deck of `count` slides, the second with two fragments. */
const fakeDeck = (count: number) => {
  const element = document.createElement('div');
  Object.defineProperty(element, 'clientWidth', { value: 1280 });
  Object.defineProperty(element, 'clientHeight', { value: 720 });
  document.body.appendChild(element);
  const sections = Array.from({ length: count }, (_, index) => {
    const section = document.createElement('section');
    if (index === 1) {
      section.innerHTML =
        '<p class="fragment" data-fragment-index="0"></p><p class="fragment" data-fragment-index="1"></p>';
    }
    element.appendChild(section);
    return section;
  });
  let at = { h: 0, v: 0, f: -1 as number | undefined };
  const moves: [number, number, number | undefined][] = [];
  const deck = {
    getRevealElement: () => element,
    getIndices: () => ({ ...at }),
    getTotalSlides: () => count,
    getCurrentSlide: () => sections[at.h],
    slide: (h: number, v = 0, f?: number) => {
      moves.push([h, v, f]);
      at = { h, v, f };
    },
  };
  return { deck: deck as unknown as RevealApi, moves, element };
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  drawn.length = 0;
  toCanvas.mockImplementation(async (...args: unknown[]) => {
    drawn.push({ args });
    return document.createElement('canvas');
  });
  // jsdom draws nothing; a context that records is enough.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () =>
      ({
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        fillStyle: '',
      }) as unknown as CanvasRenderingContext2D,
  );
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { ready: Promise.resolve() },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('renderSlideImage', () => {
  it('draws the slide asked, every fragment shown, at the size asked', async () => {
    const { deck, moves } = fakeDeck(3);
    const picture = await renderSlideImage(deck, 1, { width: 1200, height: 675 });
    expect(picture.width).toBe(1200);
    expect(picture.height).toBe(675);
    // To the slide, then to its last fragment, then back to where it was.
    expect(moves).toEqual([
      [1, 0, undefined],
      [1, 0, 1],
      [0, 0, -1],
    ]);
    expect(drawn).toHaveLength(1);
    expect((drawn[0].args[1] as { pixelRatio: number }).pixelRatio).toBeCloseTo(1200 / 1280);
  });

  it('is 1920×1080 unless asked otherwise', async () => {
    const { deck } = fakeDeck(1);
    const picture = await renderSlideImage(deck, 0);
    expect([picture.width, picture.height]).toEqual([1920, 1080]);
  });

  it('refuses a slide the deck does not have', async () => {
    const { deck, moves } = fakeDeck(2);
    await expect(renderSlideImage(deck, 2)).rejects.toThrow('The deck has no slide 3: it has 2.');
    await expect(renderSlideImage(deck, -1)).rejects.toThrow(/no slide/);
    expect(moves).toEqual([]);
  });

  it('holds the deck still while drawing, and lets go after', async () => {
    const { deck, element } = fakeDeck(1);
    let duringDraw = false;
    toCanvas.mockImplementation(async () => {
      duringDraw = element.classList.contains('dla-deck--capturing');
      return document.createElement('canvas');
    });
    await renderSlideImage(deck, 0);
    expect(duringDraw).toBe(true);
    await vi.advanceTimersByTimeAsync(150);
    expect(element.classList.contains('dla-deck--capturing')).toBe(false);
  });
});
