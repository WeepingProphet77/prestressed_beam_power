import { jsPDF } from 'jspdf';

/**
 * Generate a polished PDF report of beam analysis results.
 *
 * @param {object} results  – analysis results from analyzeBeam()
 * @param {object} section  – section geometry
 * @param {object} info     – report metadata { designerName, jobName, jobNumber, designNumber, date }
 */
export default async function generatePdfReport(results, section, info) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();   // 612
  const H = doc.internal.pageSize.getHeight();  // 792
  const M = 48; // page margin
  const cw = W - 2 * M; // content width

  // ── Color palette ──
  const blue = [37, 99, 235];       // primary
  const blueDark = [30, 64, 175];   // header gradient
  const slate800 = [30, 41, 59];
  const slate600 = [71, 85, 105];
  const slate400 = [148, 163, 184];
  const slate200 = [226, 232, 240];
  const slate100 = [241, 245, 249];
  const white = [255, 255, 255];
  const green600 = [22, 163, 74];
  const amber600 = [217, 119, 6];
  const red600 = [220, 38, 38];

  let y = 0; // current y cursor

  // ── Helper: check if we need a new page ──
  const ensureSpace = (needed) => {
    if (y + needed > H - 50) {
      doc.addPage();
      y = M;
      drawPageFooter(doc, W, H, M, slate400, info);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // PAGE 1 — Header + Summary + Tables
  // ═══════════════════════════════════════════════════════════════════════

  // ── Title bar ──
  doc.setFillColor(...blueDark);
  doc.rect(0, 0, W, 72, 'F');
  doc.setFillColor(...blue);
  doc.rect(0, 68, W, 4, 'F');

  // Badge
  doc.setFillColor(255, 255, 255, 30);
  doc.setDrawColor(255, 255, 255, 60);
  doc.roundedRect(M, 18, 68, 22, 4, 4, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...white);
  doc.text('ACI 318-19', M + 34, 33, { align: 'center' });

  // Title text
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Prestressed Concrete Beam Calculator', M + 78, 32);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 210, 230);
  doc.text('Flexural Strength Analysis Report  \u2014  Devalapura\u2013Tadros / PCI Power Formula', M + 78, 48);

  y = 90;

  // ── Job Info Block ──
  doc.setFillColor(...slate100);
  doc.setDrawColor(...slate200);
  doc.roundedRect(M, y, cw, 64, 4, 4, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...slate600);

  const col1 = M + 12;
  const col2 = M + cw / 2 + 12;
  const row1 = y + 18;
  const row2 = y + 34;
  const row3 = y + 50;

  const drawField = (x, yy, label, value) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...slate400);
    doc.setFontSize(7.5);
    doc.text(label, x, yy);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...slate800);
    doc.setFontSize(9.5);
    doc.text(value || '\u2014', x + 70, yy);
  };

  drawField(col1, row1, 'Designer:', info.designerName);
  drawField(col2, row1, 'Job Name:', info.jobName);
  drawField(col1, row2, 'Job Number:', info.jobNumber);
  drawField(col2, row2, 'Design No:', info.designNumber);
  drawField(col1, row3, 'Date:', info.date);

  y += 80;

  // ── Section type label ──
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
  doc.text(`Section Type: ${sectionNames[section.sectionType] || section.sectionType}`, M, y);
  y += 16;

  // ── Summary Result Cards ──
  const cardW = (cw - 18) / 4;
  const cardH = 56;

  const {
    phiMnFt, phiMn, MnFt, Mn, phi, epsilonT,
    ductile, transition,
  } = results;

  const ductilityStatus = ductile
    ? 'Tension-Controlled'
    : transition
    ? 'Transition Zone'
    : 'Compression-Controlled';
  const ductilityColor = ductile ? green600 : transition ? amber600 : red600;

  // Card 1 — φMn (primary / blue)
  doc.setFillColor(...blue);
  doc.roundedRect(M, y, cardW, cardH, 4, 4, 'F');
  doc.setTextColor(200, 220, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('\u03C6Mn (Design Strength)', M + cardW / 2, y + 14, { align: 'center' });
  doc.setTextColor(...white);
  doc.setFontSize(16);
  doc.text(`${phiMnFt.toFixed(1)} kip-ft`, M + cardW / 2, y + 34, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(180, 200, 240);
  doc.text(`${phiMn.toFixed(1)} kip-in`, M + cardW / 2, y + 47, { align: 'center' });

  // Card 2 — Mn
  const c2x = M + cardW + 6;
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

  // Card 3 — φ Factor
  const c3x = M + 2 * (cardW + 6);
  doc.setFillColor(...slate100);
  doc.setDrawColor(...slate200);
  doc.roundedRect(c3x, y, cardW, cardH, 4, 4, 'FD');
  doc.setTextColor(...slate400);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('\u03C6 Factor', c3x + cardW / 2, y + 14, { align: 'center' });
  doc.setTextColor(...slate800);
  doc.setFontSize(16);
  doc.text(phi.toFixed(3), c3x + cardW / 2, y + 34, { align: 'center' });
  doc.setFontSize(8);
  doc.setTextColor(...slate400);
  doc.text('ACI 318 \u00A721.2', c3x + cardW / 2, y + 47, { align: 'center' });

  // Card 4 — Ductility
  const c4x = M + 3 * (cardW + 6);
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
  doc.text(`\u03B5t = ${epsilonT.toFixed(5)}`, c4x + cardW / 2, y + 47, { align: 'center' });

  y += cardH + 20;

  // ── Section Heading helper ──
  const drawSectionHeading = (title) => {
    ensureSpace(20);
    doc.setFillColor(...blue);
    doc.rect(M, y, 3, 14, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...slate800);
    doc.text(title, M + 10, y + 11);
    y += 20;
  };

  // ── Section Analysis Table ──
  drawSectionHeading('Section Analysis');

  const detailRows = [
    ['Neutral axis depth, c', `${results.c.toFixed(3)} in`],
    ['Whitney stress block depth, a = \u03B21\u00B7c', `${results.a.toFixed(3)} in`],
    ['\u03B21', results.beta1.toFixed(3)],
    ['Concrete compression, Cc', `${results.Cc.toFixed(2)} kips`],
    ['c / dt ratio', results.cOverD.toFixed(4)],
    ['f\u2032c', `${results.fc} ksi`],
  ];

  const tblLeft = M;
  const labelW = cw * 0.6;
  const valW = cw * 0.4;
  const rowH = 20;

  detailRows.forEach((row, i) => {
    ensureSpace(rowH);
    if (i % 2 === 0) {
      doc.setFillColor(...slate100);
      doc.rect(tblLeft, y, cw, rowH, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...slate600);
    doc.text(row[0], tblLeft + 8, y + 13.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...slate800);
    doc.text(row[1], tblLeft + labelW + valW - 8, y + 13.5, { align: 'right' });
    y += rowH;
  });

  // Thin bottom border
  doc.setDrawColor(...slate200);
  doc.line(tblLeft, y, tblLeft + cw, y);
  y += 16;

  // ── Steel Layer Results Table ──
  drawSectionHeading('Steel Layer Results');

  const headers = ['Layer', 'Type', 'As (in\u00B2)', 'd (in)', 'fse (ksi)', '\u03B5s', 'fs (ksi)', 'Force (kips)'];
  const colWidths = [0.06, 0.20, 0.10, 0.09, 0.10, 0.14, 0.12, 0.13].map(
    (f) => f * cw
  );
  const colAligns = ['center', 'left', 'right', 'right', 'right', 'right', 'right', 'right'];

  // Header row
  ensureSpace(22);
  doc.setFillColor(...slate200);
  doc.rect(tblLeft, y, cw, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...slate600);

  let cx = tblLeft;
  headers.forEach((h, i) => {
    const align = colAligns[i];
    const tx =
      align === 'right' ? cx + colWidths[i] - 6 :
      align === 'center' ? cx + colWidths[i] / 2 :
      cx + 6;
    doc.text(h, tx, y + 13, { align: align === 'center' ? 'center' : align === 'right' ? 'right' : 'left' });
    cx += colWidths[i];
  });
  y += 20;

  // Data rows
  const { layerResults } = results;
  layerResults.forEach((lr, idx) => {
    ensureSpace(20);
    const isTension = lr.force > 0;
    if (isTension) {
      doc.setFillColor(240, 253, 244); // green tint
    } else {
      doc.setFillColor(255, 251, 235); // amber tint
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
      const align = colAligns[i];
      const tx =
        align === 'right' ? cx + colWidths[i] - 6 :
        align === 'center' ? cx + colWidths[i] / 2 :
        cx + 6;
      doc.text(
        cell,
        tx,
        y + 13,
        { align: align === 'center' ? 'center' : align === 'right' ? 'right' : 'left' }
      );
      cx += colWidths[i];
    });
    y += 19;
  });

  // Totals row
  ensureSpace(22);
  doc.setDrawColor(...slate400);
  doc.setLineWidth(1);
  doc.line(tblLeft, y, tblLeft + cw, y);
  doc.setLineWidth(0.5);
  y += 2;
  doc.setFillColor(...slate100);
  doc.rect(tblLeft, y, cw, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...slate800);
  const totalForce = layerResults.reduce((s, lr) => s + lr.force, 0);
  doc.text('Total Steel Force', tblLeft + cw - colWidths[colWidths.length - 1] - 8, y + 13, { align: 'right' });
  doc.text(`${totalForce.toFixed(2)} kips`, tblLeft + cw - 6, y + 13, { align: 'right' });
  y += 28;

  // ── Formulas Reference ──
  drawSectionHeading('Formulas Used');

  const formulas = [
    {
      title: 'Power Formula (Devalapura\u2013Tadros / PCI):',
      expr: 'fs = Es\u00B7\u03B5s \u00B7 [ Q + (1 \u2212 Q) / [1 + (Es\u00B7\u03B5s / K\u00B7fpy)^R ]^(1/R) ]  \u2264 fpu',
    },
    {
      title: 'Strain Compatibility (ACI 318):',
      expr: '\u03B5si = \u03B5cu\u00B7(di / c \u2212 1) + fse / Es          (\u03B5cu = 0.003)',
    },
    {
      title: 'Whitney Stress Block (ACI 318 \u00A722.2):',
      expr: 'Cc = 0.85\u00B7f\u2032c\u00B7a\u00B7b          where a = \u03B21\u00B7c',
    },
    {
      title: 'Strength Reduction \u03C6 (ACI 318 \u00A721.2):',
      expr: '\u03C6 = 0.65 + 0.25\u00B7(\u03B5t \u2212 \u03B5ty) / 0.003          (0.65 \u2264 \u03C6 \u2264 0.90)',
    },
  ];

  ensureSpace(formulas.length * 32 + 16);
  doc.setFillColor(...slate100);
  doc.setDrawColor(...slate200);
  const formulaBlockH = formulas.length * 32 + 10;
  doc.roundedRect(M, y, cw, formulaBlockH, 4, 4, 'FD');

  const fy = y + 12;
  formulas.forEach((f, i) => {
    const baseY = fy + i * 32;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...slate600);
    doc.text(f.title, M + 10, baseY);
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...slate800);
    doc.text(f.expr, M + 14, baseY + 14);
  });
  y += formulaBlockH + 16;

  // ── Diagrams ──
  // Capture SVG diagrams from the DOM and embed as images
  const diagramImages = await captureDiagrams();

  if (diagramImages.length > 0) {
    ensureSpace(30);
    drawSectionHeading('Diagrams');

    // Determine layout: try to fit side-by-side if we have space, else stack
    const diagramAreaW = cw;
    const availH = H - 50 - y;

    if (diagramImages.length === 3 && availH >= 200) {
      // Three diagrams side by side
      const gap = 8;
      const imgW = (diagramAreaW - gap * 2) / 3;

      // Determine height to maintain aspect ratios
      let maxImgH = 0;
      diagramImages.forEach((img) => {
        const aspect = img.height / img.width;
        const h = imgW * aspect;
        if (h > maxImgH) maxImgH = h;
      });

      // Cap max height
      const capH = Math.min(maxImgH, availH - 10);

      // Check if they fit on this page, otherwise new page
      if (y + capH > H - 50) {
        doc.addPage();
        y = M;
        drawPageFooter(doc, W, H, M, slate400, info);
        drawSectionHeading('Diagrams');
      }

      diagramImages.forEach((img, i) => {
        const ix = M + i * (imgW + gap);
        const aspect = img.height / img.width;
        const ih = Math.min(imgW * aspect, capH);
        doc.addImage(img.dataUrl, 'PNG', ix, y, imgW, ih);
      });

      y += capH + 10;
    } else {
      // Stack diagrams vertically
      for (const img of diagramImages) {
        const aspect = img.height / img.width;
        const imgW = Math.min(diagramAreaW, 400);
        const imgH = imgW * aspect;
        ensureSpace(imgH + 10);
        doc.addImage(img.dataUrl, 'PNG', M, y, imgW, imgH);
        y += imgH + 10;
      }
    }
  }

  // ── Page footers ──
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawPageFooter(doc, W, H, M, slate400, info, p, totalPages);
  }

  // ── Save ──
  const filename = info.jobNumber
    ? `Beam_Report_${info.jobNumber}.pdf`
    : 'Beam_Analysis_Report.pdf';
  doc.save(filename);
}

