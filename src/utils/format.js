/**
 * Display a steel constant to six significant figures. Q, K and R are derived
 * from the published A, B, C, D at full precision, so printing them raw would
 * show sixteen digits of float.
 */
export function fmtConst(v) {
  return v == null ? '' : String(Number(v.toPrecision(6)));
}

/**
 * The deepest tension reinforcement in a uniaxial result, bonded layer or
 * unbonded tendon. Depths are in the analysis frame (from the compression
 * face), so this is right for sag and hog alike.
 */
export function extremeTension(results) {
  const all = [...(results.layerResults || []), ...(results.tendonResults || [])];
  return all.reduce((m, r) => (!m || r.depth > m.depth ? r : m), null);
}

/** The deepest BONDED layer, for the power-formula and strain equations. */
export function extremeBonded(results) {
  return (results.layerResults || []).reduce((m, r) => (!m || r.depth > m.depth ? r : m), null);
}

/**
 * Status of the ACI 318-19 minimum-strength block, as a badge:
 * { tone: 'pass' | 'warn' | 'fail' | 'na', text }.
 */
export function minStrengthBadge(ms, phiMnFt) {
  if (!ms) return null;
  switch (ms.status) {
    case 'pass':
      return { tone: 'pass', text: `${phiMnFt.toFixed(1)} ≥ 1.2Mcr = ${ms.Mcr12Ft.toFixed(1)} kip-ft` };
    case 'fail':
      return { tone: 'fail', text: `${phiMnFt.toFixed(1)} < 1.2Mcr = ${ms.Mcr12Ft.toFixed(1)} kip-ft` };
    case 'waiver-flexure-met-confirm-shear':
      return { tone: 'warn', text: `< 1.2Mcr, but ≥ 2Mu (9.6.2.2): confirm ϕVn ≥ 2Vu` };
    case 'precracked':
      return { tone: 'warn', text: 'Mcr ≤ 0: tension face precracked by prestress (engineering judgment)' };
    default:
      return { tone: 'na', text: 'Not applicable (no bonded prestressed reinforcement)' };
  }
}
