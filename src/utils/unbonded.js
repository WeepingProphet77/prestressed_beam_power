/**
 * Unbonded post-tensioning, ported from the power-formula skill (v1.2,
 * engine/unbonded.mjs). Keep the two in step: the skill is the methodology
 * reference and analyzeSection.test.js carries its worked examples.
 *
 * It deliberately does NOT modify the engine: every constitutive and geometric calculation
 * (power-formula steel stress, beta1, Whitney block force and centroid, gross
 * section properties, decompression strains, phi curve, cracking moment) is
 * imported from beamCalculations.js. What lives here is only what the engine
 * has no concept of:
 *
 *   1. fps for unbonded tendons (member-level, not strain-compatible)
 *        ACI 318-19 20.3.2.4.1, Table 20.3.2.4.1        method "aci"   (default)
 *        AASHTO LRFD 5.6.3.1.2 (rational, c-dependent)  method "aashto"
 *        engineer-supplied fps from a detailed analysis method "user"
 *   2. The section equilibrium solve with the unbonded force added. The loop
 *      mirrors analyzeBeam's bisection; with zero tendons it must reproduce
 *      analyzeBeam exactly, and analyzeSection.test.js asserts that parity.
 *   3. ACI 318-19 minimum bonded reinforcement for members with unbonded
 *      tendons, As,min = 0.004 Act (9.6.2.3), and the rule that the 1.2Mcr
 *      check (9.6.2.1) applies only when bonded prestressed steel is present.
 *   4. Optional service-stress check on the uncracked gross section with the
 *      bonded and unbonded effective prestress, classified per 24.5.2.1 with
 *      the compression limits of 24.5.4.1.
 *
 * Units: ksi, in, kip, kip-in (kip-ft where the field name ends in Ft).
 */
import {
  beta1, phiFactor, powerFormulaStress, steelStrain,
  decompressionStrains, concreteCompression, compressionCentroid,
  grossSectionProperties, prestressAndCracking,
} from './beamCalculations.js';

const ECU = 0.003;
// ACI 318-19 21.2.2.1: for all prestressed reinforcement, eps_ty = 0.002.
const EPS_TY_PRESTRESSED_ACI = 0.002;

/** Net concrete area above depth y, via the engine's own geometry (all section types). */
export function areaAboveDepth(section, y) {
  const { bf, bw, hf } = section;
  // concreteCompression returns 0.85*fc*area; fc = 1/0.85 makes it return area.
  return concreteCompression(1 / 0.85, y, bf, bw, hf, section);
}

/** Width of the extreme compression face, measured by the engine's geometry. */
export function compressionFaceWidth(section) {
  const d = Math.min(1e-3, section.h / 1000);
  return areaAboveDepth(section, d) / d;
}

/** Rectangular inputs may omit bf/hf; the engine's compression routine needs them. */
export function normalizeSection(section) {
  if (section.sectionType === 'rectangular') {
    return { ...section, bf: section.bf ?? section.bw, hf: section.hf ?? section.h };
  }
  return section;
}

/**
 * Stress in each unbonded tendon at nominal strength for a trial neutral-axis
 * depth c. For "aci" and "user" the value does not depend on c; for "aashto" it
 * does, which is why this is evaluated inside the bisection.
 */
function tendonStress(t, ctx, c) {
  const { method } = ctx;
  const { fse, steel } = t;
  if (method === 'user') return Math.min(t.fpsUser, steel.fpy);
  if (method === 'aci') return t.fpsAci;
  // AASHTO LRFD Eq. 5.6.3.1.2-1: fps = fpe + 900 (dp - c) / le <= fpy, ksi
  const fps = fse + 900 * (t.depth - c) / ctx.le;
  return Math.min(Math.max(fps, fse), steel.fpy);
}

/**
 * ACI 318-19 Table 20.3.2.4.1. fc in ksi, so f'c(psi)/(100 rho)/1000 = fc/(100 rho).
 * Returns the governing value and every candidate so the calc sheet can show them.
 */
