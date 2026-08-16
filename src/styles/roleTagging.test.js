import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * The report resolves print colors from `data-fill-role` / `data-stroke-role`.
 * An element that takes a color from a role but carries no tag falls through to
 * the contrast net instead, keeping the style's hue — so the PDF stops being
 * identical across styles.
 *
 * Every one of these was a real leak found by building the second style:
 *   - the six stress-strain curves, which read from the `series` list rather
 *     than a named role, so the naive tag pass never matched them;
 *   - steel dots and force arrows, which choose their role with a ternary.
 *
 * Static analysis rather than rendering, so it runs in unit tests.
 */

const here = dirname(fileURLToPath(import.meta.url));
const componentsDir = join(here, '..', 'components');

/* Components whose SVG the report captures. */
const CAPTURED = ['BeamDiagram.jsx', 'StrainDiagram.jsx', 'StressStrainChart.jsx'];

/** A fill=/stroke= binding that reads a role, in any form. */
const ROLE_BINDING = /\b(fill|stroke)=\{[^}]*\broles\.[\w.[\]]+/g;

function linesOf(file) {
  return readFileSync(join(componentsDir, file), 'utf8').split('\n');
}

describe('diagram elements that use a role are tagged for the report', () => {
  for (const file of CAPTURED) {
    it(`${file} tags every role-driven fill and stroke`, () => {
      const lines = linesOf(file);
      const untagged = [];

      lines.forEach((line, i) => {
        for (const m of line.matchAll(ROLE_BINDING)) {
          const attr = m[1]; // 'fill' | 'stroke'
          const tag = `data-${attr}-role`;
          /* The tag may sit on the same line or just above, inside the same
             element's attribute list. */
          const window = lines.slice(Math.max(0, i - 3), i + 1).join('\n');
          if (!window.includes(tag)) {
            untagged.push(`${file}:${i + 1}  ${line.trim().slice(0, 80)}`);
          }
        }
      });

      expect(untagged, `untagged role bindings:\n${untagged.join('\n')}`).toEqual([]);
    });
  }

  it('the stress-strain curves carry a series index the report can resolve', () => {
    const src = readFileSync(join(componentsDir, 'StressStrainChart.jsx'), 'utf8');
    const curves = [...src.matchAll(/data-stroke-role="series"/g)].length;
    const indices = [...src.matchAll(/data-series-index=\{/g)].length;
    expect(curves).toBeGreaterThan(0);
    expect(indices, 'every series stroke needs an index').toBe(curves);
  });

  it('no captured component reads a raw color literal for fill or stroke', () => {
    /* A literal would bypass roles entirely and print as itself. */
    for (const file of CAPTURED) {
      const src = readFileSync(join(componentsDir, file), 'utf8');
      const literals = [...src.matchAll(/\b(?:fill|stroke)="(#[0-9a-fA-F]{3,8}|rgba?\([^"]*\))"/g)]
        .map((m) => m[0]);
      expect(literals, `${file} has literal colors: ${literals.join(', ')}`).toEqual([]);
    }
  });
});

describe('every diagram component is covered by this check', () => {
  it('CAPTURED lists the components the report actually captures', () => {
    /* generatePdfReport selects these three; if it grows, this must too. */
    const report = readFileSync(join(here, '..', 'utils', 'generatePdfReport.js'), 'utf8');
    const selectors = report.match(/const selectors = \[([^\]]*)\]/)?.[1] ?? '';
    const captured = [...selectors.matchAll(/'\.([\w-]+) svg'/g)].map((m) => m[1]);
    const expected = { 'beam-diagram': 'BeamDiagram.jsx', 'strain-diagram': 'StrainDiagram.jsx',
                       'stress-strain-chart': 'StressStrainChart.jsx' };
    for (const cls of captured) {
      expect(CAPTURED, `report captures .${cls}; add its component here`).toContain(expected[cls]);
    }
    expect(captured.length).toBe(CAPTURED.length);
  });

  it('the components directory has not grown a new diagram unnoticed', () => {
    const all = readdirSync(componentsDir).filter((f) => f.endsWith('.jsx'));
    expect(all.length).toBeGreaterThanOrEqual(CAPTURED.length);
  });
});
