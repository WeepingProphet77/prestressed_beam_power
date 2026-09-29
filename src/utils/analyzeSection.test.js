/**
 * Worked examples and invariants ported from the power-formula skill's
 * `analyze.mjs --selftest` (v1.2). The skill is the methodology reference;
 * if one of these moves, the app and the skill disagree about a capacity.
 *
 * Tolerances follow spec §12.4: 5e-3 in on lengths, 0.05 on kip and kip-ft,
 * 5e-6 on strains, exact on booleans, beta1, phi and flags.
 */
import { describe, it, expect } from 'vitest';
import { analyzeSection } from './analyzeSection';
import { analyzeBeam, grossSectionProperties } from './beamCalculations';
import { analyzeWithUnbonded } from './unbonded';
import { flipSection } from './direction';
import { areaAboveDepth, normalizeSection } from './unbonded';
import steelPresets from '../data/steelPresets';

const steel = (id) => steelPresets.find((p) => p.id === id);
const L = (area, depth, fse, grade, x = 0) => ({ area, depth, fse, x, steel: steel(grade) });

const near = (actual, expected, tol) => {
  expect(Number.isFinite(actual)).toBe(true);
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tol);
};

// ── The skill's example jobs ─────────────────────────────────────────────────
const RC = {
  section: { sectionType: 'rectangular', bf: 12, bw: 12, hf: 24, h: 24, fc: 4 },
  layers: () => [L(3.0, 21.5, 0, 'grade60')],
};
const PS = {
  section: { sectionType: 'rectangular', bf: 12, bw: 12, hf: 24, h: 24, fc: 5, lambda: 1, Mu: 150 },
  layers: () => [L(0.918, 21, 170, 'grade270')],
};
const BIAX = {
  section: {
    sectionType: 'rectangular', bf: 12, bw: 12, hf: 24, h: 24, fc: 5, lambda: 1,
    bendingMode: 'biaxial', Mux: 150, Muy: 20, MxService: 90, MyService: 12,
  },
  layers: () => [L(0.459, 21, 170, 'grade270', 3), L(0.459, 21, 170, 'grade270', 9)],
};
const PANEL = {
  section: { sectionType: 'rectangular', bw: 96, h: 6, fc: 6, lambda: 1, Mu: 45 },
  layers: () => [L(1.20, 4.5, 0, 'grade60')],
  opts: () => ({
    tendons: [L(0.612, 5.0, 170, 'grade270')],
    unbonded: { method: 'aci', spanFt: 25 },
    service: { MaFt: 12, MsusFt: 8 },
  }),
};
const AASHTO = {
  section: { sectionType: 'rectangular', bf: 12, bw: 12, hf: 24, h: 24, fc: 5 },
  layers: () => [L(0.918, 21, 170, 'grade270')],
  opts: () => ({
    tendons: [L(0.459, 18, 165, 'grade270')],
    unbonded: { method: 'aashto', tendonLengthFt: 40, supportHinges: 0 },
  }),
};
const HOG_T = {
  section: { sectionType: 'tbeam', bf: 48, hf: 4, bw: 12, h: 24, fc: 4, Mu: -150 },
  layers: () => [L(2.4, 2.5, 0, 'grade60')],
  opts: () => ({ direction: 'hog' }),
};
const HOG_PS = {
  section: { sectionType: 'rectangular', bw: 12, h: 24, fc: 5, Mu: -10 },
  layers: () => [L(0.459, 21, 170, 'grade270'), L(0.459, 21, 170, 'grade270')],
};
const run = (job) => analyzeSection({ ...job.section }, job.layers(), job.opts ? job.opts() : {});

describe('Case A: reinforced concrete beam (mild steel)', () => {
  const r = run(RC);
  it('matches the documented values', () => {
    near(r.c, 5.1903, 5e-3);
    near(r.a, 4.4118, 5e-3);
    expect(r.beta1).toBe(0.85);
    near(r.Cc, 180.0, 0.05);
    near(r.layerResults[0].stress, 60.0, 0.05);
    near(r.MnFt, 289.412, 0.05);
    expect(r.phi).toBe(0.90);
    near(r.phiMnFt, 260.471, 0.05);
    near(r.epsilonT, 0.009427, 5e-6);
    near(r.cOverD, 0.24141, 5e-5);
    near(r.cracking.McrFt, 45.537, 0.05);
    expect(r.converged).toBe(true);
  });
  it('reports the nonprestressed ACI minimum as not applicable', () => {
    expect(r.minStrengthACI.status).toBe('not-applicable');
    expect(r.direction).toBe('sag');
  });
});

