/**
 * Single entry point for a section analysis. Mirrors the power-formula skill's
 * runJob (engine/analyze.mjs): it routes to the right solver and labels the
 * result, and contains no engineering math of its own.
 *
 *   biaxial                     -> analyzeBiaxial (covers both signs of Mx)
 *   uniaxial, sag or hog        -> analyzeBeam, in the frame direction.js sets
 *   uniaxial + tendons/service  -> analyzeWithUnbonded (identical to
 *                                  analyzeBeam when there are no tendons)
 *
 * Every uniaxial result carries `direction`, `compressionFace`, `tensionFace`,
 * `minStrengthACI` (ACI 318-19 9.6.2.1 / 9.6.2.2) and, when requested,
 * `service`.
 *
 * Layers and tendons are engine-shaped: { area, depth, fse, steel, x? }, with
 * depth always measured from the member TOP as drawn, in either direction.
 */
import { analyzeBeam, analyzeBiaxial } from './beamCalculations.js';
import { analyzeWithUnbonded, serviceStresses } from './unbonded.js';
import {
  resolveDirection, analysisFrame, annotateDirection, aciMinimumStrength,
} from './direction.js';

/**
 * @param section  engine section; section.Mu is SIGNED (+ sag, - hog), kip-ft
 * @param layers   bonded steel layers
 * @param opts     { direction?, tendons?, unbonded?, service? }
 *                 service: { MaFt, MsusFt?, twoWaySlab? }, kip-ft, signed
 *                 (+ = bottom fiber in tension)
 */
export function analyzeSection(section, layers, opts = {}) {
  const { tendons = [], unbonded = {}, service = null } = opts;
  if (layers.length === 0 && tendons.length === 0) {
    throw new Error('Add at least one steel layer or unbonded tendon.');
  }

  if (section.bendingMode === 'biaxial') {
    if (tendons.length) {
      throw new Error('Unbonded tendons are supported in uniaxial mode only.');
    }
    return analyzeBiaxial(section, layers, {
      Mux: section.Mux, Muy: section.Muy, MxService: section.MxService, MyService: section.MyService,
    });
  }

  const direction = resolveDirection({ direction: opts.direction, section });
  const f = analysisFrame(section, layers, tendons, direction);
  const result = (tendons.length || service)
    ? analyzeWithUnbonded(f.section, f.layers, f.tendons, unbonded)
    : analyzeBeam(f.section, f.layers);
  annotateDirection(result, section, direction);
  // analyzeBeam does not return the eps_ty it used; analyzeWithUnbonded does.
  // Recover it the same way (deepest bonded layer) so displays never guess.
  if (result.epsilonTy == null) {
    const d = result.layerResults.reduce((m, r) => (!m || r.depth > m.depth ? r : m), null);
    result.epsilonTy = d ? d.steel.fpy / d.steel.Es : 0.002;
  }
  result.minStrengthACI = aciMinimumStrength(result, layers);
  // Service stresses are linear on the real (unflipped) gross section with
  // signed moments, so they are computed in the member frame for both signs.
  if (service) result.service = serviceStresses(section, layers, tendons, service);
  return result;
}
