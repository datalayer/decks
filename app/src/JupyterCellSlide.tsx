/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * A Jupyter cell on a slide, running a Pyodide kernel in the browser.
 *
 * The shape is `packages/react/src/examples/CellLite.tsx` in jupyter-react,
 * which is the reference for this: `useJupyter({ lite: true })` builds a
 * JupyterLite service manager whose kernel is Pyodide — jupyter-react carries
 * its own pyodide-kernel-extension, and the Pyodide runtime itself comes from
 * the jsDelivr CDN the extension names, so the first run needs the network and
 * a few seconds. `Cell` auto-starts, so the slide executes itself as soon as
 * the kernel is ready and the room watches the output arrive.
 *
 * It lives in the app rather than in `@datalayer/decks/examples` on purpose.
 * The engine ships its component registry empty and a *host* fills it; the
 * package's own example components are two light design-system pieces, while
 * this one drags in JupyterLab, Lumino, CodeMirror and their stylesheets. A
 * deck engine should not make every consumer carry that to show three
 * examples — but a host that already has Jupyter in it should absolutely be
 * able to put a live cell on a slide, and this is what that looks like.
 *
 * Loaded through `React.lazy` from `deckComponents.tsx`, so all of that weight
 * sits in an async chunk the shell never touches until the slide is reached.
 */

import { useEffect, useRef, useState, type JSX } from 'react';
import { Cell, JupyterReactTheme, useJupyter } from '@datalayer/jupyter-react';
import { useSystemColorMode, useThemeStore } from '@datalayer/primer-addons';

/**
 * The cell's code, with the deck's own palette folded into it.
 *
 * Matplotlib's defaults are a white canvas and a blue line, which on a dark
 * slide is a lit rectangle in the middle of the deck — the same "two palettes
 * in one box" the `--jp-*` mapping below fixes for the cell itself. A figure
 * cannot read CSS, so the accent is read here and interpolated, the style is
 * chosen from the colour mode in force, and the two `set_alpha(0)` calls let
 * the slide show through instead of a white rectangle. They arrive as
 * literals in the code the room sees, which is honest: that *is* what the
 * cell runs.
 *
 * The other two lines are not decoration either. `%matplotlib inline` keeps
 * the figure a PNG in the output area rather than the Pyodide canvas backend,
 * whose element brings a white background of its own; and `set_loglevel`
 * silences the font-cache notice pyplot writes to stderr on its first import
 * in a fresh kernel, which the output area renders as a red banner — a
 * warning that reads as a failure on a slide.
 */
const sourceFor = (accent: string, style: string): string => `%pip install -q matplotlib
import sys, matplotlib as mpl; mpl.set_loglevel("error")
%matplotlib inline
import matplotlib.pyplot as plt

print(f"Python {sys.version.split()[0]} · {sys.platform}")
print(sum(range(1, 101)))

plt.style.use("${style}")
fig, ax = plt.subplots(figsize=(4.6, 1.1)); fig.patch.set_alpha(0); ax.patch.set_alpha(0)
ax.plot(range(1, 101), [k * (k + 1) // 2 for k in range(1, 101)], color="${accent}", lw=2)
plt.show()`;

/*
 * A definite height, and not `flex: 1` or `100%`, for a reason worth keeping.
 *
 * The cell's body is a Lumino `BoxPanel`, and `Lumino` renders it into a div
 * of `height: 100%; min-height: 100%` — a percentage, which resolves against
 * a parent that has a height of its own or against nothing. The chain above
 * gives it nothing: `JupyterReactTheme` renders a wrapper of its own that
 * sizes to its content, so the panel measured itself once, came out at the
 * height of an empty cell, and clipped the output the moment it arrived. A
 * number here is the definite box the panel needs; the deck's own 1280x720
 * coordinate space is what the number is in, so it scales with the slide.
 */
