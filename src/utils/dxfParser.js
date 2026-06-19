/**
 * Minimal, dependency-free ASCII DXF reader for the "Custom (DXF Import)"
 * section type.
 *
 * It walks the ENTITIES section and extracts the closed loops needed to define a
 * concrete cross-section:
 *   - LWPOLYLINE / POLYLINE that are closed (group code 70, bit 1) or whose last
 *     vertex coincides with the first. Arc segments (LWPOLYLINE "bulge" values)
 *     are tessellated into straight segments.
 *   - CIRCLE entities, tessellated to a polygon (commonly used for voids).
 *
 * It also reads $INSUNITS from the HEADER section so the caller can scale the
 * geometry to inches.
 *
 * Output coordinates are in the raw DXF coordinate system (y up, arbitrary
 * origin); higher-level normalization (flip to y-down/top = 0, unit scaling, and
 * solid/opening classification) lives in dxfGeometry.js.
 *
 * Out of scope (ignored, with a warning when a closed-looking entity is skipped):
 * binary DXF, ELLIPSE, SPLINE, HATCH, INSERT/blocks, and text.
 */

// $INSUNITS code → inches-per-unit. Only the common metric/imperial codes are
// mapped; anything else (0 = unitless, or unknown) returns null so the caller
// can fall back to a user-selected unit.
const INSUNITS_TO_INCHES = {
  1: 1,            // inches
  2: 12,           // feet
  4: 1 / 25.4,     // millimeters
  5: 1 / 2.54,     // centimeters
  6: 1000 / 25.4,  // meters
};

export const UNIT_SCALE_TO_INCHES = {
  in: 1,
  ft: 12,
  mm: 1 / 25.4,
  cm: 1 / 2.54,
  m: 1000 / 25.4,
};

const INSUNITS_TO_NAME = { 1: 'in', 2: 'ft', 4: 'mm', 5: 'cm', 6: 'm' };

const ENDPOINT_EPS = 1e-6; // coincident-vertex tolerance (DXF units)

/**
 * Tessellate a single bulged segment (an arc) from p1 to p2 into a list of
 * intermediate points, NOT including p1 and NOT including p2. A bulge is
 * tan(θ/4) where θ is the signed included angle of the arc.
 */
function tessellateBulge(p1, p2, bulge) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const chord = Math.hypot(dx, dy);
  if (Math.abs(bulge) < 1e-9 || chord < 1e-12) return [];

  // Arc center: midpoint + perpendicular(chord) · (1 − b²)/(4b).
  // perpendicular of (dx,dy) is (−dy,dx); this places the center on the correct
  // side for either sign of the bulge automatically.
  const mx = (p1.x + p2.x) / 2;
  const my = (p1.y + p2.y) / 2;
  const k = (1 - bulge * bulge) / (4 * bulge);
  const cx = mx - dy * k;
  const cy = my + dx * k;

  const theta = 4 * Math.atan(bulge); // signed sweep angle
  const a1 = Math.atan2(p1.y - cy, p1.x - cx);
  const R = Math.hypot(p1.x - cx, p1.y - cy);

  // ~16 segments per full revolution of arc, at least one interior point.
  const n = Math.max(1, Math.ceil(Math.abs(theta) / (Math.PI / 8)));
  const pts = [];
  for (let i = 1; i < n; i++) {
    const a = a1 + (theta * i) / n;
    pts.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
  }
  return pts;
}

/** Drop consecutive duplicate points (within tolerance) and a trailing point
 * that closes back onto the first. Returns a clean open ordered ring. */
function cleanRing(points) {
  const out = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (prev && Math.hypot(p.x - prev.x, p.y - prev.y) < ENDPOINT_EPS) continue;
    out.push(p);
  }
  // If the last point coincides with the first, drop it (rings are implicitly closed).
  if (out.length > 1) {
    const a = out[0];
    const b = out[out.length - 1];
    if (Math.hypot(a.x - b.x, a.y - b.y) < ENDPOINT_EPS) out.pop();
  }
  return out;
}

