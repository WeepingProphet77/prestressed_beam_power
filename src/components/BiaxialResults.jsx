/**
 * Tabular results for biaxial bending: NA-aligned capacities, demand
 * utilization, and the biaxial cracking check.
 */
function fmt(v, d = 1) {
  return v == null ? '—' : v.toFixed(d);
}

export default function BiaxialResults({ results }) {
  if (!results || results.mode !== 'biaxial') return null;
  const { anchors, demand, cracking, props } = results;

  const U = demand ? demand.utilization : null;
  const pass = demand ? demand.pass : null;

  return (
    <div className="results-panel biaxial-results">
      <h2>Biaxial Flexural Results</h2>

      {demand && (
        <div className={`util-banner ${pass ? 'ok' : 'fail'}`}>
          <div className="util-big">{(U * 100).toFixed(0)}%</div>
          <div>
            <strong>{pass ? 'Demand within envelope' : 'Demand exceeds capacity'}</strong>
            <p>
              φMn capacity along the demand direction = {fmt(demand.capacity)} kip-ft;
              demand = {fmt(demand.magnitude)} kip-ft (M<sub>ux</sub>={fmt(demand.Mux)}, M<sub>uy</sub>={fmt(demand.Muy)}).
            </p>
          </div>
        </div>
      )}

      <h3>NA-aligned capacities (consistent with uniaxial analysis)</h3>
      <table className="results-table">
        <thead>
          <tr><th>Orientation</th><th>φMx (k-ft)</th><th>φMy (k-ft)</th><th>φ</th><th>c (in)</th></tr>
        </thead>
        <tbody>
          <tr><td>About x — sagging (φMnx⁺)</td><td>{fmt(anchors.xSag.phiMx)}</td><td>{fmt(anchors.xSag.phiMy)}</td><td>{fmt(anchors.xSag.phi, 3)}</td><td>{fmt(anchors.xSag.c, 2)}</td></tr>
          <tr><td>About x — hogging (φMnx⁻)</td><td>{fmt(anchors.xHog.phiMx)}</td><td>{fmt(anchors.xHog.phiMy)}</td><td>{fmt(anchors.xHog.phi, 3)}</td><td>{fmt(anchors.xHog.c, 2)}</td></tr>
          <tr><td>About y — +My (φMny⁺)</td><td>{fmt(anchors.yPos.phiMx)}</td><td>{fmt(anchors.yPos.phiMy)}</td><td>{fmt(anchors.yPos.phi, 3)}</td><td>{fmt(anchors.yPos.c, 2)}</td></tr>
          <tr><td>About y — −My (φMny⁻)</td><td>{fmt(anchors.yNeg.phiMx)}</td><td>{fmt(anchors.yNeg.phiMy)}</td><td>{fmt(anchors.yNeg.phi, 3)}</td><td>{fmt(anchors.yNeg.c, 2)}</td></tr>
        </tbody>
      </table>
      <p className="note">
        Each NA-aligned point carries a secondary moment for asymmetric sections
        (a horizontal neutral axis need not produce pure-x moment). The interaction
        envelope is the governing capacity in any direction.
      </p>

      <h3>Biaxial cracking (service)</h3>
      <table className="results-table">
        <tbody>
          <tr><td>M<sub>cr,x</sub> (+ / −)</td><td>{fmt(cracking.McrFt.xPos)} / {fmt(cracking.McrFt.xNeg)} k-ft</td></tr>
          <tr><td>M<sub>cr,y</sub> (+ / −)</td><td>{fmt(cracking.McrFt.yPos)} / {fmt(cracking.McrFt.yNeg)} k-ft</td></tr>
          <tr><td>Prestress P</td><td>{fmt(cracking.P)} kip @ e=({fmt(cracking.ex, 2)}, {fmt(cracking.ey, 2)}) in</td></tr>
          <tr><td>Cracking utilization</td><td className={cracking.cracks ? 'fail-text' : 'ok-text'}>{(cracking.utilization * 100).toFixed(0)}% — {cracking.cracks ? 'cracked' : 'uncracked'}</td></tr>
        </tbody>
      </table>

      <h3>Section properties</h3>
      <table className="results-table">
        <tbody>
          <tr><td>Area</td><td>{fmt(props.A)} in²</td></tr>
          <tr><td>Centroid (x, y)</td><td>({fmt(props.xCg, 2)}, {fmt(props.yCg, 2)}) in</td></tr>
          <tr><td>I<sub>x</sub> / I<sub>y</sub></td><td>{fmt(props.Ix, 0)} / {fmt(props.Iy, 0)} in⁴</td></tr>
          <tr><td>I<sub>xy</sub></td><td>{fmt(props.Ixy, 0)} in⁴</td></tr>
        </tbody>
      </table>
    </div>
  );
}
