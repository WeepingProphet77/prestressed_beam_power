/**
 * Tests for the ASCII DXF reader. Fixtures live in __fixtures__/.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseDxf, UNIT_SCALE_TO_INCHES } from './dxfParser';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(here, '__fixtures__', name), 'utf8');

// Magnitude of a closed ring via the shoelace formula.
const ringArea = (ring) => {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[(i + 1) % ring.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a / 2);
};

describe('parseDxf — closed LWPOLYLINE', () => {
  it('reads a single rectangle and its $INSUNITS', () => {
    const { rings, units } = parseDxf(fixture('rect.dxf'));
    expect(rings).toHaveLength(1);
    expect(rings[0]).toHaveLength(4);
    expect(units).toBe('in');
    expect(ringArea(rings[0])).toBeCloseTo(12 * 24, 6);
  });

  it('reads an outer ring plus an inner (hole) ring', () => {
    const { rings } = parseDxf(fixture('rect-with-hole.dxf'));
    expect(rings).toHaveLength(2);
    expect(ringArea(rings[0])).toBeCloseTo(288, 6);
    expect(ringArea(rings[1])).toBeCloseTo(32, 6); // 4 x 8 hole
  });
});

describe('parseDxf — POINT nodes', () => {
  it('reads POINT entities as nodes alongside the section ring', () => {
    const { rings, nodes } = parseDxf(fixture('rect-with-nodes.dxf'));
    expect(rings).toHaveLength(1);
    expect(ringArea(rings[0])).toBeCloseTo(12 * 24, 6);
    expect(nodes).toHaveLength(2);
    // Raw DXF coordinates (y up), in encounter order.
    expect(nodes[0]).toMatchObject({ x: 2, y: 2 });
    expect(nodes[1]).toMatchObject({ x: 6, y: 21 });
  });

  it('errors when nodes are present but no closed outline exists', () => {
    const dxf = [
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'POINT', '10', '2', '20', '2',
      '0', 'ENDSEC', '0', 'EOF',
    ].join('\n');
    expect(() => parseDxf(dxf)).toThrow(/no closed section outline/i);
  });
});

describe('parseDxf — bulge tessellation', () => {
  it('expands a two-vertex closed polyline with bulge 1 into a full circle', () => {
    const { rings } = parseDxf(fixture('bulge-circle.dxf'));
    expect(rings).toHaveLength(1);
    // Two semicircles → many points, not just two.
    expect(rings[0].length).toBeGreaterThan(8);
    // Circle of diameter 10 (R = 5): inscribed polygon area approaches π·25 ≈ 78.5.
    expect(ringArea(rings[0])).toBeGreaterThan(76);
    expect(ringArea(rings[0])).toBeLessThan(78.6);
  });
});

describe('parseDxf — CIRCLE', () => {
  it('tessellates a CIRCLE into a closed polygon ring', () => {
    const { rings } = parseDxf(fixture('circle.dxf'));
    expect(rings).toHaveLength(1);
    expect(rings[0].length).toBeGreaterThanOrEqual(32);
    expect(ringArea(rings[0])).toBeGreaterThan(77);
    expect(ringArea(rings[0])).toBeLessThan(78.6);
  });
});

describe('parseDxf — units detection', () => {
  it('maps $INSUNITS = 4 to millimeters', () => {
    const dxf = [
      '0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC',
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LWPOLYLINE', '90', '3', '70', '1',
      '10', '0', '20', '0', '10', '10', '20', '0', '10', '0', '20', '10',
      '0', 'ENDSEC', '0', 'EOF',
    ].join('\n');
    const { units } = parseDxf(dxf);
    expect(units).toBe('mm');
    expect(UNIT_SCALE_TO_INCHES.mm).toBeCloseTo(1 / 25.4, 8);
  });
});

describe('parseDxf — error handling', () => {
  it('rejects binary / non-ASCII content (NUL bytes)', () => {
    // Escaped control bytes keep this source file clean ASCII while still
    // exercising the binary-content guard at runtime.
    expect(() => parseDxf('\x00\x01\x02 not a dxf')).toThrow(/ASCII/i);
  });

  it('rejects content with no closed geometry', () => {
    const open = [
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LWPOLYLINE', '90', '3', '70', '0',
      '10', '0', '20', '0', '10', '10', '20', '0', '10', '5', '20', '8',
      '0', 'ENDSEC', '0', 'EOF',
    ].join('\n');
    expect(() => parseDxf(open)).toThrow(/no closed polylines/i);
  });

  it('treats a polyline whose last vertex equals the first as closed', () => {
    const dxf = [
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LWPOLYLINE', '90', '4', '70', '0',
      '10', '0', '20', '0', '10', '6', '20', '0', '10', '6', '20', '6',
      '10', '0', '20', '0', // closes back onto the first vertex
      '0', 'ENDSEC', '0', 'EOF',
    ].join('\n');
    const { rings } = parseDxf(dxf);
    expect(rings).toHaveLength(1);
    expect(ringArea(rings[0])).toBeCloseTo(18, 6); // triangle 6x6/2
  });
});
