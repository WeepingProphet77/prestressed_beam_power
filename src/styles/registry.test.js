import { describe, it, expect } from 'vitest';
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
});

describe('style contract validation', () => {
  const valid = () => ({
    id: 'test-style',
    name: 'Test',
    description: 'A style used only by these tests',
    colorScheme: 'dark',
    roles: {
      ...Object.fromEntries(COLOR_ROLES.map((r) => [r, '#000000'])),
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
