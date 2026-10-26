/*
 * Copyright (c) 2022-2026 Datalayer, Inc.
 *
 * Datalayer License
 */

import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SLIDE_TYPES, checkDeckFile, describeProblems } from '../check';
import decksPlugin, { DEFAULT_CONTROLS, PLUGIN_NAME } from '../index';

const here = path.dirname(fileURLToPath(import.meta.url));

const deck = (slides: unknown[]) =>
  JSON.stringify({ deck: { title: 'Session Keys', template: 'datalayer' }, slides });

describe('checkDeckFile', () => {
  it('passes a deck the engine can draw', () => {
    expect(checkDeckFile('a.deck.json', deck([{ type: 'title', title: 'Hi' }]))).toEqual([]);
  });

  it('says where JSON stops being JSON', () => {
    const [problem] = checkDeckFile('a.deck.json', '{ "deck": ');
    expect(problem.where).toBe('file');
    expect(problem.message).toMatch(/^not valid JSON: /);
  });

  it('wants a deck, its title and template, and slides', () => {
    expect(checkDeckFile('a', '[]').map(one => one.where)).toEqual(['file']);
    expect(checkDeckFile('a', JSON.stringify({ deck: {}, slides: [] })).map(one => one.where)).toEqual([
      'deck.title',
      'deck.template',
      'slides',
    ]);
  });

  it('refuses a slide type the engine does not know, naming the slide', () => {
    const problems = checkDeckFile('a', deck([{ type: 'title' }, { type: 'slideshow' }, 'x']));
    expect(problems.map(one => one.where)).toEqual(['slides[1].type', 'slides[2]']);
    expect(describeProblems(problems)).toContain('a (slides[1].type): "slideshow" is not a slide type');
  });

  it('holds a deck to the site’s most slides', () => {
    const eleven = Array.from({ length: 11 }, () => ({ type: 'statement' }));
    expect(checkDeckFile('a', deck(eleven), { maxSlides: 10 })).toEqual([
      { file: 'a', where: 'slides', message: '11 slides, more than the 10 this site allows' },
    ]);
    expect(checkDeckFile('a', deck(eleven.slice(1)), { maxSlides: 10 })).toEqual([]);
  });

  it('knows exactly the slide types of @datalayer/decks', async () => {
    const types = await readFile(path.join(here, '../../../../src/types.ts'), 'utf8');
    const union = /export type SlideType =([\s\S]*?);/.exec(types)?.[1] ?? '';
    const named = [...union.matchAll(/'([a-z-]+)'/g)].map(match => match[1]);
    expect(named.length).toBeGreaterThan(10);
    expect([...SLIDE_TYPES]).toEqual(named);
  });
});

describe('the plugin', () => {
  const siteWith = async (files: Record<string, string>) => {
    const siteDir = await mkdtemp(path.join(tmpdir(), 'decks-docusaurus-'));
    for (const [name, text] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(siteDir, name)), { recursive: true });
      await writeFile(path.join(siteDir, name), text);
    }
    return siteDir;
  };

  it('checks every .deck.json under decks, nested ones too, and counts them', async () => {
    const siteDir = await siteWith({
      'decks/one.deck.json': deck([{ type: 'title' }]),
      'decks/pap/two.deck.json': deck([{ type: 'closing' }]),
      'decks/notes.json': 'not a deck, not looked at',
    });
    await expect(decksPlugin({ siteDir }).loadContent()).resolves.toEqual({ decks: 2 });
  });

  it('stops the build on a deck that cannot be drawn, naming the file', async () => {
    const siteDir = await siteWith({
      'decks/long.deck.json': deck(Array.from({ length: 12 }, () => ({ type: 'bullets' }))),
    });
    await expect(decksPlugin({ siteDir }, { maxSlides: 10 }).loadContent()).rejects.toThrow(
      `${PLUGIN_NAME}: decks that cannot be drawn:\ndecks/long.deck.json (slides): 12 slides, more than the 10 this site allows`,
    );
  });

  it('is fine with a site that has no decks yet', async () => {
    const siteDir = await siteWith({});
    await expect(decksPlugin({ siteDir }).loadContent()).resolves.toEqual({ decks: 0 });
  });

  it('refuses a maxSlides below one', () => {
    expect(() => decksPlugin({ siteDir: '/' }, { maxSlides: 0 })).toThrow('maxSlides must be at least 1');
  });

  it('keeps the engine out of the server bundle', () => {
    const plugin = decksPlugin({ siteDir: '/' });
    const alias = (isServer: boolean) =>
      (plugin.configureWebpack(undefined, isServer).resolve.alias as Record<string, unknown>)[
        '@datalayer/decks-docusaurus/client'
      ];
    expect(alias(true)).toBe(false);
    expect(String(alias(false))).toMatch(/client[/\\]DeckClient\.js$/);
  });

  it('pins React to the site’s own copy', async () => {
    const siteDir = await siteWith({
      'package.json': '{"name":"site"}',
      'node_modules/react/package.json': '{"name":"react","main":"index.js"}',
      'node_modules/react/index.js': '',
    });
    const alias = decksPlugin({ siteDir }).configureWebpack(undefined, false).resolve.alias as Record<
      string,
      unknown
    >;
    expect(alias['react$']).toBe(path.join(siteDir, 'node_modules/react/index.js'));
  });

  it('gives the client the site’s controls, notes and present by default', async () => {
    const data: unknown[] = [];
    const setGlobalData = (value: unknown) => data.push(value);
    await decksPlugin({ siteDir: '/' }).contentLoaded({ content: {}, actions: { setGlobalData } });
    await decksPlugin({ siteDir: '/' }, { controls: ['present'] }).contentLoaded({
      content: {},
      actions: { setGlobalData },
    });
    expect(data).toEqual([{ controls: [...DEFAULT_CONTROLS] }, { controls: ['present'] }]);
    expect(DEFAULT_CONTROLS).toEqual(['notes', 'present']);
  });
});