/**
 * Draw footer on a page.
 */
function drawPageFooter(doc, W, H, M, slate400, info, page, totalPages) {
  if (!page) return;
  const footerY = H - 28;
  doc.setDrawColor(...slate400);
  doc.setLineWidth(0.5);
  doc.line(M, footerY, W - M, footerY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...slate400);
  doc.text(
    'ACI 318-19  \u2022  Devalapura\u2013Tadros / PCI Power Formula  \u2022  For educational and preliminary design purposes only',
    M,
    footerY + 12
  );
  doc.text(`Page ${page} of ${totalPages}`, W - M, footerY + 12, { align: 'right' });
}

/**
 * Capture SVG diagram elements from the DOM and convert to PNG data URLs.
 */
async function captureDiagrams() {
  const selectors = ['.beam-diagram svg', '.strain-diagram svg', '.stress-strain-chart svg'];
  const images = [];

  for (const sel of selectors) {
    const svgEl = document.querySelector(sel);
    if (!svgEl) continue;

    try {
      const dataUrl = await svgToDataUrl(svgEl);
      // Get intrinsic dimensions from viewBox
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
      // Skip diagram if conversion fails
    }
  }

  return images;
}

/**
 * Convert an SVG element to a PNG data URL by:
 * 1. Cloning and inlining all computed styles
 * 2. Serializing to SVG string
 * 3. Drawing onto a canvas
 * 4. Exporting as PNG
 */