describe('Case B: pretensioned beam, corrected Gr. 270 constants', () => {
  const r = run(PS);
  it('matches the documented values', () => {
    near(r.c, 5.7877, 5e-3);
    near(r.a, 4.6301, 5e-3);
    expect(r.beta1).toBeCloseTo(0.80, 6);
    near(r.layerResults[0].stress, 257.229, 0.05);
    near(r.epsilonT, 0.014211, 5e-6);
    expect(r.phi).toBe(0.90);
    near(r.MnFt, 367.682, 0.05);
    near(r.phiMnFt, 330.914, 0.05);
    near(r.cracking.McrFt, 219.977, 0.05);
    near(r.demand.utilization, 0.4533, 5e-4);
    expect(r.demand.pass).toBe(true);
  });
  it('passes ACI 318-19 9.6.2.1 on 1.2Mcr alone', () => {
    expect(r.minStrengthACI.status).toBe('pass');
    near(r.minStrengthACI.Mcr12Ft, 263.972, 0.05);
  });
});

describe('Biaxial example', () => {
  const r = run(BIAX);
  it('matches the documented anchors and demand', () => {
    near(r.anchors.xSag.phiMx, 330.914, 0.05);
    near(r.anchors.xHog.phiMx, -12.427, 0.05);
    near(r.anchors.yPos.phiMy, -83.842, 0.05);
    near(r.anchors.yNeg.phiMy, 83.842, 0.05);
    near(r.demand.capacity, 274.517, 0.05);
    near(r.demand.utilization, 0.55125, 5e-4);
    near(r.cracking.utilization, 0.5182, 5e-4);
    expect(r.cracking.cracks).toBe(false);
    expect(r.envelope.length).toBe(180);
  });
});

describe('Case D: unbonded panel, ACI Table 20.3.2.4.1 (hand-derived)', () => {
  const r = run(PANEL);
  it('matches the hand calculation', () => {
    near(r.tendonResults[0].stress, 195.686, 0.05);
    expect(r.fpsBasis.perTendon[0].governs).toBe('formula');
    expect(r.fpsBasis.perTendon[0].row).toBe('l/h > 35');
    near(r.c, 0.52222, 5e-3);
    near(r.layerResults[0].stress, 60.0, 0.05);
    near(r.MnFt, 73.771, 0.05);
    near(r.epsilonT, 0.025723, 5e-6);
    expect(r.phi).toBe(0.90);
    expect(r.converged).toBe(true);
  });
  it('applies 9.6.2.3, not 9.6.2.1, with unbonded tendons only', () => {
    expect(r.cracking.minStrengthApplies).toBe(false);
    expect(r.minBondedReinforcement.AsMin).toBeCloseTo(1.152, 6);
    expect(r.minBondedReinforcement.pass).toBe(true);
    expect(r.minStrengthACI.status).toBe('not-applicable');
    expect(r.minStrengthACI.provision).toMatch(/9\.6\.2\.3/);
  });
  it('reports service stresses on the gross section', () => {
    near(r.service.total.top, -0.069375, 1e-6);
    near(r.service.total.bottom, -0.291875, 1e-6);
    expect(r.service.class).toBe('U');
  });
});

describe('Case E: bonded strand plus unbonded tendon, AASHTO fps', () => {
  const r = run(AASHTO);
  it('matches the independent Python solve', () => {
    near(r.c, 7.73391, 5e-3);
    near(r.tendonResults[0].stress, 184.249, 0.05);
    near(r.layerResults[0].stress, 251.605, 0.05);
    near(r.MnFt, 449.712, 0.05);
    expect(r.cracking.minStrengthApplies).toBe(true);
    expect(r.converged).toBe(true);
  });
});

describe('Case F: T-beam over a support, hogging (hand-derived)', () => {
  const r = run(HOG_T);
  it('matches the hand calculation', () => {
    expect(r.direction).toBe('hog');
    expect(r.compressionFace).toBe('bottom');
    near(r.a, 3.52941, 5e-3);
    near(r.c, 4.15225, 5e-3);
    near(r.MnFt, 236.824, 0.05);
    near(r.phiMnFt, 213.141, 0.05);
    near(r.epsilonT, 0.012534, 5e-6);
    expect(r.layerResults[0].depthFromTop).toBeCloseTo(2.5, 9);
    near(r.demand.utilization, 0.70376, 5e-4);
    expect(r.minStrengthACI.status).toBe('not-applicable');
    expect(r.converged).toBe(true);
  });
  it('uses the TOP-fiber cracking moment (sag value would be 60.881)', () => {
    near(r.cracking.McrFt, 107.712, 0.05);
  });
  it('restores the member-frame section on the result', () => {
    expect(r.section.sectionType).toBe('tbeam');
    expect(r.analysisSection.sectionType).toBe('custom');
  });
});

