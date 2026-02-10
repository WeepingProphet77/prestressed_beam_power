/**
 * Displays analysis results: forces, strains, stresses, moment capacity.
 */
export default function ResultsPanel({ results }) {
  if (!results) return null;

  const {
    c,
    a,
    beta1,
    Cc,
    layerResults,
    Mn,
    MnFt,
    phi,
    phiMn,
    phiMnFt,
    epsilonT,
    cOverD,
    fc,
    ductile,
    transition,
  } = results;

  const ductilityStatus = ductile
    ? { label: 'Tension-Controlled', cls: 'status-good' }
    : transition
    ? { label: 'Transition Zone', cls: 'status-warn' }
    : { label: 'Compression-Controlled', cls: 'status-bad' };

  return (
    <div className="results-panel">
      <h3>Analysis Results</h3>

      {/* Summary Cards */}
      <div className="result-cards">
        <div className="result-card primary">
          <div className="card-label">&phi;M<sub>n</sub> (Design Strength)</div>
          <div className="card-value">{phiMn.toFixed(1)} kip-in</div>
          <div className="card-sub">{phiMnFt.toFixed(1)} kip-ft</div>
        </div>
        <div className="result-card">
          <div className="card-label">M<sub>n</sub> (Nominal Strength)</div>
          <div className="card-value">{Mn.toFixed(1)} kip-in</div>
          <div className="card-sub">{MnFt.toFixed(1)} kip-ft</div>
        </div>
        <div className="result-card">
          <div className="card-label">&phi; Factor</div>
          <div className="card-value">{phi.toFixed(3)}</div>
          <div className="card-sub">ACI 318 &sect;21.2</div>
        </div>
        <div className={`result-card ${ductilityStatus.cls}`}>
          <div className="card-label">Ductility</div>
          <div className="card-value small">{ductilityStatus.label}</div>
          <div className="card-sub">&epsilon;<sub>t</sub> = {epsilonT.toFixed(5)}</div>
        </div>
      </div>

      {/* Section Details */}
      <div className="result-details">
        <h4>Section Analysis</h4>
        <table className="detail-table">
          <tbody>
            <tr>
              <td>Neutral axis depth, c</td>
              <td>{c.toFixed(3)} in</td>
            </tr>
            <tr>
              <td>Whitney stress block depth, a = &beta;<sub>1</sub>&middot;c</td>
              <td>{a.toFixed(3)} in</td>
            </tr>
            <tr>
              <td>&beta;<sub>1</sub></td>
              <td>{beta1.toFixed(3)}</td>
            </tr>
            <tr>
              <td>Concrete compression, C<sub>c</sub></td>
              <td>{Cc.toFixed(2)} kips</td>
            </tr>
            <tr>
              <td>c / d<sub>t</sub> ratio</td>
              <td>{cOverD.toFixed(4)}</td>
            </tr>
            <tr>
              <td>f&apos;<sub>c</sub></td>
              <td>{fc} ksi</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Steel Layer Table */}
      <div className="result-details">
        <h4>Steel Layer Results</h4>
        <div className="table-wrapper">
          <table className="layer-table">
            <thead>
              <tr>
                <th>Layer</th>
                <th>Type</th>
                <th>
                  A<sub>s</sub> (in&sup2;)
                </th>
                <th>d (in)</th>
                <th>
                  f<sub>se</sub> (ksi)
                </th>
                <th>
                  &epsilon;<sub>s</sub>
                </th>
                <th>
                  f<sub>s</sub> (ksi)
                </th>
                <th>Force (kips)</th>
              </tr>
            </thead>
            <tbody>
              {layerResults.map((lr, idx) => (
                <tr key={idx} className={lr.force > 0 ? 'tension-row' : 'compression-row'}>
                  <td>{idx + 1}</td>
                  <td>{lr.name || lr.steel?.name}</td>
                  <td>{lr.area.toFixed(3)}</td>
                  <td>{lr.depth.toFixed(2)}</td>
                  <td>{(lr.fse || 0).toFixed(1)}</td>
                  <td>{lr.strain.toFixed(6)}</td>
                  <td>{lr.stress.toFixed(2)}</td>
                  <td>{lr.force.toFixed(2)}</td>
                </tr>
              ))}
              <tr className="totals-row">
                <td colSpan="7" style={{ textAlign: 'right' }}>
                  Total Steel Force
                </td>
                <td>
                  {layerResults.reduce((sum, lr) => sum + lr.force, 0).toFixed(2)} kips
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Formulas Reference */}
      <div className="result-details formulas-ref">
        <h4>Formulas Used</h4>
        <div className="formula-block">
          <div className="formula-title">Power Formula (Devalapura-Tadros / PCI):</div>
          <div className="formula">
            f<sub>s</sub> = E<sub>s</sub>&middot;&epsilon;<sub>s</sub>&middot;[ Q + (1&minus;Q) /
            [1 + (E<sub>s</sub>&middot;&epsilon;<sub>s</sub> / (K&middot;f<sub>py</sub>))<sup>R</sup>]<sup>1/R</sup> ]
            &le; f<sub>pu</sub>
          </div>
        </div>
        <div className="formula-block">
          <div className="formula-title">Strain Compatibility (ACI 318):</div>
          <div className="formula">
            &epsilon;<sub>si</sub> = &epsilon;<sub>cu</sub>&middot;(d<sub>i</sub>/c &minus; 1) +
            f<sub>se</sub>/E<sub>s</sub>
          </div>
          <div className="formula-note">&epsilon;<sub>cu</sub> = 0.003 per ACI 318</div>
        </div>
        <div className="formula-block">
          <div className="formula-title">Whitney Stress Block (ACI 318 &sect;22.2):</div>
          <div className="formula">
            C<sub>c</sub> = 0.85&middot;f&apos;<sub>c</sub>&middot;a&middot;b
            &nbsp;&nbsp;where&nbsp;&nbsp; a = &beta;<sub>1</sub>&middot;c
          </div>
        </div>
      </div>
    </div>
  );
}