export function aciTableFps({ fse, fpu, fpy, fc, rhoP, spanToDepth }) {
  if (!(fse >= 0.5 * fpu)) {
    throw new Error(
      `ACI 318-19 20.3.2.4.1 requires fse >= 0.5 fpu (${(0.5 * fpu).toFixed(1)} ksi); `
      + `got fse = ${fse} ksi. Table 20.3.2.4.1 may not be used. Supply fps from a `
      + 'more detailed analysis with unbonded.method = "user", or use "aashto".',
    );
  }
  const slender = spanToDepth > 35;
  const divisor = slender ? 300 : 100;
  const addCap = slender ? 30 : 60;
  const candidates = {
    formula: fse + 10 + fc / (divisor * rhoP),
    fsePlus: fse + addCap,
    fpy,
  };
  const fps = Math.min(candidates.formula, candidates.fsePlus, candidates.fpy);
  const governs = fps === candidates.formula ? 'formula'
    : fps === candidates.fsePlus ? `fse + ${addCap}` : 'fpy';
  return {
    fps, governs, slender,
    row: slender ? 'l/h > 35' : 'l/h <= 35',
    equation: `fse + 10 + f'c/(${divisor} rho_p)`,
    candidates,
  };
}

/**
 * Uniaxial flexural strength with bonded layers (power formula, strain
 * compatibility) plus unbonded tendons (member-level fps, constant force).
 *
 * @param section   engine section object (uniaxial)
 * @param bonded    engine-shaped bonded layers [{area, depth, fse, steel}] (may be empty)
 * @param tendons   [{area, depth, fse, steel}] unbonded tendons at this section
 * @param opts      job.unbonded: { method, spanFt, h, bComp, tendonLengthFt, supportHinges, fps }
 */
