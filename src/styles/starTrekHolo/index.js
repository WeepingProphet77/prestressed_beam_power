import Ambience from './Ambience';
import './starTrekHolo.css';

/**
 * Star Trek Holo — the original look: holographic cyan HUD on a near-black
 * ground, with corner brackets, an amber/violet capped header, and ambient
 * grid, scanline and sweep layers.
 *
 * `tokens` live in starTrekHolo.css, keyed off [data-ui-style='star-trek-holo'].
 * `roles` live here because SVG presentation attributes cannot resolve CSS
 * custom properties — see CLAUDE.md.
 */
const starTrekHolo = {
  id: 'star-trek-holo',
  name: 'Star Trek Holo',
  description: 'Holographic cyan HUD with amber and violet accents',

  /* Drives the native form-control rendering (date pickers, select arrows). */
  colorScheme: 'dark',

  Ambience,

  /* ── Diagram role contract ──
     Every style must supply all of these. Phase 2 makes the components read
     them from the active style; Phase 3 gives the PDF its own print specs so
     these never reach the report. */
  roles: {
    /* Widths and dashes are taken from what the diagrams drew before Phase 2,
       so this style renders exactly as it did — but they are the style's to
       change now, which is what lets a heavy blueprint style and a thin neon
       style draw the same section differently. */
    concreteStroke:    { color: '#7fe8ff', width: 1.8 },
    concreteFill:      { color: 'rgba(127, 232, 255, 0.07)' },
    stressBlockFill:   { color: 'rgba(255, 179, 71, 0.2)' },
    stressBlockStroke: { color: '#ffb347', width: 1, dash: '4,3' },
    hatchStroke:       { color: 'rgba(255, 179, 71, 0.45)', width: 0.8 },
    neutralAxis:       { color: '#5cffc0', width: 1.3, dash: '7,4' },
    tensionSteel:      { color: '#5cffc0', width: 2 },
    compressionSteel:  { color: '#b78bff', width: 2 },
    dotStroke:         { color: '#04121a', width: 1 },
    grid:              { color: 'rgba(127, 232, 255, 0.1)', width: 0.5 },
    axis:              { color: '#3d92a8', width: 1, dash: '3,3' },
    guide:             { color: 'rgba(127, 232, 255, 0.35)', width: 1, dash: '2,2' },
    series: ['#7fe8ff', '#b78bff', '#5cffc0', '#ffb347', '#ff6b7a', '#4fd8f5'],
  },
};

export default starTrekHolo;
