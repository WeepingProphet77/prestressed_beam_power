/**
 * Prestressed / Reinforced Concrete Beam Strength Calculator
 * Based on ACI 318 provisions and the Devalapura-Tadros (PCI) power formula.
 *
 * All units: ksi (stress), in (length), in² (area), kip (force), kip-in (moment)
 */

// ─── ACI 318 helpers ────────────────────────────────────────────────────────

/**
 * Whitney stress-block depth factor β₁ per ACI 318-19 §22.2.2.4.3
 */
export function beta1(fc) {
  if (fc <= 4) return 0.85;
  if (fc >= 8) return 0.65;
  return 0.85 - 0.05 * (fc - 4);
}

/**
 * Strength reduction factor φ per ACI 318-19 §21.2
 * Based on net tensile strain in the extreme tension steel layer.
 * εty = fpy / Es  (yield strain of outermost tension steel)
 */
export function phiFactor(epsilonT, epsilonTy) {
  if (epsilonT >= epsilonTy + 0.003) return 0.90;
  if (epsilonT <= epsilonTy) return 0.65;
  return 0.65 + 0.25 * (epsilonT - epsilonTy) / 0.003;
}

// ─── Power formula ──────────────────────────────────────────────────────────

/**
 * Devalapura-Tadros / PCI power formula for steel stress.
 *
 *   fs = Es·εs · [ Q + (1 − Q) / [1 + (Es·εs / (K·fpy))^R ]^(1/R) ]
 *
 * The result is capped at ±fpu and the sign follows the sign of εs.
 *
 * @param {number} epsilonS  – total steel strain (positive = tension)
 * @param {object} steel     – { Es, fpu, fpy, Q, R, K }
 * @returns {number} steel stress (ksi), same sign convention as strain
 */
export function powerFormulaStress(epsilonS, steel) {
  const { Es, fpu, fpy, Q, R, K } = steel;

  if (Math.abs(epsilonS) < 1e-12) return 0;

  const absEps = Math.abs(epsilonS);
  const EsEps = Es * absEps;
  const ratio = EsEps / (K * fpy);
  const ratioR = Math.pow(ratio, R);
  const bracket = Math.pow(1 + ratioR, 1 / R);
  const fs = EsEps * (Q + (1 - Q) / bracket);

  // Cap at fpu
  const fsCapped = Math.min(fs, fpu);

  return epsilonS >= 0 ? fsCapped : -fsCapped;
}

/**
 * Generate stress-strain curve data points for a given steel type.
 */
export function generateStressStrainCurve(steel, numPoints = 200) {
  const maxStrain = steel.fpu / steel.Es * 3; // go well past yield
  const points = [];
  for (let i = 0; i <= numPoints; i++) {
    const eps = (i / numPoints) * maxStrain;
    const fs = powerFormulaStress(eps, steel);
    points.push({ strain: eps, stress: fs });
  }
  return points;
}

// ─── Strain compatibility ───────────────────────────────────────────────────

/**
 * Total steel strain at layer i using strain compatibility.
 *
 *   εsi = εcu · (di / c − 1) + εso
 *
 * where εso = fse / Es  (initial strain from effective prestress, 0 for mild steel)
 * εcu = 0.003 per ACI 318
 *
 * @param {number} di   – depth of steel layer from extreme compression fiber (in)
 * @param {number} c    – neutral-axis depth from extreme compression fiber (in)
 * @param {number} fse  – effective prestress after losses (ksi), 0 for mild steel
 * @param {number} Es   – steel modulus (ksi)
 * @returns {number} total strain (positive = tension)
 */
export function steelStrain(di, c, fse, Es) {
  const ecu = 0.003;
  const eso = fse / Es; // initial prestrain
  return ecu * (di / c - 1) + eso;
}

// ─── Section analysis (rectangular / T-beam) ────────────────────────────────

/**
 * Compute the concrete compression force for a rectangular or T-section.
 *
 * For a T-beam:
 *   If a ≤ hf (stress block within the flange):
 *     Cc = 0.85 · f'c · a · bf
 *   If a > hf (stress block extends into the web):
 *     Cc = 0.85 · f'c · [hf · bf + (a − hf) · bw]
 *
 * For a rectangular beam, bf = bw and hf = h, so it reduces to Cc = 0.85·f'c·a·b.
 */
export function concreteCompression(fc, a, bf, bw, hf) {
  if (a <= hf) {
    return 0.85 * fc * a * bf;
  }
  return 0.85 * fc * (hf * bf + (a - hf) * bw);
}

/**
 * Centroid of the compression block from the extreme compression fiber.
 */