export function analyzeWithUnbonded(sectionIn, bonded, tendons, opts = {}) {
  const section = normalizeSection(sectionIn);
  const { bf, bw, hf, h, fc } = section;
  const method = opts.method ?? 'aci';
  if (!['aci', 'aashto', 'user'].includes(method)) {
    throw new Error(`unbonded.method must be "aci", "aashto", or "user"; got "${method}".`);
  }

  // ── Tendon bookkeeping ────────────────────────────────────────────────────
  for (const [i, t] of tendons.entries()) {
    if (t.steel.category !== 'prestressing') {
      throw new Error(`Unbonded tendon ${i}: grade "${t.steel.id}" is not prestressing steel.`);
    }
    if (!(t.fse > 0)) throw new Error(`Unbonded tendon ${i}: fse (ksi) is required and must be > 0.`);
    if (!(t.depth > 0 && t.depth < h)) throw new Error(`Unbonded tendon ${i}: depth must lie within the section.`);
  }
  const ApsU = tendons.reduce((s, t) => s + t.area, 0);
  const dpU = ApsU > 0 ? tendons.reduce((s, t) => s + t.area * t.depth, 0) / ApsU : 0;
  const bComp = opts.bComp ?? compressionFaceWidth(section);
  const rhoP = ApsU / (bComp * dpU);

  const ctx = { method };
  let fpsBasis = null;

  if (tendons.length === 0) {
    fpsBasis = null;
  } else if (method === 'aci') {
    if (!(opts.spanFt > 0)) throw new Error('unbonded.spanFt (span length, ft) is required for method "aci".');
    const hMember = opts.h ?? h;
    const spanToDepth = (opts.spanFt * 12) / hMember;
    const per = tendons.map((t) => {
      const r = aciTableFps({ fse: t.fse, fpu: t.steel.fpu, fpy: t.steel.fpy, fc, rhoP, spanToDepth });
      t.fpsAci = r.fps;
      return r;
    });
    fpsBasis = {
      method: 'ACI 318-19 20.3.2.4.1, Table 20.3.2.4.1',
      spanFt: opts.spanFt, hMember, spanToDepth, bComp, dp: dpU, Aps: ApsU, rhoP,
      perTendon: per,
    };
  } else if (method === 'aashto') {
    if (!(opts.tendonLengthFt > 0)) {
      throw new Error('unbonded.tendonLengthFt (anchor-to-anchor length, ft) is required for method "aashto".');
    }
    const Ns = opts.supportHinges ?? 0;
    const li = opts.tendonLengthFt * 12;
    ctx.le = (2 * li) / (2 + Ns);
    fpsBasis = {
      method: 'AASHTO LRFD 5.6.3.1.2, fps = fpe + 900(dp - c)/le <= fpy',
      tendonLengthIn: li, supportHinges: Ns, le: ctx.le, bComp, dp: dpU, Aps: ApsU, rhoP,
      note: 'Used as the "more detailed determination" permitted by ACI 318-19 20.3.2.4; '
        + 'c is from the ACI Whitney block of this section, not AASHTO 5.6.3.1.2 flanged-section equations.',
    };
  } else {
    if (!(opts.fps > 0)) throw new Error('unbonded.fps (ksi) is required for method "user".');
    for (const t of tendons) t.fpsUser = opts.fps;
    fpsBasis = {
      method: 'Engineer-supplied fps (ACI 318-19 20.3.2.4 detailed determination)',
      fpsInput: opts.fps, cappedAtFpy: tendons.some((t) => opts.fps > t.steel.fpy),
      bComp, dp: dpU, Aps: ApsU, rhoP,
    };
  }

  // ── Decompression strains for BONDED prestressed layers ──────────────────
  // The unbonded tendons precompress the concrete too, so they belong in P and
  // e for the bonded layers' decompression strain. Their own entries are discarded.
  const props = grossSectionProperties(section);
  const allForDecomp = [...bonded, ...tendons.map((t) => ({ area: t.area, depth: t.depth, fse: t.fse }))];
  const decompAll = decompressionStrains(allForDecomp, props, fc);
  const decomp = decompAll.slice(0, bonded.length);

  // ── Equilibrium solve (mirrors analyzeBeam) ───────────────────────────────
  const b1 = beta1(fc);
  let cLow = 0.01;
  let cHigh = h;
  let c = h / 2;
  let residual = Infinity;
  const forceAt = (cc) => {
    let T = 0;
    for (let i = 0; i < bonded.length; i++) {
      const l = bonded[i];
      T += powerFormulaStress(steelStrain(l.depth, cc, l.fse, l.steel.Es, decomp[i]), l.steel) * l.area;
    }
    for (const t of tendons) T += tendonStress(t, ctx, cc) * t.area;
    return T;
  };
  for (let iter = 0; iter < 500; iter++) {
    c = (cLow + cHigh) / 2;
    residual = concreteCompression(fc, b1 * c, bf, bw, hf, section) - forceAt(c);
    if (Math.abs(residual) < 1e-6) break;
    if (residual > 0) cHigh = c; else cLow = c;
  }
  const converged = Math.abs(residual) < 1e-3;

  const a = b1 * c;
  const Cc = concreteCompression(fc, a, bf, bw, hf, section);
  const ccCentroid = compressionCentroid(a, bf, bw, hf, section);

  const layerResults = bonded.map((l, i) => {
    const eps = steelStrain(l.depth, c, l.fse, l.steel.Es, decomp[i]);
    const fs = powerFormulaStress(eps, l.steel);
    return { ...l, bonded: true, strain: eps, epsDecomp: decomp[i], stress: fs, force: fs * l.area };
  });
  const tendonResults = tendons.map((t) => {
    const fps = tendonStress(t, ctx, c);
    return {
      area: t.area, depth: t.depth, fse: t.fse, steel: t.steel, bonded: false,
      netFlexuralStrain: ECU * (t.depth - c) / c, // ACI "net tensile strain" at this depth
      stress: fps, force: fps * t.area,
    };
  });

  let Mn = -Cc * ccCentroid;
  for (const r of [...layerResults, ...tendonResults]) Mn += r.force * r.depth;

  // ── phi (21.2) ────────────────────────────────────────────────────────────
  // Extreme tension reinforcement = deepest layer, bonded or unbonded.
  // Bonded deepest: engine convention (total strain vs fpy/Es + 0.003), so a
  // section with no tendons reproduces analyzeBeam exactly.
  // Unbonded deepest: ACI literally. Tendon strain is not section-compatible,
  // so eps_t is the net flexural strain 0.003(dt - c)/c with eps_ty = 0.002 for
  // prestressed reinforcement (21.2.2.1).
  const deepestB = layerResults.reduce((m, r) => (!m || r.depth > m.depth ? r : m), null);
  const deepestU = tendonResults.reduce((m, r) => (!m || r.depth > m.depth ? r : m), null);
  let epsilonT; let epsilonTy; let phiBasis;
  if (deepestB && (!deepestU || deepestB.depth >= deepestU.depth)) {
    epsilonT = deepestB.strain;
    epsilonTy = deepestB.steel.fpy / deepestB.steel.Es;
    phiBasis = 'bonded layer (engine convention: total strain vs fpy/Es + 0.003)';
  } else {
    epsilonT = deepestU.netFlexuralStrain;
    epsilonTy = EPS_TY_PRESTRESSED_ACI;
    phiBasis = 'unbonded tendon (ACI net tensile strain 0.003(dt - c)/c, eps_ty = 0.002 per 21.2.2.1)';
  }
  const phi = phiFactor(epsilonT, epsilonTy);
  const phiMn = phi * Mn;
  const dt = Math.max(deepestB?.depth ?? 0, deepestU?.depth ?? 0) || 1;

  // ── Cracking and minimum reinforcement ───────────────────────────────────
  // prestressAndCracking counts every layer with fse > 0, which is right for
  // Mcr: the unbonded force precompresses the section like any other.
  const MuIn = (section.Mu || 0) * 12;
  const crackLayers = [...bonded, ...tendons.map((t) => ({ area: t.area, depth: t.depth, fse: t.fse }))];
  const cracking = prestressAndCracking(section, crackLayers, phiMn, MuIn);
  // Only re-scope the minimum-strength check when tendons are present, so a
  // job with no tendons returns exactly what analyzeBeam returns.
  if (tendons.length) {
    const hasBondedPrestress = bonded.some((l) => l.fse > 0);
    cracking.minStrengthApplies = hasBondedPrestress;
    cracking.minStrengthNote = hasBondedPrestress
      ? '9.6.2.1 applies: bonded prestressed reinforcement is present.'
      : '9.6.2.1 (1.2Mcr) does not apply: no bonded prestressed reinforcement. '
        + 'Minimum reinforcement is governed by 9.6.2.3 (As,min = 0.004 Act) instead.';
    if (!hasBondedPrestress) cracking.passesMinStrength = null;
  }

  const Act = props.A - areaAboveDepth(section, props.yCg);
  const AsMin = tendons.length ? 0.004 * Act : 0;
  const bondedMildTension = bonded
    .filter((l) => !(l.fse > 0) && l.steel.category !== 'prestressing' && l.depth > props.yCg)
    .reduce((s, l) => s + l.area, 0);
  const minBonded = tendons.length ? {
    provision: 'ACI 318-19 9.6.2.3 (beams); 7.6.2.3 (one-way slabs). Two-way slabs use 8.6.2.3, not checked here.',
    Act, AsMin, AsProvided: bondedMildTension, pass: bondedMildTension >= AsMin - 1e-9,
    note: 'As counts bonded deformed (fse = 0) layers between the centroid and the tension face.',
  } : null;

  const MuFt = section.Mu || 0;
  const demand = MuFt > 0 ? { MuFt, utilization: (MuFt * 12) / phiMn, pass: phiMn >= MuFt * 12 } : null;

  return {
    c, a, beta1: b1, Cc, ccCentroid,
    layerResults, tendonResults, fpsBasis,
    Mn, MnFt: Mn / 12, phi, phiMn, phiMnFt: phiMn / 12,
    epsilonT, epsilonTy, phiBasis, cOverD: c / dt,
    ductile: epsilonT >= epsilonTy + 0.003,
    transition: epsilonT >= epsilonTy && epsilonT < epsilonTy + 0.003,
    fc, section, converged, residual, demand, cracking, minBondedReinforcement: minBonded,
  };
}

