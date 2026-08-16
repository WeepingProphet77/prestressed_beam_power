/**
 * The contract every registered UI style must satisfy.
 *
 * Kept as data rather than prose so the Phase 5 guardrail tests can check a
 * new style mechanically instead of relying on review. A style that omits a
 * role fails a test rather than rendering an invisible diagram.
 */

/** Roles that carry a single color value. */
export const COLOR_ROLES = [
  'concreteStroke',
  'concreteFill',
  'stressBlockFill',
  'stressBlockStroke',
  'hatchStroke',
  'neutralAxis',
  'tensionSteel',
  'compressionSteel',
  'dotStroke',
  'grid',
  'axis',
  'guide',
];

/** Roles that carry a list of colors. */
export const LIST_ROLES = ['series'];

/** How many entries `series` needs — one per steel preset curve. */
export const SERIES_LENGTH = 6;

/** Keys a registry entry must define. */
export const REQUIRED_KEYS = ['id', 'name', 'description', 'colorScheme', 'roles'];

/** Style ids appear in localStorage and (later) URLs, so keep them slug-safe. */
export const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Validate one style. Returns an array of human-readable problems, empty when
 * the style is well-formed.
 */
export function validateStyle(style) {
  const problems = [];
  if (!style || typeof style !== 'object') return ['style is not an object'];

  for (const key of REQUIRED_KEYS) {
    if (style[key] === undefined) problems.push(`missing "${key}"`);
  }
  if (style.id !== undefined && !ID_PATTERN.test(style.id)) {
    problems.push(`id "${style.id}" is not slug-safe`);
  }
  if (style.colorScheme !== undefined && !['light', 'dark'].includes(style.colorScheme)) {
    problems.push(`colorScheme must be "light" or "dark", got "${style.colorScheme}"`);
  }
  if (style.Ambience !== undefined && typeof style.Ambience !== 'function') {
    problems.push('Ambience must be a component');
  }

  const roles = style.roles || {};
  for (const role of COLOR_ROLES) {
    if (typeof roles[role] !== 'string' || !roles[role].trim()) {
      problems.push(`role "${role}" is missing`);
    }
  }
  for (const role of LIST_ROLES) {
    if (!Array.isArray(roles[role])) problems.push(`role "${role}" must be an array`);
  }
  if (Array.isArray(roles.series) && roles.series.length < SERIES_LENGTH) {
    problems.push(`series needs ${SERIES_LENGTH} colors, got ${roles.series.length}`);
  }

  return problems;
}
