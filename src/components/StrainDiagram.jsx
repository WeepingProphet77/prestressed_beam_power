/**
 * Strain and stress distribution diagram across the beam depth.
 */
export default function StrainDiagram({ results }) {
  if (!results) return null;

  const { c, a, layerResults, section, Cc, ccCentroid } = results;
  const { h } = section;

  const width = 420;
  const height = 340;
  const margin = { top: 25, right: 20, bottom: 25, left: 25 };
  const beamW = 40;
  const gapStrain = 30;
  const gapStress = 40;

  const plotH = height - margin.top - margin.bottom;
  const yScale = (depth) => margin.top + (depth / h) * plotH;

  // Strain diagram dimensions
  const strainLeft = margin.left + beamW + gapStrain;
  const strainW = 120;
  const ecu = 0.003;

  // Find max tension strain for scaling
  const maxTensionStrain = Math.max(
    ...layerResults.map((lr) => Math.abs(lr.strain)),
    ecu
  );
  const strainScale = strainW / (maxTensionStrain + ecu);

  // Strain at top = -ecu (compression), strain at bottom = ecu*(h/c - 1)
  const topStrain = -ecu;
  const botStrain = ecu * (h / c - 1);

  // Zero strain x position
  const zeroX = strainLeft + ecu * strainScale;

  // Stress diagram dimensions
  const stressLeft = strainLeft + strainW + gapStress;
  const stressW = 100;

  return (
    <div className="strain-diagram">
      <h3>Strain &amp; Stress Distribution</h3>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width }}>
        {/* Beam outline */}
        <rect
          x={margin.left}
          y={margin.top}
          width={beamW}
          height={plotH}
          fill="#f1f5f9"
          stroke="#334155"
          strokeWidth="1.5"
        />

        {/* Stress block on beam */}
        <rect
          x={margin.left}
          y={margin.top}
          width={beamW}
          height={(a / h) * plotH}
          fill="#dbeafe"
          stroke="#3b82f6"
          strokeWidth="1"
        />

        {/* Neutral axis on beam */}
        <line
          x1={margin.left}
          y1={yScale(c)}
          x2={margin.left + beamW}
          y2={yScale(c)}
          stroke="#ef4444"
          strokeWidth="1.5"
          strokeDasharray="4,2"
        />

        {/* Steel dots on beam */}
        {layerResults.map((lr, i) => (
          <circle
            key={i}
            cx={margin.left + beamW / 2}
            cy={yScale(lr.depth)}
            r="3"
            fill={lr.strain > 0 ? '#22c55e' : '#f59e0b'}
            stroke="#1e293b"
            strokeWidth="0.8"
          />
        ))}

        {/* ─── Strain Diagram ─── */}
        <text x={strainLeft + strainW / 2} y={margin.top - 8} textAnchor="middle" className="diagram-title">
          Strain
        </text>

        {/* Vertical zero line */}
        <line
          x1={zeroX}
          y1={margin.top}
          x2={zeroX}
          y2={margin.top + plotH}
          stroke="#94a3b8"
          strokeWidth="0.8"
          strokeDasharray="3,2"
        />

        {/* Strain triangle */}
        <polygon
          points={`
            ${zeroX + topStrain * strainScale},${margin.top}
            ${zeroX},${yScale(c)}
            ${zeroX + botStrain * strainScale},${margin.top + plotH}
          `}
          fill="rgba(239,68,68,0.1)"
          stroke="#ef4444"
          strokeWidth="1.5"
        />

        {/* Strain value labels */}
        <text x={zeroX + topStrain * strainScale - 4} y={margin.top - 2} textAnchor="end" className="strain-value">
          {topStrain.toFixed(4)}
        </text>
        <text
          x={zeroX + botStrain * strainScale + 4}
          y={margin.top + plotH + 14}
          textAnchor="start"
          className="strain-value"
        >
          {botStrain.toFixed(4)}
        </text>

        {/* Layer strain indicators */}
        {layerResults.map((lr, i) => {
          const y = yScale(lr.depth);
          const x = zeroX + lr.strain * strainScale;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="3" fill="#ef4444" stroke="#fff" strokeWidth="1" />
              <line x1={zeroX} y1={y} x2={x} y2={y} stroke="#ef4444" strokeWidth="0.8" strokeDasharray="2,2" />
            </g>
          );
        })}

        {/* ─── Stress Diagram ─── */}
        <text x={stressLeft + stressW / 2} y={margin.top - 8} textAnchor="middle" className="diagram-title">
          Stress
        </text>

        {/* Rectangular stress block */}
        <rect
          x={stressLeft}
          y={margin.top}
          width={stressW * 0.7}
          height={(a / h) * plotH}
          fill="rgba(59,130,246,0.15)"
          stroke="#3b82f6"
          strokeWidth="1.5"
        />
        <text
          x={stressLeft + stressW * 0.7 + 4}
          y={margin.top + ((a / h) * plotH) / 2 + 4}
          className="stress-label"
        >
          0.85f&#x2032;<tspan baselineShift="sub" fontSize="8">c</tspan>
        </text>

        {/* Compression resultant arrow */}
        <g>
          <line
            x1={stressLeft + stressW * 0.85}
            y1={yScale(ccCentroid)}
            x2={stressLeft + stressW * 0.35}
            y2={yScale(ccCentroid)}
            stroke="#3b82f6"
            strokeWidth="2"
            markerEnd="url(#arrowBlue)"
          />
          <text
            x={stressLeft + stressW * 0.88}
            y={yScale(ccCentroid) + 4}
            className="force-label blue"
          >
            C<tspan baselineShift="sub" fontSize="8">c</tspan>
          </text>
        </g>

        {/* Steel force arrows */}
        {layerResults.map((lr, i) => {
          const y = yScale(lr.depth);
          const isTension = lr.force > 0;
          return (
            <g key={i}>
              <line
                x1={stressLeft + (isTension ? stressW * 0.35 : stressW * 0.85)}
                y1={y}
                x2={stressLeft + (isTension ? stressW * 0.85 : stressW * 0.35)}
                y2={y}
                stroke={isTension ? '#22c55e' : '#f59e0b'}
                strokeWidth="2"
                markerEnd={isTension ? 'url(#arrowGreen)' : 'url(#arrowAmber)'}
              />
              <text
                x={stressLeft + (isTension ? stressW * 0.88 : stressW * 0.88)}
                y={y + 4}
                className={`force-label ${isTension ? 'green' : 'amber'}`}
              >
                T<tspan baselineShift="sub" fontSize="8">{i + 1}</tspan>
              </text>
            </g>
          );
        })}

        {/* Arrow markers */}
        <defs>
          <marker id="arrowBlue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6" fill="#3b82f6" />
          </marker>
          <marker id="arrowGreen" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6" fill="#22c55e" />
          </marker>
          <marker id="arrowAmber" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6" fill="#f59e0b" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
