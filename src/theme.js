/**
 * Diagram palette for the holographic HUD theme.
 *
 * SVG presentation attributes can't read CSS custom properties, so the colors
 * used inside the diagram components live here and mirror the tokens defined
 * in index.css. Keep the two in sync when either changes.
 */
const theme = {
  /* Core palette */
  cyan: '#7fe8ff',
  cyanDim: '#3d92a8',
  cyanBright: '#dffaff',
  amber: '#ffb347',
  violet: '#b78bff',
  ok: '#5cffc0',
  bad: '#ff6b7a',
  ink: '#04121a',

  /* Semantic roles used across the diagrams */
  concreteStroke: '#7fe8ff',
  concreteFill: 'rgba(127, 232, 255, 0.07)',
  stressBlockFill: 'rgba(255, 179, 71, 0.2)',
  stressBlockStroke: '#ffb347',
  hatchStroke: 'rgba(255, 179, 71, 0.45)',
  neutralAxis: '#5cffc0',
  tensionSteel: '#5cffc0',
  compressionSteel: '#b78bff',
  dotStroke: '#04121a',
  grid: 'rgba(127, 232, 255, 0.1)',
  axis: '#3d92a8',
  guide: 'rgba(127, 232, 255, 0.35)',

  /* Steel stress-strain curve series */
  series: ['#7fe8ff', '#b78bff', '#5cffc0', '#ffb347', '#ff6b7a', '#4fd8f5'],
};

/**
 * Screen color → print-safe equivalent, keyed by "r,g,b".
 *
 * The PDF report rasterizes the live diagram SVGs onto a white page, so the
 * HUD palette — which is tuned for a near-black ground — would come out washed
 * out or illegible. These replacements keep each element's semantic role
 * (amber compression, green tension, violet compression steel, red demand)
 * while carrying enough contrast to print. Screen styling is unaffected.
 */
const PRINT_COLOR_MAP = {
  '127,232,255': '#1e293b', // cyan        → slate: concrete outline, envelopes, grid
  '61,146,168': '#64748b',  // cyan-dim    → mid slate: axes, dimensions, labels
  '223,250,255': '#0f172a', // cyan-bright → near-black: readout text
  '234,252,255': '#0f172a', // hero white  → near-black
  '255,179,71': '#b45309',  // amber       → dark amber: stress block, compression
  '183,139,255': '#7c3aed', // violet      → dark violet: compression steel
  '92,255,192': '#15803d',  // mint        → dark green: tension, neutral axis
  '255,107,122': '#b91c1c', // coral       → dark red: demand, failure
  '79,216,245': '#0e7490',  // light cyan  → dark teal: sixth curve series
};

const RGB_RE = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i;

/**
 * Convert one computed color value to its print equivalent.
 *
 * Values arrive from getComputedStyle as rgb()/rgba(), so the lookup is keyed
 * on the numeric triplet. Any alpha present is preserved, which keeps
 * translucent fills (the stress block, the grid) as light tints rather than
 * flattening them to solid ink. Anything unrecognized — `none`, `url(#grad)`,
 * a color outside the palette — is passed through untouched.
 */
export function toPrintColor(value) {
  if (typeof value !== 'string') return value;
  const m = RGB_RE.exec(value.trim());
  if (!m) return value;

  const hex = PRINT_COLOR_MAP[
    `${Math.round(+m[1])},${Math.round(+m[2])},${Math.round(+m[3])}`
  ];
  if (!hex) return value;

  const rawAlpha = m[4];
  if (rawAlpha === undefined) return hex;
  const alpha = rawAlpha.endsWith('%')
    ? parseFloat(rawAlpha) / 100
    : parseFloat(rawAlpha);
  if (!Number.isFinite(alpha) || alpha >= 1) return hex;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default theme;
