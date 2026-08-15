import { describe, it, expect } from 'vitest';
import theme, { toPrintColor } from '../theme';

/**
 * The PDF report rasterizes the live diagram SVGs onto a white page, so every
 * screen color that reaches it must be swapped for a print-safe equivalent.
 * getComputedStyle always hands back rgb()/rgba(), which is what these cover.
 */

/* Relative luminance per WCAG 2.x, used to assert print colors are dark
   enough to read on white. */
function luminance(hex) {
  const ch = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

const contrastOnWhite = (hex) => 1.05 / (luminance(hex) + 0.05);

describe('toPrintColor', () => {
  it('maps the HUD palette to darker print colors', () => {
    expect(toPrintColor('rgb(127, 232, 255)')).toBe('#1e293b'); // cyan
    expect(toPrintColor('rgb(255, 179, 71)')).toBe('#b45309');  // amber
    expect(toPrintColor('rgb(92, 255, 192)')).toBe('#15803d');  // mint
    expect(toPrintColor('rgb(183, 139, 255)')).toBe('#7c3aed'); // violet
    expect(toPrintColor('rgb(255, 107, 122)')).toBe('#b91c1c'); // coral
  });

  it('preserves alpha so translucent fills stay light tints', () => {
    expect(toPrintColor('rgba(255, 179, 71, 0.2)')).toBe('rgba(180, 83, 9, 0.2)');
    expect(toPrintColor('rgba(127, 232, 255, 0.1)')).toBe('rgba(30, 41, 59, 0.1)');
  });

  it('treats a fully opaque alpha as opaque', () => {
    expect(toPrintColor('rgba(127, 232, 255, 1)')).toBe('#1e293b');
  });

  it('accepts percentage alpha and space/slash separators', () => {
    expect(toPrintColor('rgba(255, 179, 71, 50%)')).toBe('rgba(180, 83, 9, 0.5)');
    expect(toPrintColor('rgb(255 179 71 / 0.4)')).toBe('rgba(180, 83, 9, 0.4)');
  });

  it('passes through values it does not recognize', () => {
    expect(toPrintColor('none')).toBe('none');
    expect(toPrintColor('url("#concFill")')).toBe('url("#concFill")');
    expect(toPrintColor('rgb(1, 2, 3)')).toBe('rgb(1, 2, 3)');
    expect(toPrintColor('')).toBe('');
    expect(toPrintColor(undefined)).toBe(undefined);
  });

  it('gives every mapped color readable contrast on white', () => {
    // 4.5:1 is the WCAG AA threshold for body text.
    const screenColors = [
      theme.cyan, theme.cyanDim, theme.cyanBright, theme.amber,
      theme.violet, theme.ok, theme.bad, ...theme.series,
    ];
    for (const hex of screenColors) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const print = toPrintColor(`rgb(${r}, ${g}, ${b})`);
      expect(print, `${hex} has no print mapping`).toMatch(/^#/);
      expect(contrastOnWhite(print), `${hex} → ${print} is too light to print`)
        .toBeGreaterThan(4.5);
    }
  });

  it('keeps the six curve series visually distinct in print', () => {
    const printed = theme.series.map((hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return toPrintColor(`rgb(${r}, ${g}, ${b})`);
    });
    expect(new Set(printed).size).toBe(theme.series.length);
  });
});
