/**
 * Steel-table verification, ported from the power-formula skill's
 * `analyze.mjs --verify-steel`.
 *
 * beamCalculations.test.js checks that the CODE reproduces section results.
 * This checks that the DATA in steelPresets.js is right, which a section case
 * cannot: a tension-controlled strand sits near the fpu cap, where a wrong
 * curve and the right one nearly coincide.
 *
 *   Layer 0  Data integrity: Es = A + B, no two grades sharing a curve shape
 *            (the v1.0 defect), and the two hard fit constraints.
 *   Layer 1  The methodology's own stress table (self-consistent only).
 *   Layer 2  Devalapura & Tadros (1992) Table 2, an INDEPENDENTLY published
 *            design aid. The only check that fails because a constant was
 *            transcribed wrong. Never widen its tolerance.
 */
import { describe, it, expect } from 'vitest';
import steelPresets from './steelPresets';
import { powerFormulaStress, phiFactor } from '../utils/beamCalculations';

const byId = (id) => steelPresets.find((p) => p.id === id);
const prestressing = steelPresets.filter((p) => p.category === 'prestressing');

describe('Layer 0: data integrity', () => {
  it.each(prestressing.map((s) => [s.id, s]))('%s satisfies Es = A + B', (_, s) => {
    expect(Math.abs(s.A + s.B - s.Es)).toBeLessThan(1e-9);
  });

  it('no two prestressing grades share Q, R, K', () => {
    const keys = prestressing.map((s) => `${s.Q.toFixed(9)}|${s.R}|${s.K.toFixed(9)}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('no two prestressing grades share published A, B, C, D', () => {
    const keys = prestressing.map((s) => `${s.A}|${s.B}|${s.C}|${s.D}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('Gr. 270 passes 243.0 ksi at eps = 0.0100 (A416 fpy at 1% extension)', () => {
    expect(Math.abs(powerFormulaStress(0.01, byId('grade270')) - 243.0)).toBeLessThanOrEqual(0.05);
  });

  it('Gr. 150 passes 127.5 ksi at eps = 0.0070 (A722 fpy at 0.7% extension)', () => {
    expect(Math.abs(powerFormulaStress(0.007, byId('grade150')) - 127.5)).toBeLessThanOrEqual(0.05);
  });

  it('strand Es is 28,500 (Gr. 270) and 28,000 (Gr. 250), never the old 28,800', () => {
    expect(byId('grade270').Es).toBe(28500);
    expect(byId('grade250').Es).toBe(28000);
  });
});

describe('Layer 1: methodology stress table (spec §12.1)', () => {
  // 1e-3 ksi, not 1e-4: the table was generated from six-digit Q, R, K and
  // this file derives them from A, B, C, D at full precision. The spec
  // anticipates that difference. It is not a relaxation to force a pass.
  const EPS = [0.001, 0.002, 0.003, 0.005, 0.007, 0.010, 0.015, 0.020, 0.030];
  const TABLE = {
    grade60: [29.0000, 58.0000, 60.0000, 60.0000, 60.0000, 60.0000, 60.0000, 60.0000, 60.0000],
    grade70: [29.0000, 58.0000, 70.0000, 70.0000, 70.0000, 70.0000, 70.0000, 70.0000, 70.0000],
    grade150: [28.9966, 57.7889, 84.7637, 118.3388, 127.5020, 130.9336, 133.6472, 136.0266, 140.7085],
    grade250: [28.0000, 55.9991, 83.9822, 139.2249, 187.8152, 224.9397, 235.6484, 238.2593, 242.2203],
    grade270: [28.5000, 56.9999, 85.4962, 142.2322, 195.3935, 243.0397, 258.2668, 263.3216, 270.0000],
  };

  it.each(Object.entries(TABLE))('%s matches to 1e-3 ksi', (id, expected) => {
    const s = byId(id);
    EPS.forEach((e, i) => {
      expect(Math.abs(powerFormulaStress(e, s) - expected[i])).toBeLessThanOrEqual(1e-3);
    });
  });

  it('is odd in strain and zero at the origin, for every grade', () => {
    expect(powerFormulaStress(0, steelPresets[0])).toBe(0);
    for (const s of steelPresets) {
      for (const e of EPS) {
        expect(Math.abs(powerFormulaStress(-e, s) + powerFormulaStress(e, s))).toBeLessThanOrEqual(1e-12);
      }
    }
  });

  it('Gr. 60 holds the 60 ksi cap far past any reachable strain', () => {
    expect(powerFormulaStress(0.05, byId('grade60'))).toBeCloseTo(60, 9);
  });
});

describe('phi curves (spec §12.2), using the corrected Gr. 270 eps_ty', () => {
  const PHI = [
    [60 / 29000, [[0.002, 0.6500], [0.003, 0.7276], [0.004, 0.8109], [0.005, 0.8943], [0.006, 0.9000]]],
    [243 / 28500, [[0.008, 0.6500], [0.009, 0.6895], [0.010, 0.7728], [0.0114, 0.8895], [0.013, 0.9000]]],
  ];
  it.each(PHI)('eps_ty = %f', (epsTy, series) => {
    for (const [e, want] of series) {
      expect(Math.abs(phiFactor(e, epsTy) - want)).toBeLessThanOrEqual(5e-5);
    }
  });
});

describe('Layer 2: Devalapura & Tadros (1992) Table 2 design aid, ±0.1 ksi', () => {
  // The Gr. 250 eps = 0.050 cell deviates by 0.0903 ksi: ~90% of the
  // tolerance is consumed. Any movement here is signal. Do not widen it.
  const EPS = [0.0070, 0.0080, 0.0090, 0.0100, 0.0125, 0.0150, 0.0200, 0.0250, 0.0300, 0.0400, 0.0500];
  const AID = {
    grade270: [195.4, 217.0, 232.8, 243.0, 254.1, 258.3, 263.3, 267.8, 270.0, 270.0, 270.0],
    grade250: [187.8, 205.5, 217.5, 225.0, 232.9, 235.7, 238.3, 240.3, 242.2, 246.1, 250.0],
    grade150: [127.5, 129.1, 130.2, 130.9, 132.4, 133.7, 136.0, 138.4, 140.7, 145.4, 150.0],
  };

  it.each(Object.entries(AID))('%s reproduces the published design aid', (id, expected) => {
    const s = byId(id);
    EPS.forEach((e, i) => {
      expect(Math.abs(powerFormulaStress(e, s) - expected[i])).toBeLessThanOrEqual(0.1);
    });
  });
});
