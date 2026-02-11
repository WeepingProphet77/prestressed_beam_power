/**
 * SVG cross-section diagram of the beam with reinforcement layers,
 * neutral axis, and Whitney stress block visualization.
 */
export default function BeamDiagram({ section, results }) {
  if (!section || !results) return null;

  const { bf, bw, hf, h, sectionType, bt, ht, hg, bb, hb, numStems, stemWidth, numVoids, voidDiameter } = section;
  const { c, a, layerResults } = results;

  // Drawing scale
  const padding = 40;
  const maxDrawWidth = 300;
  const maxDrawHeight = 400;

  const isSandwich = sectionType === 'sandwich';
  const isDoubleTee = sectionType === 'doubletee';
  const isHollowCore = sectionType === 'hollowcore';
  const maxWidth = isSandwich ? Math.max(bt, bb) : (bf || bw);
  const scale = Math.min(maxDrawWidth / maxWidth, maxDrawHeight / h);

  const drawW = maxWidth * scale;
  const drawH = h * scale;
  const svgW = drawW + padding * 2 + 180;
  const svgH = drawH + padding * 2;

  const ox = padding + 60; // origin x (left edge of beam)
  const oy = padding;      // origin y (top of beam)

  const isT = sectionType === 'tbeam' && hf > 0 && bf > bw;

  // Build beam outline path
  let outlinePath;
  if (isSandwich) {
    const topW = bt * scale;
    const topH = ht * scale;
    const gapH = hg * scale;
    const botW = bb * scale;
    const botH = hb * scale;
    const topOffset = (drawW - topW) / 2;
    const botOffset = (drawW - botW) / 2;

    // Two separate rectangles
    outlinePath = `
      M ${ox + topOffset} ${oy}
      L ${ox + topOffset + topW} ${oy}
      L ${ox + topOffset + topW} ${oy + topH}
      L ${ox + topOffset} ${oy + topH}
      Z
      M ${ox + botOffset} ${oy + topH + gapH}
      L ${ox + botOffset + botW} ${oy + topH + gapH}
      L ${ox + botOffset + botW} ${oy + topH + gapH + botH}
      L ${ox + botOffset} ${oy + topH + gapH + botH}
      Z
    `;
  } else if (isDoubleTee) {
    // Double tee: flange on top with two stems below
    const flangeW = bf * scale;
    const flangeH = hf * scale;
    const stemW = stemWidth * scale;
    const webH = (h - hf) * scale;
    const nStems = numStems || 2;
    const spacing = flangeW / (nStems + 1);

    // Draw flange
    outlinePath = `
      M ${ox} ${oy}
      L ${ox + flangeW} ${oy}
      L ${ox + flangeW} ${oy + flangeH}
    `;

    // Draw stems from right to left
    for (let i = nStems - 1; i >= 0; i--) {
      const stemCenterX = spacing * (i + 1);
      const stemLeft = stemCenterX - stemW / 2;
      const stemRight = stemCenterX + stemW / 2;

      if (i === nStems - 1) {
        outlinePath += `L ${ox + stemRight} ${oy + flangeH}`;
      }
      outlinePath += `
        L ${ox + stemRight} ${oy + flangeH + webH}
        L ${ox + stemLeft} ${oy + flangeH + webH}
        L ${ox + stemLeft} ${oy + flangeH}
      `;
      if (i > 0) {
        const nextStemCenterX = spacing * i;
        const nextStemRight = nextStemCenterX + stemW / 2;
        outlinePath += `L ${ox + nextStemRight} ${oy + flangeH}`;
      }
    }

    outlinePath += `L ${ox} ${oy + flangeH} Z`;
  } else if (isHollowCore) {
    // Hollow core: rectangular with circular voids
    outlinePath = `
      M ${ox} ${oy}
      L ${ox + drawW} ${oy}
      L ${ox + drawW} ${oy + drawH}
      L ${ox} ${oy + drawH}
      Z
    `;

    // Add void circles as separate paths (will be filled with background color)
    const voidR = (voidDiameter * scale) / 2;
    const voidCenterY = oy + (h / 2) * scale;
    const voidSpacing = drawW / (numVoids + 1);

    for (let i = 0; i < numVoids; i++) {
      const voidCenterX = ox + voidSpacing * (i + 1);
      outlinePath += `
        M ${voidCenterX + voidR} ${voidCenterY}
        A ${voidR} ${voidR} 0 1 0 ${voidCenterX - voidR} ${voidCenterY}
        A ${voidR} ${voidR} 0 1 0 ${voidCenterX + voidR} ${voidCenterY}
        Z
      `;
    }
  } else if (isT) {
    const flangeW = bf * scale;
    const webW = bw * scale;
    const flangeH = hf * scale;
    const webH = (h - hf) * scale;
    const flangeOffset = (flangeW - webW) / 2;

    outlinePath = `
      M ${ox} ${oy}
      L ${ox + flangeW} ${oy}
      L ${ox + flangeW} ${oy + flangeH}
      L ${ox + flangeOffset + webW} ${oy + flangeH}
      L ${ox + flangeOffset + webW} ${oy + flangeH + webH}
      L ${ox + flangeOffset} ${oy + flangeH + webH}
      L ${ox + flangeOffset} ${oy + flangeH}
      L ${ox} ${oy + flangeH}
      Z
    `;
  } else {
    outlinePath = `
      M ${ox} ${oy}
      L ${ox + drawW} ${oy}
      L ${ox + drawW} ${oy + drawH}
      L ${ox} ${oy + drawH}
      Z
    `;
  }

  // Stress block
  const aH = a * scale;
  let stressBlockPath;
  if (isSandwich) {
    const topW = bt * scale;
    const topH = ht * scale;
    const gapH = hg * scale;
    const botW = bb * scale;
    const topOffset = (drawW - topW) / 2;
    const botOffset = (drawW - botW) / 2;

    if (aH <= topH) {
      // Stress block only in top rectangle
      stressBlockPath = `
        M ${ox + topOffset} ${oy}
        L ${ox + topOffset + topW} ${oy}
        L ${ox + topOffset + topW} ${oy + aH}
        L ${ox + topOffset} ${oy + aH}
        Z
      `;
    } else if (aH <= topH + gapH) {
      // Stress block only in top rectangle (gap has no concrete)
      stressBlockPath = `
        M ${ox + topOffset} ${oy}
        L ${ox + topOffset + topW} ${oy}
        L ${ox + topOffset + topW} ${oy + topH}
        L ${ox + topOffset} ${oy + topH}
        Z
      `;
    } else {
      // Stress block in top rectangle and part of bottom rectangle
      const botStressH = aH - topH - gapH;
      stressBlockPath = `
        M ${ox + topOffset} ${oy}
        L ${ox + topOffset + topW} ${oy}
        L ${ox + topOffset + topW} ${oy + topH}
        L ${ox + topOffset} ${oy + topH}
        Z
        M ${ox + botOffset} ${oy + topH + gapH}
        L ${ox + botOffset + botW} ${oy + topH + gapH}
        L ${ox + botOffset + botW} ${oy + topH + gapH + botStressH}
        L ${ox + botOffset} ${oy + topH + gapH + botStressH}
        Z
      `;
    }
  } else if (isDoubleTee) {
    const flangeW = bf * scale;
    const flangeH = hf * scale;
    const stemW = stemWidth * scale;
    const nStems = numStems || 2;
    const spacing = flangeW / (nStems + 1);

    if (aH <= flangeH) {
      // Stress block only in flange
      stressBlockPath = `
        M ${ox} ${oy}
        L ${ox + flangeW} ${oy}
        L ${ox + flangeW} ${oy + aH}
        L ${ox} ${oy + aH}
        Z
      `;
    } else {
      // Stress block in flange and stems
      stressBlockPath = `
        M ${ox} ${oy}
        L ${ox + flangeW} ${oy}
        L ${ox + flangeW} ${oy + flangeH}
      `;

      for (let i = nStems - 1; i >= 0; i--) {
        const stemCenterX = spacing * (i + 1);
        const stemLeft = stemCenterX - stemW / 2;
        const stemRight = stemCenterX + stemW / 2;

        if (i === nStems - 1) {
          stressBlockPath += `L ${ox + stemRight} ${oy + flangeH}`;
        }
        stressBlockPath += `
          L ${ox + stemRight} ${oy + aH}
          L ${ox + stemLeft} ${oy + aH}
          L ${ox + stemLeft} ${oy + flangeH}
        `;
        if (i > 0) {
          const nextStemCenterX = spacing * i;
          const nextStemRight = nextStemCenterX + stemW / 2;
          stressBlockPath += `L ${ox + nextStemRight} ${oy + flangeH}`;
        }
      }

      stressBlockPath += `L ${ox} ${oy + flangeH} Z`;
    }
  } else if (isHollowCore) {
    // Stress block for hollow core (simplified as rectangular)
    stressBlockPath = `
      M ${ox} ${oy}
      L ${ox + drawW} ${oy}
      L ${ox + drawW} ${oy + aH}
      L ${ox} ${oy + aH}
      Z
    `;
    // Subtract voids from stress block if they intersect
    const voidR = (voidDiameter * scale) / 2;
    const voidCenterY = oy + (h / 2) * scale;
    const voidSpacing = drawW / (numVoids + 1);

    if (aH > voidCenterY - voidR) {
      for (let i = 0; i < numVoids; i++) {
        const voidCenterX = ox + voidSpacing * (i + 1);
        stressBlockPath += `
          M ${voidCenterX + voidR} ${voidCenterY}
          A ${voidR} ${voidR} 0 1 0 ${voidCenterX - voidR} ${voidCenterY}
          A ${voidR} ${voidR} 0 1 0 ${voidCenterX + voidR} ${voidCenterY}
          Z
        `;
      }
    }
  } else if (isT) {
    const flangeW = bf * scale;
    const webW = bw * scale;
    const flangeH = hf * scale;
    const flangeOffset = (flangeW - webW) / 2;

    if (aH <= flangeH) {
      stressBlockPath = `
        M ${ox} ${oy}
        L ${ox + flangeW} ${oy}
        L ${ox + flangeW} ${oy + aH}
        L ${ox} ${oy + aH}
        Z
      `;
    } else {
      stressBlockPath = `
        M ${ox} ${oy}
        L ${ox + flangeW} ${oy}
        L ${ox + flangeW} ${oy + flangeH}
        L ${ox + flangeOffset + webW} ${oy + flangeH}
        L ${ox + flangeOffset + webW} ${oy + aH}
        L ${ox + flangeOffset} ${oy + aH}
        L ${ox + flangeOffset} ${oy + flangeH}
        L ${ox} ${oy + flangeH}
        Z
      `;
    }
  } else {
    stressBlockPath = `
      M ${ox} ${oy}
      L ${ox + drawW} ${oy}
      L ${ox + drawW} ${oy + aH}
      L ${ox} ${oy + aH}
      Z
    `;
  }

  // Neutral axis y position
  const naY = oy + c * scale;
  const beamCenterX = isSandwich ? ox + drawW / 2 :
                      (isT || isDoubleTee ? ox + (bf * scale) / 2 : ox + drawW / 2);
  const beamRightX = isSandwich ? ox + drawW :
                     (isT || isDoubleTee ? ox + bf * scale : ox + drawW);

  // Annotation x
  const annotX = beamRightX + 12;

  return (
    <div className="beam-diagram">
      <h3>Cross-Section &amp; Stress Block</h3>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        width="100%"
        style={{ maxWidth: svgW, display: 'block', margin: '0 auto' }}
      >
        <defs>
          <pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6">
            <path d="M0,6 L6,0" stroke="#6b9bd2" strokeWidth="0.8" />
          </pattern>
        </defs>

        {/* Stress block fill */}
        <path d={stressBlockPath} fill="#dbeafe" stroke="none" />
        <path d={stressBlockPath} fill="url(#hatch)" stroke="#3b82f6" strokeWidth="1" />

        {/* Beam outline */}
        <path d={outlinePath} fill="none" stroke="#1e293b" strokeWidth="2.5" />

        {/* Neutral axis */}
        <line
          x1={ox - 15}
          y1={naY}
          x2={beamRightX + 6}
          y2={naY}
          stroke="#ef4444"
          strokeWidth="1.5"
          strokeDasharray="6,3"
        />
        <text x={annotX} y={naY + 4} className="diagram-label na-label">
          c = {c.toFixed(2)}&quot;
        </text>

        {/* Stress block depth annotation */}
        <text x={annotX} y={oy + aH / 2 + 4} className="diagram-label a-label">
          a = {a.toFixed(2)}&quot;
        </text>

        {/* Steel layers */}
        {layerResults.map((lr, idx) => {
          const ly = oy + lr.depth * scale;
          const isTension = lr.strain > 0;
          const dotR = Math.min(6, Math.max(3, Math.sqrt(lr.area) * 3));

          // For T-beam, check if layer is in web region
          let layerCx = beamCenterX;

          return (
            <g key={idx}>
              {/* Steel dot(s) */}
              <circle
                cx={layerCx - 10}
                cy={ly}
                r={dotR}
                fill={isTension ? '#22c55e' : '#f59e0b'}
                stroke="#1e293b"
                strokeWidth="1"
              />
              <circle
                cx={layerCx + 10}
                cy={ly}
                r={dotR}
                fill={isTension ? '#22c55e' : '#f59e0b'}
                stroke="#1e293b"
                strokeWidth="1"
              />
              {/* Label */}
              <text x={annotX} y={ly + 4} className="diagram-label steel-label">
                d={lr.depth.toFixed(2)}&quot; | f<tspan baselineShift="sub" fontSize="8">s</tspan>={lr.stress.toFixed(1)} ksi
              </text>
            </g>
          );
        })}

        {/* Dimension: total depth */}
        <line x1={ox - 25} y1={oy} x2={ox - 25} y2={oy + drawH} stroke="#64748b" strokeWidth="1" />
        <line x1={ox - 30} y1={oy} x2={ox - 20} y2={oy} stroke="#64748b" strokeWidth="1" />
        <line x1={ox - 30} y1={oy + drawH} x2={ox - 20} y2={oy + drawH} stroke="#64748b" strokeWidth="1" />
        <text
          x={ox - 28}
          y={oy + drawH / 2}
          className="diagram-label dim-label"
          transform={`rotate(-90, ${ox - 28}, ${oy + drawH / 2})`}
        >
          h = {h}&quot;
        </text>

        {/* Legend */}
        <g transform={`translate(${ox}, ${oy + drawH + 20})`}>
          <rect x="0" y="0" width="12" height="12" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" />
          <text x="16" y="10" className="diagram-label legend-text">Whitney stress block (0.85f&#x2032;c)</text>
          <line x1="0" y1="22" x2="12" y2="22" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4,2" />
          <text x="16" y="26" className="diagram-label legend-text">Neutral axis</text>
        </g>
      </svg>
    </div>
  );
}
