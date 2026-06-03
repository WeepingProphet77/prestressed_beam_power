import { useEffect, useRef, useState } from 'react';

/**
 * Interactive cross-section drawer for the "custom" section type.
 *
 * The user builds an outer polygon (the solid concrete) and, optionally, one
 * or more hole polygons (voids). Coordinates are in inches with y pointing
 * downward — the same depth-from-top convention used by the analysis engine.
 *
 * Controls:
 *   Arrow keys  – move the cursor by the current step (settable, default 0.25")
 *   Spacebar    – drop a node at the cursor
 *   Backspace   – undo the last node
 *   Enter        – close the current ring back to its first node
 *   (mouse)      – click to drop a node; click the first node to close
 *
 * Rings: index 0 is the outer (solid) ring; any further rings are holes.
 * Whenever the set of closed rings changes, onChange(outer, holes) fires.
 */

const GRID = 48;          // drawing domain in inches (GRID × GRID)
const DEFAULT_STEP = 0.25; // default cursor increment (in)
const PX = 9;             // pixels per inch
const PAD = 24;           // svg padding (px)
const SNAP = 1.0;         // snap-to-first-node radius (in)

const RING_COLORS = ['#1e293b', '#b45309', '#0e7490', '#7c3aed'];

export default function SectionDrawer({ value, onChange }) {
  // rings: [{ points: [{x,y}], closed: bool }]
  const [rings, setRings] = useState(() => {
    if (value?.points?.length >= 3) {
      const outer = { points: value.points.map((p) => ({ ...p })), closed: true };
      const holes = (value.holes || []).map((h) => ({ points: h.map((p) => ({ ...p })), closed: true }));
      return [outer, ...holes];
    }
    return [{ points: [], closed: false }];
  });
  const [cursor, setCursor] = useState({ x: GRID / 2, y: GRID / 2 });
  const [step, setStep] = useState(DEFAULT_STEP); // arrow-key increment (in)
  const svgRef = useRef(null);

  // Round a value to the current step so the cursor stays on the increment grid.
  const snapToStep = (v) => Math.round(v / step) * step;

  // Index of the ring currently being drawn (the last open ring, if any).
  const activeIdx = rings.findIndex((r) => !r.closed);
  const activeRing = activeIdx >= 0 ? rings[activeIdx] : null;
  const lastNode = activeRing && activeRing.points.length
    ? activeRing.points[activeRing.points.length - 1]
    : null;

  const toPx = (v) => PAD + v * PX;
  const clamp = (v) => Math.max(0, Math.min(GRID, v));

  // Report closed rings up to the parent whenever the geometry changes.
  useEffect(() => {
    const closed = rings.filter((r) => r.closed && r.points.length >= 3);
    if (!closed.length) {
      onChange(null, []);
      return;
    }
    const [outer, ...holes] = closed;
    onChange(outer.points, holes.map((h) => h.points));
    // onChange identity from parent is stable enough for this use; rings drives it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rings]);

  const moveCursor = (dx, dy) => {
    // Snap to the step grid first so changing the step realigns the cursor.
    setCursor((c) => ({
      x: clamp(snapToStep(c.x) + dx * step),
      y: clamp(snapToStep(c.y) + dy * step),
    }));
  };

  const dropNode = (pt) => {
    setRings((prev) => {
      const next = prev.map((r) => ({ ...r, points: [...r.points] }));
      let idx = next.findIndex((r) => !r.closed);
      if (idx < 0) {
        // All rings closed → start a new hole ring.
        next.push({ points: [], closed: false });
        idx = next.length - 1;
      }
      const ring = next[idx];
      // Closing by clicking the first node.
      if (
        ring.points.length >= 3 &&
        Math.hypot(pt.x - ring.points[0].x, pt.y - ring.points[0].y) <= SNAP
      ) {
        ring.closed = true;
      } else {
        ring.points.push({ x: pt.x, y: pt.y });
      }
      return next;
    });
  };

  const undoNode = () => {
    setRings((prev) => {
      const next = prev.map((r) => ({ ...r, points: [...r.points] }));
      // Reopen the most recently closed ring, or pop from the open ring.
      let idx = next.findIndex((r) => !r.closed);
      if (idx < 0) {
        idx = next.length - 1;
        next[idx].closed = false;
      }
      const ring = next[idx];
      if (ring.points.length) {
        ring.points.pop();
      } else if (next.length > 1) {
        // Empty trailing ring → remove it.
        next.pop();
      }
      return next;
    });
  };

  const closeRing = () => {
    setRings((prev) => {
      const idx = prev.findIndex((r) => !r.closed);
      if (idx < 0 || prev[idx].points.length < 3) return prev;
      const next = prev.map((r, i) => (i === idx ? { ...r, closed: true } : r));
      return next;
    });
  };

  const startHole = () => {
    setRings((prev) => {
      if (prev.some((r) => !r.closed)) return prev; // finish current ring first
      return [...prev, { points: [], closed: false }];
    });
  };

  const clearAll = () => setRings([{ points: [], closed: false }]);

  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); moveCursor(0, -1); break;
      case 'ArrowDown': e.preventDefault(); moveCursor(0, 1); break;
      case 'ArrowLeft': e.preventDefault(); moveCursor(-1, 0); break;
      case 'ArrowRight': e.preventDefault(); moveCursor(1, 0); break;
      case ' ': e.preventDefault(); dropNode(cursor); break;
      case 'Backspace': e.preventDefault(); undoNode(); break;
      case 'Enter': e.preventDefault(); closeRing(); break;
      default: break;
    }
  };

  // Mouse → snap to the current step grid.
  const handleSvgMouse = (e, place) => {
    const rect = svgRef.current.getBoundingClientRect();
    const sx = (rect.width) / (GRID * PX + PAD * 2);
    const sy = (rect.height) / (GRID * PX + PAD * 2);
    const ix = clamp(snapToStep(((e.clientX - rect.left) / sx - PAD) / PX));
    const iy = clamp(snapToStep(((e.clientY - rect.top) / sy - PAD) / PX));
    setCursor({ x: ix, y: iy });
    if (place) dropNode({ x: ix, y: iy });
  };

  const svgSize = GRID * PX + PAD * 2;
  const gridLines = [];
  for (let i = 0; i <= GRID; i += 4) {
    gridLines.push(
      <line key={`v${i}`} x1={toPx(i)} y1={toPx(0)} x2={toPx(i)} y2={toPx(GRID)}
        stroke="#e2e8f0" strokeWidth={i % 12 === 0 ? 1 : 0.5} />,
      <line key={`h${i}`} x1={toPx(0)} y1={toPx(i)} x2={toPx(GRID)} y2={toPx(i)}
        stroke="#e2e8f0" strokeWidth={i % 12 === 0 ? 1 : 0.5} />
    );
  }

  const dx = lastNode ? (cursor.x - lastNode.x) : null;
  const dy = lastNode ? (cursor.y - lastNode.y) : null;

  const outerClosed = rings[0]?.closed && rings[0].points.length >= 3;

  return (
    <div className="section-drawer">
      <div className="drawer-hint">
        <strong>Arrow keys</strong> move &middot; <strong>Space</strong> drop node &middot;{' '}
        <strong>Backspace</strong> undo &middot; <strong>Enter</strong> close shape &middot;{' '}
        click the first node to close.
      </div>

      <div className="drawer-step">
        <label>
          <span className="label-text">Cursor step (in)</span>
          <input
            type="number"
            step="0.05"
            min="0.05"
            value={step}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (v > 0) setStep(v);
            }}
          />
        </label>
        <div className="drawer-step-presets">
          {[0.125, 0.25, 0.5, 1, 2].map((s) => (
            <button
              key={s}
              type="button"
              className={step === s ? 'active' : ''}
              onClick={() => setStep(s)}
            >
              {s}&quot;
            </button>
          ))}
        </div>
      </div>

      <div
        className="drawer-canvas-wrap"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="application"
        aria-label="Custom section drawing canvas"
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          width="100%"
          style={{ maxWidth: svgSize, display: 'block', touchAction: 'none' }}
          onMouseMove={(e) => handleSvgMouse(e, false)}
          onClick={(e) => handleSvgMouse(e, true)}
        >
          {/* Grid */}
          <rect x={toPx(0)} y={toPx(0)} width={GRID * PX} height={GRID * PX}
            fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1" />
          {gridLines}

          {/* Rings */}
          {rings.map((ring, ri) => {
            if (!ring.points.length) return null;
            const color = RING_COLORS[ri % RING_COLORS.length];
            const isHole = ri > 0;
            const d = ring.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toPx(p.x)} ${toPx(p.y)}`).join(' ')
              + (ring.closed ? ' Z' : '');
            return (
              <g key={ri}>
                <path
                  d={d}
                  fill={ring.closed ? (isHole ? '#ffffff' : 'rgba(59,130,246,0.12)') : 'none'}
                  stroke={color}
                  strokeWidth="2"
                  strokeDasharray={isHole ? '5,3' : 'none'}
                />
                {ring.points.map((p, i) => (
                  <circle key={i} cx={toPx(p.x)} cy={toPx(p.y)} r={i === 0 && !ring.closed ? 5 : 3.5}
                    fill={i === 0 && !ring.closed ? '#22c55e' : color} stroke="#fff" strokeWidth="1" />
                ))}
              </g>
            );
          })}

          {/* Rubber-band from last node to cursor */}
          {lastNode && (
            <line x1={toPx(lastNode.x)} y1={toPx(lastNode.y)} x2={toPx(cursor.x)} y2={toPx(cursor.y)}
              stroke="#3b82f6" strokeWidth="1.2" strokeDasharray="4,3" />
          )}

          {/* Cursor crosshair */}
          <g>
            <line x1={toPx(cursor.x) - 8} y1={toPx(cursor.y)} x2={toPx(cursor.x) + 8} y2={toPx(cursor.y)}
              stroke="#ef4444" strokeWidth="1.4" />
            <line x1={toPx(cursor.x)} y1={toPx(cursor.y) - 8} x2={toPx(cursor.x)} y2={toPx(cursor.y) + 8}
              stroke="#ef4444" strokeWidth="1.4" />
          </g>

          {/* Live Δx / Δy readout near the cursor */}
          {lastNode && (
            <text x={toPx(cursor.x) + 10} y={toPx(cursor.y) - 8} className="drawer-delta"
              fontSize="12" fill="#0f172a">
              Δx={dx.toFixed(2)}&quot;, Δy={dy.toFixed(2)}&quot;
            </text>
          )}
        </svg>
      </div>

      <div className="drawer-readout">
        Cursor: ({cursor.x.toFixed(2)}, {cursor.y.toFixed(2)})&quot;
        {lastNode && <> &nbsp;|&nbsp; from last node: Δx={dx.toFixed(2)}&quot;, Δy={dy.toFixed(2)}&quot;</>}
      </div>

      <div className="drawer-controls">
        <button type="button" onClick={closeRing} disabled={!activeRing || activeRing.points.length < 3}>
          Close shape
        </button>
        <button type="button" onClick={startHole} disabled={!outerClosed || rings.some((r) => !r.closed)}>
          + Add hole / void
        </button>
        <button type="button" onClick={undoNode}>Undo node</button>
        <button type="button" onClick={clearAll} className="drawer-clear">Clear</button>
      </div>

      {!outerClosed && (
        <div className="drawer-warning">
          Draw and close the outer shape (at least 3 nodes) to run the analysis.
        </div>
      )}
    </div>
  );
}
