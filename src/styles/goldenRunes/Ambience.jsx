import RUNES, { scatter } from './runes';

/* Fixed at module load so the scatter is stable across re-renders. */
const MARKS = scatter(26, 20240816);

/**
 * Golden Runes ambience: a drifting gold haze with runes scattered through it.
 *
 * Three stacked layers, which is the point of ambience being a component — as
 * `body::before`/`::after` there were only two slots and both were already
 * spent.
 *
 * Motion is dropped entirely when the user asks for reduced motion; the runes
 * and haze remain, they simply hold still.
 */
export default function Ambience({ reducedMotion }) {
  return (
    <>
      <div className="gr-haze" />
      <div className="gr-emberglow" />
      <svg
        className={`gr-runes${reducedMotion ? ' gr-runes-still' : ''}`}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {MARKS.map((m, i) => (
          <g
            key={i}
            transform={`translate(${m.x} ${m.y}) rotate(${m.rotate}) scale(${m.size * 0.1})`}
            opacity={m.opacity}
            style={
              reducedMotion
                ? undefined
                : { animationDuration: `${m.drift}s`, animationDelay: `${m.delay}s` }
            }
          >
            <path d={RUNES[m.name]} />
          </g>
        ))}
      </svg>
    </>
  );
}
