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
 * The result is capped at:
 *   - fpy (yield) for mild steel (Grade 60, 65, 70)
 *   - fpu (ultimate) for prestressing steel (Gr. 150, 250, 270)
 * This is controlled by the steel.stressCap property.
 *
 * @param {number} epsilonS  – total steel strain (positive = tension)
 * @param {object} steel     – { Es, fpu, fpy, Q, R, K, stressCap }
 * @returns {number} steel stress (ksi), same sign convention as strain
 */
export function powerFormulaStress(epsilonS, steel) {
  const { Es, fpy, Q, R, K } = steel;
  // stressCap: fpy for mild steel, fpu for prestressing steel
  const cap = steel.stressCap ?? steel.fpu;

  if (Math.abs(epsilonS) < 1e-12) return 0;

  const absEps = Math.abs(epsilonS);
  const EsEps = Es * absEps;
  const ratio = EsEps / (K * fpy);
  const ratioR = Math.pow(ratio, R);
  const bracket = Math.pow(1 + ratioR, 1 / R);
  const fs = EsEps * (Q + (1 - Q) / bracket);

  // Cap at yield for mild steel, at ultimate for prestressing steel
  const fsCapped = Math.min(fs, cap);

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
 * Compute the concrete compression force for a rectangular, T-section, sandwich section,
 * double tee, or hollow core section.
 *
 * For a T-beam:
 *   If a ≤ hf (stress block within the flange):
 *     Cc = 0.85 · f'c · a · bf
 *   If a > hf (stress block extends into the web):
 *     Cc = 0.85 · f'c · [hf · bf + (a − hf) · bw]
 *
 * For a sandwich section:
 *   If a ≤ ht (stress block within the top rectangle):
 *     Cc = 0.85 · f'c · a · bt
 *   If ht < a ≤ ht+hg (stress block in top rectangle only, gap has no concrete):
 *     Cc = 0.85 · f'c · ht · bt
 *   If a > ht+hg (stress block extends into bottom rectangle):
 *     Cc = 0.85 · f'c · [ht · bt + (a − ht − hg) · bb]
 *
 * For a double tee:
 *   If a ≤ hf (stress block within the flange):
 *     Cc = 0.85 · f'c · a · bf
 *   If a > hf (stress block extends into stems):
 *     Cc = 0.85 · f'c · [hf · bf + (a − hf) · numStems · stemWidth]
 *
 * For a hollow core:
 *   Calculate solid area minus void area at depth a
 *   Voids are circular with diameter voidDiameter
 *
 * For a rectangular beam, bf = bw and hf = h, so it reduces to Cc = 0.85·f'c·a·b.
 */
export function concreteCompression(fc, a, bf, bw, hf, section = null) {
  // Handle sandwich section if section object is provided
  if (section && section.sectionType === 'sandwich') {
    const { bt, ht, hg, bb } = section;
    if (a <= ht) {
      return 0.85 * fc * a * bt;
    } else if (a <= ht + hg) {
      return 0.85 * fc * ht * bt;
    } else {
      return 0.85 * fc * (ht * bt + (a - ht - hg) * bb);
    }
  }

  // Handle double tee section
  if (section && section.sectionType === 'doubletee') {
    const { numStems = 2, stemWidth } = section;
    if (a <= hf) {
      return 0.85 * fc * a * bf;
    }
    return 0.85 * fc * (hf * bf + (a - hf) * numStems * stemWidth);
  }

  // Handle hollow core section
  if (section && section.sectionType === 'hollowcore') {
    const { numVoids, voidDiameter, voidCenterDepth } = section;
    const grossArea = bf * a;

    // Calculate void area within stress block depth a
    let voidArea = 0;
    if (a > voidCenterDepth - voidDiameter / 2 && voidCenterDepth > 0) {
      // Voids intersect with stress block
      for (let i = 0; i < numVoids; i++) {
        const voidTop = voidCenterDepth - voidDiameter / 2;
        const voidBottom = voidCenterDepth + voidDiameter / 2;

        if (a <= voidTop) {
          // Stress block doesn't reach void
          continue;
        } else if (a >= voidBottom) {
          // Full void circle is within stress block
          voidArea += Math.PI * Math.pow(voidDiameter / 2, 2);
        } else {
          // Partial void intersection (circular segment)
          const r = voidDiameter / 2;
          const h = a - voidTop;
          // Use circular segment area formula
          const theta = 2 * Math.acos((r - h) / r);
          const segmentArea = (r * r / 2) * (theta - Math.sin(theta));
          voidArea += segmentArea;
        }
      }
    }

    const netArea = grossArea - voidArea;
    return 0.85 * fc * netArea;
  }

  // Handle T-beam and rectangular sections
  if (a <= hf) {
    return 0.85 * fc * a * bf;
  }
  return 0.85 * fc * (hf * bf + (a - hf) * bw);
}

/**
 * Centroid of the compression block from the extreme compression fiber.
 *
 * For sandwich sections:
 *   If a ≤ ht: centroid = a / 2
 *   If ht < a ≤ ht+hg: centroid = ht / 2 (only top rectangle contributes)
 *   If a > ht+hg: weighted centroid of top and bottom rectangles
 *
 * For double tee:
 *   Similar to T-beam but with multiple stems
 *
 * For hollow core:
 *   Approximated as gross section centroid minus void contribution
 */
export function compressionCentroid(a, bf, bw, hf, section = null) {
  // Handle sandwich section if section object is provided
  if (section && section.sectionType === 'sandwich') {
    const { bt, ht, hg, bb } = section;
    if (a <= ht) {
      return a / 2;
    } else if (a <= ht + hg) {
      return ht / 2;
    } else {
      const topArea = ht * bt;
      const botArea = (a - ht - hg) * bb;
      const totalArea = topArea + botArea;
      return (topArea * ht / 2 + botArea * (ht + hg + (a - ht - hg) / 2)) / totalArea;
    }
  }

  // Handle double tee section
  if (section && section.sectionType === 'doubletee') {
    const { numStems = 2, stemWidth } = section;
    if (a <= hf) {
      return a / 2;
    }
    const flangeArea = hf * bf;
    const stemArea = (a - hf) * numStems * stemWidth;
    const totalArea = flangeArea + stemArea;
    return (flangeArea * hf / 2 + stemArea * (hf + (a - hf) / 2)) / totalArea;
  }

  // Handle hollow core section
  if (section && section.sectionType === 'hollowcore') {
    const { numVoids, voidDiameter, voidCenterDepth } = section;
    const grossArea = bf * a;
    const grossCentroid = a / 2;

    // Calculate void contribution
    let voidMoment = 0;
    let voidArea = 0;

    if (a > voidCenterDepth - voidDiameter / 2 && voidCenterDepth > 0) {
      for (let i = 0; i < numVoids; i++) {
        const voidTop = voidCenterDepth - voidDiameter / 2;
        const voidBottom = voidCenterDepth + voidDiameter / 2;

        if (a <= voidTop) {
          continue;
        } else if (a >= voidBottom) {
          // Full void circle
          const area = Math.PI * Math.pow(voidDiameter / 2, 2);
          voidArea += area;
          voidMoment += area * voidCenterDepth;
        } else {
          // Partial void intersection
          const r = voidDiameter / 2;
          const h = a - voidTop;
          const theta = 2 * Math.acos((r - h) / r);
          const segmentArea = (r * r / 2) * (theta - Math.sin(theta));
          // Centroid of circular segment from chord
          const yBar = (4 * r * Math.pow(Math.sin(theta / 2), 3)) / (3 * (theta - Math.sin(theta)));
          const segmentCentroid = voidTop + yBar;
          voidArea += segmentArea;
          voidMoment += segmentArea * segmentCentroid;
        }
      }
    }

    const netArea = grossArea - voidArea;
    if (netArea <= 0) return grossCentroid;
    return (grossArea * grossCentroid - voidMoment) / netArea;
  }

  // Handle T-beam and rectangular sections
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
    const Cc = concreteCompression(fc, a, bf, bw, hf, section);

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
  const Cc = concreteCompression(fc, a, bf, bw, hf, section);
  const ccCentroid = compressionCentroid(a, bf, bw, hf, section);

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

  // Prestress & cracking analysis
  const cracking = prestressAndCracking(section, steelLayers, phiMn);

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
    cracking,
  };
}

