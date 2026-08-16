import starTrekHolo from './starTrekHolo';
import goldenRunes from './goldenRunes';

/**
 * The UI Style registry.
 *
 * Adding a style is two steps: write `src/styles/<id>/index.js` (plus its CSS
 * and, optionally, an Ambience component) and add it to this array. The
 * selector, the guardrail tests, and persistence all read from here, so
 * nothing else needs editing.
 *
 * Every entry must satisfy the contract in `styleContract.js`.
 */
const styles = [starTrekHolo, goldenRunes];

export default styles;

export const DEFAULT_STYLE_ID = starTrekHolo.id;

/** Resolve an id to a style, falling back to the default for unknown ids. */
export function getStyle(id) {
  return styles.find((s) => s.id === id) || styles[0];
}
