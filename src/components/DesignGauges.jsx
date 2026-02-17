/**
 * Dashboard-style horizontal bar gauges showing key design values at a glance.
 * Each gauge shows colored zones, threshold markers with labels, and a needle
 * indicating the current value.
 */
import { useMemo } from 'react';

// Straight-line phi: ϕ (U+03D5)
const PHI = '\u03D5';

/* ── Horizontal bar gauge ── */
function BarGauge({ title, value, displayValue, zones, markers, needleLabel }) {
  // zones: [{ start, end, color, label }] — defines colored bands
  // markers: [{ value: number, label: string }] — tick marks with labels
  // The full range is derived from zones
  const rangeMin = zones[0].start;
  const rangeMax = zones[zones.length - 1].end;
  const range = rangeMax - rangeMin;

  const toPercent = (v) => Math.max(0, Math.min(100, ((v - rangeMin) / range) * 100));
  const needlePos = toPercent(value);

  // Determine needle color from zones
  let needleColor = '#1e293b';
  for (const z of zones) {
    if (value >= z.start && value <= z.end) {
      needleColor = z.color;
      break;
    }
  }

  return (
    <div className="hbar-gauge">
      <div className="hbar-title-row">
        <span className="hbar-title" dangerouslySetInnerHTML={{ __html: title }} />
        <span className="hbar-readout" style={{ color: needleColor }}>{displayValue}</span>
      </div>

      {/* Zone labels */}
      <div className="hbar-zone-labels">
        {zones.map((z, i) => {
          const left = toPercent(z.start);
          const width = toPercent(z.end) - left;
          return (
            <span
              key={i}
              className="hbar-zone-label"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                color: z.color,
              }}
            >
              {z.label}
            </span>
          );
        })}
      </div>

      {/* Track with colored zones */}
      <div className="hbar-track">
        {zones.map((z, i) => {
          const left = toPercent(z.start);
          const width = toPercent(z.end) - left;
          return (
            <div
              key={i}
              className="hbar-zone"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: z.color,
              }}
            />
          );
        })}

        {/* Needle */}
        <div
          className="hbar-needle"
          style={{ left: `${needlePos}%` }}
        >
          <div className="hbar-needle-line" style={{ backgroundColor: needleColor }} />
          <div className="hbar-needle-diamond" style={{ borderBottomColor: needleColor }} />
        </div>
      </div>

      {/* Marker ticks and labels below the bar */}
      <div className="hbar-markers">
        {markers.map((m, i) => {
          const pos = toPercent(m.value);
          return (
            <div
              key={i}
              className="hbar-marker"
              style={{ left: `${pos}%` }}
            >
              <div className="hbar-marker-tick" />
              <span
                className="hbar-marker-label"
                dangerouslySetInnerHTML={{ __html: m.label }}
              />
            </div>
          );
        })}
      </div>

      {/* Needle value callout */}
      {needleLabel && (
        <div className="hbar-needle-callout" style={{ left: `${needlePos}%` }}>
          <span
            className="hbar-callout-text"
            style={{ borderColor: needleColor, color: needleColor }}
            dangerouslySetInnerHTML={{ __html: needleLabel }}
          />
        </div>
      )}
    </div>
  );
}

