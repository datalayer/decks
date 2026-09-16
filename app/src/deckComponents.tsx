/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * What this host offers a spec by name.
 *
 * The package's example components — the appearance chooser and the agents
 * hero — plus the one that is this application's rather than the library's: a
 * Jupyter cell with a Pyodide kernel. A spec names `JupyterPyodideCell` and
 * gets a live cell if the host is this app, and the engine's "unknown
 * component" notice if it is not, which is the contract working as intended.
 *
 * The cell is behind `React.lazy` with its own `Suspense`: the registry calls
 * a registered component as a plain element (`slides/Blocks.tsx`), with no
 * boundary of its own, so the boundary has to travel with the component. The
 * win is that JupyterLab, Lumino, CodeMirror and their stylesheets stay in an
 * async chunk that a reader who never opens that slide never downloads.
 *
 * @module deckComponents
 */

import React, { lazy, Suspense, type JSX } from 'react';
import { exampleDeckComponents } from '../../examples';

const JupyterCellSlide = lazy(() => import('./JupyterCellSlide'));

const loading: React.CSSProperties = {
  display: 'flex',
  flex: '1 1 auto',
  alignItems: 'center',
  minHeight: 0,
  fontSize: '18px',
  color: 'var(--dla-deck-muted)',
};

const JupyterPyodideCell = (): JSX.Element => (
  <Suspense fallback={<div style={loading}>Loading the Jupyter cell…</div>}>
    <JupyterCellSlide />
  </Suspense>
);

export const appDeckComponents = {
  ...exampleDeckComponents,
  JupyterPyodideCell,
};

export default appDeckComponents;
