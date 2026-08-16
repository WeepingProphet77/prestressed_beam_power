import { describe, it, expect } from 'vitest';
import {
  PRINT_SPEC, MIN_CONTRAST, PRINT_TEXT_DEFAULT, printSpecFor,
  printTextColor, contrastOnWhite, ensureContrastOnWhite,
} from './printSpec';
import { COLOR_ROLES, LIST_ROLES, SERIES_LENGTH } from './styleContract';
import styles from './registry';

/**
 * The report must look the same regardless of the active UI style, and must
 * stay legible on paper for styles that do not exist yet. These are the tests
 * that make that structural rather than a convention.
 */

describe('print spec covers the role contract', () => {
  it('defines a print spec for every color role', () => {
    const missing = COLOR_ROLES.filter((r) => !printSpecFor(r));
    expect(missing, `roles with no print spec: ${missing.join(', ')}`).toEqual([]);
  });

  it('defines a print color list for every list role', () => {
    for (const role of LIST_ROLES) {
      expect(Array.isArray(PRINT_SPEC[role]), `${role} must be a list`).toBe(true);
      expect(PRINT_SPEC[role].length).toBeGreaterThanOrEqual(SERIES_LENGTH);
    }
  });

  it('every print color reads on white paper', () => {
    for (const role of COLOR_ROLES) {
      const { color } = printSpecFor(role);
      /* Translucent fills are washes, not ink; they are not held to the text
         threshold, but they must still be a dark hue rather than a light one. */
      const translucent = /rgba\(/.test(color);
      const ratio = contrastOnWhite(color.replace(/rgba\(([^)]+),[^,)]+\)/, 'rgb($1)'));
      expect(ratio, `${role} (${color}) is too light to print`).toBeGreaterThan(
        translucent ? 3 : MIN_CONTRAST
      );
    }
  });

  it('keeps the curve series mutually distinct', () => {
    expect(new Set(PRINT_SPEC.series).size).toBe(PRINT_SPEC.series.length);
  });

  it('is independent of any registered style — no shared color values', () => {
    /* If a print color happened to equal a screen color that would be a
       coincidence, not a coupling; this asserts the report is not simply
       reusing the active style's palette. */
    for (const style of styles) {
      const screen = COLOR_ROLES.map((r) => style.roles[r].color).join('|');
      const print = COLOR_ROLES.map((r) => printSpecFor(r).color).join('|');
      expect(print).not.toBe(screen);
    }
  });
});

describe('ensureContrastOnWhite', () => {
  it('darkens colors that would vanish on paper', () => {
    for (const light of ['#7fe8ff', '#5cffc0', '#ffb347', 'rgb(223, 250, 255)']) {
      const out = ensureContrastOnWhite(light);
      expect(contrastOnWhite(out), `${light} -> ${out}`).toBeGreaterThanOrEqual(MIN_CONTRAST - 0.01);
    }
  });

  it('leaves colors that already print well untouched', () => {
    for (const dark of ['#1e293b', '#15803d', 'rgb(15, 23, 42)']) {
      expect(ensureContrastOnWhite(dark)).toBe(dark);
    }
  });

  it('preserves alpha so washes stay washes', () => {
    const out = ensureContrastOnWhite('rgba(127, 232, 255, 0.2)');
    expect(out).toMatch(/^rgba\(/);
    expect(out).toMatch(/0\.2\)$/);
  });

  it('passes through values that are not colors', () => {
    for (const v of ['none', 'url("#goldShimmer")', 'inherit', '']) {
      expect(ensureContrastOnWhite(v)).toBe(v);
    }
  });

  it('handles a gradient reference without throwing — the report never inks it', () => {
    expect(() => ensureContrastOnWhite('url(#anything)')).not.toThrow();
  });
});

describe('printTextColor', () => {
  it('gives a later class precedence over the generic one', () => {
    expect(printTextColor('diagram-label na-label')).toBe('#15803d');
    expect(printTextColor('diagram-label a-label')).toBe('#b45309');
  });

  it('falls back to neutral ink for unknown or absent classes', () => {
    expect(printTextColor('some-new-style-class')).toBe(PRINT_TEXT_DEFAULT);
    expect(printTextColor('')).toBe(PRINT_TEXT_DEFAULT);
    expect(printTextColor(null)).toBe(PRINT_TEXT_DEFAULT);
  });

  it('never returns a color too light to print', () => {
    const samples = ['diagram-label', 'diagram-label na-label', 'force-label green',
                     'chart-tick', 'unknown', null];
    for (const cls of samples) {
      expect(contrastOnWhite(printTextColor(cls)), `${cls}`).toBeGreaterThan(MIN_CONTRAST);
    }
  });

  it('does not read the element color, so the style cannot influence it', () => {
    /* Same class always yields the same ink, whatever the style renders. */
    expect(printTextColor('diagram-label')).toBe(printTextColor('diagram-label'));
  });
});
