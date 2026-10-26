/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/*
 * The few Docusaurus modules the theme and client import, typed here rather
 * than by installing Docusaurus into the decks repository: they exist only in
 * the site's webpack, which resolves them.
 */

declare module '@docusaurus/BrowserOnly' {
  import type { ReactNode } from 'react';
  export default function BrowserOnly(props: {
    children: () => ReactNode;
    fallback?: ReactNode;
  }): ReactNode;
}

declare module '@docusaurus/useGlobalData' {
  export function usePluginData(name: string, id?: string): unknown;
}

declare module '@datalayer/decks-docusaurus/client' {
  import type { ComponentType } from 'react';
  import type { DeckClientProps } from './client/DeckClient.js';
  const DeckClient: ComponentType<DeckClientProps>;
  export default DeckClient;
}
