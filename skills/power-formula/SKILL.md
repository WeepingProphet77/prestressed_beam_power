---
name: power-formula
description: >-
  Analyze the flexural capacity of reinforced and prestressed concrete members
  using the "power formula" methodology (Devalapura–Tadros / PCI continuous
  steel stress-strain model with ACI 318-19 strain-compatibility analysis). Use
  when the user asks to check a concrete beam's moment capacity, φMn, cracking
  moment, ductility/φ, or demand utilization for rectangular, T, sandwich,
  double-tee, hollow-core, or custom sections — uniaxial or biaxial. Trigger on
  mentions of "power formula", prestressed/PT/post-tensioned beam capacity,
  strand/rebar flexural analysis, or φMn vs Mu checks.
---

# Power Formula — Concrete Flexural Capacity

This skill analyzes the **flexural strength** of reinforced and prestressed
concrete members using the **power formula** methodology. It is a *capacity /
analysis* tool: given a section and its steel, it reports φMn, the cracking
moment, ductility classification, and pass/fail against a factored demand.

The skill is **self-contained and portable**. It carries its own pinned copy of
the analysis engine under `engine/`, so it runs anywhere Node ≥ 18 is available
and does not depend on the surrounding repository. The engine is the single
source of truth — **never reimplement the engineering math by hand**; always
drive it through the scripts below.

## The methodology

- **Steel stress (the power formula):** the Devalapura–Tadros / PCI continuous
  model
  `fs = Es·εs·[Q + (1−Q)/[1 + (Es·εs/(K·fpy))^R]^(1/R)]`,
  capped at `fpy` for mild steel and `fpu` for prestressing steel. The grade
  parameters `Q, R, K, Es, fpy, fpu, stressCap` live in
  `engine/steelPresets.js` and are the authoritative source.
- **Strain compatibility (ACI 318-19):** εcu = 0.003; total steel strain =
  flexural `εcu·(d/c − 1)` + effective prestrain `fse/Es` + concrete
  decompression strain (bonded prestressed layers only). Neutral-axis depth `c`
  is solved by bisection on ΣF = 0, then Mn → φMn.
- **Code provisions:** β₁ (§22.2.2.4.3), φ from net tensile strain (§21.2),
  `Ec = 57000√f'c`, `fr = 7.5·λ·√f'c`, cracking moment `Mcr`, and the minimum
  flexural strength check φMn ≥ min(1.2·Mcr, 1.33·Mu) (§9.6.1.3).
- **Units:** US customary — ksi (stress/modulus), in (length), in² (area), kip
  (force), kip-ft / kip-in (moment).

## How to run an analysis

1. **Build the job JSON.** Gather the section, steel layers, f'c, λ, and any
   factored demand from the user. See the schema and examples below.
2. **Run the engine** (the single source of truth for all numbers):

   ```bash
   node engine/analyze.mjs < job.json
   ```

   It prints `{ mode, result, resolvedSteel }`. Check `result.converged` — if
   `false`, report it and show `result.residual` rather than trusting the
   numbers (usually the steel cannot be balanced within the section).
3. **Generate diagrams** (optional, requested by the user):

   ```bash
   node engine/diagrams.mjs <outDir> < job.json
   ```

   Writes dependency-free SVGs: `section.svg`, `strain.svg` (uniaxial),
   `stress-strain.svg`, and `envelope.svg` (biaxial).
4. **Write the calc report** from the result JSON (template below). Cite the
   ACI section next to each check.

## Input schema

```jsonc
{
  "section": {
    "sectionType": "rectangular | tbeam | sandwich | doubletee | hollowcore | custom",
    "fc": 5,            // f'c, ksi (REQUIRED)
    "lambda": 1,        // lightweight factor (optional, default 1)
    "Mu": 0,            // factored demand, kip-ft (optional; enables 1.33Mu relief)
    "bendingMode": "biaxial",  // only for biaxial runs
    // geometry per section type, all inches:
    //   rectangular: bw, h            (bf/hf may mirror bw/h)
    //   tbeam:       bf, bw, hf, h
    //   sandwich:    bt, ht, hg, bb, h
    //   doubletee:   bf, hf, numStems, stemWidth, h
    //   hollowcore:  bf, h, numVoids, voidDiameter, voidCenterDepth
    //   custom:      points:[{x,y}], holes:[[{x,y}]], h   (y down, 0 = top fiber)
  },
  "steelLayers": [
    {
      "area": 0.918,    // in^2 (REQUIRED)
      "depth": 21,      // in from extreme compression fiber (REQUIRED)
      "x": 6,           // in, horizontal position — biaxial only
      "fse": 170,       // effective prestress after losses, ksi (0 = mild)
      "grade": "grade270" // id from steelPresets.js (REQUIRED)
    }
  ],
  "mode": "uniaxial",   // or "biaxial"
  "biaxial": { "Mux": 0, "Muy": 0, "MxService": 0, "MyService": 0 } // kip-ft
}
```

