/**
 * The report's own palette.
 *
 * The PDF is a printed engineering deliverable, not a themed surface: it looks
 * the same no matter which UI style is active. That is enforced structurally
 * rather than by convention —
 *
 *   1. Diagram elements carry `data-fill-role` / `data-stroke-role`, and the
 *      report resolves color, width and dash from the role, **ignoring what the
 *      element actually looks like on screen**. A style's gradients, filters and
 *      animations therefore cannot reach the report, because the report never
 *      reads them.
 *
 *   2. Anything the report cannot resolve by role — text colored by CSS class,
 *      say — is passed through `ensureContrastOnWhite`, which darkens it until
 *      it is legible on paper. That is the safety net: a style nobody
 *      anticipated still prints readably.
 *
 * Together these retire the bug class that made the dark restyle produce an
 * illegible report (#32/#33).
 */

/** Roles → how the report draws them. Mirrors the screen role contract. */
export const PRINT_SPEC = {
  concreteStroke: { color: '#1e293b', width: 1.8 },
  concreteFill: { color: 'rgba(30, 41, 59, 0.05)' },
  stressBlockFill: { color: 'rgba(180, 83, 9, 0.20)' },
  stressBlockStroke: { color: '#b45309', width: 1, dash: '4,3' },
  hatchStroke: { color: 'rgba(180, 83, 9, 0.45)', width: 0.8 },
  neutralAxis: { color: '#15803d', width: 1.3, dash: '7,4' },
  tensionSteel: { color: '#15803d', width: 2 },
  compressionSteel: { color: '#7c3aed', width: 2 },
  dotStroke: { color: '#1e293b', width: 1 },
  grid: { color: 'rgba(30, 41, 59, 0.10)', width: 0.5 },
  axis: { color: '#64748b', width: 1, dash: '3,3' },
  guide: { color: 'rgba(30, 41, 59, 0.35)', width: 1, dash: '2,2' },
  series: ['#1e293b', '#7c3aed', '#15803d', '#b45309', '#b91c1c', '#0e7490'],
};

/** WCAG contrast target for ink on white paper. */
export const MIN_CONTRAST = 4.5;

const RGB_RE = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i;

function parseColor(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  const m = RGB_RE.exec(v);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: +m[1], g: +m[2], b: +m[3], a: Number.isFinite(a) ? a : 1 };
  }
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, (c) => c + c) : hex[1];
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: 1,
    };
  }
  return null;
}

const channel = (v) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** Relative luminance, per WCAG 2.x. */
export function luminance({ r, g, b }) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio of a color against white paper. */
export function contrastOnWhite(color) {
  const c = typeof color === 'string' ? parseColor(color) : color;
  if (!c) return 0;
  return 1.05 / (luminance(c) + 0.05);
}

/**
 * Darken a color until it reads on white paper.
 *
 * The safety net for values the report cannot resolve by role. Colors that
 * already have enough contrast are returned untouched, so a style that prints
 * well is not altered; only the ones that would vanish get pulled down. Alpha
 * is preserved, and anything unparseable (`none`, `url(#grad)`) passes through.
 */
export function ensureContrastOnWhite(value, target = MIN_CONTRAST) {
  const c = parseColor(value);
  if (!c) return value;
  if (contrastOnWhite(c) >= target) return value;

  /* Scale the channels down toward black until the target is met. Binary
     search rather than stepping, so this stays exact and cheap. */
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    const test = { r: c.r * mid, g: c.g * mid, b: c.b * mid };
    if (contrastOnWhite(test) >= target) lo = mid;
    else hi = mid;
  }
  /* Floor rather than round: the search lands exactly on the target, and
     rounding a channel up would drop it back under. Flooring only darkens. */
  const k = lo;
  const r = Math.floor(c.r * k);
  const g = Math.floor(c.g * k);
  const b = Math.floor(c.b * k);
  return c.a < 1 ? `rgba(${r}, ${g}, ${b}, ${c.a})` : `rgb(${r}, ${g}, ${b})`;
}

/**
 * Print colors for diagram text, keyed by the CSS class the component uses.
 *
 * Text is colored by class rather than by role, and those classes resolve to
 * style tokens — so left alone, label color would follow the active style into
 * the report. Resolving from the class name instead keeps the report identical
 * across styles while preserving the meaning each label carries (green for the
 * neutral axis, amber for the stress block, grey for dimensions).
 */
const PRINT_TEXT = {
  'na-label': '#15803d',
  'a-label': '#b45309',
  'strain-value': '#15803d',
  'stress-label': '#b45309',
  'chart-point-label': '#15803d',
  'force-label': '#b45309',
  green: '#15803d',
  amber: '#7c3aed',
  blue: '#b45309',
  'diagram-title': '#475569',
  'chart-axis-label': '#475569',
};

/**
 * The report's own typography.
 *
 * Diagram labels take `font-family` from `--mono`, which each style redefines —
 * Golden Runes uses a serif stack — so left alone the report's labels would
 * change typeface with the style. Pinning them here keeps the report constant
 * and matches the Helvetica jsPDF draws the rest of the page in.
 */
export const PRINT_FONT = {
  'font-family': "'Helvetica Neue', Helvetica, Arial, sans-serif",
  'letter-spacing': 'normal',
  'font-variant': 'normal',
};

/** Neutral ink for any label the map does not name. */
export const PRINT_TEXT_DEFAULT = '#64748b';

/**
 * The print color for a text element, from its classes.
 *
 * Later classes win, so `diagram-label na-label` resolves to the na-label
 * color rather than the generic one.
 */
export function printTextColor(classAttr) {
  if (!classAttr) return PRINT_TEXT_DEFAULT;
  let color = PRINT_TEXT_DEFAULT;
  for (const cls of String(classAttr).split(/\s+/)) {
    if (PRINT_TEXT[cls]) color = PRINT_TEXT[cls];
  }
  return color;
}

/**
 * The print spec for a role, or null when the role is unknown.
 *
 * `series` is a list rather than a single spec, so an index selects from it —
 * that is how the six stress-strain curves get the report's own palette
 * instead of the style's.
 */
export function printSpecFor(role, index) {
  const spec = PRINT_SPEC[role];
  if (Array.isArray(spec)) {
    if (index === null || index === undefined || index === '') return null;
    const i = Number(index);
    return Number.isInteger(i) ? { color: spec[i % spec.length] } : null;
  }
  return spec || null;
}
