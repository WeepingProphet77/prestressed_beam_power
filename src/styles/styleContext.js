import { createContext, useContext } from 'react';

/**
 * Context for the active UI style.
 *
 * Kept separate from StyleProvider.jsx so that file exports only components —
 * mixing components and hooks in one module breaks React Fast Refresh.
 */
export const StyleContext = createContext(null);

/** Access the active style. Diagram components use `.roles`. */
export function useUiStyle() {
  const ctx = useContext(StyleContext);
  if (!ctx) throw new Error('useUiStyle must be used inside a StyleProvider');
  return ctx;
}
