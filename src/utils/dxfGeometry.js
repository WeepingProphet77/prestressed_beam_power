/**
 * Turn the raw closed rings parsed from a DXF into the section geometry the
 * analysis engine expects.
 *
 * The engine's "custom" polygon convention is: coordinates in inches, y pointing
 * DOWN with y = 0 at the extreme compression fiber (top), x measured from the
 * left. DXF is y-UP with an arbitrary origin, so this module:
 *   1. classifies rings by point-in-polygon nesting depth
 *      (even depth = solid, odd depth = opening),
 *   2. scales to inches,
 *   3. flips Y and translates so the top fiber is y = 0 and the left edge x = 0.
 *
 * The current engine models a single outer ring plus interior holes, so more
 * than one top-level solid is rejected with a clear message.
 */
import { polygonProperties } from './beamCalculations';
// Re-export so UI code can import the unit map alongside the geometry helpers.
export { UNIT_SCALE_TO_INCHES } from './dxfParser';

/** Ray-casting point-in-polygon (even-odd rule). Boundary cases are not
 * significant for valid, non-touching nested section rings. */
function pointInRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x, yi = ring[i].y;
    const xj = ring[j].x, yj = ring[j].y;
    const intersects = (yi > pt.y) !== (yj > pt.y) &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Area-weighted centroid (shoelace). */
function ringCentroid(ring) {
  let a2 = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    const cross = p.x * q.y - q.x * p.y;
    a2 += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  if (Math.abs(a2) < 1e-12) return { x: ring[0].x, y: ring[0].y };
  return { x: cx / (3 * a2), y: cy / (3 * a2) };
}

/**
 * A point used to test whether this ring is nested inside another. Because rings
 * in a valid section never intersect, ANY point of the ring works — so we use a
 * vertex (nudged a hair toward the centroid to dodge ray-casting degeneracy on a
 * shared coordinate). Crucially we do NOT use the bare centroid: for a ring with
 * a concentric opening the centroid falls inside the opening, which would
 * mis-classify the outer boundary.
 */
function representativePoint(ring) {
  const c = ringCentroid(ring);
  const v = ring[0];
  return { x: v.x + 1e-6 * (c.x - v.x), y: v.y + 1e-6 * (c.y - v.y) };
}

/**
 * Compute the nesting depth of each ring: the number of OTHER rings that
 * contain its representative point. Even depth ⇒ solid, odd depth ⇒ opening.
 */
export function classifyRings(rings) {
  const reps = rings.map(representativePoint);
  return rings.map((_, i) => {
    let depth = 0;
    for (let j = 0; j < rings.length; j++) {
      if (j !== i && pointInRing(reps[i], rings[j])) depth++;
    }
    return depth;
  });
}

/**
 * Normalize parsed DXF rings into an engine-ready section geometry.
 *
 * @param {Array<Array<{x,y}>>} rings   closed rings in raw DXF coordinates
 * @param {object} opts
 * @param {number} [opts.unitScale]     inches per DXF unit (defaults to 1)
 * @param {Array<{x,y}>} [opts.nodes]   DXF POINT entities in raw DXF coordinates
 * @returns {{ points, holes, h, nodes, stats, warnings }}
 *   points  outer solid ring  [{x,y}]            (inches, y down, top = 0)
 *   holes   opening rings      [[{x,y}], ...]
 *   h       total depth (in)
 *   nodes   reinforcement locations [{x, depth}]  (inches; x from left, depth from top)
 *   stats   { width, height, area, openingCount, nodeCount }
 *   warnings string[]
 */
export function dxfRingsToSection(rings, { unitScale = 1, nodes = [] } = {}) {
  if (!rings || !rings.length) {
    throw new Error('No closed geometry was found in the DXF.');
  }
  const warnings = [];
  const depths = classifyRings(rings);

  const solids = rings.filter((_, i) => depths[i] % 2 === 0);
  const openings = rings.filter((_, i) => depths[i] === 1);
  const islands = rings.filter((_, i) => depths[i] >= 2);

  if (solids.length === 0) {
    throw new Error('Could not identify a solid outer boundary in the DXF.');
  }
  if (solids.length > 1) {
    throw new Error(
      `Found ${solids.length} separate solid regions. This section type supports a ` +
      `single connected outer boundary with interior openings. Combine the solids ` +
      `into one closed outline, or remove the extra regions.`
    );
  }
  if (islands.length) {
    warnings.push(
      `${islands.length} ring(s) nested inside an opening were ignored (islands within ` +
      `voids are not modeled).`
    );
  }

  const outer = solids[0];

  // Global bounds (over all rings; the outer encloses every opening, so these
  // equal the outer's bounds) for the flip + translate.
  let minX = Infinity, maxY = -Infinity, minYraw = Infinity, maxYraw = -Infinity;
  for (const ring of rings) {
    for (const p of ring) {
      if (p.x < minX) minX = p.x;
      if (p.y > maxY) maxY = p.y;
      if (p.y > maxYraw) maxYraw = p.y;
      if (p.y < minYraw) minYraw = p.y;
    }
  }

  // Flip Y (top fiber → 0) and shift left edge → 0, scaling to inches.
  const tx = (p) => ({
    x: (p.x - minX) * unitScale,
    y: (maxY - p.y) * unitScale,
  });
  const points = outer.map(tx);
  const holes = openings.map((ring) => ring.map(tx));

  const h = (maxYraw - minYraw) * unitScale;

  const section = { sectionType: 'dxf', points, holes };
  const { A } = polygonProperties(section);
  let width = 0;
  for (const p of points) if (p.x > width) width = p.x;

  // Transform reinforcement nodes into the engine convention (x from left,
  // depth from top), flag any that fall outside the concrete (or inside a void),
  // and order them top-to-bottom then left-to-right for a stable layer list.
  const transformedNodes = nodes.map((p) => {
    const t = tx(p);
    return { x: t.x, depth: t.y };
  });
  let outsideCount = 0;
  for (const n of transformedNodes) {
    const pt = { x: n.x, y: n.depth };
    const inSolid = pointInRing(pt, points);
    const inVoid = holes.some((hole) => hole.length >= 3 && pointInRing(pt, hole));
    if (!inSolid || inVoid) outsideCount++;
  }
  transformedNodes.sort((a, b) => a.depth - b.depth || a.x - b.x);
  if (outsideCount) {
    warnings.push(
      `${outsideCount} node(s) lie outside the concrete (or inside a void). Their ` +
      `steel layers were still created — reposition them or adjust the section.`
    );
  }

  return {
    points,
    holes,
    h,
    nodes: transformedNodes,
    stats: { width, height: h, area: A, openingCount: holes.length, nodeCount: transformedNodes.length },
    warnings,
  };
}