/**
 * Compute the decompression strain for prestressed layers.
 * This is the additional strain needed to decompress the concrete at the steel level.
 */
export function decompressionStrain(fse, Es) {
  return fse / Es;
}

// ─── Gross section properties ────────────────────────────────────────────────

/**
 * Compute gross cross-section properties for all supported section types.
 *
 * Returns { A, yCg, Ig, yb, Sb }
 *   A   – gross area (in²)
 *   yCg – centroid depth from extreme compression fiber (in)
 *   Ig  – gross moment of inertia about centroidal axis (in⁴)
 *   yb  – distance from centroid to extreme tension fiber (in)
 *   Sb  – section modulus for the extreme tension fiber (in³)
 */
export function grossSectionProperties(section) {
  const { h } = section;

  let A, yCg, Ig;

  switch (section.sectionType) {
    case 'rectangular': {
      const b = section.bw;
      A = b * h;
      yCg = h / 2;
      Ig = (b * Math.pow(h, 3)) / 12;
      break;
    }

    case 'tbeam': {
      const { bf, bw, hf } = section;
      const hw = h - hf;
      const flangeA = bf * hf;
      const webA = bw * hw;
      A = flangeA + webA;
      yCg = (flangeA * hf / 2 + webA * (hf + hw / 2)) / A;
      const flangeI = (bf * Math.pow(hf, 3)) / 12 + flangeA * Math.pow(yCg - hf / 2, 2);
      const webI = (bw * Math.pow(hw, 3)) / 12 + webA * Math.pow(hf + hw / 2 - yCg, 2);
      Ig = flangeI + webI;
      break;
    }

    case 'sandwich': {
      const { bt, ht, hg, bb } = section;
      const hb2 = h - ht - hg;
      const topA = bt * ht;
      const botA = bb * hb2;
      A = topA + botA;
      yCg = (topA * ht / 2 + botA * (ht + hg + hb2 / 2)) / A;
      const topI = (bt * Math.pow(ht, 3)) / 12 + topA * Math.pow(yCg - ht / 2, 2);
      const botI = (bb * Math.pow(hb2, 3)) / 12 + botA * Math.pow(ht + hg + hb2 / 2 - yCg, 2);
      Ig = topI + botI;
      break;
    }

    case 'doubletee': {
      const { bf, hf, numStems = 2, stemWidth } = section;
      const hs = h - hf;
      const flangeA = bf * hf;
      const stemA = numStems * stemWidth * hs;
      A = flangeA + stemA;
      yCg = (flangeA * hf / 2 + stemA * (hf + hs / 2)) / A;
      const flangeI = (bf * Math.pow(hf, 3)) / 12 + flangeA * Math.pow(yCg - hf / 2, 2);
      const stemI = (numStems * stemWidth * Math.pow(hs, 3)) / 12 + stemA * Math.pow(hf + hs / 2 - yCg, 2);
      Ig = flangeI + stemI;
      break;
    }

    case 'hollowcore': {
      const { bf, numVoids, voidDiameter, voidCenterDepth } = section;
      const r = voidDiameter / 2;
      const voidA = numVoids * Math.PI * r * r;
      A = bf * h - voidA;
      // Gross rectangle centroid is h/2; void centroids are at voidCenterDepth
      const grossMoment = bf * h * (h / 2);
      const voidMoment = voidA * voidCenterDepth;
      yCg = (grossMoment - voidMoment) / A;
      // Moment of inertia: gross rectangle minus voids (parallel axis theorem)
      const grossI = (bf * Math.pow(h, 3)) / 12 + bf * h * Math.pow(h / 2 - yCg, 2);
      const voidIself = numVoids * (Math.PI * Math.pow(r, 4)) / 4;
      const voidIpar = voidA * Math.pow(voidCenterDepth - yCg, 2);
      Ig = grossI - voidIself - voidIpar;
      break;
    }

    default: {
      // Fallback to rectangular using bf × h
      const b = section.bf || section.bw;
      A = b * h;
      yCg = h / 2;
      Ig = (b * Math.pow(h, 3)) / 12;
    }
  }

  const yb = h - yCg;
  const Sb = Ig / yb;

  return { A, yCg, Ig, yb, Sb };
}

