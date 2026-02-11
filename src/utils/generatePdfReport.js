import { jsPDF } from 'jspdf';

// ─── Greek / math text helpers ───────────────────────────────────────────────

/**
 * Map Unicode Greek characters to Symbol font character codes.
 * jsPDF's built-in Symbol font maps ASCII letters to Greek glyphs.
 */
const GREEK = {
  '\u03B1': 'a', // α
  '\u03B2': 'b', // β
  '\u03B3': 'g', // γ
  '\u03B4': 'd', // δ
  '\u03B5': 'e', // ε
  '\u03B6': 'z', // ζ
  '\u03B7': 'h', // η
  '\u03B8': 'q', // θ
  '\u03C0': 'p', // π
  '\u03C1': 'r', // ρ
  '\u03C3': 's', // σ
  '\u03C4': 't', // τ
  '\u03C6': 'f', // φ
  '\u03C8': 'y', // ψ
  '\u03C9': 'w', // ω
};

/**
 * Sanitise a string so every character is renderable by Helvetica or Symbol.
 * Characters outside WinAnsiEncoding are replaced with safe ASCII equivalents.
 */
function sanitize(str) {
  return str
    .replace(/\u2212/g, '-')   // − minus sign → hyphen
    .replace(/\u2264/g, '<=')  // ≤
    .replace(/\u2265/g, '>=')  // ≥
    .replace(/\u2032/g, "'")   // ′ prime → apostrophe
    .replace(/\u00D7/g, 'x');  // × → x
}

/**
 * Render a string that may contain Greek Unicode characters.
 * Automatically switches to the PDF Symbol font for Greek glyphs
 * and back to the caller's font for everything else.
 *
 * Supports  align: 'left' | 'center' | 'right'
 */
function drawGreek(doc, str, x, y, options) {
  const opts = options || {};
  str = sanitize(str);

  // Break into segments: { text, greek }
  const segs = [];
  let buf = '';
  let bufGreek = false;

  for (const ch of str) {
    const isG = ch in GREEK;
    if (segs.length === 0 && buf.length === 0) {
      bufGreek = isG;
    }
    if (isG !== bufGreek) {
      if (buf) segs.push({ text: buf, greek: bufGreek });
      buf = '';
      bufGreek = isG;
    }
    buf += isG ? GREEK[ch] : ch;
  }
  if (buf) segs.push({ text: buf, greek: bufGreek });

  const saved = doc.getFont();

  // Pre-compute total width so we can honour align
  let totalW = 0;
  for (const s of segs) {
    if (s.greek) doc.setFont('symbol', 'normal');
    else doc.setFont(saved.fontName, saved.fontStyle);
    totalW += doc.getTextWidth(s.text);
  }

  const align = opts.align || 'left';
  let cx = x;
  if (align === 'center') cx = x - totalW / 2;
  else if (align === 'right') cx = x - totalW;

  for (const s of segs) {
    if (s.greek) doc.setFont('symbol', 'normal');
    else doc.setFont(saved.fontName, saved.fontStyle);
    doc.text(s.text, cx, y);
    cx += doc.getTextWidth(s.text);
  }

  doc.setFont(saved.fontName, saved.fontStyle);
  return totalW;
}

/**
 * Render text with a subscript portion.
 *   drawSub(doc, "f", "s", x, y)  →  fₛ
 * Returns the total advance width.
 */
function drawSub(doc, main, sub, x, y) {
  const sz = doc.getFontSize();
  const saved = doc.getFont();
  const subSz = sz * 0.65;

  const mw = drawGreek(doc, main, x, y);

  doc.setFontSize(subSz);
  doc.setFont(saved.fontName, saved.fontStyle);
  const sw = drawGreek(doc, sub, x + mw, y + sz * 0.18);
  doc.setFontSize(sz);
  doc.setFont(saved.fontName, saved.fontStyle);
  return mw + sw;
}

/**
 * Render text with a superscript portion.
 */
