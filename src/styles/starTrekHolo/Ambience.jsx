/**
 * Star Trek Holo ambience: engineering grid, CRT scanlines, and a travelling
 * scan sweep.
 *
 * These were `body::before` / `body::after` plus a hardcoded div. As real
 * elements owned by the style they no longer consume the document's two
 * pseudo-element slots, so a style may stack as many layers as it likes — or
 * render nothing at all.
 *
 * Motion is suppressed under `prefers-reduced-motion` by the style's CSS, and
 * the shell also refuses to mount motion layers when the user asks for reduced
 * motion, so this never has to be remembered per style.
 */
export default function Ambience({ reducedMotion }) {
  return (
    <>
      <div className="sth-grid" />
      <div className="sth-scanlines" />
      {!reducedMotion && <div className="sth-sweep" />}
    </>
  );
}
