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

/** Where to go, through the host if it said, or by loading the page. */
export const useDecksNavigate = (): ((to: string) => void) => {
  const { navigate } = useDecksHost();
  return navigate ?? ((to: string) => window.location.assign(to));
};