export function compressionCentroid(a, bf, bw, hf) {
  if (a <= hf) {
    return a / 2;
  }
  const flangeArea = hf * bf;
  const webArea = (a - hf) * bw;
  const totalArea = flangeArea + webArea;
  return (flangeArea * hf / 2 + webArea * (hf + (a - hf) / 2)) / totalArea;
}

/**
 * Main analysis: find neutral axis depth c by force equilibrium, then compute Mn.
 *
 * @param {object} section – { bf, bw, hf, h, fc }
 *   bf = flange width (in), bw = web width (in), hf = flange thickness (in), h = total depth (in)
 *   fc = concrete compressive strength (ksi)
 *
 * @param {Array} steelLayers – [{ area, depth, fse, steel: { Es, fpu, fpy, Q, R, K } }, ...]
 *   area = area of steel (in²)
 *   depth = distance from extreme compression fiber (in)
 *   fse = effective prestress (ksi), 0 for mild steel
 *
 * @returns {object} results
 */
export function analyzeBeam(section, steelLayers) {
  const { bf, bw, hf, h, fc } = section;
  const b1 = beta1(fc);

  // Bisection to find c where ΣF = 0
  // Compression is positive, tension in steel at bottom is positive
  let cLow = 0.01;
  let cHigh = h;
  let c = h / 2;
  const maxIter = 500;
  const tolerance = 1e-6;

  for (let iter = 0; iter < maxIter; iter++) {
    c = (cLow + cHigh) / 2;
    const a = b1 * c;

    // Concrete compression
    const Cc = concreteCompression(fc, a, bf, bw, hf);

    // Steel forces (positive = tension)
    let totalSteelForce = 0;
    for (const layer of steelLayers) {
      const eps = steelStrain(layer.depth, c, layer.fse, layer.steel.Es);
      const fs = powerFormulaStress(eps, layer.steel);
      totalSteelForce += fs * layer.area;
    }

    // Equilibrium: Cc − totalSteelForce = 0  (compression balances tension)
    const residual = Cc - totalSteelForce;

    if (Math.abs(residual) < tolerance) break;

    if (residual > 0) {
      // Too much compression → c is too large → reduce c
      cHigh = c;
    } else {
      // Too much tension → c is too small → increase c
      cLow = c;
    }
  }

  // Final results with converged c
  const a = b1 * c;
  const Cc = concreteCompression(fc, a, bf, bw, hf);
  const ccCentroid = compressionCentroid(a, bf, bw, hf);

  // Compute per-layer results
  const layerResults = steelLayers.map((layer) => {
    const eps = steelStrain(layer.depth, c, layer.fse, layer.steel.Es);
    const fs = powerFormulaStress(eps, layer.steel);
    const force = fs * layer.area;
    return {
      ...layer,
      strain: eps,
      stress: fs,
      force,
    };
  });

  // Nominal moment about the extreme compression fiber
  let Mn = Cc * ccCentroid; // Concrete compression contribution (negative about top)
  // Wait – let's take moment about a common point. Take moment about the extreme compression fiber (top).
  // Mn = Σ (steel tension forces × depth) − Cc × centroid_of_compression_block
  Mn = 0;
  for (const lr of layerResults) {
    Mn += lr.force * lr.depth;
  }
  Mn -= Cc * ccCentroid;

  // Net tensile strain in outermost tension steel (for φ factor)
  let maxDepth = 0;
  let extremeTensionLayer = null;
  for (const lr of layerResults) {
    if (lr.depth > maxDepth) {
      maxDepth = lr.depth;
      extremeTensionLayer = lr;
    }
  }

  const epsilonT = extremeTensionLayer ? extremeTensionLayer.strain : 0;
  const epsilonTy = extremeTensionLayer
    ? extremeTensionLayer.steel.fpy / extremeTensionLayer.steel.Es
    : 0.002;

  const phi = phiFactor(epsilonT, epsilonTy);
  const phiMn = phi * Mn;

  // c/d ratio for ductility check
  const dt = maxDepth || 1;
  const cOverD = c / dt;

  return {
    c,
    a,
    beta1: b1,
    Cc,
    ccCentroid,
    layerResults,
    Mn,         // kip-in
    MnFt: Mn / 12,  // kip-ft
    phi,
    phiMn,      // kip-in
    phiMnFt: phiMn / 12,  // kip-ft
    epsilonT,
    cOverD,
    fc,
    section,
    ductile: epsilonT >= epsilonTy + 0.003,
    transition: epsilonT >= epsilonTy && epsilonT < epsilonTy + 0.003,
  };
}

/**
 * Compute the decompression strain for prestressed layers.
 * This is the additional strain needed to decompress the concrete at the steel level.
 */
export function decompressionStrain(fse, Es) {
  return fse / Es;
}
