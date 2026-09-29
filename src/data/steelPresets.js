/**
 * Steel type presets with power formula parameters.
 *
 * Power formula (this codebase's form):
 *   fs = Es * εs * [ Q + (1 - Q) / [1 + (Es*εs / (K*fpy))^R ]^(1/R) ]  ≤  stressCap
 *
 * Published form (Devalapura & Tadros 1992, Eq. 1 — algebraically identical):
 *   fps = εps * [ A + B / [1 + (C*εps)^D ]^(1/D) ]  ≤  fpu
 *
 * The two are related by:
 *   Es = A + B      Q = A / Es      K = Es / (C * fpy)      R = D
 *
 * ── Why the constants are stored as A, B, C, D ────────────────────────────
 *
 * The published research tabulates A, B, C, D, and the source paper warns that
 * "the large number of significant digits presented here is advisable to be
 * used because the values of fps are sensitive to these constants." Storing the
 * published values verbatim and deriving Es, Q, K, R at load time:
 *
 *   1. removes the rounding decision from the data (rounding K from 1.043452 to
 *      1.043 alone moves Gr. 270 stress by 0.07 ksi at ε = 0.01), and
 *   2. makes `Es === A + B` an assertion the loader can enforce. That identity
 *      is the strongest available check that a row is internally consistent,
 *      and it is exactly the check that catches the v1.0 error described below.
 *
 * The exported objects carry the same fields as before (Es, fpy, fpu, Q, R, K,
 * stressCap, ...), so every consumer is unchanged.
 *
 * ── Provenance: two classes, not equally authoritative ────────────────────
 *
 * PRESTRESSING rows are research output. Do not adjust them. Every one is the
 * transform above applied to Table 1 of Devalapura & Tadros (1992). The Gr. 270
 * row is that paper's own proposed curve, fitted to a 99% confidence lower
 * bound of 56 tensile tests; the Gr. 250 and Gr. 150 rows are the earlier
 * Skogman, Tadros & Grasmick (1988) fits reproduced in it, which that paper
 * describes as made under "conservative assumptions" amid a scarcity of
 * measured curves.
 *
 * MILD rows (grade60/65/70) are NOT research. They are a modeling convention:
 * Q = 0 and R = 100 degenerate the power formula to elastic-perfectly-plastic,
 * so classical mild steel runs through the same code path with no branch. The
 * mild K value is inert — the cap governs long before the knee (grade60:
 * K·fpy = 65.8 ksi against a 60 ksi cap) — and is carried only to keep every
 * row the same shape. Do not read meaning into it or cite it as a research value.
 *
 * ── v1.1 correction (spec §3, §12.1.1) ────────────────────────────────────
 *
 * Through v1.0, grade250 and grade270 shared Q = 0.031 / R = 7.36 / K = 1.043
 * and Es = 28800, and grade150 used Q = 0.016 / R = 3.75 / K = 1.04. Copying
 * one grade's shape parameters to another over-predicted steel stress by up to
 * 3.9% — unconservatively — and 28800 ksi is not a value from any cited source.
 * Each grade now carries its own published constants. Verify with:
 *
 *   npx vitest run src/data/steelPresets.test.js
 *
 * ── Adding a steel ────────────────────────────────────────────────────────
 *
 * Never invent Q, R, K, and never interpolate or copy them between grades.
 * Fit per the procedure in the methodology spec (§3.3, after Mattock 1979) and
 * record A, B, C, D at full published precision with the source and specimen
 * population. The research also supplies complete constants for ASTM A421
 * stress-relieved wire (235 ksi: A=403, B=28597, C=133.1, D=5.463, fpy=211.5;
 * 250 ksi: A=435, B=28565, C=125.1, D=6.351, fpy=225), deliberately omitted
 * here because this application does not offer them, and this table and the
 * separately maintained power-formula skill's table must stay in lockstep.
 *
 * Units: ksi for stresses/moduli, in for lengths.
 */

/**
 * Derive Es, Q, K, R from the published A, B, C, D and validate the row.
 * Throws on an internally inconsistent entry rather than silently producing
 * capacity numbers from bad data.
 */