/** Tokenize raw DXF text into an array of { code, value } pairs. */
function tokenize(text) {
  // DXF lines come in pairs: an integer group code, then its value. Tolerate
  // both \n and \r\n. Trim only surrounding whitespace, never interior.
  const lines = text.split(/\r\n|\r|\n/);
  const tokens = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const codeStr = lines[i].trim();
    if (codeStr === '') { i -= 1; continue; } // skip stray blank, realign
    const code = Number(codeStr);
    if (!Number.isInteger(code)) {
      // Not a valid group code — almost certainly a binary or malformed DXF.
      throw new Error('This does not look like a text (ASCII) DXF file. Re-export as ASCII DXF.');
    }
    tokens.push({ code, value: lines[i + 1] });
  }
  return tokens;
}

/**
 * Parse ASCII DXF text.
 * @param {string} text
 * @returns {{ rings: Array<Array<{x:number,y:number}>>, nodes: Array<{x:number,y:number}>, units: string|null, warnings: string[] }}
 *   nodes are DXF POINT entities (reinforcement locations), in raw DXF coords.
 */
export function parseDxf(text) {
  if (typeof text !== 'string' || text.indexOf('\0') !== -1) {
    throw new Error('This does not look like a text (ASCII) DXF file. Re-export as ASCII DXF.');
  }
  const tokens = tokenize(text);
  if (!tokens.length) throw new Error('The DXF file is empty or unreadable.');

  const rings = [];
  const nodes = []; // DXF POINT entities → candidate steel-layer locations
  const warnings = [];
  let units = null;

  // ── HEADER: read $INSUNITS ──────────────────────────────────────────────
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].code === 9 && tokens[i].value.trim() === '$INSUNITS') {
      // The value follows as the next code-70 (integer) pair.
      const next = tokens[i + 1];
      const code = Number(next.value);
      if (Number.isFinite(code)) units = INSUNITS_TO_NAME[code] ?? null;
      break;
    }
  }

  // ── Walk entities ───────────────────────────────────────────────────────
  // Find the bounds of the ENTITIES section; if none, scan the whole file
  // (some exporters omit the SECTION wrapper for entity-only DXFs).
  let start = 0;
  let end = tokens.length;
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].code === 2 && tokens[i].value.trim() === 'ENTITIES') start = i + 1;
    if (start && tokens[i].code === 0 && tokens[i].value.trim() === 'ENDSEC' && i > start) {
      end = i;
      break;
    }
  }

  let i = start;
  while (i < end) {
    const tok = tokens[i];
    if (tok.code !== 0) { i++; continue; }
    const type = tok.value.trim();

    if (type === 'LWPOLYLINE') {
      const res = readLwpolyline(tokens, i + 1, end);
      i = res.next;
      const ring = finalizeRing(res.vertices, res.closed, warnings, 'LWPOLYLINE');
      if (ring) rings.push(ring);
    } else if (type === 'POLYLINE') {
      const res = readPolyline(tokens, i + 1, end);
      i = res.next;
      const ring = finalizeRing(res.vertices, res.closed, warnings, 'POLYLINE');
      if (ring) rings.push(ring);
    } else if (type === 'CIRCLE') {
      const res = readCircle(tokens, i + 1, end);
      i = res.next;
      if (res.circle) rings.push(circleToRing(res.circle));
    } else if (type === 'POINT') {
      const res = readPoint(tokens, i + 1, end);
      i = res.next;
      if (res.point) nodes.push(res.point);
    } else if (type === 'ELLIPSE' || type === 'SPLINE') {
      warnings.push(`A ${type} entity was found and skipped — only closed polylines and circles are supported.`);
      i++;
    } else {
      i++;
    }
  }

  if (!rings.length) {
    if (nodes.length) {
      throw new Error(
        `Found ${nodes.length} node(s) but no closed section outline. Draw the ` +
        `concrete cross-section with a closed polyline so the nodes can be placed inside it.`
      );
    }
    throw new Error('No closed polylines (or circles) were found in the DXF. Draw the section with closed polylines.');
  }

  return { rings, nodes, units, warnings };
}

/** Reads an LWPOLYLINE body starting after its "0/LWPOLYLINE" token. */
function readLwpolyline(tokens, from, end) {
  let closed = false;
  const verts = [];
  let cur = null;
  let i = from;
  for (; i < end; i++) {
    const { code, value } = tokens[i];
    if (code === 0) break; // next entity
    if (code === 70) {
      closed = (Number(value) & 1) === 1;
    } else if (code === 10) {
      if (cur) verts.push(cur);
      cur = { x: Number(value), y: 0, bulge: 0 };
    } else if (code === 20 && cur) {
      cur.y = Number(value);
    } else if (code === 42 && cur) {
      cur.bulge = Number(value);
    }
  }
  if (cur) verts.push(cur);
  return { vertices: verts, closed, next: i };
}

