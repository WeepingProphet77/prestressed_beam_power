/**
 * Displays analysis results: forces, strains, stresses, moment capacity.
 * All calculation sections are collapsible (collapsed by default).
 */
import { useState } from 'react';

function CollapsibleSection({ title, id, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`collapsible-section ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="collapsible-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={`section-${id}`}
      >
        <span className="collapsible-chevron">{open ? '\u25BC' : '\u25B6'}</span>
        <h4>{title}</h4>
      </button>
      {open && (
        <div className="collapsible-body" id={`section-${id}`}>
          {children}
        </div>
      )}
    </div>
  );
}

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
    cracking,
  } = results;

  const ductilityStatus = ductile
    ? { label: 'Tension-Controlled', cls: 'status-good' }
    : transition
    ? { label: 'Transition Zone', cls: 'status-warn' }
    : { label: 'Compression-Controlled', cls: 'status-bad' };

  // Find extreme tension layer (deepest) for evaluated formula display
  let extremeLayer = layerResults[0];
  for (const lr of layerResults) {
    if (lr.depth > extremeLayer.depth) extremeLayer = lr;
  }
  const etl = extremeLayer;
  const epsilonTy = etl ? etl.steel.fpy / etl.steel.Es : 0.002;

  return (
    <div className="results-panel">
      <h3>Detailed Calculations</h3>
      <p className="results-collapse-hint">Click any section below to expand and view calculations.</p>

      {/* Section Flexural Strength */}
      <CollapsibleSection title="Section Flexural Strength" id="flexural">
        <div className="result-details flexural-strength-section">
          {/* Data table */}
          <table className="detail-table">
            <tbody>
              <tr>
                <td>f&#x2032;<sub>c</sub></td>
                <td>{fc} ksi</td>
              </tr>
              <tr>
                <td>&beta;<sub>1</sub></td>
                <td>{beta1.toFixed(3)}</td>
              </tr>
              <tr>
                <td>Neutral axis depth, c</td>
                <td>{c.toFixed(3)} in</td>
              </tr>
              <tr>
                <td>Whitney stress block depth, a = &beta;<sub>1</sub>&middot;c</td>
                <td>{a.toFixed(3)} in</td>
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
                <td>Net tensile strain, &epsilon;<sub>t</sub></td>
                <td>{epsilonT.toFixed(6)}</td>
              </tr>
              <tr>
                <td>Yield strain, &epsilon;<sub>ty</sub> = f<sub>py</sub> / E<sub>s</sub></td>
                <td>{epsilonTy.toFixed(6)}</td>
              </tr>
              <tr>
                <td>Strength reduction, &#x03D5;</td>
                <td>{phi.toFixed(3)}</td>
              </tr>
              <tr>
                <td>M<sub>n</sub> (Nominal Strength)</td>
                <td>{MnFt.toFixed(1)} kip-ft ({Mn.toFixed(1)} kip-in)</td>
              </tr>
              <tr>
                <td>&#x03D5;M<sub>n</sub> (Design Strength)</td>
                <td>{phiMnFt.toFixed(1)} kip-ft ({phiMn.toFixed(1)} kip-in)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      {/* Evaluated Equations */}
      <CollapsibleSection title="Evaluated Equations" id="equations">
        <div className="result-details flexural-strength-section">
          <div className="cracking-formulas" style={{ borderTop: 'none', paddingTop: 0 }}>
            {/* Power Formula */}
            <div className="formula-block">
              <div className="formula-title">Power Formula (Devalapura&#8211;Tadros / PCI):</div>
              <div className="formula">
                <span className="formula-lhs">f<sub>s</sub></span> ={' '}
                E<sub>s</sub>&#8239;&epsilon;<sub>s</sub>{' '}
                <span className="formula-bracket">[</span>{' '}
                Q + <span className="formula-frac"><span className="formula-num">1 &minus; Q</span><span className="formula-denom">[1 + (E<sub>s</sub>&epsilon;<sub>s</sub> / K f<sub>py</sub>)<sup>R</sup>]<sup>1/R</sup></span></span>{' '}
                <span className="formula-bracket">]</span>{' '}
                &le; f<sub>pu</sub>
              </div>
              {etl && (
                <>
                  <div className="formula">
                    <span className="formula-lhs" style={{visibility: 'hidden'}}>f<sub>s</sub></span> ={' '}
                    {etl.steel.Es.toLocaleString()}&#8239;({etl.strain.toFixed(6)}){' '}
                    [ {etl.steel.Q} + (1 &minus; {etl.steel.Q}) / [1 + ({etl.steel.Es.toLocaleString()} &times; {etl.strain.toFixed(6)} / {etl.steel.K} &times; {etl.steel.fpy})<sup>{etl.steel.R}</sup>]<sup>1/{etl.steel.R}</sup> ]
                  </div>
                  <div className="formula">
                    <span className="formula-lhs" style={{visibility: 'hidden'}}>f<sub>s</sub></span> ={' '}
                    {etl.stress.toFixed(2)} ksi
                    <span className="formula-note" style={{display: 'inline', marginLeft: '0.75rem'}}>
                      (extreme tension layer)
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Strain Compatibility */}
            <div className="formula-block">
              <div className="formula-title">Strain Compatibility (ACI 318):</div>
              <div className="formula">
                <span className="formula-lhs">&epsilon;<sub>si</sub></span> ={' '}
                &epsilon;<sub>cu</sub>&#8239;(d<sub>i</sub> / c &minus; 1) + f<sub>se</sub> / E<sub>s</sub>
              </div>
              {etl && (
                <>
                  <div className="formula">
                    <span className="formula-lhs" style={{visibility: 'hidden'}}>&epsilon;<sub>si</sub></span> ={' '}
                    0.003&#8239;({etl.depth.toFixed(2)} / {c.toFixed(3)} &minus; 1) + {(etl.fse || 0).toFixed(1)} / {etl.steel.Es.toLocaleString()}
                  </div>
                  <div className="formula">
                    <span className="formula-lhs" style={{visibility: 'hidden'}}>&epsilon;<sub>si</sub></span> ={' '}
                    {etl.strain.toFixed(6)}
                    <span className="formula-note" style={{display: 'inline', marginLeft: '0.75rem'}}>
                      (extreme tension layer)
                    </span>
                  </div>
                </>
              )}
              <div className="formula-note">&epsilon;<sub>cu</sub> = 0.003 per ACI 318</div>
            </div>

            {/* Whitney Stress Block */}
            <div className="formula-block">
              <div className="formula-title">Whitney Stress Block (ACI 318 &sect;22.2):</div>
              <div className="formula">
                <span className="formula-lhs">C<sub>c</sub></span> ={' '}
                0.85&#8239;f&#x2032;<sub>c</sub>&#8239;a&#8239;b
                <span style={{marginLeft: '1rem'}}>where</span>{' '}
                a = &beta;<sub>1</sub>&#8239;c
              </div>
              <div className="formula">
                <span className="formula-lhs" style={{visibility: 'hidden'}}>C<sub>c</sub></span>{' '}
                a = {beta1.toFixed(3)} &times; {c.toFixed(3)} = {a.toFixed(3)} in
              </div>
              <div className="formula">
                <span className="formula-lhs" style={{visibility: 'hidden'}}>C<sub>c</sub></span> ={' '}
                {Cc.toFixed(2)} kips
              </div>
            </div>

            {/* Strength Reduction φ */}
            <div className="formula-block">
              <div className="formula-title">Strength Reduction &#x03D5; (ACI 318 &sect;21.2):</div>
              <div className="formula">
                <span className="formula-lhs">&#x03D5;</span> ={' '}
                0.65 + 0.25&#8239;(&epsilon;<sub>t</sub> &minus; &epsilon;<sub>ty</sub>) / 0.003
              </div>
              <div className="formula">
                <span className="formula-lhs" style={{visibility: 'hidden'}}>&#x03D5;</span> ={' '}
                0.65 + 0.25&#8239;({epsilonT.toFixed(6)} &minus; {epsilonTy.toFixed(6)}) / 0.003
              </div>
              <div className="formula">
                <span className="formula-lhs" style={{visibility: 'hidden'}}>&#x03D5;</span> ={' '}
                {phi.toFixed(3)}
              </div>
              <div className="formula-note">0.65 &le; &#x03D5; &le; 0.90</div>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Steel Layer Table */}
      <CollapsibleSection title="Steel Layer Results" id="layers">
        <div className="result-details">
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
      </CollapsibleSection>

      {/* Prestress & Cracking Analysis */}
      {cracking && (
        <CollapsibleSection title="Prestress &amp; Cracking Analysis" id="cracking">
          <div className="result-details prestress-cracking-section">
            {/* Computed values table */}
            <table className="detail-table">
              <tbody>
                <tr>
                  <td>Gross section area, A<sub>g</sub></td>
                  <td>{cracking.sectionProps.A.toFixed(2)} in&sup2;</td>
                </tr>
                <tr>
                  <td>Gross moment of inertia, I<sub>g</sub></td>
                  <td>{cracking.sectionProps.Ig.toFixed(1)} in&#x2074;</td>
                </tr>
                <tr>
                  <td>Section modulus (bottom), S<sub>b</sub></td>
                  <td>{cracking.sectionProps.Sb.toFixed(2)} in&sup3;</td>
                </tr>
                <tr>
                  <td>Centroid depth, y&#x0304;<sub>cg</sub></td>
                  <td>{cracking.sectionProps.yCg.toFixed(3)} in</td>
                </tr>
                <tr>
                  <td>Effective prestress force, P<sub>e</sub></td>
                  <td>{cracking.P.toFixed(2)} kips</td>
                </tr>
                <tr>
                  <td>
                    Avg. precompressive stress, f<sub>pc</sub> = P<sub>e</sub> / A<sub>g</sub>
                  </td>
                  <td>{cracking.fpc.toFixed(4)} ksi</td>
                </tr>
                <tr>
                  <td>Prestress eccentricity, e</td>
                  <td>{cracking.e.toFixed(3)} in</td>
                </tr>
                <tr>
                  <td>
                    Modulus of rupture, f<sub>r</sub> = 7.5&radic;(f&#x2032;<sub>c</sub>)
                  </td>
                  <td>{cracking.fr.toFixed(4)} ksi</td>
                </tr>
                <tr>
                  <td>Cracking moment, M<sub>cr</sub></td>
                  <td>{cracking.McrFt.toFixed(1)} kip-ft</td>
                </tr>
                <tr>
                  <td>1.2 M<sub>cr</sub></td>
                  <td>{cracking.thresholdFt.toFixed(1)} kip-ft</td>
                </tr>
              </tbody>
            </table>

            {/* Equations */}
            <div className="cracking-formulas">
              <div className="formula-block">
                <div className="formula-title">
                  Average Precompressive Stress:
                </div>
                <div className="formula">
                  <span className="formula-lhs">f<sub>pc</sub></span> ={' '}
                  P<sub>e</sub> / A<sub>g</sub>
                  {' '}= {cracking.P.toFixed(2)} / {cracking.sectionProps.A.toFixed(2)}
                  {' '}= {cracking.fpc.toFixed(4)} ksi
                </div>
              </div>
              <div className="formula-block">
                <div className="formula-title">
                  Modulus of Rupture (ACI 318 &sect;19.2.3):
                </div>
                <div className="formula">
                  <span className="formula-lhs">f<sub>r</sub></span> ={' '}
                  7.5&radic;(f&#x2032;<sub>c</sub>){' '}
                  = 7.5&radic;({(fc * 1000).toFixed(0)})
                  {' '}= {(cracking.fr * 1000).toFixed(1)} psi
                  {' '}= {cracking.fr.toFixed(4)} ksi
                </div>
                <div className="formula-note">f&#x2032;<sub>c</sub> in psi for this equation</div>
              </div>
              <div className="formula-block">
                <div className="formula-title">
                  Cracking Moment (ACI 318 &sect;24.2.3.5):
                </div>
                <div className="formula">
                  <span className="formula-lhs">M<sub>cr</sub></span> ={' '}
                  S<sub>b</sub>&#8239;(f<sub>r</sub> + P<sub>e</sub>/A<sub>g</sub> + P<sub>e</sub>&#8239;e / S<sub>b</sub>)
                </div>
                <div className="formula">
                  <span className="formula-lhs" style={{visibility: 'hidden'}}>M<sub>cr</sub></span> ={' '}
                  {cracking.sectionProps.Sb.toFixed(2)}&#8239;({cracking.fr.toFixed(4)} + {cracking.P.toFixed(2)}/{cracking.sectionProps.A.toFixed(2)} + {cracking.P.toFixed(2)} &times; {cracking.e.toFixed(3)} / {cracking.sectionProps.Sb.toFixed(2)})
                </div>
                <div className="formula">
                  <span className="formula-lhs" style={{visibility: 'hidden'}}>M<sub>cr</sub></span> ={' '}
                  {cracking.Mcr.toFixed(1)} kip-in = {cracking.McrFt.toFixed(1)} kip-ft
                </div>
              </div>
              <div className="formula-block">
                <div className="formula-title">
                  Minimum Flexural Strength (ACI 318 &sect;9.6.2.2):
                </div>
                <div className="formula">
                  <span className="formula-lhs">&#x03D5;M<sub>n</sub></span>{' '}
                  &ge; 1.2&#8239;M<sub>cr</sub>
                </div>
                <div className="formula">
                  {phiMnFt.toFixed(1)} kip-ft{' '}
                  {cracking.passesMinStrength ? '\u2265' : '<'}{' '}
                  {cracking.thresholdFt.toFixed(1)} kip-ft
                </div>
                <div className={`cracking-check ${cracking.passesMinStrength ? 'check-pass' : 'check-fail'}`}>
                  {cracking.passesMinStrength
                    ? '\u2713 OK \u2014 \u03D5Mn \u2265 1.2Mcr'
                    : '\u2717 FAILS \u2014 \u03D5Mn < 1.2Mcr'}
                </div>
              </div>
            </div>
          </div>
        </CollapsibleSection>
      )}

    </div>
  );
}
