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

export default theme;