/**
 * Compute prestress force, eccentricity, cracking moment, and the 1.2Mcr check.
 *
 * Prestress force P = Σ(fse_i × As_i)  for layers with fse > 0
 * Eccentricity e = y_ps - y_cg  (positive when below centroid)
 *   where y_ps is the centroid of prestress force from top
 * Average precompressive stress f_pc = P / A
 * Modulus of rupture f_r = 7.5 √(f'c)  in psi → converted to ksi
 * Cracking moment Mcr = Sb × (fr + P/A + P×e/Sb)
 *
 * @returns { P, fpc, e, fr, Mcr, McrFt, phiMnOverMcr, passesMinStrength, sectionProps }
 */
export function prestressAndCracking(section, steelLayers, phiMn) {
  const sectionProps = grossSectionProperties(section);
  const { A, yCg, Sb } = sectionProps;

  // Effective prestress force: only layers with fse > 0
  let P = 0;
  let PeMoment = 0; // Σ(fse_i × As_i × d_i)
  for (const layer of steelLayers) {
    if (layer.fse > 0) {
      const force = layer.fse * layer.area;
      P += force;
      PeMoment += force * layer.depth;
    }
  }

  // Eccentricity of prestress centroid from section centroid
  // e > 0 means prestress centroid is below section centroid (typical)
  const yps = P > 0 ? PeMoment / P : yCg;
  const e = yps - yCg;

  // Average precompressive stress
  const fpc = P / A;

  // Modulus of rupture: fr = 7.5√f'c (psi units) → convert to ksi
  // f'c is in ksi, so f'c_psi = fc × 1000
  const fc = section.fc;
  const fr = 7.5 * Math.sqrt(fc * 1000) / 1000; // ksi

  // Cracking moment: Mcr = Sb × (fr + P/A + P×e/Sb)
  // = Sb × fr + Sb × P/A + P × e
  const Mcr = Sb * (fr + P / A + P * e / Sb);
  const McrFt = Mcr / 12;

  // 1.2Mcr check: φMn ≥ 1.2Mcr
  const threshold = 1.2 * Mcr;
  const thresholdFt = threshold / 12;
  const passesMinStrength = phiMn >= threshold;

  return {
    P,
    fpc,
    e,
    yps,
    fr,
    Mcr,
    McrFt,
    threshold,
    thresholdFt,
    passesMinStrength,
    sectionProps,
  };
}
