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
    series: ['#7fe8ff', '#b78bff', '#5cffc0', '#ffb347', '#ff6b7a', '#4fd8f5'],
  },
};

export default starTrekHolo;