const frame: React.CSSProperties = {
  /*
   * JupyterLab's palette, told what the deck is wearing.
   *
   * Every colour in a JupyterLab widget comes from a `--jp-*` custom
   * property, and the stylesheet that sets them knows about JupyterLab's own
   * light and dark themes, not about this deck — so a cell dropped on a
   * Matrix-dark slide came out in JupyterLab's greys against the template's
   * greens, two palettes in one box. These map the handful that show onto the
   * deck's own tokens, so the cell wears whichever template and theme the
   * deck is in, including the syntax colours, which are the template's code
   * colours rather than JupyterLab's.
   */
  ['--jp-layout-color0' as string]: 'var(--dla-deck-surface)',
  ['--jp-layout-color1' as string]: 'var(--dla-deck-surface)',
  ['--jp-layout-color2' as string]: 'var(--dla-deck-code-background)',
  ['--jp-layout-color3' as string]: 'var(--dla-deck-code-background)',
  ['--jp-content-font-color0' as string]: 'var(--dla-deck-foreground)',
  ['--jp-content-font-color1' as string]: 'var(--dla-deck-foreground)',
  ['--jp-content-font-color2' as string]: 'var(--dla-deck-muted)',
  ['--jp-content-font-color3' as string]: 'var(--dla-deck-muted)',
  ['--jp-ui-font-color0' as string]: 'var(--dla-deck-foreground)',
  ['--jp-ui-font-color1' as string]: 'var(--dla-deck-foreground)',
  ['--jp-ui-font-color2' as string]: 'var(--dla-deck-muted)',
  ['--jp-ui-font-color3' as string]: 'var(--dla-deck-muted)',
  ['--jp-border-color0' as string]: 'var(--dla-deck-border)',
  ['--jp-border-color1' as string]: 'var(--dla-deck-border)',
  ['--jp-border-color2' as string]: 'var(--dla-deck-border)',
  ['--jp-border-color3' as string]: 'var(--dla-deck-border)',
  ['--jp-toolbar-background' as string]: 'var(--dla-deck-surface)',
  ['--jp-toolbar-border-color' as string]: 'var(--dla-deck-border)',
  ['--jp-cell-editor-background' as string]: 'var(--dla-deck-code-background)',
  ['--jp-cell-editor-border-color' as string]: 'var(--dla-deck-border)',
  ['--jp-cell-editor-active-background' as string]: 'var(--dla-deck-code-background)',
  ['--jp-input-background' as string]: 'var(--dla-deck-code-background)',
  ['--jp-brand-color0' as string]: 'var(--dla-deck-accent)',
  ['--jp-brand-color1' as string]: 'var(--dla-deck-accent)',
  ['--jp-brand-color2' as string]: 'var(--dla-deck-accent)',
  ['--jp-editor-selected-background' as string]: 'var(--dla-deck-accent-soft)',
  ['--jp-editor-selected-focused-background' as string]: 'var(--dla-deck-accent-soft)',
  ['--jp-mirror-editor-keyword-color' as string]: 'var(--dla-deck-code-keyword)',
  ['--jp-mirror-editor-atom-color' as string]: 'var(--dla-deck-code-keyword)',
  ['--jp-mirror-editor-string-color' as string]: 'var(--dla-deck-code-string)',
  ['--jp-mirror-editor-string-2-color' as string]: 'var(--dla-deck-code-string)',
  ['--jp-mirror-editor-comment-color' as string]: 'var(--dla-deck-code-comment)',
  ['--jp-mirror-editor-number-color' as string]: 'var(--dla-deck-code-number)',
  ['--jp-mirror-editor-def-color' as string]: 'var(--dla-deck-code-name)',
  ['--jp-mirror-editor-variable-2-color' as string]: 'var(--dla-deck-code-name)',
  ['--jp-mirror-editor-builtin-color' as string]: 'var(--dla-deck-code-name)',
  ['--jp-mirror-editor-operator-color' as string]: 'var(--dla-deck-foreground)',
  ['--jp-mirror-editor-variable-color' as string]: 'var(--dla-deck-foreground)',
  ['--jp-mirror-editor-punctuation-color' as string]: 'var(--dla-deck-muted)',
  // JupyterLab sizes its type for a page. A slide is 1280x720 and this box is
  // a third of it, so the cell is set a couple of points smaller — which is
  // also what buys the room for the figure under the code.
  ['--jp-code-font-size' as string]: '11px',
  ['--jp-code-line-height' as string]: '1.45',
  ['--jp-content-font-size1' as string]: '12px',
  ['--jp-ui-font-size1' as string]: '11px',

  height: '420px',
  overflow: 'auto',
  padding: '16px 20px',
  border: '1px solid var(--dla-deck-border)',
  borderRadius: '14px',
  background: 'var(--dla-deck-surface)',
};

