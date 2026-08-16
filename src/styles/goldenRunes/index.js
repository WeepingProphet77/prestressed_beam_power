import Ambience from './Ambience';
import Defs from './Defs';
import './goldenRunes.css';

/**
 * Golden Runes — aged gold linework on a dark, warm ground, with Norse runes
 * drifting through a gold haze.
 *
 * The second style, and the one that proves the system: it shares nothing with
 * Star Trek Holo but the token names and the role contract. Serif rather than
 * monospace, softened corners rather than square, gilded rules rather than
 * corner brackets, haze rather than scanlines, and airier spacing.
 *
 * Two roles take a gradient rather than a color — `url(#gr-shimmer)` from this
 * style's own <defs>. That is deliberate: it exercises the parts of the design
 * that exist only for effects like this, and it is safe precisely because the
 * report resolves print colors from the role, so the shimmer can never reach
 * the PDF.
 */
const goldenRunes = {
  id: 'golden-runes',
  name: 'Golden Runes',
  description: 'Aged gold linework and drifting runes on a dark ground',

  colorScheme: 'dark',

  Ambience,
  Defs,

  roles: {
    /* Dashes are irregular on purpose — lines broken and cracked with age
       rather than evenly ticked. */
    concreteStroke: { color: 'url(#gr-shimmer)', width: 2, dash: '17,3,4,3,9,4' },
    concreteFill: { color: 'rgba(217, 164, 65, 0.05)' },
    stressBlockFill: { color: 'rgba(224, 139, 51, 0.18)' },
    stressBlockStroke: { color: '#e08b33', width: 1.2, dash: '7,3,2,3' },
    hatchStroke: { color: 'rgba(217, 164, 65, 0.38)', width: 0.9 },
    neutralAxis: { color: '#6fae86', width: 1.4, dash: '11,4,3,4' },
    tensionSteel: { color: 'url(#gr-gold)', width: 2.2 },
    compressionSteel: { color: '#cfc3a0', width: 2.2 },
    dotStroke: { color: '#14100a', width: 1 },
    grid: { color: 'rgba(217, 164, 65, 0.09)', width: 0.5 },
    axis: { color: '#8a6a35', width: 1, dash: '4,3' },
    guide: { color: 'rgba(207, 195, 160, 0.3)', width: 1, dash: '2,3' },
    series: ['#d9a441', '#cfc3a0', '#6fae86', '#e08b33', '#c8543a', '#a97f34'],
  },
};

export default goldenRunes;