function svgToDataUrl(svgEl) {
  return new Promise((resolve, reject) => {
    try {
      const clone = svgEl.cloneNode(true);

      // Inline computed styles on all elements
      inlineStyles(svgEl, clone);

      // Set explicit width/height for rendering
      const vb = svgEl.getAttribute('viewBox');
      let width = 800;
      let height = 600;
      if (vb) {
        const parts = vb.split(/[\s,]+/).map(Number);
        if (parts.length === 4) {
          width = parts[2] * 2;  // 2x for crisp rendering
          height = parts[3] * 2;
        }
      }

      clone.setAttribute('width', width);
      clone.setAttribute('height', height);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      // Add a white background rectangle
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

/**
 * Recursively inline computed styles from the original DOM element
 * onto the cloned element, so CSS classes and variables resolve properly.
 */
function inlineStyles(original, clone) {
  if (original.nodeType !== 1) return; // element nodes only

  const computed = window.getComputedStyle(original);
  const important = [
    'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset',
    'stroke-linecap', 'stroke-linejoin', 'stroke-opacity', 'fill-opacity',
    'opacity', 'font-family', 'font-size', 'font-weight', 'font-style',
    'text-anchor', 'dominant-baseline', 'color', 'visibility', 'display',
  ];

  for (const prop of important) {
    const val = computed.getPropertyValue(prop);
    if (val) {
      clone.style.setProperty(prop, val);
    }
  }

  const origChildren = original.children;
  const cloneChildren = clone.children;
  for (let i = 0; i < origChildren.length; i++) {
    if (cloneChildren[i]) {
      inlineStyles(origChildren[i], cloneChildren[i]);
    }
  }
}
