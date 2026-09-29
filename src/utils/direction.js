/**
 * Moment direction (sag / hog) for uniaxial runs, plus the ACI 318-19
 * minimum-strength evaluation.
 *
 * Ported from the power-formula skill (v1.2, engine/direction.mjs). It
 * contains NO engineering math of its own.
 *
 * Why a flip and not a new solver: the engine measures every depth from the
 * extreme compression fiber and assumes that fiber is the member top. A
 * hogging (negative) moment on a section is exactly the same problem as a
 * sagging moment on that section rotated 180 degrees about a horizontal axis.
 * So for "hog" this module mirrors the geometry and the steel depths
 * (y -> h - y), runs the unchanged engine, and labels the result so every
 * depth is unambiguous. analyzeSection.test.js pins the flip three ways: a mirrored-input
 * parity check (must reproduce the sag result to 1e-9), a hand-derived T-beam
 * over a support, and the biaxial solver's own xHog anchor as an independent
 * cross-check.
 *
 * Sign convention (member frame, same as the biaxial solver and the service
 * block): positive moment puts the BOTTOM fiber in tension (sag); negative
 * puts the TOP fiber in tension (hog). section.Mu is signed. Steel depths are
 * ALWAYS entered from the member top, as drawn, in either direction.
 */
import { sectionToPolygon } from './beamCalculations.js';
import { normalizeSection } from './unbonded.js';

const TOL = 1e-9;

/** Resolve "sag" | "hog" from job.direction and the sign of section.Mu. */
export function resolveDirection(job) {
  const d = job.direction;
  const Mu = job.section?.Mu ?? 0;
  if (d != null && d !== 'sag' && d !== 'hog') {
    throw new Error(`"direction" must be "sag" or "hog" (got ${JSON.stringify(d)}).`);
  }
  if (d === 'sag' && Mu < 0) {
    throw new Error('direction "sag" conflicts with a negative Mu. Mu is signed: + = sag (bottom in tension), - = hog (top in tension).');
  }
  if (d === 'hog' && Mu > 0) {
    throw new Error('direction "hog" conflicts with a positive Mu. Mu is signed: enter a hogging demand as a negative number (e.g. "Mu": -85).');
  }
  return d ?? (Mu < 0 ? 'hog' : 'sag');
}

const mirrorRing = (ring, h) => ring.map((p) => ({ x: p.x, y: h - p.y })).reverse();

/** Rotate a section 180 degrees about a horizontal axis (y -> h - y). */
export function flipSection(section) {
  const { h } = section;
  if (!(h > 0)) throw new Error('Section "h" is required to analyze a hogging moment.');
  switch (section.sectionType) {
    case 'rectangular':
      return { ...section }; // symmetric about mid-depth
    case 'sandwich':
      return { ...section, bt: section.bb, bb: section.bt, ht: h - section.ht - section.hg };
    case 'hollowcore':
      return { ...section, voidCenterDepth: h - section.voidCenterDepth };
    case 'custom':
    case 'dxf':
      return {
        ...section,
        points: mirrorRing(section.points, h),
        holes: (section.holes || []).map((r) => mirrorRing(r, h)),
      };
    case 'tbeam':
    case 'doubletee': {
      // An inverted T or double tee is not a native engine shape, so express it
      // as the engine's own polygon (sectionToPolygon) and mirror that.
      const poly = sectionToPolygon(section);
      return {
        sectionType: 'custom',
        fc: section.fc,
        lambda: section.lambda,
        Mu: section.Mu,
        h,
        points: mirrorRing(poly.outer, h),
        holes: (poly.holes || []).map((r) => mirrorRing(r, h)),
        flippedFrom: section.sectionType,
      };
    }
    default:
      throw new Error(`Hogging analysis does not support sectionType "${section.sectionType}".`);
  }
}

/** Mirror steel depths into the flipped frame, checking they sit inside the section. */
export function flipLayers(layers, h, label = 'steelLayers') {
  return layers.map((l, i) => {
    if (l.depth < -TOL || l.depth > h + TOL) {
      throw new Error(`${label}[${i}]: depth ${l.depth} in is outside the section (0 to ${h} in from the top).`);
    }
    return { ...l, depth: h - l.depth };
  });
}

/**
 * Build the analysis-frame inputs for a uniaxial job. For "sag" they are the
 * inputs unchanged. For "hog" they are flipped, and Mu becomes its magnitude
 * because the engine only understands positive (compression-at-analysis-top)
 * demand.
 */
export function analysisFrame(sectionIn, layers, tendons, direction) {
  // Rectangular inputs may omit bf/hf; the engine's compression routine needs
  // them.
  const section = normalizeSection(sectionIn);
  if (direction !== 'hog') return { section, layers, tendons };
  const h = section.h;
  return {
    section: { ...flipSection(section), Mu: Math.abs(section.Mu ?? 0) },
    layers: flipLayers(layers, h, 'steelLayers'),
    tendons: flipLayers(tendons, h, 'unbondedTendons'),
  };
}