function drawSup(doc, main, sup, x, y) {
  const sz = doc.getFontSize();
  const saved = doc.getFont();
  const supSz = sz * 0.65;

  const mw = drawGreek(doc, main, x, y);

  doc.setFontSize(supSz);
  doc.setFont(saved.fontName, saved.fontStyle);
  const sw = drawGreek(doc, sup, x + mw, y - sz * 0.3);
  doc.setFontSize(sz);
  doc.setFont(saved.fontName, saved.fontStyle);
  return mw + sw;
}

// ─── Main report generator ──────────────────────────────────────────────────

/**
 * Generate a polished PDF report of beam analysis results.
 */
export default async function generatePdfReport(results, section, info) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();   // 612
  const H = doc.internal.pageSize.getHeight();  // 792
  const MG = 48; // page margin
  const cw = W - 2 * MG; // content width

  // Color palette
  const blue = [37, 99, 235];
  const blueDark = [30, 64, 175];
  const slate800 = [30, 41, 59];
  const slate600 = [71, 85, 105];
  const slate400 = [148, 163, 184];
  const slate200 = [226, 232, 240];
  const slate100 = [241, 245, 249];
  const white = [255, 255, 255];
  const green600 = [22, 163, 74];
  const amber600 = [217, 119, 6];
  const red600 = [220, 38, 38];
  const blueLabel = [37, 99, 235];

  let y = 0;

  const ensureSpace = (needed) => {
    if (y + needed > H - 50) {
      doc.addPage();
      y = MG;
    }
  };

  // ═════════════════════════════════════════════════════════════════════════
  // TITLE BAR
  // ═════════════════════════════════════════════════════════════════════════

  doc.setFillColor(...blueDark);
  doc.rect(0, 0, W, 72, 'F');
  doc.setFillColor(...blue);
  doc.rect(0, 68, W, 4, 'F');

  // Badge
  doc.setFillColor(255, 255, 255, 30);
  doc.setDrawColor(255, 255, 255, 60);
  doc.roundedRect(MG, 18, 68, 22, 4, 4, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...white);
  doc.text('ACI 318-19', MG + 34, 33, { align: 'center' });

  // Title
  doc.setFontSize(16);
  doc.text('Prestressed Concrete Beam Calculator', MG + 78, 32);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 210, 230);
  doc.text('Flexural Strength Analysis Report  --  Devalapura-Tadros / PCI Power Formula', MG + 78, 48);

  y = 90;

  // ═════════════════════════════════════════════════════════════════════════
  // JOB INFO BLOCK
  // ═════════════════════════════════════════════════════════════════════════

  doc.setFillColor(...slate100);
  doc.setDrawColor(...slate200);
  doc.roundedRect(MG, y, cw, 64, 4, 4, 'FD');

  const col1 = MG + 12;
  const col2 = MG + cw / 2 + 12;
  const row1 = y + 18;
  const row2 = y + 34;
  const row3 = y + 50;

  const drawField = (fx, fy, label, value) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...slate400);
    doc.setFontSize(7.5);
    doc.text(label, fx, fy);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...slate800);
    doc.setFontSize(9.5);
    doc.text(value || '--', fx + 70, fy);
  };

  drawField(col1, row1, 'Designer:', info.designerName);
  drawField(col2, row1, 'Job Name:', info.jobName);
  drawField(col1, row2, 'Job Number:', info.jobNumber);
  drawField(col2, row2, 'Design No:', info.designNumber);
  drawField(col1, row3, 'Date:', info.date);

  y += 80;

  // Section type label
  const sectionNames = {
    rectangular: 'Rectangular',
    tbeam: 'T-Beam',
    sandwich: 'Sandwich',
    doubletee: 'Double Tee (PCI)',
    hollowcore: 'Hollow Core (PCI)',
  };
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(...slate400);
  doc.text(`Section Type: ${sectionNames[section.sectionType] || section.sectionType}`, MG, y);
  y += 16;

  // ═════════════════════════════════════════════════════════════════════════
  // SUMMARY CARDS
  // ═════════════════════════════════════════════════════════════════════════

  const cardW = (cw - 18) / 4;
  const cardH = 56;
  const { phiMnFt, phiMn, MnFt, Mn, phi, epsilonT, ductile, transition } = results;

  const ductilityStatus = ductile
    ? 'Tension-Controlled'
    : transition
    ? 'Transition Zone'
    : 'Compression-Controlled';
  const ductilityColor = ductile ? green600 : transition ? amber600 : red600;

  // Card 1 -- phiMn (primary blue)
  doc.setFillColor(...blue);
  doc.roundedRect(MG, y, cardW, cardH, 4, 4, 'F');
  doc.setTextColor(200, 220, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  // "φMn (Design Strength)" — rendered with Symbol for φ
  drawGreek(doc, '\u03C6M\u200An (Design Strength)', MG + cardW / 2, y + 14, { align: 'center' });
  doc.setTextColor(...white);
  doc.setFontSize(16);
  doc.text(`${phiMnFt.toFixed(1)} kip-ft`, MG + cardW / 2, y + 34, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(180, 200, 240);
  doc.text(`${phiMn.toFixed(1)} kip-in`, MG + cardW / 2, y + 47, { align: 'center' });

  // Card 2 -- Mn
  const c2x = MG + cardW + 6;
  doc.setFillColor(...slate100);
  doc.setDrawColor(...slate200);
  doc.roundedRect(c2x, y, cardW, cardH, 4, 4, 'FD');
  doc.setTextColor(...slate400);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('Mn (Nominal Strength)', c2x + cardW / 2, y + 14, { align: 'center' });
  doc.setTextColor(...slate800);
  doc.setFontSize(16);
  doc.text(`${MnFt.toFixed(1)} kip-ft`, c2x + cardW / 2, y + 34, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(...slate400);
  doc.text(`${Mn.toFixed(1)} kip-in`, c2x + cardW / 2, y + 47, { align: 'center' });

  // Card 3 -- phi factor
  const c3x = MG + 2 * (cardW + 6);
  doc.setFillColor(...slate100);
  doc.setDrawColor(...slate200);
  doc.roundedRect(c3x, y, cardW, cardH, 4, 4, 'FD');
  doc.setTextColor(...slate400);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  drawGreek(doc, '\u03C6 Factor', c3x + cardW / 2, y + 14, { align: 'center' });
  doc.setTextColor(...slate800);
  doc.setFontSize(16);
  doc.text(phi.toFixed(3), c3x + cardW / 2, y + 34, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(...slate400);
  doc.text('ACI 318 Sec. 21.2', c3x + cardW / 2, y + 47, { align: 'center' });

  // Card 4 -- Ductility
  const c4x = MG + 3 * (cardW + 6);
  doc.setFillColor(...slate100);
  doc.setDrawColor(...ductilityColor);
  doc.setLineWidth(1.5);
  doc.roundedRect(c4x, y, cardW, cardH, 4, 4, 'FD');
  doc.setLineWidth(0.5);
  doc.setTextColor(...slate400);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('Ductility', c4x + cardW / 2, y + 14, { align: 'center' });
  doc.setTextColor(...ductilityColor);
  doc.setFontSize(10);
  doc.text(ductilityStatus, c4x + cardW / 2, y + 32, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(...slate400);
  doc.setFont('helvetica', 'normal');
  // "εt = 0.01234"
  drawGreek(doc, `\u03B5t = ${epsilonT.toFixed(5)}`, c4x + cardW / 2, y + 47, { align: 'center' });

  y += cardH + 20;

  // ── Section Heading helper ──
  const drawSectionHeading = (title) => {
    ensureSpace(20);
    doc.setFillColor(...blue);
    doc.rect(MG, y, 3, 14, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...slate800);
    doc.text(title, MG + 10, y + 11);
    y += 20;
  };

  // ═════════════════════════════════════════════════════════════════════════
  // SECTION ANALYSIS TABLE
  // ═════════════════════════════════════════════════════════════════════════

  drawSectionHeading('Section Analysis');

  const tblLeft = MG;
  const tblRight = MG + cw;
  const rowH = 20;

  // Each row: [ labelFn(doc, x, y), valueFn(doc, x, y) ]
  // Using functions so we can render Greek inline.
  const detailData = [
    {
      label: (lx, ly) => { doc.text('Neutral axis depth, c', lx, ly); },
      value: `${results.c.toFixed(3)} in`,
    },
    {
      label: (lx, ly) => {
        // "Whitney stress block depth, a = β₁·c"
        let cx2 = lx;
        doc.text('Whitney stress block depth, a = ', lx, ly);
        cx2 += doc.getTextWidth('Whitney stress block depth, a = ');
        cx2 += drawSub(doc, '\u03B2', '1', cx2, ly);
        doc.text('\u00B7c', cx2, ly);
      },
      value: `${results.a.toFixed(3)} in`,
    },
    {
      label: (lx, ly) => { drawSub(doc, '\u03B2', '1', lx, ly); },
      value: results.beta1.toFixed(3),
    },
    {
      label: (lx, ly) => {
        let cx2 = lx;
        doc.text('Concrete compression, C', lx, ly);
        cx2 += doc.getTextWidth('Concrete compression, C');
        drawSub(doc, '', 'c', cx2, ly);
      },
      value: `${results.Cc.toFixed(2)} kips`,
    },
    {
      label: (lx, ly) => {
        let cx2 = lx;
        doc.text('c / d', lx, ly);
        cx2 += doc.getTextWidth('c / d');
        drawSub(doc, '', 't', cx2, ly);
        cx2 += doc.getTextWidth('t') * 0.65 + 1;
        doc.text(' ratio', cx2, ly);
      },
      value: results.cOverD.toFixed(4),
    },
    {
      label: (lx, ly) => {
        // f'c
        doc.text("f'", lx, ly);
        const w = doc.getTextWidth("f'");
        drawSub(doc, '', 'c', lx + w, ly);
      },
      value: `${results.fc} ksi`,
    },
  ];

  detailData.forEach((row, i) => {
    ensureSpace(rowH);
    if (i % 2 === 0) {
      doc.setFillColor(...slate100);
      doc.rect(tblLeft, y, cw, rowH, 'F');
    }
    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...slate600);
    row.label(tblLeft + 8, y + 13.5);
    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...slate800);
    doc.text(row.value, tblRight - 8, y + 13.5, { align: 'right' });
    y += rowH;
  });

  doc.setDrawColor(...slate200);
  doc.line(tblLeft, y, tblRight, y);
  y += 16;

  // ═════════════════════════════════════════════════════════════════════════
  // STEEL LAYER RESULTS TABLE
  // ═════════════════════════════════════════════════════════════════════════

  drawSectionHeading('Steel Layer Results');

  // Column config: { label, labelFn?, width, align }
  const colCfg = [
    { label: 'Layer',   w: 0.06, align: 'center' },
    { label: 'Type',    w: 0.20, align: 'left' },
    { label: null,      w: 0.10, align: 'right',
      labelFn: (lx, ly) => {
        const tw = drawSub(doc, 'A', 's', lx, ly);
        doc.text(' (in\u00B2)', lx + tw, ly);
      }},
    { label: 'd (in)',  w: 0.09, align: 'right' },
    { label: null,      w: 0.10, align: 'right',
      labelFn: (lx, ly) => {
        const tw = drawSub(doc, 'f', 'se', lx, ly);
        doc.text(' (ksi)', lx + tw, ly);
      }},
    { label: null,      w: 0.14, align: 'right',
      labelFn: (lx, ly) => {
        drawSub(doc, '\u03B5', 's', lx, ly);
      }},
    { label: null,      w: 0.12, align: 'right',
      labelFn: (lx, ly) => {
        const tw = drawSub(doc, 'f', 's', lx, ly);
        doc.text(' (ksi)', lx + tw, ly);
      }},
    { label: 'Force (kips)', w: 0.13, align: 'right' },
  ];

  const colWidths = colCfg.map((c) => c.w * cw);

  // Header row
  ensureSpace(22);
  doc.setFillColor(...slate200);
  doc.rect(tblLeft, y, cw, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...slate600);

  let cx = tblLeft;
  colCfg.forEach((col, i) => {
    const pad = 6;
    if (col.labelFn) {
      // Custom label renderer — position depends on alignment
      const lx = col.align === 'right' ? cx + colWidths[i] - pad - 30 : cx + pad;
      col.labelFn(lx, y + 13);
    } else if (col.label) {
      const aopt = col.align === 'center' ? 'center' : col.align === 'right' ? 'right' : 'left';
      const tx = col.align === 'right' ? cx + colWidths[i] - pad :
                 col.align === 'center' ? cx + colWidths[i] / 2 :
                 cx + pad;
      doc.text(col.label, tx, y + 13, { align: aopt });
    }
    cx += colWidths[i];
  });
  y += 20;

  // Data rows
  const { layerResults } = results;
  layerResults.forEach((lr, idx) => {
    ensureSpace(20);
    if (lr.force > 0) {
      doc.setFillColor(240, 253, 244);
    } else {
      doc.setFillColor(255, 251, 235);
    }
    doc.rect(tblLeft, y, cw, 19, 'F');

    const cells = [
      `${idx + 1}`,
      lr.name || lr.steel?.name || '',
      lr.area.toFixed(3),
      lr.depth.toFixed(2),
      (lr.fse || 0).toFixed(1),
      lr.strain.toFixed(6),
      lr.stress.toFixed(2),
      lr.force.toFixed(2),
    ];

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...slate800);

    cx = tblLeft;
    cells.forEach((cell, i) => {
      const a = colCfg[i].align;
      const pad = 6;
      const tx = a === 'right' ? cx + colWidths[i] - pad :
                 a === 'center' ? cx + colWidths[i] / 2 :
                 cx + pad;
      const aopt = a === 'center' ? 'center' : a === 'right' ? 'right' : 'left';
      doc.text(cell, tx, y + 13, { align: aopt });
      cx += colWidths[i];
    });
    y += 19;
  });

  // Totals row
  ensureSpace(22);
  doc.setDrawColor(...slate400);
  doc.setLineWidth(1);
  doc.line(tblLeft, y, tblRight, y);
  doc.setLineWidth(0.5);
  y += 2;
  doc.setFillColor(...slate100);
  doc.rect(tblLeft, y, cw, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...slate800);
  const totalForce = layerResults.reduce((s, lr) => s + lr.force, 0);
  doc.text('Total Steel Force', tblRight - colWidths[colWidths.length - 1] - 8, y + 13, { align: 'right' });
  doc.text(`${totalForce.toFixed(2)} kips`, tblRight - 6, y + 13, { align: 'right' });
  y += 28;

  // ═════════════════════════════════════════════════════════════════════════
  // FORMULAS REFERENCE
  // ═════════════════════════════════════════════════════════════════════════

  drawSectionHeading('Formulas Used');

  const formulaBlockH = 148;
  ensureSpace(formulaBlockH + 16);
  doc.setFillColor(...slate100);
  doc.setDrawColor(...slate200);
  doc.roundedRect(MG, y, cw, formulaBlockH, 4, 4, 'FD');

  const fx0 = MG + 10;
  let fy = y + 14;
  const formulaGap = 36;

  const drawFormulaTitle = (title) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...slate600);
    drawGreek(doc, title, fx0, fy);
  };

  const drawFormulaExpr = (renderFn) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...slate800);
    renderFn(fx0 + 4, fy + 14);
  };

  const drawFormulaNote = (note) => {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...slate400);
    drawGreek(doc, note, fx0 + 8, fy + 24);
  };

  // Formula 1: Power Formula
  drawFormulaTitle('Power Formula (Devalapura-Tadros / PCI):');
  drawFormulaExpr((ex, ey) => {
    let px = ex;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...blueLabel);
    px += drawSub(doc, 'f', 's', px, ey);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...slate800);
    doc.text(' = ', px, ey); px += doc.getTextWidth(' = ');
    px += drawSub(doc, 'E', 's', px, ey);
    doc.text('\u00B7', px, ey); px += doc.getTextWidth('\u00B7');
    px += drawSub(doc, '\u03B5', 's', px, ey);
    doc.text(' [ Q + (1 - Q) / [1 + (', px, ey); px += doc.getTextWidth(' [ Q + (1 - Q) / [1 + (');
    px += drawSub(doc, 'E', 's', px, ey);
    doc.text('\u00B7', px, ey); px += doc.getTextWidth('\u00B7');
    px += drawSub(doc, '\u03B5', 's', px, ey);
    doc.text(' / K\u00B7', px, ey); px += doc.getTextWidth(' / K\u00B7');
    px += drawSub(doc, 'f', 'py', px, ey);
    px += drawSup(doc, ')', 'R', px, ey);
    px += drawSup(doc, ']', '1/R', px, ey);
    doc.text(' ]', px, ey); px += doc.getTextWidth(' ]');
    doc.text('  <=  ', px, ey); px += doc.getTextWidth('  <=  ');
    drawSub(doc, 'f', 'pu', px, ey);
  });
  fy += formulaGap;

  // Formula 2: Strain Compatibility
  drawFormulaTitle('Strain Compatibility (ACI 318):');
  drawFormulaExpr((ex, ey) => {
    let px = ex;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...blueLabel);
    px += drawSub(doc, '\u03B5', 'si', px, ey);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...slate800);
    doc.text(' = ', px, ey); px += doc.getTextWidth(' = ');
    px += drawSub(doc, '\u03B5', 'cu', px, ey);
    doc.text('\u00B7(', px, ey); px += doc.getTextWidth('\u00B7(');
    px += drawSub(doc, 'd', 'i', px, ey);
    doc.text(' / c - 1) + ', px, ey); px += doc.getTextWidth(' / c - 1) + ');
    px += drawSub(doc, 'f', 'se', px, ey);
    doc.text(' / ', px, ey); px += doc.getTextWidth(' / ');
    drawSub(doc, 'E', 's', px, ey);
  });
  drawFormulaNote('\u03B5cu = 0.003 per ACI 318');
  fy += formulaGap;

  // Formula 3: Whitney Stress Block
  drawFormulaTitle('Whitney Stress Block (ACI 318 Sec. 22.2):');
  drawFormulaExpr((ex, ey) => {
    let px = ex;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...blueLabel);
    px += drawSub(doc, 'C', 'c', px, ey);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...slate800);
    doc.text(" = 0.85\u00B7f'", px, ey); px += doc.getTextWidth(" = 0.85\u00B7f'");
    px += drawSub(doc, '', 'c', px, ey);
    doc.text('\u00B7a\u00B7b', px, ey); px += doc.getTextWidth('\u00B7a\u00B7b');
    doc.text('     where  a = ', px, ey); px += doc.getTextWidth('     where  a = ');
    px += drawSub(doc, '\u03B2', '1', px, ey);
    doc.text('\u00B7c', px, ey);
  });
  fy += formulaGap;

  // Formula 4: Strength Reduction
  drawFormulaTitle('Strength Reduction \u03C6 (ACI 318 Sec. 21.2):');
  drawFormulaExpr((ex, ey) => {
    let px = ex;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...blueLabel);
    px += drawGreek(doc, '\u03C6', px, ey);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...slate800);
    doc.text(' = 0.65 + 0.25\u00B7(', px, ey); px += doc.getTextWidth(' = 0.65 + 0.25\u00B7(');
    px += drawSub(doc, '\u03B5', 't', px, ey);
    doc.text(' - ', px, ey); px += doc.getTextWidth(' - ');
    px += drawSub(doc, '\u03B5', 'ty', px, ey);
    doc.text(') / 0.003', px, ey);
  });
  drawFormulaNote('0.65 <= \u03C6 <= 0.90');
  fy += formulaGap;

  y += formulaBlockH + 16;

  // ═════════════════════════════════════════════════════════════════════════
  // DIAGRAMS
  // ═════════════════════════════════════════════════════════════════════════

  const diagramImages = await captureDiagrams();

  if (diagramImages.length > 0) {
    ensureSpace(30);
    drawSectionHeading('Diagrams');

    const diagramAreaW = cw;
    const availH = H - 50 - y;

    if (diagramImages.length === 3 && availH >= 200) {
      const gap = 8;
      const imgW = (diagramAreaW - gap * 2) / 3;

      let maxImgH = 0;
      diagramImages.forEach((img) => {
        const aspect = img.height / img.width;
        const h = imgW * aspect;
        if (h > maxImgH) maxImgH = h;
      });

      const capH = Math.min(maxImgH, availH - 10);

      if (y + capH > H - 50) {
        doc.addPage();
        y = MG;
        drawSectionHeading('Diagrams');
      }

      diagramImages.forEach((img, i) => {
        const ix = MG + i * (imgW + gap);
        const aspect = img.height / img.width;
        const ih = Math.min(imgW * aspect, capH);
        doc.addImage(img.dataUrl, 'PNG', ix, y, imgW, ih);
      });
      y += capH + 10;
    } else {
      for (const img of diagramImages) {
        const aspect = img.height / img.width;
        const imgW = Math.min(diagramAreaW, 400);
        const imgH = imgW * aspect;
        ensureSpace(imgH + 10);
        doc.addImage(img.dataUrl, 'PNG', MG, y, imgW, imgH);
        y += imgH + 10;
      }
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PAGE FOOTERS
  // ═════════════════════════════════════════════════════════════════════════

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerY = H - 28;
    doc.setDrawColor(...slate400);
    doc.setLineWidth(0.5);
    doc.line(MG, footerY, W - MG, footerY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...slate400);
    doc.text(
      'ACI 318-19  |  Devalapura-Tadros / PCI Power Formula  |  For educational and preliminary design purposes only',
      MG,
      footerY + 12
    );
    doc.text(`Page ${p} of ${totalPages}`, W - MG, footerY + 12, { align: 'right' });
  }

  // ── Save ──
  const filename = info.jobNumber
    ? `Beam_Report_${info.jobNumber}.pdf`
    : 'Beam_Analysis_Report.pdf';
  doc.save(filename);
}

