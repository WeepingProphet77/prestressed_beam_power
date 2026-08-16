import { useUiStyle } from '../styles/styleContext';
import { StyleDefs } from '../styles/StyleProvider';

/**
 * Biaxial φMx–φMy interaction diagram: strength envelope, cracking envelope,
 * factored-demand and service points, with NA-aligned φMnx/φMny anchors marked.
 */
export default function InteractionDiagram({ results }) {
  const roles = useUiStyle().roles;
  if (!results || results.mode !== 'biaxial') return null;
  const { envelope, anchors, demand, cracking } = results;

  const strength = envelope.map((p) => ({ x: p.phiMx, y: p.phiMy }));
  const crack = (cracking.envelope || []).map((p) => ({ x: p.Mx, y: p.My }));

  // Extent across both envelopes + demand/service points.
  const allPts = [
    ...strength, ...crack,
    ...(demand ? [{ x: demand.Mux, y: demand.Muy }] : []),
    { x: cracking == null ? 0 : (results.section.MxService || 0), y: results.section.MyService || 0 },
  ];
  const ext = Math.max(
    ...allPts.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))),
    1
  ) * 1.1;

  const SIZE = 360;
  const PAD = 28;
  const half = (SIZE - 2 * PAD) / 2;
  const cx = PAD + half;
  const cy = PAD + half;
  const sc = half / ext;
  const X = (mx) => cx + mx * sc;
  const Y = (my) => cy - my * sc;

  const toPath = (pts) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ') + ' Z';

  // Axis ticks (nice round numbers)
  const tickStep = niceStep(ext);
  const ticks = [];
  for (let v = tickStep; v < ext; v += tickStep) ticks.push(v);

  const sx = results.section.MxService || 0;
  const sy = results.section.MyService || 0;

  return (
    <div className="beam-diagram interaction-diagram">
      <h3>Biaxial Interaction (φMx–φMy)</h3>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" style={{ maxWidth: SIZE, display: 'block', margin: '0 auto' }}>
        <StyleDefs />
        {/* axes */}
        <line x1={PAD} y1={cy} x2={SIZE - PAD} y2={cy} data-role="axis" stroke={roles.axis.color} strokeWidth="1" />
        <line x1={cx} y1={PAD} x2={cx} y2={SIZE - PAD} data-role="axis" stroke={roles.axis.color} strokeWidth="1" />
        {ticks.map((v) => (
          <g key={v}>
            <line x1={X(v)} y1={cy - 3} x2={X(v)} y2={cy + 3} data-role="axis" stroke={roles.axis.color} />
            <line x1={X(-v)} y1={cy - 3} x2={X(-v)} y2={cy + 3} data-role="axis" stroke={roles.axis.color} />
            <line x1={cx - 3} y1={Y(v)} x2={cx + 3} y2={Y(v)} data-role="axis" stroke={roles.axis.color} />
            <line x1={cx - 3} y1={Y(-v)} x2={cx + 3} y2={Y(-v)} data-role="axis" stroke={roles.axis.color} />
          </g>
        ))}
        <text x={SIZE - PAD} y={cy - 6} className="diagram-label" textAnchor="end">+φMx</text>
        <text x={cx + 6} y={PAD + 8} className="diagram-label">+φMy</text>
        <text x={X(ticks[0] ?? 0)} y={cy + 14} className="diagram-label" fontSize="9">{(ticks[0] ?? 0).toFixed(0)}</text>

        {/* cracking envelope */}
        {crack.length > 2 && (
          <path d={toPath(crack)} fill="none" data-role="stressBlockStroke" stroke={roles.stressBlockStroke.color} strokeWidth="1.5" strokeDasharray="5,3" />
        )}

        {/* strength envelope */}
        <path d={toPath(strength)} fill="rgba(127,232,255,0.10)" data-role="concreteStroke" stroke={roles.concreteStroke.color} strokeWidth="1.8" />

        {/* NA-aligned anchors */}
        {[anchors.xSag, anchors.xHog, anchors.yPos, anchors.yNeg].map((a, i) => (
          <circle key={i} cx={X(a.phiMx)} cy={Y(a.phiMy)} r="3.5" data-role="tensionSteel" fill={roles.tensionSteel.color} stroke={roles.dotStroke.color} strokeWidth="1" />
        ))}

        {/* service point */}
        {(sx !== 0 || sy !== 0) && (
          <g>
            <circle cx={X(sx)} cy={Y(sy)} r="4" data-role="stressBlockStroke" fill={roles.stressBlockStroke.color} stroke={roles.dotStroke.color} strokeWidth="1" />
            <text x={X(sx) + 6} y={Y(sy) - 4} className="diagram-label" fontSize="9" data-role="stressBlockStroke" fill={roles.stressBlockStroke.color}>service</text>
          </g>
        )}

        {/* demand point + radial line */}
        {demand && (
          <g>
            <line x1={cx} y1={cy} x2={X(demand.Mux)} y2={Y(demand.Muy)} data-role="neutralAxis" stroke={roles.neutralAxis.color} strokeWidth="1" strokeDasharray="3,2" />
            <circle cx={X(demand.Mux)} cy={Y(demand.Muy)} r="4.5"
              fill={demand.pass ? roles.tensionSteel.color : roles.neutralAxis.color} data-role="dotStroke" stroke={roles.dotStroke.color} strokeWidth="1.5" />
            <text x={X(demand.Mux) + 6} y={Y(demand.Muy) + 4} className="diagram-label" fontSize="9" data-role="neutralAxis" fill={roles.neutralAxis.color}>
              demand
            </text>
          </g>
        )}

        {/* legend */}
        <g transform={`translate(${PAD}, ${SIZE - 6})`}>
          <line x1="0" y1="-4" x2="14" y2="-4" data-role="concreteStroke" stroke={roles.concreteStroke.color} strokeWidth="2" />
          <text x="18" y="-1" className="diagram-label legend-text">φMn strength</text>
          <line x1="100" y1="-4" x2="114" y2="-4" data-role="stressBlockStroke" stroke={roles.stressBlockStroke.color} strokeWidth="1.5" strokeDasharray="4,2" />
          <text x="118" y="-1" className="diagram-label legend-text">cracking</text>
        </g>
      </svg>
    </div>
  );
}

function niceStep(ext) {
  const raw = ext / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const step = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
  return step * mag;
}
