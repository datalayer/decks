/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The deck itself, in the browser: the engine's `DeckView` under a Primer
 * theme, checked by `validateDeckSpec` before it is drawn.
 *
 * The theme is pinned to the site's (the plugin's `theme`, `loop` — what
 * datalayer.ai wears — when absent) and the colour mode follows the site's own
 * switch, rather than the deck offering an appearance chooser: a deck that
 * repainted itself while the documentation around it stayed put would read as
 * a bug. A deck whose spec names a theme of its own still wears it.
 *
 * It imports nothing of Docusaurus: the colour mode is read from the
 * `data-theme` Docusaurus keeps on `<html>`, so this module works whichever
 * copy of Docusaurus' packages a workspace resolves next to it (a second copy
 * of a context-holding module is a context nobody provides).
 */

import type { JSX } from 'react';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { Flash } from '@primer/react';
import { DatalayerThemeProvider, themeConfigs, useThemeStore, type ThemeVariant } from '@datalayer/primer-addons';
// The `loop` theme's face, Inter, served from the site's own build.
import '@datalayer/primer-addons/style/loop-face.css';
import {
  DECK_CONTROLS,
  DeckView,
  DecksHostProvider,
  validateDeckSpec,
  type DeckControl,
  type DecksHost,
} from '@datalayer/decks';
import { createSilentNarrator } from './silentNarrator.js';

export type DeckClientProps = {
  spec: unknown;
  /** The toolbar's controls, comma-separated. */
  controls: string;
  /** The primer-addons theme variant the deck wears. */
  theme: string;
};

/** The site's colour mode, as Docusaurus marks it on `<html>`. */
const siteColorMode = (): 'light' | 'dark' =>
  document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

const watchColorMode = (changed: () => void): (() => void) => {
  const observer = new MutationObserver(changed);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
};

/** The controls named, in the toolbar's order; unknown names are dropped. */
export const controlsOf = (names: readonly string[]): DeckControl[] =>
  DECK_CONTROLS.filter(control => names.includes(control));

export default function DeckClient({ spec, controls, theme }: DeckClientProps): JSX.Element {
  const variant = (theme in themeConfigs ? theme : 'loop') as ThemeVariant;
  const config = themeConfigs[variant];
  const colorMode = useSyncExternalStore(watchColorMode, siteColorMode, () => 'light' as const);
  const shown = controlsOf(controls.split(',').map(name => name.trim()));
  const checked = useMemo(() => validateDeckSpec(spec), [spec]);

  useEffect(() => {
    // The site's theme, in the site's colour mode, for what reads the store
    // (the deck's own theme override); never written to a preference.
    const store = useThemeStore.getState();
    store.setTheme(variant, false);
    store.setColorMode(colorMode);
  }, [variant, colorMode]);

  // Play shows the notes as captions, at reading pace, with no voice.
  const narrator = useMemo(() => createSilentNarrator(), []);
  const host = useMemo<Partial<DecksHost>>(
    () => ({ useTheme: () => ({ theme: variant, colorMode }), useNarrator: () => narrator }),
    [variant, colorMode, narrator],
  );

  if (!checked.valid || !checked.spec) {
    return (
      <Flash variant="danger" role="alert">
        This deck cannot be drawn:
        <ul>
          {checked.issues
            .filter(issue => issue.severity === 'error')
            .map(issue => (
              <li key={`${issue.where}-${issue.message}`}>
                <code>{issue.where}</code>: {issue.message}
              </li>
            ))}
        </ul>
      </Flash>
    );
  }

  return (
    // The variant's own Primer theme and styles: a provider given neither
    // wears only its built-in defaults, not the variant's look.
    <DatalayerThemeProvider colorMode={colorMode} theme={config.primerTheme} themeStyles={config.themeStyles}>
      <DecksHostProvider host={host}>
        <div className="dla-docusaurus-deck">
          <DeckView spec={checked.spec} controls={shown} />
        </div>
      </DecksHostProvider>
    </DatalayerThemeProvider>
  );
}
