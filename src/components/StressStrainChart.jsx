import { generateStressStrainCurve } from '../utils/beamCalculations';
import steelPresets from '../data/steelPresets';

/**
 * SVG stress-strain chart showing the power formula curves for all steel types
 * and overlaying the operating points from the current analysis.
 */
export default function StressStrainChart({ results }) {
  const width = 560;
  const height = 380;
  const margin = { top: 30, right: 20, bottom: 55, left: 65 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  // Generate curves for all presets
  const curves = steelPresets.map((preset) => ({
    preset,
    points: generateStressStrainCurve(preset, 150),
  }));

  // Determine axis ranges
  const maxStrain = 0.05;
  const maxStress = 300;

  const xScale = (val) => margin.left + (val / maxStrain) * plotW;
  const yScale = (val) => margin.top + plotH - (val / maxStress) * plotH;

  // Colors for each curve
  const colors = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#10b981'];

  // Grid lines
  const xTicks = [0, 0.005, 0.01, 0.015, 0.02, 0.025, 0.03, 0.035, 0.04, 0.045, 0.05];
  const yTicks = [0, 50, 100, 150, 200, 250, 300];

  return (
    <div className="stress-strain-chart">
      <h3>Steel Stress-Strain Curves (Power Formula)</h3>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ maxWidth: width }}>
        {/* Grid */}
        {xTicks.map((t) => (
          <line
            key={`xg-${t}`}
            x1={xScale(t)}
            y1={margin.top}
            x2={xScale(t)}
            y2={margin.top + plotH}
            stroke="#e2e8f0"
            strokeWidth="0.5"
          />
        ))}
        {yTicks.map((t) => (
          <line
            key={`yg-${t}`}
            x1={margin.left}
            y1={yScale(t)}
            x2={margin.left + plotW}
            y2={yScale(t)}
            stroke="#e2e8f0"
            strokeWidth="0.5"
          />
        ))}

        {/* Axes */}
        <line
          x1={margin.left}
          y1={margin.top + plotH}
          x2={margin.left + plotW}
          y2={margin.top + plotH}
          stroke="#334155"
          strokeWidth="1.5"
        />
        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={margin.top + plotH}
          stroke="#334155"
          strokeWidth="1.5"
        />

        {/* Axis labels */}
        <text
          x={margin.left + plotW / 2}
          y={height - 8}
          textAnchor="middle"
          className="chart-axis-label"
        >
          Strain, &#949;<tspan baselineShift="sub" fontSize="9">s</tspan>
        </text>
        <text
          x={14}
          y={margin.top + plotH / 2}
          textAnchor="middle"
          className="chart-axis-label"
          transform={`rotate(-90, 14, ${margin.top + plotH / 2})`}
        >
          Stress, f<tspan baselineShift="sub" fontSize="9">s</tspan> (ksi)
        </text>

        {/* Tick labels */}
        {xTicks.map((t) => (
          <text key={`xt-${t}`} x={xScale(t)} y={margin.top + plotH + 16} textAnchor="middle" className="chart-tick">
            {t.toFixed(3)}
          </text>
        ))}
        {yTicks.map((t) => (
          <text key={`yt-${t}`} x={margin.left - 8} y={yScale(t) + 4} textAnchor="end" className="chart-tick">
            {t}
          </text>
        ))}

        {/* Curves */}
        {curves.map(({ preset, points }, ci) => {
          const d = points
            .map((p, i) => {
              const x = xScale(p.strain);
              const y = yScale(p.stress);
              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            })
            .join(' ');
          return (
            <path
              key={preset.id}
              d={d}
              fill="none"
              stroke={colors[ci % colors.length]}
              strokeWidth="2"
              opacity="0.85"
            />
          );
        })}

        {/* Operating points from analysis */}
        {results &&
          results.layerResults.map((lr, idx) => {
            if (lr.strain <= 0) return null;
            const x = xScale(lr.strain);
            const y = yScale(Math.abs(lr.stress));
            return (
              <g key={idx}>
                <circle cx={x} cy={y} r="5" fill="#ef4444" stroke="#fff" strokeWidth="1.5" />
                <text x={x + 8} y={y - 6} className="chart-point-label">
                  L<tspan baselineShift="sub" fontSize="8">{idx + 1}</tspan>
                </text>
              </g>
            );
          })}

        {/* Legend */}
        {curves.map(({ preset }, ci) => {
          const lx = margin.left + 10;
          const ly = margin.top + 12 + ci * 16;
          return (
            <g key={`leg-${preset.id}`}>
              <line
                x1={lx}
                y1={ly}
                x2={lx + 20}
                y2={ly}
                stroke={colors[ci % colors.length]}
                strokeWidth="2.5"
              />
              <text x={lx + 25} y={ly + 4} className="chart-legend-text">
                {preset.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
