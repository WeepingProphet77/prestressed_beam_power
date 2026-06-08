#!/usr/bin/env node
/**
 * Power-formula analysis runner.
 *
 * Reads a JSON job on stdin, drives the vendored beam-strength engine
 * (beamCalculations.js — the Devalapura–Tadros / PCI power formula with
 * ACI 318-19 strain-compatibility analysis), and prints the result JSON
 * on stdout. This is the single entry point the skill calls; it never
 * reimplements any engineering math.
 *
 * Input schema (stdin, JSON):
 * {
 *   "section": {
 *     "sectionType": "rectangular" | "tbeam" | "sandwich" | "doubletee" |
 *                    "hollowcore" | "custom",
 *     "fc": 5,                // f'c, ksi
 *     "lambda": 1,            // lightweight factor (optional, default 1)
 *     "Mu": 0,                // factored demand, kip-ft (optional; enables 1.33Mu relief)
 *     ...geometry fields per section type (see SKILL.md)
 *   },
 *   "steelLayers": [
 *     {
 *       "area": 0.918,        // in^2
 *       "depth": 21,          // in, from extreme compression fiber
 *       "x": 6,               // in, only for biaxial (horizontal position)
 *       "fse": 170,           // effective prestress after losses, ksi (0 = mild)
 *       "grade": "grade270"   // id from steelPresets.js
 *     }
 *   ],
 *   "mode": "uniaxial" | "biaxial",   // optional, default "uniaxial"
 *   "biaxial": { "Mux": 0, "Muy": 0, "MxService": 0, "MyService": 0 }  // optional
 * }
 *
 * Output: the full result object from analyzeBeam / analyzeBiaxial, plus the
 * resolved steel parameters per layer, as JSON on stdout.
 */
import { analyzeBeam, analyzeBiaxial } from './beamCalculations.js';
import steelPresets from './steelPresets.js';

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function resolveSteel(grade) {
  const preset = steelPresets.find((p) => p.id === grade);
  if (!preset) {
    const ids = steelPresets.map((p) => p.id).join(', ');
    throw new Error(`Unknown steel grade "${grade}". Available: ${ids}`);
  }
  return preset;
}

function buildLayers(steelLayers) {
  return steelLayers.map((l, i) => {
    if (typeof l.area !== 'number' || typeof l.depth !== 'number') {
      throw new Error(`Layer ${i}: "area" and "depth" are required numbers.`);
    }
    return {
      area: l.area,
      depth: l.depth,
      x: l.x ?? 0,
      fse: l.fse ?? 0,
      steel: resolveSteel(l.grade),
    };
  });
}

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) throw new Error('No input received on stdin.');
  const job = JSON.parse(raw);

  const { section, steelLayers, mode = 'uniaxial', biaxial = {} } = job;
  if (!section) throw new Error('Missing "section".');
  if (!Array.isArray(steelLayers) || steelLayers.length === 0) {
    throw new Error('"steelLayers" must be a non-empty array.');
  }

  const layers = buildLayers(steelLayers);

  let result;
  if (mode === 'biaxial') {
    result = analyzeBiaxial(section, layers, biaxial);
  } else {
    result = analyzeBeam(section, layers);
  }

  // Echo the resolved steel parameters so the report can cite Q/R/K/fpu etc.
  const resolvedSteel = layers.map((l) => ({
    grade: l.steel.id,
    name: l.steel.name,
    Es: l.steel.Es,
    fpy: l.steel.fpy,
    fpu: l.steel.fpu,
    stressCap: l.steel.stressCap,
    Q: l.steel.Q,
    R: l.steel.R,
    K: l.steel.K,
  }));

  process.stdout.write(JSON.stringify({ mode, result, resolvedSteel }, null, 2));
}

main().catch((err) => {
  process.stderr.write(`ERROR: ${err.message}\n`);
  process.exit(1);
});
