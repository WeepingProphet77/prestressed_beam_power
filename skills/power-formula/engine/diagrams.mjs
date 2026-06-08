#!/usr/bin/env node
/**
 * Power-formula diagram generator (dependency-free SVG).
 *
 * Reads the SAME job JSON as analyze.mjs on stdin and writes one or more SVG
 * files into an output directory. Diagrams:
 *   - section.svg        section outline + steel layers
 *   - strain.svg         strain diagram at ultimate (εcu=0.003 at top, line through c)
 *   - stress-strain.svg  power-formula curve for each distinct steel grade
 *   - envelope.svg       (biaxial only) φMx–φMy interaction envelope + demand point
 *
 * Usage:  node diagrams.mjs <outDir> < job.json
 *
 * SVG is used so the skill has zero external dependencies and the output is
 * viewable anywhere (browser, IDE, embedded in markdown).
 */
import {
  analyzeBeam,
  analyzeBiaxial,
  sectionToPolygon,
  generateStressStrainCurve,
  beta1,
} from './beamCalculations.js';
import steelPresets from './steelPresets.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

const resolveSteel = (g) => {
  const p = steelPresets.find((s) => s.id === g);
  if (!p) throw new Error(`Unknown steel grade "${g}".`);
  return p;
};

function buildLayers(steelLayers) {
  return steelLayers.map((l) => ({
    area: l.area, depth: l.depth, x: l.x ?? 0, fse: l.fse ?? 0,
    steel: resolveSteel(l.grade),
  }));
}

// ── tiny SVG helpers ──────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function svg(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="sans-serif">\n${body}\n</svg>\n`;
}
const line = (x1, y1, x2, y2, s = '#333', w = 1) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${s}" stroke-width="${w}"/>`;
const text = (x, y, t, opt = {}) =>
  `<text x="${x}" y="${y}" font-size="${opt.size || 12}" fill="${opt.fill || '#222'}" text-anchor="${opt.anchor || 'start'}">${esc(t)}</text>`;
const circle = (cx, cy, r, fill = '#c0392b') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;

// ── section sketch ─────────────────────────────────────────────────────────────
function sectionSvg(section, layers) {
  const poly = sectionToPolygon(section);
  const rings = [poly.outer, ...(poly.extra || [])];
  const allPts = rings.flat().concat((poly.holes || []).flat());
  const xs = allPts.map((p) => p.x), ys = allPts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const W = 360, H = 420, pad = 50;
  const sx = (W - 2 * pad) / Math.max(maxX - minX, 1e-6);
  const sy = (H - 2 * pad) / Math.max(maxY - minY, 1e-6);
  const s = Math.min(sx, sy);
  const px = (x) => pad + (x - minX) * s;
  const py = (y) => pad + (y - minY) * s;
  const pathOf = (ring, fill) =>
    `<path d="${ring.map((p, i) => `${i ? 'L' : 'M'}${px(p.x)},${py(p.y)}`).join(' ')} Z" fill="${fill}" stroke="#2c3e50" stroke-width="1.5"/>`;

  let body = text(W / 2, 24, 'Section', { anchor: 'middle', size: 14 });
  for (const r of rings) body += '\n' + pathOf(r, '#d6e4f0');
  for (const hole of poly.holes || []) body += '\n' + pathOf(hole, '#ffffff');
  for (const l of layers) {
    const cx = section.bendingMode === 'biaxial' || l.x ? px(l.x) : px((minX + maxX) / 2);
    body += '\n' + circle(cx, py(l.depth), Math.max(3, Math.sqrt(l.area) * s * 0.6),
      l.fse > 0 ? '#c0392b' : '#2c3e50');
  }
  // depth axis
  body += '\n' + line(pad - 20, py(minY), pad - 20, py(maxY), '#999', 1);
  body += '\n' + text(pad - 24, py(minY) - 4, 'top (comp.)', { anchor: 'end', size: 10, fill: '#666' });
  body += '\n' + text(pad - 24, py(maxY) + 12, 'bottom', { anchor: 'end', size: 10, fill: '#666' });
  return svg(W, H, body);
}

// ── strain diagram ─────────────────────────────────────────────────────────────
function strainSvg(section, result, layers) {
  const c = result.c, h = section.h, ecu = 0.003;
  const W = 380, H = 420, pad = 50;
  const py = (y) => pad + (y / h) * (H - 2 * pad);
  // strain at bottom fiber
  const epsBot = ecu * (h - c) / c;
  const maxStrain = Math.max(ecu, Math.abs(epsBot)) * 1.15 || 1;
  const zeroX = W * 0.45;
  const sx = (W - zeroX - pad) / maxStrain;
  const px = (eps) => zeroX + eps * sx; // tension positive to the right

  let body = text(W / 2, 24, 'Strain at ultimate', { anchor: 'middle', size: 14 });
  body += '\n' + line(zeroX, py(0), zeroX, py(h), '#999', 1); // zero-strain axis
  body += '\n' + line(pad, py(0), W - pad, py(0), '#ddd', 1);
  body += '\n' + line(pad, py(h), W - pad, py(h), '#ddd', 1);
  // strain line: -ecu at top (compression, left), +epsBot at bottom (right)
  body += '\n' + line(px(-ecu), py(0), px(epsBot), py(h), '#c0392b', 2);
  // neutral axis
  body += '\n' + line(pad, py(c), W - pad, py(c), '#2980b9', 1.5);
  body += '\n' + text(W - pad, py(c) - 4, `c = ${c.toFixed(2)} in`, { anchor: 'end', size: 11, fill: '#2980b9' });
  body += '\n' + text(px(-ecu) - 4, py(0) - 4, `εcu = -0.003`, { anchor: 'end', size: 10, fill: '#c0392b' });
  for (const lr of result.layerResults || []) {
    body += '\n' + circle(px(lr.strain), py(lr.depth), 3, '#222');
    body += '\n' + text(px(lr.strain) + 6, py(lr.depth) + 4,
      `ε=${lr.strain.toFixed(4)}`, { size: 9, fill: '#444' });
  }
  return svg(W, H, body);
}