/** Reads a POLYLINE + its VERTEX list, up to SEQEND. */
function readPolyline(tokens, from, end) {
  let closed = false;
  const verts = [];
  let i = from;
  // Header of the POLYLINE (flags) precede the VERTEX entities.
  for (; i < end; i++) {
    const { code, value } = tokens[i];
    if (code === 0) break;
    if (code === 70) closed = (Number(value) & 1) === 1;
  }
  // Now consume VERTEX entities until SEQEND.
  while (i < end) {
    const { code, value } = tokens[i];
    if (code !== 0) { i++; continue; }
    const t = value.trim();
    if (t === 'VERTEX') {
      const v = { x: 0, y: 0, bulge: 0 };
      i++;
      for (; i < end; i++) {
        const tk = tokens[i];
        if (tk.code === 0) break;
        if (tk.code === 10) v.x = Number(tk.value);
        else if (tk.code === 20) v.y = Number(tk.value);
        else if (tk.code === 42) v.bulge = Number(tk.value);
      }
      verts.push(v);
    } else if (t === 'SEQEND') {
      i++;
      break;
    } else {
      break;
    }
  }
  return { vertices: verts, closed, next: i };
}

/** Reads a CIRCLE body. */
function readCircle(tokens, from, end) {
  const c = { x: 0, y: 0, r: 0 };
  let i = from;
  for (; i < end; i++) {
    const { code, value } = tokens[i];
    if (code === 0) break;
    if (code === 10) c.x = Number(value);
    else if (code === 20) c.y = Number(value);
    else if (code === 40) c.r = Number(value);
  }
  return { circle: c.r > 0 ? c : null, next: i };
}

/** Reads a POINT body (group code 10 = x, 20 = y). */
function readPoint(tokens, from, end) {
  const p = { x: null, y: null };
  let i = from;
  for (; i < end; i++) {
    const { code, value } = tokens[i];
    if (code === 0) break;
    if (code === 10) p.x = Number(value);
    else if (code === 20) p.y = Number(value);
  }
  const ok = Number.isFinite(p.x) && Number.isFinite(p.y);
  return { point: ok ? { x: p.x, y: p.y } : null, next: i };
}

/** Expand vertices+bulges into a clean closed ring, or null if not usable. */
function finalizeRing(vertices, closed, warnings, kind) {
  if (vertices.length < 2) return null;

  // Treat as closed if the flag says so OR the last vertex coincides with the first.
  const first = vertices[0];
  const last = vertices[vertices.length - 1];
  const coincident = Math.hypot(first.x - last.x, first.y - last.y) < ENDPOINT_EPS;
  const isClosed = closed || coincident;
  if (!isClosed) {
    warnings.push(`An open ${kind} was skipped — only closed polylines define solids or openings.`);
    return null;
  }

  // Expand bulges. Each vertex's bulge describes the arc to the NEXT vertex
  // (wrapping for the closing segment when the polyline is flagged closed).
  const pts = [];
  const n = vertices.length;
  const segCount = closed && !coincident ? n : n - 1;
  for (let k = 0; k < n; k++) {
    const v = vertices[k];
    pts.push({ x: v.x, y: v.y });
    if (k < segCount) {
      const nv = vertices[(k + 1) % n];
      if (Math.abs(v.bulge || 0) > 1e-9) {
        pts.push(...tessellateBulge(v, nv, v.bulge));
      }
    }
  }

  const ring = cleanRing(pts);
  return ring.length >= 3 ? ring : null;
}

/** Tessellate a CIRCLE into a closed polygon ring. */
function circleToRing(c, segments = 48) {
  const ring = [];
  for (let k = 0; k < segments; k++) {
    const a = (k / segments) * 2 * Math.PI;
    ring.push({ x: c.x + c.r * Math.cos(a), y: c.y + c.r * Math.sin(a) });
  }
  return ring;
}

export { INSUNITS_TO_INCHES };