/** Label a uniaxial result with its direction and member-frame depths. */
export function annotateDirection(result, originalSection, direction) {
  const h = originalSection.h;
  const hog = direction === 'hog';
  result.direction = direction;
  result.compressionFace = hog ? 'bottom' : 'top';
  result.tensionFace = hog ? 'top' : 'bottom';
  const fromTop = (d) => (hog ? h - d : d);
  for (const lr of result.layerResults || []) lr.depthFromTop = fromTop(lr.depth);
  for (const tr of result.tendonResults || []) tr.depthFromTop = fromTop(tr.depth);
  if (hog) {
    result.analysisSection = result.section;
    result.section = originalSection;
    result.frameNote = 'HOGGING (top in tension). c, a, ccCentroid, and every layer "depth" are measured '
      + 'from the member BOTTOM, which is the compression face. "depthFromTop" gives each layer as drawn. '
      + 'Cracking properties yb/Sb refer to the tension face, which is the member TOP, so Mcr is the '
      + 'top-fiber cracking moment. Moments are magnitudes; the demand is hogging.';
    if (result.demand) result.demand.direction = 'hog';
  }
  return result;
}

/**
 * ACI 318-19 minimum flexural strength, evaluated from the engine's own Mcr.
 *
 * The engine's cracking block reports "lesser of 1.2Mcr and 1.33Mu" under the
 * label 9.6.1.3. That label is wrong and the 1.33Mu relief is not an ACI
 * 318-19 provision. This block is the ACI evaluation the app and report
 * carry; the engine's fields are left untouched so it stays numerically
 * identical to the power-formula skill's copy.
 *
 *   9.6.2.1  bonded prestressed reinforcement: phiMn >= 1.2 Mcr
 *   9.6.2.2  9.6.2.1 need not be satisfied if phiMn >= 2 Mu AND phiVn >= 2 Vu
 *            (shear is outside this app, so the flexure half is reported and
 *            the shear half is left for the engineer)
 *   nonprestressed: ACI minimum is As,min (9.6.1.2; 9.6.1.3 waives it when As
 *            provided >= 4/3 As required). 1.2Mcr is not the ACI check there.
 *   unbonded only: 9.6.2.3 (As,min = 0.004 Act), reported by unbonded.js.
 */
export function aciMinimumStrength(result, layers) {
  const cr = result.cracking;
  const bondedPS = layers.some((l) => (l.fse ?? 0) > 0);
  const phiMnFt = result.phiMnFt;
  if (!bondedPS) {
    const hasUnbonded = (result.tendonResults || []).length > 0;
    return {
      provision: hasUnbonded ? 'ACI 318-19 9.6.2.3' : 'ACI 318-19 9.6.1.2 / 9.6.1.3',
      applies: false,
      status: 'not-applicable',
      note: hasUnbonded
        ? '9.6.2.1 (1.2Mcr) applies only with bonded prestressed reinforcement. Minimum bonded reinforcement is 9.6.2.3, As,min = 0.004 Act; see minBondedReinforcement.'
        : 'Nonprestressed member: the ACI 318-19 minimum is As,min per 9.6.1.2 (beams; 7.6.1.1 for one-way slabs), waived by 9.6.1.3 where As provided >= 4/3 As required. Not checked here. The engine\'s 1.2Mcr comparison is informational only and is not the ACI provision.',
    };
  }
  const Mcr12Ft = 1.2 * cr.McrFt;
  const MuFt = Math.abs(result.demand?.MuFt ?? 0);
  const passes12 = phiMnFt >= Mcr12Ft;
  const flexWaiver = MuFt > 0 && phiMnFt >= 2 * MuFt;
  let status;
  if (!(cr.McrFt > 0)) status = 'precracked';
  else if (passes12) status = 'pass';
  else if (flexWaiver) status = 'waiver-flexure-met-confirm-shear';
  else status = 'fail';
  return {
    provision: 'ACI 318-19 9.6.2.1 (one-way slabs 7.6.2.1, two-way 8.6.2.2)',
    applies: true,
    face: result.tensionFace ?? 'bottom',
    Mcr12Ft,
    phiMnFt,
    passes12Mcr: passes12,
    waiver: {
      provision: 'ACI 318-19 9.6.2.2',
      twoMuFt: MuFt > 0 ? 2 * MuFt : null,
      flexureConditionMet: MuFt > 0 ? flexWaiver : null,
      shearCondition: 'phiVn >= 2Vu, not checked by this app',
    },
    status,
    note: {
      precracked: `Mcr = ${cr.McrFt.toFixed(2)} kip-ft is not positive: the effective prestress alone puts the ${result.tensionFace ?? 'bottom'} fiber past the modulus of rupture, so the section is cracked on that face before any applied moment. The 1.2Mcr threshold is degenerate and "passing" it means nothing. Typical cause: hogging on a member prestressed low in the section. Provide reinforcement on this face and confirm the fiber stress by a transfer/service check; this is an engineering judgment call, not a pass.`,
      'waiver-flexure-met-confirm-shear': 'phiMn < 1.2Mcr, but phiMn >= 2Mu. 9.6.2.1 is waived by 9.6.2.2 ONLY if phiVn >= 2Vu as well. Confirm shear before relying on this.',
    }[status] ?? null,
    engineLegacyCheck: `The engine's cracking.governs/passesMinStrength use "lesser of 1.2Mcr and 1.33Mu" (governs: ${cr.governs}). The 1.33Mu relief is an AASHTO LRFD form, not ACI 318-19. Report this block for ACI work.`,
  };
}