function fromPublished(preset) {
  const { A, B, C, D, fpy, Es } = preset;

  const EsDerived = A + B;
  if (Math.abs(EsDerived - Es) > 1e-9) {
    throw new Error(
      `steelPresets: "${preset.id}" fails the Es = A + B identity `
      + `(A + B = ${EsDerived}, Es = ${Es}). One of the two is wrong.`
    );
  }

  return {
    ...preset,
    Q: A / EsDerived,          // strain-hardening ratio
    K: EsDerived / (C * fpy),  // knee location, K·fpy = fso
    R: D,                      // knee sharpness
  };
}

const rawPresets = [
  // ── Mild steel: modeling convention, not research (see header) ──────────
  {
    id: 'grade60',
    name: 'Grade 60 Bars',
    description: 'ASTM A615 Gr. 60 deformed reinforcing bars',
    category: 'mild',
    provenance: 'convention — degenerate parameterization, not research',
    Es: 29000,     // ksi
    fpu: 90,       // ksi (ultimate tensile strength)
    fpy: 60,       // ksi (yield)
    stressCap: 60, // mild steel: cap at fy
    Q: 0.0,
    R: 100,
    K: 1.096,      // inert: the cap governs before the knee
    defaultFse: 0, // no prestress for mild steel
  },
  {
    id: 'grade65',
    name: 'Grade 65 WWR',
    description: 'ASTM A1064 Gr. 65 welded wire reinforcement',
    category: 'mild',
    provenance: 'convention — degenerate parameterization, not research',
    Es: 29000,
    fpu: 80,
    fpy: 65,
    stressCap: 65, // mild steel: cap at fy
    Q: 0.0,
    R: 100,
    K: 1.096,      // inert
    defaultFse: 0,
  },
  {
    id: 'grade70',
    name: 'Grade 70 Plate',
    description: 'ASTM A709 Gr. 70 steel plate',
    category: 'mild',
    provenance: 'convention — degenerate parameterization, not research',
    Es: 29000,
    fpu: 90,
    fpy: 70,
    stressCap: 70, // mild steel: cap at fy
    Q: 0.0,
    R: 100,
    K: 1.06,       // inert
    defaultFse: 0,
  },

  // ── Prestressing steel: research output, do not adjust ──────────────────
  // Q, R, K are derived from A, B, C, D by fromPublished() below.
  {
    id: 'grade150',
    name: 'Gr. 150 Rods',
    description: 'ASTM A722 Gr. 150 high-strength threaded rods',
    category: 'prestressing',
    provenance: 'Devalapura & Tadros (1992) Table 1, 150 ksi bar, fpy/fpu = 0.85'
      + ' (1988-vintage fit; conservative by an unquantified margin)',
    // fpy per A722 is defined at 0.7% extension; this curve passes through
    // 127.5 ksi at ε = 0.0070 exactly, which is a constraint of the fit.
    A: 467, B: 28533, C: 225.2, D: 4.991,
    Es: 29000,
    fpu: 150,
    fpy: 127.5,
    stressCap: 150, // prestressing steel: cap at fpu
    defaultFse: 0,
  },
  {
    id: 'grade270',
    name: 'Gr. 270 Strand',
    description: 'ASTM A416 Gr. 270 7-wire low-relaxation strand',
    category: 'prestressing',
    provenance: 'Devalapura & Tadros (1992) proposed curve, fpy/fpu = 0.90',
    // fpy per A416 is defined at 1% extension; this curve passes through
    // 243.0 ksi at ε = 0.0100 exactly, which is a constraint of the fit.
    // Es = 28500, not 28800: the 1992 program measured moduli above the
    // then-customary 28000 and adopted 28500 to derive this curve.
    A: 887, B: 27613, C: 112.4, D: 7.360,
    Es: 28500,
    fpu: 270,
    fpy: 243,
    stressCap: 270, // prestressing steel: cap at fpu
    defaultFse: 170,
  },
  {
    id: 'grade250',
    name: 'Gr. 250 Strand',
    description: 'ASTM A416 Gr. 250 7-wire strand',
    category: 'prestressing',
    provenance: 'Devalapura & Tadros (1992) Table 1, 250 ksi strand, fpy/fpu = 0.90'
      + ' (1988-vintage fit; conservative by an unquantified margin)',
    A: 384, B: 27616, C: 119.7, D: 6.430,
    Es: 28000,
    fpu: 250,
    fpy: 225,
    stressCap: 250, // prestressing steel: cap at fpu
    defaultFse: 150,
  },
];

const steelPresets = rawPresets.map((p) =>
  (p.category === 'prestressing' ? fromPublished(p) : p)
);

export default steelPresets;
