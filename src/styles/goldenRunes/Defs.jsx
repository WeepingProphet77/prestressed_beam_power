/**
 * Golden Runes' SVG defs, rendered inside each diagram's own <svg>.
 *
 * This is what a role means when its color is `url(#gr-shimmer)`: shimmer and
 * cracking are not colors, they are a gradient and a filter, so the style has
 * to be able to contribute them to the drawing.
 *
 * These must stay local to each svg rather than living in one shared sprite —
 * the report clones a single diagram and serializes it standalone, so a
 * url(#…) pointing elsewhere in the document would resolve on screen and break
 * in the PDF. (The report never inks these anyway; it resolves by role.)
 */
export default function Defs() {
  return (
    <defs>
      {/* Gold that catches the light as it travels along the stroke. */}
      <linearGradient id="gr-shimmer" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#8a6a35" />
        <stop offset="42%" stopColor="#d9a441" />
        <stop offset="50%" stopColor="#fff3d0" />
        <stop offset="58%" stopColor="#d9a441" />
        <stop offset="100%" stopColor="#8a6a35" />
        <animateTransform
          attributeName="gradientTransform"
          type="translate"
          values="-1 0; 1 0; -1 0"
          dur="6s"
          repeatCount="indefinite"
        />
      </linearGradient>

      {/* The same gold, still — used where motion would be noise. */}
      <linearGradient id="gr-gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f2c14e" />
        <stop offset="100%" stopColor="#a97f34" />
      </linearGradient>

      {/* Age: nudges an edge off true so lines read as cracked rather than
          merely dashed. Kept low-frequency and small — feTurbulence is the
          most expensive thing this style does. */}
      <filter id="gr-crackle" x="-8%" y="-8%" width="116%" height="116%">
        <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="7" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </defs>
  );
}
