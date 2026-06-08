#!/usr/bin/env node
/**
 * Sync the power-formula skill's engine with the repository's canonical source.
 *
 * The SINGLE SOURCE OF TRUTH for the methodology is:
 *   src/utils/beamCalculations.js   (the power-formula analysis engine)
 *   src/data/steelPresets.js        (per-grade Q/R/K parameters)
 *
 * A skill uploaded to Claude runs as a standalone bundle and cannot reach the
 * rest of the repo, so the skill keeps its own copy under engine/. This script
 * refreshes that copy from the canonical source and records the git commit it
 * came from, so the bundle always reflects the current methodology.
 *
 * Run it before downloading the skill to upload to Claude:
 *   node skills/power-formula/sync-engine.mjs      (or: npm run skill:sync)
 */
import { copyFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const engineDir = join(here, 'engine');
mkdirSync(engineDir, { recursive: true });

const files = [
  ['src/utils/beamCalculations.js', 'beamCalculations.js'],
  ['src/data/steelPresets.js', 'steelPresets.js'],
];

for (const [src, dest] of files) {
  copyFileSync(join(repoRoot, src), join(engineDir, dest));
  console.log(`synced ${src} -> engine/${dest}`);
}

let commit = 'unknown';
try {
  commit = execSync('git rev-parse HEAD', { cwd: repoRoot }).toString().trim();
} catch {
  /* not a git checkout — leave as unknown */
}

writeFileSync(
  join(engineDir, 'SOURCE.txt'),
  [
    'engine/beamCalculations.js and engine/steelPresets.js are GENERATED copies.',
    'Canonical source: src/utils/beamCalculations.js, src/data/steelPresets.js',
    `Synced from commit: ${commit}`,
    `Synced at: ${new Date().toISOString()}`,
    '',
    'Do not edit these copies directly. Edit the canonical source, then run:',
    '  node skills/power-formula/sync-engine.mjs   (or: npm run skill:sync)',
    '',
  ].join('\n'),
);
console.log(`stamped engine/SOURCE.txt (commit ${commit.slice(0, 12)})`);
