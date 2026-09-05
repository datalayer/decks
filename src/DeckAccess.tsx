/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * Who gets to see a deck.
 *
 * Two gates, both declared by the spec and both applied here so that every
 * way into a deck passes the same one — the reading view and the print view
 * alike, since a print address that skipped the check would hand out the deck
 * as a PDF instead.
 *
 * Neither gate is a lock, and it is worth being plain about that rather than
 * letting the padlock imply otherwise: a deck is JavaScript sent to the
 * browser, so its slides and its password are both readable by anyone who
 * opens the network tab. What these do is keep a forwarded link from opening
 * by itself, which is the actual risk for a deck that is merely not public
 * yet. A deck that must not be read by the wrong person needs a server that
 * declines to send it.
 *
 * Whether the reader is signed in, and how to sign in, come from the host —
 * see {@link module:host}. A host that cannot say leaves a deck that requires
 * it closed, with the reason and no button.
 *
 * @module DeckAccess
 */

import type { JSX } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Heading, Text, TextInput } from '@primer/react';
import { KeyIcon, LockIcon, SignInIcon } from '@primer/octicons-react';
import { useDecksHost } from './host';
import type { DeckAccessSpec } from './types';

/** The query parameter that carries a password, so a link can arrive ready. */
export const DECK_PASSWORD_PARAM = 'deckPassword';

/** How long a remembered password lasts. Long enough to outlive the meeting. */
const REMEMBER_DAYS = 180;

/**
 * The cookie a deck remembers its reader in.
 *
 * Named per deck: unlocking one is not unlocking the others, and a reader who
 * was given one link should not find a second deck open because of it.
 */
const cookieName = (deckId: string): string =>
  `dla-deck-${deckId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

const readCookie = (name: string): string | null => {
  if (typeof document === 'undefined') {
    return null;
  }
  const prefix = `${name}=`;
  const found = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : null;
};

const writeCookie = (name: string, value: string): void => {
  if (typeof document === 'undefined') {
    return;
  }
  const maxAge = REMEMBER_DAYS * 24 * 60 * 60;
  // `Lax` rather than `None`: the cookie only ever needs to be there when the
  // reader opens the deck themselves, and `Secure` would drop it on the
  // http://localhost the deck is developed against.
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
};

/**
 * Whether two secrets match.
 *
 * Trimmed and case-folded, because the password reaches people in an email and
 * comes back with a capital letter the mail client added or a space the copy
 * took with it. A deck password is a doorbell, and being strict about the case
 * of it only ever turns away the right person.
 */
const matches = (given: string | null | undefined, wanted: string): boolean =>
  (given ?? '').trim().toLowerCase() === wanted.trim().toLowerCase();

/**
 * The password on the address, and a way to take it back off.
 *
 * Read from `window.location` rather than a router: the engine does not know
 * which router a host uses, and a deck's password is not routing state. The
 * parameter is removed with `history.replaceState`, so it is not left in the
 * history or in the next link the reader copies.
 */
const passwordFromAddress = (): string | null =>
  typeof window === 'undefined'
    ? null
    : new URLSearchParams(window.location.search).get(DECK_PASSWORD_PARAM);

const stripPasswordFromAddress = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  const url = new URL(window.location.href);
  if (!url.searchParams.has(DECK_PASSWORD_PARAM)) {
    return;
  }
  url.searchParams.delete(DECK_PASSWORD_PARAM);
  window.history.replaceState(window.history.state, '', url.toString());
};

type DeckAccessProps = {
  /** Stable identity of the deck, for the cookie: its address is one. */
  deckId: string;
  title: string;
  access?: DeckAccessSpec;
  children: React.ReactNode;
};

/** A panel in the middle of the page, for the two things that are not the deck. */
const Gate = ({
  icon,
  heading,
  children,
}: {
  icon: React.ReactNode;
  heading: string;
  children: React.ReactNode;
}): JSX.Element => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 3,
      maxWidth: 460,
      mx: 'auto',
      px: 4,
      py: [6, 7],
      textAlign: 'center',
    }}
  >
    <Box
      sx={{
        width: 56,
        height: 56,
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        bg: 'accent.subtle',
        color: 'accent.fg',
      }}
    >
      {icon}
    </Box>
    <Heading as="h1" sx={{ fontSize: 3 }}>
      {heading}
    </Heading>
    {children}
  </Box>
);

const useSignedIn = (): boolean => {
  const { useIsSignedIn } = useDecksHost();
  // The hook the host gave, or a constant: both are hooks as far as React can
  // tell, and the host's choice does not change for the life of the tree.
  return useIsSignedIn ? useIsSignedIn() : false;
};

export const DeckAccess = ({ deckId, title, access, children }: DeckAccessProps): JSX.Element => {
  const { signIn } = useDecksHost();
  const signedIn = useSignedIn();
  const password = access?.password;
  const name = useMemo(() => cookieName(deckId), [deckId]);
  const [fromUrl] = useState<string | null>(passwordFromAddress);
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    if (!password) {
      return true;
    }
    return matches(fromUrl, password) || matches(readCookie(name), password);
  });
  const [typed, setTyped] = useState('');
  const [refused, setRefused] = useState(false);

  useEffect(() => {
    if (!password || !fromUrl) {
      return;
    }
    if (matches(fromUrl, password)) {
      writeCookie(name, password);
      setUnlocked(true);
    }
    stripPasswordFromAddress();
  }, [password, fromUrl, name]);

  const submit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (password && matches(typed, password)) {
        writeCookie(name, password);
        setUnlocked(true);
        setRefused(false);
        return;
      }
      setRefused(true);
    },
    [password, typed, name],
  );

  if (access?.authenticated && !signedIn) {
    const returnTo =
      typeof window === 'undefined' ? '/' : window.location.pathname + window.location.search;
    return (
      <Gate icon={<LockIcon size={24} />} heading="Sign in to see this deck">
        <Text sx={{ color: 'fg.muted' }}>
          <strong>{title}</strong> is shared with people who have an account.
        </Text>
        {signIn ? (
          <Button variant="primary" leadingVisual={SignInIcon} onClick={() => signIn(returnTo)}>
            Sign in
          </Button>
        ) : null}
      </Gate>
    );
  }

  if (password && !unlocked) {
    return (
      <Gate icon={<KeyIcon size={24} />} heading="This deck has a password">
        <Text sx={{ color: 'fg.muted' }}>
          Enter the password you were given for <strong>{title}</strong>. It is remembered on
          this browser, so this is asked once.
        </Text>
        <Box as="form" onSubmit={submit} sx={{ display: 'flex', gap: 2, width: '100%' }}>
          <TextInput
            type="password"
            value={typed}
            autoFocus
            aria-label="Deck password"
            placeholder="Password"
            onChange={(event) => {
              setTyped(event.target.value);
              setRefused(false);
            }}
            validationStatus={refused ? 'error' : undefined}
            sx={{ flex: 1 }}
          />
          <Button type="submit" variant="primary">
            Open
          </Button>
        </Box>
        {refused && (
          <Text sx={{ color: 'danger.fg', fontSize: 1 }}>That is not the password for this deck.</Text>
        )}
      </Gate>
    );
  }

  return <>{children}</>;
};

export default DeckAccess;