/**
 * Service stresses on the uncracked gross section (24.5.2.2 permits this for
 * Class U and T). Compression negative, tension positive, ksi. Positive M puts
 * the bottom fiber in tension. The unbonded tendon force is taken as fse*Aps:
 * its stress increase under service load is spread over the whole tendon
 * length and is negligible at section level.
 *
 * @param service { MaFt, MsusFt?, twoWaySlab? }  kip-ft
 */
export function serviceStresses(sectionIn, bonded, tendons, service) {
  const section = normalizeSection(sectionIn);
  const { A, yCg, Ig } = grossSectionProperties(section);
  const h = section.h;
  const St = Ig / yCg;
  const Sb = Ig / (h - yCg);
  let P = 0; let Pd = 0;
  for (const l of [...bonded, ...tendons]) {
    if (l.fse > 0) { P += l.fse * l.area; Pd += l.fse * l.area * l.depth; }
  }
  const e = P > 0 ? Pd / P - yCg : 0;
  const fibers = (Mft) => {
    const M = Mft * 12;
    return {
      top: -P / A + (P * e) / St - M / St,
      bottom: -P / A - (P * e) / Sb + M / Sb,
    };
  };
  const total = fibers(service.MaFt ?? 0);
  const sus = service.MsusFt != null ? fibers(service.MsusFt) : null;

  const sqrtFcPsi = Math.sqrt(section.fc * 1000);
  const lim = (k) => (k * sqrtFcPsi) / 1000;
  const ft = Math.max(total.top, total.bottom, 0);
  let cls;
  if (service.twoWaySlab) cls = ft <= lim(6) ? 'U' : 'NOT PERMITTED (two-way slab must be Class U, ft <= 6 sqrt(f\'c))';
  else if (ft <= lim(7.5)) cls = 'U';
  else if (ft <= lim(12)) cls = 'T';
  else cls = 'C';

  const ftSus = sus ? Math.max(sus.top, sus.bottom, 0) : 0;
  const compTotal = -Math.min(total.top, total.bottom, 0);
  const compSus = sus ? -Math.min(sus.top, sus.bottom, 0) : null;
  return {
    section: { A, yCg, Ig, St, Sb },
    P, e, fpc: P / A,
    total, sustained: sus,
    ft, tensionLimits: { U: lim(7.5), T: lim(12), twoWayU: lim(6) },
    class: cls,
    classNote: cls === 'C'
      ? 'Class C: gross-section stresses are not valid past cracking. A cracked-section analysis with the unbonded force held at fse*Aps and 24.3.2 crack control on the bonded steel is required and is NOT performed here.'
      : 'Uncracked gross section (24.5.2.2).',
    sustainedTension: ftSus,
    sustainedTensionNote: ftSus > 0
      ? 'Tension also occurs under the sustained case. Class is set by the total service case; check which fiber this is and whether it is in the precompressed tensile zone.'
      : null,
    compression: {
      total: compTotal, limitTotal: 0.60 * section.fc, passTotal: compTotal <= 0.60 * section.fc,
      sustained: compSus, limitSustained: 0.45 * section.fc,
      passSustained: compSus == null ? null : compSus <= 0.45 * section.fc,
      provision: '24.5.4.1 (Class U and T only)',
    },
  };
}
