/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

/**
 * The components a spec may name — as a registry the host fills.
 *
 * A slide of `type: 'component'`, a column of `type: 'component'`, a title's
 * `visual` and a slide's `backdrop` all name what they want, and this map
 * decides whether the name means anything. Naming rather than importing keeps
 * a spec *data*: a value that can be read, diffed and validated, and that
 * cannot smuggle in a component its author never sanctioned.
 *
 * The engine ships the map empty. The design-system illustrations the landing
 * decks use are registered by the landing, because they are the landing's;
 * another host registers its own. Registration is live, so a component added
 * after the first render is available to the next.
 *
 * @module registry/components
 */

import type { ComponentType } from 'react';

const registry = new Map<string, ComponentType<any>>();
const listeners = new Set<() => void>();

const emit = (): void => listeners.forEach((listener) => listener());

/** Make components available to every deck, by name. Returns an undo. */
export const registerDeckComponents = (
  components: Record<string, ComponentType<any>>,
): (() => void) => {
  const names = Object.keys(components);
  for (const name of names) {
    registry.set(name, components[name]);
  }
  emit();
  return () => {
    for (const name of names) {
      if (registry.get(name) === components[name]) {
        registry.delete(name);
      }
    }
    emit();
  };
};

/** The component behind a name, or nothing — which the slide shows as such. */
export const deckComponent = (name: string): ComponentType<any> | undefined =>
  registry.get(name);

/** Whether a name is registered. What validation asks. */
export const hasDeckComponent = (name: string): boolean => registry.has(name);

/** Every registered name, for a picker or a diagnostic. */
export const deckComponentNames = (): string[] => Array.from(registry.keys()).sort();

/** Re-run when the registry changes. */
export const subscribeDeckComponents = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
