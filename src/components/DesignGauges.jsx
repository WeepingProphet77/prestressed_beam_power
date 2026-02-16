/**
 * Dashboard-style arc gauges showing key design values at a glance.
 * Displayed prominently before the detailed (collapsible) calculations.
 */
import { useMemo } from 'react';

/* ── SVG arc helper ── */
function describeArc(cx, cy, r, startAngle, endAngle) {
  const rad = (a) => ((a - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(rad(startAngle));
  const y1 = cy + r * Math.sin(rad(startAngle));
  const x2 = cx + r * Math.cos(rad(endAngle));
  const y2 = cy + r * Math.sin(rad(endAngle));
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

/* ── Single arc gauge ── */
function ArcGauge({ label, value, displayValue, unit, min, max, thresholds, size = 120 }) {
  const ARC_START = -120;
  const ARC_END = 120;
  const ARC_RANGE = ARC_END - ARC_START; // 240 degrees

  const r = size * 0.38;
  const cx = size / 2;
  const cy = size * 0.48;
  const strokeW = size * 0.075;

  // Clamp ratio 0..1
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const valueAngle = ARC_START + ratio * ARC_RANGE;

  // Determine color from thresholds: [{limit, color}] sorted ascending
  let color = thresholds[thresholds.length - 1].color;
  for (const t of thresholds) {
    if (value <= t.limit) {
      color = t.color;
      break;
    }
  }

  // Build gradient tick marks for the background arc
  const bgPath = describeArc(cx, cy, r, ARC_START, ARC_END);
  const valuePath = ratio > 0.005 ? describeArc(cx, cy, r, ARC_START, valueAngle) : '';

  return (
    <div className="gauge-item">
      <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`}>
        {/* Background track */}
        <path
          d={bgPath}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeW}
          strokeLinecap="round"
        />

        {/* Colored threshold zones on track (subtle) */}
        {thresholds.map((t, i) => {
          const zoneStart = i === 0 ? min : thresholds[i - 1].limit;
          const zoneEnd = t.limit;
          const startRatio = Math.max(0, (zoneStart - min) / (max - min));
          const endRatio = Math.min(1, (zoneEnd - min) / (max - min));
          const a1 = ARC_START + startRatio * ARC_RANGE;
          const a2 = ARC_START + endRatio * ARC_RANGE;
          if (endRatio <= startRatio) return null;
          return (
            <path
              key={i}
              d={describeArc(cx, cy, r, a1, a2)}
              fill="none"
              stroke={t.color}
              strokeWidth={strokeW}
              strokeLinecap="butt"
              opacity={0.15}
            />
          );
        })}

        {/* Value arc */}
        {valuePath && (
          <path
            d={valuePath}
            fill="none"
            stroke={color}
            strokeWidth={strokeW}
            strokeLinecap="round"
          />
        )}

        {/* Value text */}
        <text
          x={cx}
          y={cy + size * 0.02}
          textAnchor="middle"
          dominantBaseline="middle"
          className="gauge-value-text"
          style={{ fontSize: size * 0.17, fill: color }}
        >
          {displayValue}
        </text>

        {/* Unit text */}
        {unit && (
          <text
            x={cx}
            y={cy + size * 0.15}
            textAnchor="middle"
            dominantBaseline="middle"
            className="gauge-unit-text"
            style={{ fontSize: size * 0.09 }}
          >
            {unit}
          </text>
        )}
      </svg>
      <div className="gauge-label" dangerouslySetInnerHTML={{ __html: label }} />
    </div>
  );
}

/* ── Status badge (for pass/fail type indicators) ── */
function StatusBadge({ label, status, detail }) {
  const cls = status === 'pass' ? 'badge-pass' : status === 'warn' ? 'badge-warn' : 'badge-fail';
  const icon = status === 'pass' ? '\u2713' : status === 'warn' ? '\u26A0' : '\u2717';
  return (
    <div className={`gauge-badge ${cls}`}>
      <span className="badge-icon">{icon}</span>
      <div className="badge-content">
        <span className="badge-label" dangerouslySetInnerHTML={{ __html: label }} />
        <span className="badge-detail">{detail}</span>
      </div>
    </div>
  );
}

/* ── Main component ── */
export default function DesignGauges({ results }) {
  if (!results) return null;

  const {
    phiMnFt,
    phiMn,
    MnFt,
    phi,
    epsilonT,
    cOverD,
    ductile,
    transition,
    layerResults,
    cracking,
  } = results;

  // Extreme tension layer info
  const extremeLayer = useMemo(() => {
    let ext = layerResults[0];
    for (const lr of layerResults) {
      if (lr.depth > ext.depth) ext = lr;
    }
    return ext;
  }, [layerResults]);

  const epsilonTy = extremeLayer ? extremeLayer.steel.fpy / extremeLayer.steel.Es : 0.002;

  // Steel stress utilization (extreme layer)
  const stressCap = extremeLayer?.steel?.stressCap || extremeLayer?.steel?.fpu || extremeLayer?.steel?.fpy;
  const stressUtil = stressCap ? (extremeLayer.stress / stressCap) * 100 : 0;

  // Ductility info
  const ductilityStatus = ductile ? 'pass' : transition ? 'warn' : 'fail';
  const ductilityLabel = ductile
    ? 'Tension-Controlled'
    : transition
    ? 'Transition Zone'
    : 'Compression-Controlled';

  // 1.2Mcr check
  const hasCracking = !!cracking;
  const mcrRatio = hasCracking ? (phiMnFt / cracking.thresholdFt) * 100 : null;

  return (
    <div className="design-gauges">
      {/* Hero value */}
      <div className="gauge-hero">
        <div className="hero-label">&phi;M<sub>n</sub> &mdash; Design Moment Strength</div>
        <div className="hero-value">{phiMnFt.toFixed(1)} <span className="hero-unit">kip-ft</span></div>
        <div className="hero-sub">{phiMn.toFixed(1)} kip-in &nbsp;|&nbsp; M<sub>n</sub> = {MnFt.toFixed(1)} kip-ft</div>
      </div>

      {/* Gauge grid */}
      <div className="gauge-grid">
        <ArcGauge
          label="&phi; Factor"
          value={phi}
          displayValue={phi.toFixed(2)}
          min={0.60}
          max={0.95}
          thresholds={[
            { limit: 0.70, color: '#ef4444' },
            { limit: 0.80, color: '#f59e0b' },
            { limit: 0.95, color: '#22c55e' },
          ]}
        />

        <ArcGauge
          label="Net Tensile Strain &epsilon;<sub>t</sub>"
          value={epsilonT}
          displayValue={epsilonT.toFixed(4)}
          min={0}
          max={Math.max(epsilonT * 1.5, epsilonTy + 0.006)}
          thresholds={[
            { limit: epsilonTy, color: '#ef4444' },
            { limit: epsilonTy + 0.003, color: '#f59e0b' },
            { limit: Infinity, color: '#22c55e' },
          ]}
        />

        <ArcGauge
          label="c / d<sub>t</sub> Ratio"
          value={cOverD}
          displayValue={cOverD.toFixed(3)}
          min={0}
          max={0.8}
          thresholds={[
            { limit: 0.375, color: '#22c55e' },
            { limit: 0.6, color: '#f59e0b' },
            { limit: Infinity, color: '#ef4444' },
          ]}
        />

        <ArcGauge
          label="Steel Stress Utilization"
          value={stressUtil}
          displayValue={`${stressUtil.toFixed(0)}%`}
          unit={`${extremeLayer.stress.toFixed(0)} / ${stressCap.toFixed(0)} ksi`}
          min={0}
          max={110}
          thresholds={[
            { limit: 50, color: '#3b82f6' },
            { limit: 85, color: '#22c55e' },
            { limit: 100, color: '#f59e0b' },
            { limit: Infinity, color: '#ef4444' },
          ]}
        />
      </div>

      {/* Status badges */}
      <div className="gauge-badges">
        <StatusBadge
          label="Ductility"
          status={ductilityStatus}
          detail={ductilityLabel}
        />
        {hasCracking && (
          <StatusBadge
            label="&phi;M<sub>n</sub> &ge; 1.2 M<sub>cr</sub>"
            status={cracking.passesMinStrength ? 'pass' : 'fail'}
            detail={
              cracking.passesMinStrength
                ? `${phiMnFt.toFixed(1)} \u2265 ${cracking.thresholdFt.toFixed(1)} kip-ft`
                : `${phiMnFt.toFixed(1)} < ${cracking.thresholdFt.toFixed(1)} kip-ft`
            }
          />
        )}
        {hasCracking && (
          <ArcGauge
            label="M<sub>cr</sub> Margin"
            value={mcrRatio}
            displayValue={`${mcrRatio.toFixed(0)}%`}
            unit={`of 1.2 M\u2091\u2099`}
            min={0}
            max={200}
            size={120}
            thresholds={[
              { limit: 100, color: '#ef4444' },
              { limit: 120, color: '#f59e0b' },
              { limit: Infinity, color: '#22c55e' },
            ]}
          />
        )}
      </div>
    </div>
  );
}
