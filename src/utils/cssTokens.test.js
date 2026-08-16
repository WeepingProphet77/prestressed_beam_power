import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Phase 0 guardrail for the UI Style feature.
 *
 * A style swaps colors by overriding the `--*-rgb` triplets in `:root`. Any raw
 * color value written elsewhere in the stylesheets is a value a style cannot
 * reach, so it would silently keep the old palette. These tests keep the
 * stylesheets free of them.
 */

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');
const read = (f) => readFileSync(join(src, f), 'utf8');

/* rgb()/rgba() with a numeric first argument — `rgba(var(--x-rgb), .3)` is fine,
   `rgba(127, 232, 255, .3)` is not — plus any hex literal. */
const LITERAL = /rgba?\(\s*\d|#[0-9a-fA-F]{3,8}\b/g;

/* Strip the :root block, which is the one legitimate home for raw values. */
function outsideRoot(css) {
  return css.replace(/:root\s*\{[\s\S]*?\n\}/, '');
}

describe('CSS color tokens', () => {
  for (const file of ['App.css', 'index.css']) {
    it(`${file} contains no raw color literals`, () => {
      const found = read(file).match(LITERAL) || [];
      expect(found, `raw colors in ${file}: ${found.join(', ')}`).toEqual([]);
    });
  }

  it('App.css defines no colors of its own — the palette lives in index.css', () => {
    const found = outsideRoot(read('App.css')).match(LITERAL) || [];
    expect(found).toEqual([]);
  });

  it('every var() referenced by the stylesheets is defined', () => {
    const index = read('index.css');
    const defined = new Set([...index.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]));
    const used = new Set(
      [read('App.css'), index].flatMap((css) =>
        [...css.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1])
      )
    );
    const missing = [...used].filter((t) => !defined.has(t));
    expect(missing, `undefined tokens: ${missing.join(', ')}`).toEqual([]);
  });

  it('no token is defined in terms of itself', () => {
    const selfRefs = [...read('index.css').matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)]
      .filter(([, name, value]) => value.includes(`var(${name})`))
      .map(([, name]) => name);
    expect(selfRefs, `circular tokens: ${selfRefs.join(', ')}`).toEqual([]);
  });

  it('each --*-rgb token holds a bare triplet, so rgba() can compose it', () => {
    const bad = [...read('index.css').matchAll(/^\s*(--[\w-]+-rgb):\s*([^;]+);/gm)]
      .filter(([, , value]) => !/^\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*$/.test(value))
      .map(([, name]) => name);
    expect(bad, `malformed triplets: ${bad.join(', ')}`).toEqual([]);
  });
});
