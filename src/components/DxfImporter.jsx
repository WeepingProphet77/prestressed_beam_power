import { useRef, useState } from 'react';
import { parseDxf, UNIT_SCALE_TO_INCHES } from '../utils/dxfParser';
import { dxfRingsToSection } from '../utils/dxfGeometry';

/**
 * Upload a .dxf cross-section for the "Custom (DXF Import)" section type.
 *
 * The outermost closed polyline is the solid concrete; closed polylines nested
 * inside it are openings (voids). DXF POINT entities are treated as reinforcement
 * "nodes". On a successful import this reports the normalized geometry —
 * { points, holes, h, nodes } in inches, y down, top fiber at y = 0 — to the
 * parent via onChange, matching the engine's polygon convention. When nodes are
 * present the parent switches to biaxial bending and seeds a steel layer at each.
 *
 * Units: if the DXF carries $INSUNITS it is used and shown; the user can override
 * with the unit selector. Re-importing replaces the previous geometry.
 */

const UNIT_OPTIONS = [
  { id: 'in', label: 'inches' },
  { id: 'ft', label: 'feet' },
  { id: 'mm', label: 'millimeters' },
  { id: 'cm', label: 'centimeters' },
  { id: 'm', label: 'meters' },
];

const PREVIEW = 220; // preview viewport (px)
const PAD = 12;

