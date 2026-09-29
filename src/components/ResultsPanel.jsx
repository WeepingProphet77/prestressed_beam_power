/**
 * Displays analysis results: forces, strains, stresses, moment capacity.
 * All calculation sections are collapsible (collapsed by default).
 */
import { useState } from 'react';
import { fmtConst, extremeBonded } from '../utils/format';

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
    cracking,
    minStrengthACI: ms,
    tendonResults = [],
    fpsBasis,
    minBondedReinforcement: minBonded,
    service,
  } = results;

  // Deepest bonded layer, for the evaluated power-formula and strain equations
  const etl = extremeBonded(results);
  const epsilonTy = results.epsilonTy ?? 0.002;
  const hog = results.direction === 'hog';
  const dFromTop = (r) => r.depthFromTop ?? r.depth;

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
                <td>Moment direction</td>
                <td>
                  {hog
                    ? 'Hogging (negative): top in tension, compression face at the bottom'
                    : 'Sagging (positive): bottom in tension, compression face at the top'}
                </td>
              </tr>
              <tr>
                <td>f&#x2032;<sub>c</sub></td>
                <td>{fc} ksi</td>
              </tr>
              <tr>
                <td>&beta;<sub>1</sub></td>
                <td>{beta1.toFixed(3)}</td>
              </tr>
              <tr>
                <td>Neutral axis depth, c{hog && ' (from the bottom)'}</td>
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
                <td>Yield strain, &epsilon;<sub>ty</sub>{results.phiBasis?.startsWith('unbonded') ? ' (ACI 21.2.2.1)' : <> = f<sub>py</sub> / E<sub>s</sub></>}</td>
                <td>{epsilonTy.toFixed(6)}</td>
              </tr>
              {results.phiBasis && (
                <tr>
                  <td>&#x03D5; basis</td>
                  <td>{results.phiBasis}</td>
                </tr>
              )}
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
          {hog && <p className="formula-note">{results.frameNote}</p>}
        </div>
      </CollapsibleSection>

      {/* Evaluated Equations */}
      <CollapsibleSection title="Evaluated Equations" id="equations">
        <div className="result-details flexural-strength-section">
          <div className="cracking-formulas" style={{ borderTop: 'none', paddingTop: 0 }}>
            {/* Power Formula */}
            {etl && (
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
                    [ {fmtConst(etl.steel.Q)} + (1 &minus; {fmtConst(etl.steel.Q)}) / [1 + ({etl.steel.Es.toLocaleString()} &times; {etl.strain.toFixed(6)} / {fmtConst(etl.steel.K)} &times; {etl.steel.fpy})<sup>{fmtConst(etl.steel.R)}</sup>]<sup>1/{fmtConst(etl.steel.R)}</sup> ]
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
            )}

            {/* Strain Compatibility */}
            <div className="formula-block">
              <div className="formula-title">Strain Compatibility (ACI 318):</div>
              <div className="formula">
                <span className="formula-lhs">&epsilon;<sub>si</sub></span> ={' '}
                &epsilon;<sub>cu</sub>&#8239;(d<sub>i</sub> / c &minus; 1) + f<sub>se</sub> / E<sub>s</sub> + &Delta;&epsilon;<sub>decomp</sub>
              </div>
              {etl && (
                <>
                  <div className="formula">
                    <span className="formula-lhs" style={{visibility: 'hidden'}}>&epsilon;<sub>si</sub></span> ={' '}
                    0.003&#8239;({etl.depth.toFixed(2)} / {c.toFixed(3)} &minus; 1) + {(etl.fse || 0).toFixed(1)} / {etl.steel.Es.toLocaleString()} + {(etl.epsDecomp || 0).toFixed(6)}
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
              <div className="formula-note">
                &epsilon;<sub>cu</sub> = 0.003 per ACI 318. &Delta;&epsilon;<sub>decomp</sub> is the
                concrete decompression strain at the steel level (bonded prestress only).
                {' '}d<sub>i</sub> and c are measured from the compression face
                {hog ? ', which is the member bottom under hogging.' : '.'}
              </div>
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
                  <th>d from top (in)</th>
                  {hog && <th>d from comp. face (in)</th>}
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
                    <td>{dFromTop(lr).toFixed(2)}</td>
                    {hog && <td>{lr.depth.toFixed(2)}</td>}
                    <td>{(lr.fse || 0).toFixed(1)}</td>
                    <td>{lr.strain.toFixed(6)}</td>
                    <td>{lr.stress.toFixed(2)}</td>
                    <td>{lr.force.toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="totals-row">
                  <td colSpan={hog ? 8 : 7} style={{ textAlign: 'right' }}>
                    Total Bonded Steel Force
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
                  <td>Section modulus, tension face ({hog ? 'top' : 'bottom'}), S<sub>b</sub></td>
                  <td>{cracking.sectionProps.Sb.toFixed(2)} in&sup3;</td>
                </tr>
                <tr>
                  <td>Centroid depth from the compression face, y&#x0304;<sub>cg</sub></td>
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
                    Modulus of rupture, f<sub>r</sub> = 7.5&lambda;&radic;(f&#x2032;<sub>c</sub>)
                    {cracking.lambda != null && cracking.lambda !== 1 && ` (λ = ${cracking.lambda})`}
                  </td>
                  <td>{cracking.fr.toFixed(4)} ksi</td>
                </tr>
                <tr>
                  <td>Cracking moment, M<sub>cr</sub> ({hog ? 'top' : 'bottom'} fiber)</td>
                  <td>{cracking.McrFt.toFixed(1)} kip-ft</td>
                </tr>
                <tr>
                  <td>1.2 M<sub>cr</sub></td>
                  <td>{(cracking.Mcr12 / 12).toFixed(1)} kip-ft</td>
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
                  7.5&lambda;&radic;(f&#x2032;<sub>c</sub>){' '}
                  = 7.5 &times; {cracking.lambda ?? 1} &times; &radic;({(fc * 1000).toFixed(0)})
                  {' '}= {(cracking.fr * 1000).toFixed(1)} psi
                  {' '}= {cracking.fr.toFixed(4)} ksi
                </div>
                <div className="formula-note">
                  f&#x2032;<sub>c</sub> in psi for this equation. &lambda; = lightweight factor
                  (ACI 318 &sect;19.2.4).
                </div>
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
              {ms && <MinimumStrength ms={ms} phiMnFt={phiMnFt} />}
            </div>
          </div>
        </CollapsibleSection>
      )}

      {/* Unbonded tendons (ACI 318-19 20.3.2.4) */}
      {tendonResults.length > 0 && (
        <CollapsibleSection title="Unbonded Tendons" id="unbonded">
          <UnbondedDetails tendons={tendonResults} basis={fpsBasis} minBonded={minBonded} dFromTop={dFromTop} />
        </CollapsibleSection>
      )}

      {/* Service stresses (ACI 318-19 24.5) */}
      {service && (
        <CollapsibleSection title="Service Stresses" id="service">
          <ServiceDetails service={service} />
        </CollapsibleSection>
      )}

    </div>
  );
}

const STATUS_TEXT = {
  pass: '\u2713 OK \u2014 \u03D5Mn \u2265 1.2Mcr',
  fail: '\u2717 FAILS \u2014 \u03D5Mn < 1.2Mcr and the 9.6.2.2 waiver is not met',
  'waiver-flexure-met-confirm-shear': '\u26A0 \u03D5Mn < 1.2Mcr, but \u03D5Mn \u2265 2Mu: waived by 9.6.2.2 only if \u03D5Vn \u2265 2Vu',
  precracked: '\u26A0 Mcr \u2264 0: tension face precracked by prestress. Engineering judgment, not a pass.',
};

/** ACI 318-19 minimum flexural strength, from analyzeSection's minStrengthACI. */
function MinimumStrength({ ms, phiMnFt }) {
  if (!ms.applies) {
    return (
      <div className="formula-block">
        <div className="formula-title">Minimum Flexural Strength ({ms.provision}):</div>
        <div className="formula-note">{ms.note}</div>
      </div>
    );
  }
  const tone = ms.status === 'pass' ? 'check-pass' : ms.status === 'fail' ? 'check-fail' : 'check-warn';
  return (
    <div className="formula-block">
      <div className="formula-title">Minimum Flexural Strength (ACI 318-19 &sect;9.6.2.1):</div>
      <div className="formula">
        <span className="formula-lhs">&#x03D5;M<sub>n</sub></span>{' '}
        &ge; 1.2&#8239;M<sub>cr</sub>
        <span className="formula-note" style={{ display: 'inline', marginLeft: '0.75rem' }}>
          (waived by &sect;9.6.2.2 where &#x03D5;M<sub>n</sub> &ge; 2M<sub>u</sub> and &#x03D5;V<sub>n</sub> &ge; 2V<sub>u</sub>)
        </span>
      </div>
      <div className="formula">
        {phiMnFt.toFixed(1)} kip-ft {ms.passes12Mcr ? '\u2265' : '<'} 1.2&#8239;M<sub>cr</sub> = {ms.Mcr12Ft.toFixed(1)} kip-ft
        {ms.waiver.twoMuFt != null && (
          <>
            {' '}&nbsp;|&nbsp; 2&#8239;M<sub>u</sub> = {ms.waiver.twoMuFt.toFixed(1)} kip-ft
          </>
        )}
      </div>
      <div className={`cracking-check ${tone}`}>{STATUS_TEXT[ms.status]}</div>
      {ms.note && <div className="formula-note">{ms.note}</div>}
    </div>
  );
}

function UnbondedDetails({ tendons, basis, minBonded, dFromTop }) {
  const per = basis?.perTendon;
  return (
    <div className="result-details">
      <div className="table-wrapper">
        <table className="layer-table">
          <thead>
            <tr>
              <th>Tendon</th>
              <th>Type</th>
              <th>A<sub>ps</sub> (in&sup2;)</th>
              <th>d from top (in)</th>
              <th>f<sub>se</sub> (ksi)</th>
              <th>f<sub>ps</sub> (ksi)</th>
              <th>Force (kips)</th>
            </tr>
          </thead>
          <tbody>
            {tendons.map((t, i) => (
              <tr key={i} className="tension-row">
                <td>U{i + 1}</td>
                <td>{t.steel?.name}</td>
                <td>{t.area.toFixed(3)}</td>
                <td>{dFromTop(t).toFixed(2)}</td>
                <td>{t.fse.toFixed(1)}</td>
                <td>{t.stress.toFixed(2)}</td>
                <td>{t.force.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {basis && (
        <table className="detail-table">
          <tbody>
            <tr><td>f<sub>ps</sub> method</td><td>{basis.method}</td></tr>
            <tr><td>Compression-face width for &rho;<sub>p</sub>, b</td><td>{basis.bComp.toFixed(2)} in</td></tr>
            <tr><td>&rho;<sub>p</sub> = A<sub>ps</sub> / (b&#8239;d<sub>p</sub>)</td><td>{basis.rhoP.toFixed(6)}</td></tr>
            {basis.spanToDepth != null && (
              <tr><td>Span / depth, &#8467;/h</td><td>{basis.spanToDepth.toFixed(1)} ({per?.[0]?.row})</td></tr>
            )}
            {per?.map((r, i) => (
              <tr key={i}>
                <td>U{i + 1}: least of {r.equation}, f<sub>se</sub> + {r.slender ? 30 : 60}, f<sub>py</sub></td>
                <td>
                  {r.candidates.formula.toFixed(1)}, {r.candidates.fsePlus.toFixed(1)}, {r.candidates.fpy.toFixed(1)}
                  {' '}&rarr; {r.fps.toFixed(1)} ksi ({r.governs})
                </td>
              </tr>
            ))}
            {basis.le != null && (
              <tr><td>&#8467;<sub>e</sub> = 2&#8467;<sub>i</sub> / (2 + N<sub>s</sub>)</td><td>{basis.le.toFixed(1)} in</td></tr>
            )}
            {basis.fpsInput != null && (
              <tr><td>Engineer-supplied f<sub>ps</sub></td><td>{basis.fpsInput} ksi{basis.cappedAtFpy ? ' (capped at fpy)' : ''}</td></tr>
            )}
          </tbody>
        </table>
      )}
      {basis?.note && <p className="formula-note">{basis.note}</p>}
      {minBonded && (
        <div className="formula-block">
          <div className="formula-title">Minimum Bonded Reinforcement (ACI 318-19 &sect;9.6.2.3):</div>
          <div className="formula">
            A<sub>s,min</sub> = 0.004&#8239;A<sub>ct</sub> = 0.004 &times; {minBonded.Act.toFixed(2)} = {minBonded.AsMin.toFixed(3)} in&sup2;
          </div>
          <div className="formula">
            A<sub>s</sub> provided = {minBonded.AsProvided.toFixed(3)} in&sup2;
          </div>
          <div className={`cracking-check ${minBonded.pass ? 'check-pass' : 'check-fail'}`}>
            {minBonded.pass ? '\u2713 OK' : '\u2717 FAILS'} &mdash; A<sub>s</sub> {minBonded.pass ? '\u2265' : '<'} A<sub>s,min</sub>
          </div>
          <div className="formula-note">{minBonded.note}</div>
        </div>
      )}
    </div>
  );
}

function ServiceDetails({ service: sv }) {
  const row = (label, f) => (
    <tr>
      <td>{label}</td>
      <td>{f.top.toFixed(4)} ksi</td>
      <td>{f.bottom.toFixed(4)} ksi</td>
    </tr>
  );
  return (
    <div className="result-details">
      <div className="table-wrapper">
        <table className="layer-table">
          <thead>
            <tr><th>Case</th><th>Top fiber</th><th>Bottom fiber</th></tr>
          </thead>
          <tbody>
            {row('Total service', sv.total)}
            {sv.sustained && row('Sustained', sv.sustained)}
          </tbody>
        </table>
      </div>
      <table className="detail-table">
        <tbody>
          <tr><td>Effective prestress, P (bonded + unbonded)</td><td>{sv.P.toFixed(2)} kips</td></tr>
          <tr><td>Eccentricity, e</td><td>{sv.e.toFixed(3)} in</td></tr>
          <tr><td>Extreme tension, f<sub>t</sub></td><td>{sv.ft.toFixed(4)} ksi</td></tr>
          <tr>
            <td>Class U / T limits (7.5&radic;f&#x2032;c, 12&radic;f&#x2032;c)</td>
            <td>{sv.tensionLimits.U.toFixed(4)} / {sv.tensionLimits.T.toFixed(4)} ksi</td>
          </tr>
          <tr><td>Classification (&sect;24.5.2.1)</td><td>Class {sv.class}</td></tr>
          <tr>
            <td>Compression, total (&le; 0.60f&#x2032;c)</td>
            <td>{sv.compression.total.toFixed(4)} / {sv.compression.limitTotal.toFixed(3)} ksi {sv.compression.passTotal ? '\u2713' : '\u2717'}</td>
          </tr>
          {sv.compression.sustained != null && (
            <tr>
              <td>Compression, sustained (&le; 0.45f&#x2032;c)</td>
              <td>{sv.compression.sustained.toFixed(4)} / {sv.compression.limitSustained.toFixed(3)} ksi {sv.compression.passSustained ? '\u2713' : '\u2717'}</td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="formula-note">
        Compression negative, tension positive. {sv.classNote}
        {sv.sustainedTensionNote && ` ${sv.sustainedTensionNote}`}
      </p>
    </div>
  );
}
