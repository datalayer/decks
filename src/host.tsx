/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * What a deck needs from the application around it.
 *
 * The engine used to reach into the landing application for three things: the
 * theme the page is wearing, a logo for the footer, and whether the reader is
 * signed in. All three are the host's business, and a package that imported
 * the host's stores could only ever be used by that host. So they arrive
 * through one context, with defaults that make a bare mount work:
 *
 * - **theme** defaults to the store of `@datalayer/primer-addons`, which is
 *   what every Datalayer shell already wears;
 * - **logo** defaults to none — the footer keeps the holder's name;
 * - **sign-in** defaults to "unknown", which a deck that requires it treats as
 *   not signed in, and shows the way in only if the host gave one.
 *
 * A host wraps its tree once and overrides what it knows better.
 *
 * @module host
 */

import type { ComponentType, JSX, ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { useThemeStore, type ColorMode, type ThemeVariant } from '@datalayer/primer-addons';

/** The theme a deck is drawn in: the application's, unless a deck asks. */
export type DecksTheme = {
  theme: ThemeVariant;
  colorMode: ColorMode;
};

/**
 * What the footer hands the host's logo: the theme in force and the colours
 * the template chose or the theme implies. The shape is the one Datalayer's
 * `SvgLinesLogo` takes, so a host passes that component through unchanged; a
 * host with another mark reads what it needs and ignores the rest.
 */
export type DeckLogoProps = {
  height?: number;
  variant: ThemeVariant;
  colorMode: ColorMode;
  inverse?: boolean;
  colored?: boolean;
  primaryColor?: string;
  secondaryColor?: string;
  textColor?: string;
};

/** What a narrator tells the deck while it reads a slide's notes. */
export type NarrationCallbacks = {
  /** The voice began the sentence at this index of those it was given. */
  onSentence: (index: number) => void;
  /** The voice said the last of them. */
  onEnd: () => void;
  /** It could not say them; `reason` is shown to the reader as it is. */
  onRefused: (reason: string) => void;
};

/**
 * The voice that plays a deck (the *Play* button): it reads each slide's
 * speaker notes aloud while the deck shows them as captions.
 *
 * The engine has no voice of its own; a host that has one gives it here, and
 * a host that gives none shows no *Play* button. A host whose voice cannot
 * speak for this reader — not signed in, say — still gives a narrator, with
 * `unavailable` saying why, and *Play* says that rather than playing.
 */
export type DeckNarrator = {
  /** Why playing cannot speak here, in a sentence the reader is shown. */
  unavailable?: string;
  /** With `unavailable`: signing in is the way out, so offer it. */
  needsSignIn?: boolean;
  /**
   * A slide's notes as the sentences to show and say — the host's own cutter,
   * so that the captions are exactly what its voice says. The engine's
   * `noteSentences` when absent.
   */
  sentences?: (notes: string | undefined) => string[];
  /** Called from the press on *Play*: a browser plays sound only after a gesture. */
  unlock?: () => void;
  /**
   * Say these sentences in order, replacing whatever was being said, and tell
   * the deck as each begins and when the last has ended.
   */
  speak: (sentences: string[], events: NarrationCallbacks) => void;
  /** Stop at once. No callback of the last `speak` may arrive afterwards. */
  stop: () => void;
  /**
   * The whole audio of one sentence, in a format the browser decodes
   * (`AudioContext.decodeAudioData`: Opus, MP3, WAV…), said by the same voice
   * as `speak`. Rejects with an `Error` whose message is shown to the reader
   * as it is. What *Video* records the deck with: absent, the deck has no
   * *Video* button. A narrator that is `unavailable` still gives it (one that
   * rejects), so *Video* is there to say why.
   */
  synthesize?: (sentence: string) => Promise<ArrayBuffer>;
};

export type DecksHost = {
  /**
   * The theme the page is wearing. A hook, because it changes while a deck
   * is on screen — and a deck that asked for its own theme changes it too, see
   * `deckThemeOverride`. The default reads primer-addons' own store.
   */
  useTheme: () => DecksTheme;
  /** The mark drawn in the footer when a spec asks for `logo: true`. */
  Logo?: ComponentType<DeckLogoProps>;
  /** Whether the reader is signed in. Undefined means the host cannot say. */
  useIsSignedIn?: () => boolean;
  /** Take the reader to sign in, and back to `returnTo` afterwards. */
  signIn?: (returnTo: string) => void;
  /** Navigate within the host's application. Defaults to a full page load. */
  navigate?: (to: string) => void;
  /**
   * The voice that plays a deck, read once per deck view. A hook, because the
   * narrator depends on who is reading (a token) and may change with them.
   * Keep it the same object between renders (memoise it): a new one restarts
   * the slide being read. Absent, the deck has no *Play* button, and no
   * *Video* button either (see `DeckNarrator.synthesize`).
   */
  useNarrator?: () => DeckNarrator | undefined;
};

const useDefaultTheme = (): DecksTheme => {
  const { theme, colorMode } = useThemeStore();
  return { theme, colorMode };
};

const DEFAULT_HOST: DecksHost = { useTheme: useDefaultTheme };

const DecksHostContext = createContext<DecksHost>(DEFAULT_HOST);

/** Give the decks under it a host. Absent, the defaults above apply. */
export const DecksHostProvider = ({
  host,
  children,
}: {
  host: Partial<DecksHost>;
  children: ReactNode;
}): JSX.Element => {
  const value: DecksHost = { ...DEFAULT_HOST, ...host };
  return <DecksHostContext.Provider value={value}>{children}</DecksHostContext.Provider>;
};

export const useDecksHost = (): DecksHost => useContext(DecksHostContext);

/** The theme to draw with, from whichever host is around. */
export const useDecksTheme = (): DecksTheme => {
  const { useTheme } = useDecksHost();
  return useTheme();
};

const useNoNarrator = (): DeckNarrator | undefined => undefined;

/** The host's narrator, or none. */
export const useDecksNarrator = (): DeckNarrator | undefined => {
  const { useNarrator } = useDecksHost();
  return (useNarrator ?? useNoNarrator)();
};

/** Where to go, through the host if it said, or by loading the page. */
export const useDecksNavigate = (): ((to: string) => void) => {
  const { navigate } = useDecksHost();
  return navigate ?? ((to: string) => window.location.assign(to));
};