// ── stress-strain curve ─────────────────────────────────────────────────────────
function stressStrainSvg(layers) {
  const grades = [...new Map(layers.map((l) => [l.steel.id, l.steel])).values()];
  const W = 480, H = 360, pad = 55;
  const curves = grades.map((g) => generateStressStrainCurve(g, 200));
  const maxEps = Math.max(...curves.flat().map((p) => p.strain));
  const maxFs = Math.max(...curves.flat().map((p) => p.stress));
  const px = (e) => pad + (e / maxEps) * (W - 2 * pad);
  const py = (f) => H - pad - (f / maxFs) * (H - 2 * pad);
  const colors = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad', '#e67e22'];

  let body = text(W / 2, 24, 'Power-formula stress–strain', { anchor: 'middle', size: 14 });
  body += '\n' + line(pad, py(0), W - pad, py(0), '#333', 1);
  body += '\n' + line(pad, py(0), pad, pad, '#333', 1);
  body += '\n' + text(W / 2, H - 10, 'strain εs', { anchor: 'middle', size: 11, fill: '#555' });
  body += '\n' + `<text x="16" y="${H / 2}" font-size="11" fill="#555" transform="rotate(-90 16 ${H / 2})" text-anchor="middle">stress fs (ksi)</text>`;
  grades.forEach((g, i) => {
    const pts = curves[i].map((p) => `${px(p.strain).toFixed(1)},${py(p.stress).toFixed(1)}`).join(' ');
    body += '\n' + `<polyline points="${pts}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="2"/>`;
    body += '\n' + text(W - pad - 140, pad + 6 + i * 16, `${g.name} (Q=${g.Q}, R=${g.R}, K=${g.K})`,
      { size: 10, fill: colors[i % colors.length] });
  });
  return svg(W, H, body);
}

// ── biaxial envelope ─────────────────────────────────────────────────────────────
function envelopeSvg(result) {
  const env = result.envelope;
  const W = 440, H = 440, pad = 55, cx = W / 2, cy = H / 2;
  const maxM = Math.max(...env.flatMap((p) => [Math.abs(p.phiMx), Math.abs(p.phiMy)])) * 1.1 || 1;
  const sc = (W / 2 - pad) / maxM;
  const px = (mx) => cx + mx * sc;
  const py = (my) => cy - my * sc;

  let body = text(W / 2, 24, 'φMx–φMy interaction envelope', { anchor: 'middle', size: 14 });
  body += '\n' + line(pad, cy, W - pad, cy, '#ccc', 1);
  body += '\n' + line(cx, pad, cx, H - pad, '#ccc', 1);
  body += '\n' + text(W - pad, cy - 6, 'φMx (k-ft)', { anchor: 'end', size: 10, fill: '#666' });
  body += '\n' + text(cx + 6, pad + 4, 'φMy (k-ft)', { size: 10, fill: '#666' });
  const pts = env.map((p) => `${px(p.phiMx).toFixed(1)},${py(p.phiMy).toFixed(1)}`).join(' ');
  body += '\n' + `<polygon points="${pts}" fill="#d6e4f0" fill-opacity="0.5" stroke="#2980b9" stroke-width="2"/>`;
  if (result.demand) {
    const d = result.demand;
    body += '\n' + line(cx, cy, px(d.Mux), py(d.Muy), '#c0392b', 1.5);
    body += '\n' + circle(px(d.Mux), py(d.Muy), 4, '#c0392b');
    body += '\n' + text(px(d.Mux) + 6, py(d.Muy),
      `demand (util=${Number.isFinite(d.utilization) ? d.utilization.toFixed(2) : '∞'})`,
      { size: 10, fill: '#c0392b' });
  }
  return svg(W, H, body);
}

async function main() {
  const outDir = process.argv[2] || '.';
  mkdirSync(outDir, { recursive: true });
  const job = JSON.parse(await readStdin());
  const { section, steelLayers, mode = 'uniaxial', biaxial = {} } = job;
  const layers = buildLayers(steelLayers);

  const written = [];
  const put = (name, content) => { writeFileSync(join(outDir, name), content); written.push(name); };

  put('section.svg', sectionSvg(section, layers));
  put('stress-strain.svg', stressStrainSvg(layers));

  if (mode === 'biaxial') {
    const result = analyzeBiaxial(section, layers, biaxial);
    put('envelope.svg', envelopeSvg(result));
  } else {
    const result = analyzeBeam(section, layers);
    void beta1; // (kept available for callers extending this script)
    put('strain.svg', strainSvg(section, result, layers));
  }
  process.stdout.write(`Wrote: ${written.join(', ')} -> ${outDir}\n`);
}

main().catch((err) => { process.stderr.write(`ERROR: ${err.message}\n`); process.exit(1); });
