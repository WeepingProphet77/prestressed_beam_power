import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import styles, { DEFAULT_STYLE_ID, getStyle } from './registry';
import {
  validateStyle,
  COLOR_ROLES,
  LIST_ROLES,
  ID_PATTERN,
} from './styleContract';

/**
 * Guardrails for the UI Style registry.
 *
 * These are what let a new style be added by writing one file and one registry
 * entry: a style that omits a role, reuses an id, or picks an id that will not
 * survive a URL fails here rather than rendering an invisible diagram.
 */

describe('style registry', () => {
  it('registers at least one style', () => {
    expect(styles.length).toBeGreaterThan(0);
  });

  it('every registered style satisfies the contract', () => {
    for (const style of styles) {
      const problems = validateStyle(style);
      expect(problems, `${style.id || '(unnamed)'}: ${problems.join('; ')}`).toEqual([]);
    }
  });

  it('style ids are unique', () => {
    const ids = styles.map((s) => s.id);
    expect(ids).toEqual([...new Set(ids)]);
  });

  it('style ids are URL- and storage-safe slugs', () => {
    for (const s of styles) expect(s.id, `bad id: ${s.id}`).toMatch(ID_PATTERN);
  });

  it('the default style id resolves to a registered style', () => {
    expect(styles.some((s) => s.id === DEFAULT_STYLE_ID)).toBe(true);
  });

  it('getStyle falls back to a real style for unknown ids', () => {
    expect(getStyle('no-such-style')).toBe(styles[0]);
    expect(getStyle(undefined)).toBe(styles[0]);
  });

  it('getStyle returns the requested style when it exists', () => {
    for (const s of styles) expect(getStyle(s.id)).toBe(s);
  });

  it('the pre-paint script in index.html knows exactly these style ids', () => {
    /* index.html applies the stored preference before React mounts, so it has
       its own copy of the id list. If a style is removed and that list is not
       updated, a returning user with the stale preference gets an attribute no
       stylesheet matches and the app paints unstyled until hydration. */
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    const known = [...(html.match(/var KNOWN = \[([^\]]*)\]/)?.[1] ?? '')
      .matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(known.sort(), 'index.html KNOWN list is out of sync with the registry')
      .toEqual(styles.map((s) => s.id).sort());
  });

  it('index.html defaults to a registered style', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    const dflt = html.match(/<html[^>]*data-ui-style="([^"]+)"/)?.[1];
    expect(styles.map((s) => s.id)).toContain(dflt);
  });
});

describe('style contract validation', () => {
  const valid = () => ({
    id: 'test-style',
    name: 'Test',
    description: 'A style used only by these tests',
    colorScheme: 'dark',
    roles: {
      ...Object.fromEntries(COLOR_ROLES.map((r) => [r, { color: '#000000', width: 1 }])),
      ...Object.fromEntries(LIST_ROLES.map((r) => [r, ['#000000', '#111', '#222', '#333', '#444', '#555']])),
    },
  });

  it('accepts a well-formed style', () => {
    expect(validateStyle(valid())).toEqual([]);
  });

  it('rejects a missing role', () => {
    const s = valid();
    delete s.roles.neutralAxis;
    expect(validateStyle(s)).toContain('role "neutralAxis" is missing');
  });

  it('rejects a role given as a bare color instead of a spec', () => {
    const s = valid();
    s.roles.concreteStroke = '#ff0000';
    expect(validateStyle(s)).toContain('role "concreteStroke" is missing');
  });

  it('rejects a spec with no color', () => {
    const s = valid();
    s.roles.concreteStroke = { width: 2 };
    expect(validateStyle(s)).toContain('role "concreteStroke" has no color');
  });

  it('rejects a non-positive stroke width', () => {
    const s = valid();
    s.roles.concreteStroke = { color: '#fff', width: 0 };
    expect(validateStyle(s).join()).toMatch(/non-positive width/);
  });

  it('rejects a non-slug id', () => {
    const s = { ...valid(), id: 'Not A Slug' };
    expect(validateStyle(s).join()).toMatch(/not slug-safe/);
  });

  it('rejects an unknown colorScheme', () => {
    const s = { ...valid(), colorScheme: 'sepia' };
    expect(validateStyle(s).join()).toMatch(/colorScheme/);
  });

  it('rejects a short series list', () => {
    const s = valid();
    s.roles.series = ['#000'];
    expect(validateStyle(s).join()).toMatch(/series needs/);
  });

  it('rejects a non-component Ambience', () => {
    const s = { ...valid(), Ambience: 'not-a-component' };
    expect(validateStyle(s)).toContain('Ambience must be a component');
  });
});
