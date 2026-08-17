import starTrekHolo from './starTrekHolo';

/**
 * The UI Style registry.
 *
 * Adding a style is two steps: write `src/styles/<id>/index.js` (plus its CSS
 * and, optionally, Ambience and Defs components) and add it to this array. The
 * selector, the guardrail tests, and persistence all read from here, so
 * nothing else needs editing.
 *
 * Every entry must satisfy the contract in `styleContract.js`.
 */
const styles = [starTrekHolo];

export default styles;

export const DEFAULT_STYLE_ID = starTrekHolo.id;

/** Resolve an id to a style, falling back to the default for unknown ids. */
export function getStyle(id) {
  return styles.find((s) => s.id === id) || styles[0];
}