const waiting: React.CSSProperties = {
  margin: 0,
  fontSize: '18px',
  color: 'var(--dla-deck-muted)',
};

/**
 * Whether this slide has been on screen yet.
 *
 * Reveal keeps every slide mounted — the deck is one document — so a cell that
 * started its kernel on mount started it the moment the deck opened, and every
 * reader of this example downloaded Pyodide whether or not they ever reached
 * slide thirteen. An observer is the cheap fix: nothing happens until the
 * slide is actually shown, and once shown it stays started, so stepping back
 * and forth does not restart the kernel.
 */
const useOnScreenOnce = (): [React.RefObject<HTMLDivElement | null>, boolean] => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (seen || !element) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setSeen(true);
        observer.disconnect();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [seen]);
  return [ref, seen];
};

const CellWithKernel = ({ accent, style }: { accent: string; style: string }): JSX.Element => {
  // `lite: true` is the whole difference from a cell wired to a server: the
  // kernel is Pyodide, in this tab, and nothing is deployed to run it.
  const { defaultKernel } = useJupyter({ startDefaultKernel: true, lite: true });
  const colorMode = useThemeStore((state) => state.colorMode);
  const systemMode = useSystemColorMode();
  return (
    <JupyterReactTheme
      colormode={colorMode === 'auto' ? systemMode : colorMode}
      useBaseStyles={false}
    >
      {defaultKernel ? (
        <Cell id="deck-pyodide-cell" source={sourceFor(accent, style)} kernel={defaultKernel} />
      ) : (
        <p style={waiting}>Starting the Pyodide kernel…</p>
      )}
    </JupyterReactTheme>
  );
};

/** What the template resolved a token to, or a readable fallback. */
const tokenOf = (element: Element | null, name: string, fallback: string): string => {
  const value = element ? getComputedStyle(element).getPropertyValue(name).trim() : '';
  // The `datalayer` template sets these to Primer tokens, and a computed
  // custom property comes back substituted — a colour, not a `var()`. A
  // template that resolves to nothing at all gets the fallback rather than an
  // empty string, which matplotlib would refuse.
  return value && !value.startsWith('var(') ? value : fallback;
};

export const JupyterCellSlide = (): JSX.Element => {
  const [ref, onScreen] = useOnScreenOnce();
  const accent = tokenOf(ref.current, '--dla-deck-accent', '#2ecc71');
  const colorMode = useThemeStore((state) => state.colorMode);
  const systemMode = useSystemColorMode();
  // Matplotlib's own dark style gets the ticks and labels legible; the deck's
  // colour mode decides which, so the figure is right in either.
  const style =
    (colorMode === 'auto' ? systemMode : colorMode) === 'dark'
      ? 'dark_background'
      : 'default';
  return (
    <div ref={ref} style={frame}>
      {onScreen ? (
        <CellWithKernel accent={accent} style={style} />
      ) : (
        <p style={waiting}>The kernel starts when this slide does.</p>
      )}
    </div>
  );
};

export default JupyterCellSlide;