export default function DxfImporter({ value, onChange }) {
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState(null);
  const [rawRings, setRawRings] = useState(null); // parsed rings (DXF coords)
  const [rawNodes, setRawNodes] = useState([]);   // parsed POINT entities (DXF coords)
  const [nodes, setNodes] = useState([]);         // transformed nodes (engine coords) for preview
  const [unit, setUnit] = useState('in');
  const [detectedUnit, setDetectedUnit] = useState(null);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [stats, setStats] = useState(null);

  // Build geometry from already-parsed rings + nodes at the chosen unit, push it up.
  const applyRings = (rings, chosenUnit, nodesArg = rawNodes) => {
    try {
      const unitScale = UNIT_SCALE_TO_INCHES[chosenUnit] ?? 1;
      const geom = dxfRingsToSection(rings, { unitScale, nodes: nodesArg });
      setStats(geom.stats);
      setWarnings(geom.warnings || []);
      setNodes(geom.nodes || []);
      setError(null);
      onChange({ points: geom.points, holes: geom.holes, h: geom.h, nodes: geom.nodes });
    } catch (e) {
      setStats(null);
      setNodes([]);
      setError(e.message);
      onChange({ points: [], holes: [], h: 0, nodes: [] });
    }
  };

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { rings, nodes: parsedNodes, units, warnings: parseWarnings } = parseDxf(String(reader.result));
        setRawRings(rings);
        setRawNodes(parsedNodes || []);
        setDetectedUnit(units);
        const chosen = units && UNIT_SCALE_TO_INCHES[units] ? units : unit;
        setUnit(chosen);
        // Combine parse-time + geometry-time warnings.
        const geomWarnings = [];
        try {
          const unitScale = UNIT_SCALE_TO_INCHES[chosen] ?? 1;
          const geom = dxfRingsToSection(rings, { unitScale, nodes: parsedNodes || [] });
          geomWarnings.push(...(geom.warnings || []));
          setStats(geom.stats);
          setNodes(geom.nodes || []);
          setError(null);
          onChange({ points: geom.points, holes: geom.holes, h: geom.h, nodes: geom.nodes });
        } catch (e) {
          setStats(null);
          setNodes([]);
          setError(e.message);
          onChange({ points: [], holes: [], h: 0, nodes: [] });
        }
        setWarnings([...(parseWarnings || []), ...geomWarnings]);
      } catch (e) {
        setRawRings(null);
        setRawNodes([]);
        setNodes([]);
        setStats(null);
        setDetectedUnit(null);
        setWarnings([]);
        setError(e.message);
        onChange({ points: [], holes: [], h: 0, nodes: [] });
      }
    };
    reader.onerror = () => {
      setError('Could not read the file.');
      onChange({ points: [], holes: [], h: 0, nodes: [] });
    };
    reader.readAsText(file);
  };

  const handleUnitChange = (u) => {
    setUnit(u);
    if (rawRings) applyRings(rawRings, u);
  };

  const handleClear = () => {
    setFileName(null);
    setRawRings(null);
    setRawNodes([]);
    setNodes([]);
    setDetectedUnit(null);
    setError(null);
    setWarnings([]);
    setStats(null);
    if (fileRef.current) fileRef.current.value = '';
    onChange({ points: [], holes: [], h: 0, nodes: [] });
  };

  // ── Preview (uses the normalized geometry already on `value`) ──
  const points = value?.points || [];
  const holes = value?.holes || [];
  const hasGeom = points.length >= 3;

  let preview = null;
  if (hasGeom) {
    const allX = points.map((p) => p.x);
    const allY = points.map((p) => p.y);
    const maxX = Math.max(...allX);
    const maxY = Math.max(...allY);
    const scale = Math.min(
      (PREVIEW - PAD * 2) / (maxX || 1),
      (PREVIEW - PAD * 2) / (maxY || 1)
    );
    const sx = (v) => PAD + v * scale;
    const sy = (v) => PAD + v * scale;
    const ringPath = (ring) =>
      ring.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x)} ${sy(p.y)}`).join(' ') + ' Z';
    let d = ringPath(points);
    for (const hole of holes) if (hole.length >= 3) d += ' ' + ringPath(hole);
    const w = maxX * scale + PAD * 2;
    const hh = maxY * scale + PAD * 2;
    preview = (
      <svg className="dxf-preview" viewBox={`0 0 ${w} ${hh}`} width="100%"
        style={{ maxWidth: w, display: 'block' }}>
        <path d={d} fillRule="evenodd" fill="rgba(59,130,246,0.12)" stroke="#1e293b" strokeWidth="1.5" />
        {holes.map((hole, i) =>
          hole.length >= 3 ? (
            <path key={i} d={ringPath(hole)} fill="none" stroke="#b45309" strokeWidth="1.2" strokeDasharray="4,3" />
          ) : null
        )}
        {/* Reinforcement nodes (DXF POINT entities) → steel-layer locations. */}
        {nodes.map((n, i) => (
          <circle key={`n${i}`} cx={sx(n.x)} cy={sy(n.depth)} r={3.2}
            fill="#dc2626" stroke="#fff" strokeWidth="1" />
        ))}
      </svg>
    );
  }

  return (
    <div className="dxf-importer">
      <div className="drawer-hint">
        Upload a <strong>.dxf</strong> with the section drawn as <strong>closed polylines</strong>.
        The outer polyline is solid concrete; closed polylines inside it are treated as openings.
        Any <strong>POINT</strong> entities (nodes) become steel-layer locations and switch the
        analysis to biaxial bending.
      </div>

      <div className="dxf-upload-row">
        <input
          ref={fileRef}
          type="file"
          accept=".dxf,application/dxf,image/vnd.dxf"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {fileName && (
          <button type="button" className="drawer-clear dxf-clear" onClick={handleClear}>
            Clear
          </button>
        )}
      </div>

      {rawRings && (
        <div className="dxf-units-row">
          <label>
            <span className="label-text">Drawing units</span>
            <select value={unit} onChange={(e) => handleUnitChange(e.target.value)}>
              {UNIT_OPTIONS.map((u) => (
                <option key={u.id} value={u.id}>{u.label}</option>
              ))}
            </select>
          </label>
          <span className="dxf-units-note">
            {detectedUnit
              ? `Detected from file: ${detectedUnit}`
              : 'No units found in file — choose the drawing units.'}
          </span>
        </div>
      )}

      {error && (
        <div className="dxf-error">{error}</div>
      )}

      {warnings.map((w, i) => (
        <div key={i} className="drawer-warning">{w}</div>
      ))}

      {hasGeom && stats && (
        <>
          {preview}
          <div className="drawer-readout">
            depth h = {stats.height.toFixed(2)}&quot; &nbsp;|&nbsp; width = {stats.width.toFixed(2)}&quot;
            &nbsp;|&nbsp; net area = {stats.area.toFixed(2)} in&sup2; &nbsp;|&nbsp; openings = {stats.openingCount}
            &nbsp;|&nbsp; nodes = {stats.nodeCount ?? 0}
          </div>
          {(stats.nodeCount ?? 0) > 0 && (
            <div className="drawer-warning">
              {stats.nodeCount} reinforcement node(s) found — switched to biaxial bending
              and added a steel layer at each node. Set the steel type and area per layer below.
            </div>
          )}
        </>
      )}

      {!hasGeom && !error && (
        <div className="drawer-warning">
          Select a DXF file to import the section.
        </div>
      )}
    </div>
  );
}
