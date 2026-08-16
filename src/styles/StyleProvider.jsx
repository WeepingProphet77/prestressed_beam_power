import { useEffect, useMemo, useState } from 'react';
import styles, { DEFAULT_STYLE_ID, getStyle } from './registry';
import { StyleContext, useUiStyle } from './styleContext';

const STORAGE_KEY = 'ui-style';

/** Read the stored preference, tolerating unavailable or poisoned storage. */
function readStoredId() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && styles.some((s) => s.id === stored) ? stored : DEFAULT_STYLE_ID;
  } catch {
    /* Storage throws in some private modes; the default is a fine answer. */
    return DEFAULT_STYLE_ID;
  }
}

/** Track the OS "reduce motion" setting so no style can override it. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return undefined;
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

export function StyleProvider({ children }) {
  const [styleId, setStyleId] = useState(readStoredId);
  const reducedMotion = usePrefersReducedMotion();
  const style = getStyle(styleId);

  /* The attribute is what the CSS token blocks key off, and color-scheme keeps
     native controls (date pickers, select arrows) matching the style. */
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-ui-style', style.id);
    root.style.colorScheme = style.colorScheme;
    try {
      window.localStorage.setItem(STORAGE_KEY, style.id);
    } catch {
      /* The preference simply will not persist; not worth failing over. */
    }
  }, [style]);

  const value = useMemo(
    () => ({ style, styleId: style.id, setStyleId, styles, roles: style.roles, reducedMotion }),
    [style, reducedMotion]
  );

  return <StyleContext.Provider value={value}>{children}</StyleContext.Provider>;
}

/**
 * Renders the active style's ambience into one fixed, non-interactive layer.
 * A style with no ambience renders nothing.
 */
export function StyleAmbience() {
  const { style, reducedMotion } = useUiStyle();
  const Ambience = style.Ambience;
  if (!Ambience) return null;
  return (
    <div className="ui-ambience" aria-hidden="true">
      <Ambience reducedMotion={reducedMotion} />
    </div>
  );
}
