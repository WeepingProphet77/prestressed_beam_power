# Biaxial engine output — field reference

Read this only when `mode === "biaxial"` and you need the exact field shapes to
write the report. The uniaxial output is documented inline in SKILL.md; the
common case does not need this file. Everything here comes straight from
`analyzeBiaxial`, so you never need to open `engine/beamCalculations.js` to learn
the structure.

`analyze.mjs` prints `{ mode: "biaxial", result, resolvedSteel }`. The biaxial
`result` object:

```jsonc
{
  "mode": "biaxial",
  "section": { /* echo of the input section, with lambda + bendingMode */ },

  "props": {                 // gross transformed section properties
    "A": 288,                // in^2
    "xCg": 6, "yCg": 12,     // centroid, in (x right, y down from top fiber)
    "Ix": 13824, "Iy": 3456, // in^4
    "Ixy": 0,                // in^4 (product of inertia)
    "corners": [ { "x": -6, "y": -12 }, ... ]  // section corners about centroid
  },

  "envelope": [              // full φM sweep, one entry per angle θ (radians)
    {
      "theta": 0,            // load angle, radians
      "phiMx": 139.3,        // φMnx at this angle, kip-ft
      "phiMy": -83.8,        // φMny at this angle, kip-ft
      "Mx": 154.8, "My": -93.2, // nominal (unfactored) Mn at this angle, kip-ft
      "phiF": 0.9,           // φ used at this angle (varies with εt per §21.2)
      "c": 2.53              // neutral-axis depth at this angle, in
    }
    // ~144 entries covering 0..2π
  ],

  "anchors": {               // the four principal-axis capacity points
    "xSag": { "phiMx", "phiMy", "Mx", "My", "phi", "c", "epsT", "layerResults":[...] },
    "xHog": { ... },         // hogging about x
    "yPos": { ... },         // positive y
    "yNeg": { ... }          // negative y
    // each layerResults[] entry: { area, depth, x, fse, steel{...}, strain, stress, force }
  },

  "demand": {                // present only when Mux/Muy supplied
    "Mux": 150, "Muy": 20,   // factored demand, kip-ft
    "angle": 0.1326,         // demand vector angle, radians
    "capacity": 275.3,       // φM capacity along the demand angle, kip-ft
    "magnitude": 151.3,      // demand magnitude √(Mux²+Muy²), kip-ft
    "utilization": 0.5497,   // magnitude / capacity
    "pass": true
  },

  "cracking": {              // biaxial cracking check on the gross section
    "P": 156.06,             // total prestress force, kip
    "ex": 0, "ey": 9,        // prestress eccentricity, in
    "fr": 0.5303,            // modulus of rupture 7.5·λ·√f'c, ksi
    "det": 47775744,
    "Mcr":   { "xPos", "xNeg", "yPos", "yNeg" },   // cracking moments, kip-in (null where N/A)
    "McrFt": { "xPos", "xNeg", "yPos", "yNeg" },   // same, kip-ft
    "utilization": 0.5182,
    "cracks": false,         // true if service demand exceeds the cracking envelope
    "governing": { "x": 6, "y": 12 },              // governing fiber location, in
    "envelope": [ { "Mx", "My" }, ... ]            // service cracking envelope, kip-ft
  },

  "sectionPolygon": { "outer": [ { "x", "y" }, ... ], "holes": [ [ ... ] ] }
}
```

`resolvedSteel` is the same top-level array as in the uniaxial case
(`{ grade, name, Es, fpy, fpu, stressCap, Q, R, K }` per layer).

## What to report for biaxial

- The four `anchors` (φMnx sag/hog, φMny ±) as the principal-axis capacities.
- `demand.utilization` and `demand.pass` for the factored check.
- The `cracking` result (`cracks`, `utilization`, governing fiber) for service.
- The `envelope` array feeds `envelope.svg` from `diagrams.mjs`; you rarely need
  to tabulate every point in the written calc — cite the anchors and the demand
  point instead.