describe('Case G: prestressed beam in hog, cross-checked against the biaxial xHog anchor', () => {
  const r = run(HOG_PS);
  it('infers hog from Mu < 0 and matches the independent solver', () => {
    expect(r.direction).toBe('hog');
    near(r.phiMnFt, 12.427, 0.05);
    near(r.c, 3.68107, 5e-3);
    near(r.epsilonT, 0.0057712, 5e-6);
    expect(r.phi).toBe(0.65);
  });
  it('flags the top fiber as precracked by prestress', () => {
    expect(r.minStrengthACI.status).toBe('precracked');
  });
});

describe('parity: the unbonded path with no tendons reproduces analyzeBeam', () => {
  it.each([['rc', RC], ['ps', PS]])('%s', (_, job) => {
    const ref = analyzeBeam({ ...job.section }, job.layers());
    const alt = analyzeWithUnbonded({ ...job.section }, job.layers(), [], {});
    for (const get of [(r) => r.c, (r) => r.Mn, (r) => r.phi, (r) => r.epsilonT, (r) => r.cracking.Mcr]) {
      const x = get(ref);
      expect(Math.abs(x - get(alt))).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(x)));
    }
    expect(alt.cracking.passesMinStrength).toBe(ref.cracking.passesMinStrength);
    expect(alt.cracking.governs).toBe(ref.cracking.governs);
  });
});

describe('mirror parity: bars moved to the top and bent in hog == original in sag', () => {
  it('matches to 1e-9', () => {
    const ref = run(RC);
    const mir = analyzeSection(
      { ...RC.section },
      RC.layers().map((l) => ({ ...l, depth: RC.section.h - l.depth })),
      { direction: 'hog' },
    );
    for (const get of [(r) => r.c, (r) => r.Mn, (r) => r.phi, (r) => r.epsilonT, (r) => r.cracking.Mcr]) {
      const x = get(ref);
      expect(Math.abs(x - get(mir))).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(x)));
    }
  });
});

describe('flip invariants, every section type', () => {
  const CASES = [
    { sectionType: 'rectangular', bw: 12, h: 24, fc: 5 },
    { sectionType: 'tbeam', bf: 48, hf: 4, bw: 12, h: 24, fc: 5 },
    { sectionType: 'sandwich', bt: 48, ht: 3, hg: 4, bb: 40, h: 10, fc: 5 },
    { sectionType: 'doubletee', bf: 96, hf: 2, numStems: 2, stemWidth: 6, stemSpacing: 48, h: 24, fc: 5 },
    { sectionType: 'hollowcore', bf: 48, bw: 48, hf: 8, h: 8, numVoids: 6, voidDiameter: 5.5, voidCenterDepth: 4.5, fc: 5 },
    { sectionType: 'custom', h: 20, fc: 5,
      points: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 6 }, { x: 10, y: 6 }, { x: 10, y: 20 }, { x: 0, y: 20 }] },
    { sectionType: 'dxf', h: 20, fc: 5,
      points: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 6 }, { x: 10, y: 6 }, { x: 10, y: 20 }, { x: 0, y: 20 }] },
  ];
  it.each(CASES.map((c) => [c.sectionType, c]))('%s', (_, raw) => {
    const s0 = normalizeSection(raw);
    const s1 = normalizeSection(flipSection(s0));
    const p0 = grossSectionProperties(s0);
    const p1 = grossSectionProperties(s1);
    const h = s0.h;
    const rel = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a));
    expect(rel(p0.A, p1.A)).toBe(true);
    expect(rel(p0.Ig, p1.Ig)).toBe(true);
    expect(rel(h - p0.yCg, p1.yCg)).toBe(true);
    for (const f of [0.1, 0.3, 0.6]) {
      expect(rel(areaAboveDepth(s1, f * h), p0.A - areaAboveDepth(s0, h - f * h))).toBe(true);
    }
  });
});

describe('guards refuse rather than guess', () => {
  it('rejects sag with a negative Mu', () => {
    expect(() => analyzeSection({ ...RC.section, Mu: -50 }, RC.layers(), { direction: 'sag' })).toThrow(/conflicts/);
  });
  it('rejects hog with a positive Mu', () => {
    expect(() => analyzeSection({ ...RC.section, Mu: 50 }, RC.layers(), { direction: 'hog' })).toThrow(/conflicts/);
  });
  it('rejects fse < 0.5 fpu under the ACI table method', () => {
    const o = PANEL.opts();
    o.tendons[0].fse = 120;
    expect(() => analyzeSection({ ...PANEL.section }, PANEL.layers(), o)).toThrow(/0\.5 fpu/);
  });
  it('rejects unbonded tendons in biaxial mode', () => {
    expect(() => analyzeSection({ ...BIAX.section }, BIAX.layers(), { tendons: [L(0.5, 18, 170, 'grade270')] }))
      .toThrow(/uniaxial/);
  });
});
