function sanitizeForPdf(value) {
  return String(value ?? "")
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll("•", "-")
    .replaceAll("·", "-")
    .replaceAll("…", "...")
    .replaceAll("³", "3")
    .replaceAll("²", "2")
    .replaceAll("°", "deg")
    .replace(/[^\x20-\x7E]/g, "?");
}

function escapePdfText(value) {
  return sanitizeForPdf(value).replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

/**
 * Minimal A4 PDF: Helvetica / Helvetica-Bold, paginated text table.
 * No external dependency — caller passes already-sanitized cell strings.
 */
export function buildPdfBlob({ title, subtitle, headers, rows }) {
  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 36;
  const linesPerPage = 36;
  const fontSize = 7;
  const lineH = 13;

  const chunks = [];
  for (let i = 0; i < rows.length; i += linesPerPage) chunks.push(rows.slice(i, i + linesPerPage));
  if (chunks.length === 0) chunks.push([]);

  const objects = [];
  const addObj = (content) => {
    objects.push(content);
    return objects.length;
  };

  const pageCount = chunks.length;
  addObj("<< /Type /Catalog /Pages 2 0 R >>");
  addObj(`<< /Type /Pages /Kids [${Array.from({ length: pageCount }, (_, i) => `${3 + i * 2} 0 R`).join(" ")}] /Count ${pageCount} >>`);

  const fontRegular = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBold = addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const pageObjNums = [];
  const contentObjNums = [];
  chunks.forEach(() => {
    pageObjNums.push(addObj(""));
    contentObjNums.push(addObj(""));
  });

  const contents = chunks.map((chunk, pageIdx) => {
    let y = pageH - 54;
    let s = "";
    const addLine = (text, opts = {}) => {
      const size = opts.bold ? 10 : opts.header ? 8 : fontSize;
      const font = opts.bold ? "/F2" : "/F1";
      const x = opts.x ?? margin;
      const ty = y;
      s += `BT ${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${ty.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET\n`;
      if (!opts.noAdvance) y -= opts.step ?? lineH;
    };
    s += `0.78 0.82 1 w\n0 0 1 RG\n${margin.toFixed(2)} ${(pageH - 42).toFixed(2)} m ${(pageW - margin).toFixed(2)} ${(pageH - 42).toFixed(2)} l S\n`;
    s += `0.35 w\n`;
    addLine(title, { bold: true, step: 13 });
    addLine(subtitle, { header: true, step: 10 });
    addLine(`Halaman ${pageIdx + 1} / ${pageCount}  -  ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`, { header: false, step: 16 });
    s += `${margin.toFixed(2)} ${y.toFixed(2)} m ${(pageW - margin).toFixed(2)} ${y.toFixed(2)} l S\n`;
    y -= 8;
    const colWidths = headers.length <= 6 ? [110, 68, 78, 58, 58, 92] : [102, 54, 56, 64, 56, 56, 58, 56, 52, 88];
    let widths = colWidths.slice(0, headers.length);
    const totalW = pageW - margin * 2;
    const sumW = widths.reduce((a, b) => a + b, 0);
    widths = widths.map((w) => (w / sumW) * totalW);

    const drawRow = (cells, isHeader) => {
      let x = margin + 2;
      const rowY = y;
      if (isHeader) {
        s += `0.94 0.95 1.0 rg\n${margin.toFixed(2)} ${(rowY - 3).toFixed(2)} ${(totalW).toFixed(2)} 11 re f\n0 g\n`;
      }
      cells.forEach((cell, idx) => {
        const txt = String(cell ?? "-").slice(0, 28);
        const font = isHeader ? "/F2" : "/F1";
        s += `BT ${font} 6.2 Tf 1 0 0 1 ${x.toFixed(2)} ${rowY.toFixed(2)} Tm (${escapePdfText(txt)}) Tj ET\n`;
        x += widths[idx];
      });
      if (!isHeader) {
        s += `0.9 0.9 0.9 RG\n${margin.toFixed(2)} ${(rowY - 5).toFixed(2)} m ${(pageW - margin).toFixed(2)} ${(rowY - 5).toFixed(2)} l S\n0 g\n`;
      }
      y -= 11;
    };

    drawRow(headers, true);
    y -= 2;
    chunk.forEach((row) => drawRow(row, false));
    if (chunk.length === 0) addLine("Tidak ada data pada rentang terpilih.", { step: 11 });
    s += `0.7 0.72 0.84 RG\n${margin.toFixed(2)} 28 m ${(pageW - margin).toFixed(2)} 28 l S\n`;
    s += `BT /F1 6 Tf 1 0 0 1 ${margin.toFixed(2)} 20 Tm (${escapePdfText("HydroTrack - Flowmeter Archive - generated " + new Date().toISOString())}) Tj ET\n`;
    return s;
  });

  contentObjNums.forEach((objNum, idx) => {
    const stream = contents[idx];
    const len = new TextEncoder().encode(stream).length;
    objects[objNum - 1] = `<< /Length ${len} >>\nstream\n${stream}endstream`;
  });
  pageObjNums.forEach((objNum, idx) => {
    const contentNum = contentObjNums[idx];
    objects[objNum - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentNum} 0 R >>`;
  });

  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefOffset = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => { out += `${String(off).padStart(10, "0")} 00000 n \n`; });
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([out], { type: "application/pdf" });
}