// ─── SVG capture helpers ─────────────────────────────────────────────────────

async function captureDiagrams() {
  const selectors = ['.beam-diagram svg', '.strain-diagram svg', '.stress-strain-chart svg'];
  const images = [];

  for (const sel of selectors) {
    const svgEl = document.querySelector(sel);
    if (!svgEl) continue;

    try {
      const dataUrl = await svgToDataUrl(svgEl);
      const vb = svgEl.getAttribute('viewBox');
      let width = 400;
      let height = 300;
      if (vb) {
        const parts = vb.split(/[\s,]+/).map(Number);
        if (parts.length === 4) {
          width = parts[2];
          height = parts[3];
        }
      }
      images.push({ dataUrl, width, height });
    } catch {
      // skip
    }
  }

  return images;
}

function svgToDataUrl(svgEl) {
  return new Promise((resolve, reject) => {
    try {
      const clone = svgEl.cloneNode(true);
      inlineStyles(svgEl, clone);

      const vb = svgEl.getAttribute('viewBox');
      let width = 800;
      let height = 600;
      if (vb) {
        const parts = vb.split(/[\s,]+/).map(Number);
        if (parts.length === 4) {
          width = parts[2] * 2;
          height = parts[3] * 2;
        }
      }

      clone.setAttribute('width', width);
      clone.setAttribute('height', height);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('width', '100%');
      bg.setAttribute('height', '100%');
      bg.setAttribute('fill', '#ffffff');
      clone.insertBefore(bg, clone.firstChild);

      const svgString = new XMLSerializer().serializeToString(clone);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG image'));
      };
      img.src = url;
    } catch (err) {
      reject(err);
    }
  });
}

function inlineStyles(original, clone) {
  if (original.nodeType !== 1) return;

  const computed = window.getComputedStyle(original);
  const props = [
    'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset',
    'stroke-linecap', 'stroke-linejoin', 'stroke-opacity', 'fill-opacity',
    'opacity', 'font-family', 'font-size', 'font-weight', 'font-style',
    'text-anchor', 'dominant-baseline', 'color', 'visibility', 'display',
  ];

  for (const prop of props) {
    const val = computed.getPropertyValue(prop);
    if (val) clone.style.setProperty(prop, val);
  }

  const origChildren = original.children;
  const cloneChildren = clone.children;
  for (let i = 0; i < origChildren.length; i++) {
    if (cloneChildren[i]) inlineStyles(origChildren[i], cloneChildren[i]);
  }
}