**Steel grade ids:** `grade60`, `grade65`, `grade70` (mild); `grade150`,
`grade250`, `grade270` (prestressing). Defaults for `fse`: 0 (mild), 150
(Gr 250), 170 (Gr 270).

## Worked examples

Inputs live in `examples/`. Expected results (regression-verified against the
engine's own test suite):

| Example | Member | Key results |
|---|---|---|
| `examples/rc-beam.json` | Singly-reinforced RC: 12×24, d=21.5, As=3.0 Gr 60, f'c=4 | a ≈ 4.41 in, steel yields at 60 ksi, Mn ≈ 289.4 kip-ft, φ=0.90, φMn ≈ 260.5 kip-ft |
| `examples/prestressed-beam.json` | Prestressed: 12×24, Aps=0.918 Gr 270 @ d=21, fse=170, f'c=5, Mu=150 | strand ≈ 257 ksi, φMn ≈ 330.9 kip-ft, Mcr ≈ 220 kip-ft, min-strength governed by 1.33Mu, passes |
| `examples/biaxial-beam.json` | Biaxial: same section, two strands, Mux=150 / Muy=20 | full φMx–φMy envelope + demand utilization |

Run one:

```bash
node engine/analyze.mjs < examples/rc-beam.json
node engine/diagrams.mjs out/ < examples/prestressed-beam.json
```

## Report template (uniaxial)

```
POWER-FORMULA FLEXURAL CAPACITY — <member name>

Inputs
  Section: <type> <geometry>, f'c = <fc> ksi, λ = <lambda>
  Steel:   <per layer: area, depth, fse, grade (Q/R/K from resolvedSteel)>
  Demand:  Mu = <Mu> kip-ft   (if provided)

Flexural analysis (ACI 318-19 strain compatibility, εcu = 0.003)
  β₁ = <beta1>                                 [§22.2.2.4.3]
  Neutral axis  c = <c> in,  a = β₁c = <a> in
  Compression   Cc = <Cc> kip at <ccCentroid> in from top
  Per layer:    ε = <strain>, fs = <stress> ksi (power formula), F = <force> kip
  Mn  = <MnFt> kip-ft
  Net tensile strain εt = <epsilonT>  →  <ductile|transition|compression-controlled>
  φ   = <phi>                                  [§21.2]
  φMn = <phiMnFt> kip-ft

Cracking & minimum strength (§9.6.1.3)
  P = <P> kip, e = <e> in, f_pc = <fpc> ksi
  f_r = 7.5·λ·√f'c = <fr> ksi
  Mcr = <McrFt> kip-ft → 1.2Mcr = <Mcr12Ft> kip-ft
  Threshold governed by <governs>; φMn ≥ threshold? <passesMinStrength>

Demand check
  φMn vs Mu:  utilization = <demand.utilization>, <PASS|FAIL>

Convergence: <converged> (residual <residual>)
```

For biaxial, report the `anchors` (φMnx sag/hog, φMny ±), the demand
`utilization` from `result.demand`, and the cracking envelope from
`result.cracking`.

## Limitations & cautions

- **Lightweight concrete:** Ec uses the normalweight `57000√f'c`; the
  decompression strain is therefore slightly conservative for lightweight. `λ`
  is applied to `f_r` only.
- **Cracking** is computed on the **gross** (uncracked) section.
- **Decompression strain** applies only to bonded prestressed layers (fse > 0);
  mild steel carries no prestrain or decompression offset.
- Always confirm `converged === true` before reporting capacity.
- This skill covers **flexure only** — not shear, deflection, transfer/release
  stresses, or anchorage. Say so if asked.

## Revising the skill

The engine under `engine/` is a pinned copy of the source app's
`src/utils/beamCalculations.js` and `src/data/steelPresets.js`. To pick up
upstream improvements, replace those two files with the newer versions and
re-run the examples to confirm the regression values still hold.