/* ── Status badge ── */
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

  // Extreme tension layer
  const extremeLayer = useMemo(() => {
    let ext = layerResults[0];
    for (const lr of layerResults) {
      if (lr.depth > ext.depth) ext = lr;
    }
    return ext;
  }, [layerResults]);

  const epsilonTy = extremeLayer ? extremeLayer.steel.fpy / extremeLayer.steel.Es : 0.002;
  const tensionLimit = epsilonTy + 0.003;

  // Steel stress utilization
  const stressCap = extremeLayer?.steel?.stressCap || extremeLayer?.steel?.fpu || extremeLayer?.steel?.fpy;
  const fpy = extremeLayer?.steel?.fpy || 60;

  // Ductility
  const ductilityStatus = ductile ? 'pass' : transition ? 'warn' : 'fail';
  const ductilityLabel = ductile
    ? 'Tension-Controlled'
    : transition
    ? 'Transition Zone'
    : 'Compression-Controlled';

  // 1.2Mcr check
  const hasCracking = !!cracking;

  // Strain gauge range — extend past actual value
  const strainMax = Math.max(epsilonT * 1.25, tensionLimit * 1.4, 0.01);

  return (
    <div className="design-gauges">
      {/* Hero value */}
      <div className="gauge-hero">
        <div className="hero-label">{PHI}M<sub>n</sub> &mdash; Design Moment Strength</div>
        <div className="hero-value">{phiMnFt.toFixed(1)} <span className="hero-unit">kip-ft</span></div>
        <div className="hero-sub">{phiMn.toFixed(1)} kip-in &nbsp;|&nbsp; M<sub>n</sub> = {MnFt.toFixed(1)} kip-ft</div>
      </div>

      {/* Horizontal bar gauges */}
      <div className="hbar-gauges-stack">

        {/* Strain Classification */}
        <BarGauge
          title="Section Strain Classification"
          value={epsilonT}
          displayValue={`${PHI}<sub>t</sub> = ${epsilonT.toFixed(5)}`}
          zones={[
            { start: 0, end: epsilonTy, color: '#ef4444', label: 'Compression' },
            { start: epsilonTy, end: tensionLimit, color: '#f59e0b', label: 'Transition' },
            { start: tensionLimit, end: strainMax, color: '#22c55e', label: 'Tension' },
          ]}
          markers={[
            { value: 0, label: '0' },
            { value: epsilonTy, label: `&epsilon;<sub>ty</sub> = ${epsilonTy.toFixed(4)}` },
            { value: tensionLimit, label: `&epsilon;<sub>ty</sub>+0.003 = ${tensionLimit.toFixed(4)}` },
            { value: strainMax, label: strainMax.toFixed(4) },
          ]}
          needleLabel={`&epsilon;<sub>t</sub> = ${epsilonT.toFixed(5)}`}
        />

        {/* Phi Factor */}
        <BarGauge
          title={`Strength Reduction Factor, ${PHI}`}
          value={phi}
          displayValue={`${PHI} = ${phi.toFixed(3)}`}
          zones={[
            { start: 0.65, end: 0.65 + (0.90 - 0.65) * 0.01, color: '#ef4444', label: 'Comp.' },
            { start: 0.65 + (0.90 - 0.65) * 0.01, end: 0.90 - (0.90 - 0.65) * 0.01, color: '#f59e0b', label: 'Transition' },
            { start: 0.90 - (0.90 - 0.65) * 0.01, end: 0.90, color: '#22c55e', label: 'Tension' },
          ]}
          markers={[
            { value: 0.65, label: '0.65' },
            { value: 0.75, label: '0.75' },
            { value: 0.90, label: '0.90' },
          ]}
          needleLabel={`${PHI} = ${phi.toFixed(3)}`}
        />

        {/* c/dt Ratio */}
        <BarGauge
          title="Neutral Axis Depth Ratio, c/d<sub>t</sub>"
          value={cOverD}
          displayValue={`c/d<sub>t</sub> = ${cOverD.toFixed(4)}`}
          zones={[
            { start: 0, end: 0.375, color: '#22c55e', label: 'Tension-Controlled' },
            { start: 0.375, end: 0.6, color: '#f59e0b', label: 'Transition' },
            { start: 0.6, end: Math.max(0.8, cOverD * 1.15), color: '#ef4444', label: 'Compression' },
          ]}
          markers={[
            { value: 0, label: '0' },
            { value: 0.375, label: '0.375' },
            { value: 0.6, label: '0.600' },
            { value: Math.max(0.8, cOverD * 1.15), label: Math.max(0.8, cOverD * 1.15).toFixed(2) },
          ]}
          needleLabel={`c/d<sub>t</sub> = ${cOverD.toFixed(4)}`}
        />

        {/* Steel Stress */}
        <BarGauge
          title="Extreme Tension Steel Stress, f<sub>ps</sub>"
          value={extremeLayer.stress}
          displayValue={`f<sub>ps</sub> = ${extremeLayer.stress.toFixed(1)} ksi`}
          zones={[
            { start: 0, end: fpy, color: '#3b82f6', label: 'Elastic' },
            { start: fpy, end: stressCap, color: '#22c55e', label: 'Inelastic' },
            { start: stressCap, end: stressCap * 1.05, color: '#ef4444', label: 'Cap' },
          ]}
          markers={[
            { value: 0, label: '0' },
            { value: fpy, label: `f<sub>py</sub> = ${fpy}` },
            { value: stressCap, label: `f<sub>pu</sub> = ${stressCap}` },
          ]}
          needleLabel={`${extremeLayer.stress.toFixed(1)} ksi (${((extremeLayer.stress / stressCap) * 100).toFixed(0)}%)`}
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
            label={`${PHI}M<sub>n</sub> &ge; 1.2 M<sub>cr</sub>`}
            status={cracking.passesMinStrength ? 'pass' : 'fail'}
            detail={
              cracking.passesMinStrength
                ? `${phiMnFt.toFixed(1)} \u2265 ${cracking.thresholdFt.toFixed(1)} kip-ft`
                : `${phiMnFt.toFixed(1)} < ${cracking.thresholdFt.toFixed(1)} kip-ft`
            }
          />
        )}
      </div>
    </div>
  );
}
