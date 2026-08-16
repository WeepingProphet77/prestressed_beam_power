import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Guardrails for the token layer.
 *
 * The split matters: `index.css` and `App.css` are the *base layer*. They
 * define structure and consume tokens, but own no colors, no spacing values
 * and no ornament — otherwise a UI style could not reach them. Concrete values
 * live in each style's own stylesheet under `src/styles/`.
 */

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');
const read = (f) => readFileSync(join(src, f), 'utf8');

const BASE_LAYER = ['App.css', 'index.css'];

/** Every stylesheet a registered style contributes. */
function styleSheets() {
  const root = join(src, 'styles');
  const out = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const f of readdirSync(join(root, entry.name))) {
      if (f.endsWith('.css')) out.push(readFileSync(join(root, entry.name, f), 'utf8'));
    }
  }
  return out;
}

const LITERAL = /rgba?\(\s*\d|#[0-9a-fA-F]{3,8}\b/g;

describe('base layer owns no concrete values', () => {
  for (const file of BASE_LAYER) {
    it(`${file} contains no raw color literals`, () => {
      const found = read(file).match(LITERAL) || [];
      expect(found, `raw colors in ${file}: ${found.join(', ')}`).toEqual([]);
    });
  }

  it('App.css uses no raw spacing values — padding/margin/gap come from the scale', () => {
    const found = [
      ...read('App.css').matchAll(
        /\b(padding|margin|gap|row-gap|column-gap)(-top|-right|-bottom|-left)?:\s*([^;]*\d+px[^;]*);/g
      ),
    ].map((m) => `${m[1]}${m[2] || ''}: ${m[3]}`);
    expect(found, `raw spacing: ${found.join(' | ')}`).toEqual([]);
  });

  it('the base layer defines no palette or spacing tokens — styles do', () => {
    const owned = BASE_LAYER.flatMap((f) =>
      [...read(f).matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1])
    ).filter((t) => /-rgb$/.test(t) || /^--space-\d/.test(t) || t === '--density');
    expect(owned, `base layer must not define: ${owned.join(', ')}`).toEqual([]);
  });
});

describe('token graph', () => {
  const all = [...BASE_LAYER.map(read), ...styleSheets()];

  it('every var() referenced anywhere is defined by some stylesheet', () => {
    const defined = new Set(all.flatMap((css) => [...css.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1])));
    const used = new Set(all.flatMap((css) => [...css.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1])));
    const missing = [...used].filter((t) => !defined.has(t));
    expect(missing, `undefined tokens: ${missing.join(', ')}`).toEqual([]);
  });

  it('no token is defined in terms of itself', () => {
    const selfRefs = all.flatMap((css) =>
      [...css.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)]
        .filter(([, name, value]) => value.includes(`var(${name})`))
        .map(([, name]) => name)
    );
    expect(selfRefs, `circular tokens: ${selfRefs.join(', ')}`).toEqual([]);
  });

  it('each --*-rgb token holds a bare triplet, so rgba() can compose it', () => {
    const bad = all.flatMap((css) =>
      [...css.matchAll(/^\s*(--[\w-]+-rgb):\s*([^;]+);/gm)]
        .filter(([, , value]) => !/^\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*$/.test(value))
        .map(([, name]) => name)
    );
    expect(bad, `malformed triplets: ${bad.join(', ')}`).toEqual([]);
  });
});

describe('every style supplies the token contract', () => {
  /* A style that omits these renders the app unstyled rather than restyled. */
  const REQUIRED = ['--cy-rgb', '--am-rgb', '--vi-rgb', '--ok-rgb', '--bad-rgb', '--ink-rgb', '--density'];

  for (const [i, css] of styleSheets().entries()) {
    it(`style sheet #${i + 1} defines the required tokens and density scale`, () => {
      const defined = new Set([...css.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]));
      const missing = REQUIRED.filter((t) => !defined.has(t));
      expect(missing, `missing: ${missing.join(', ')}`).toEqual([]);
      for (let step = 1; step <= 7; step++) {
        expect(css, `--space-${step} must scale with --density`).toMatch(
          new RegExp(`--space-${step}:\\s*calc\\([\\d.]+px \\* var\\(--density\\)\\)`)
        );
      }
    });
  }
});
