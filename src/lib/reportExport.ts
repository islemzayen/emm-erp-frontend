// src/lib/reportExport.ts
// Shared branded export helpers for the Online Sales module.
// Produces colored, logo-stamped, centered-title XLSX and PDF documents so every
// export across the module looks identical to the dedicated Reports page.
//
// Usage:
//   import { exportBrandedXlsx, exportBrandedPdf } from "@/lib/reportExport";
//   await exportBrandedXlsx("Catalog Report", headers, rows, "Catalog_2026-05-30.xlsx");
//   await exportBrandedPdf("Catalog Report", "All products", headers, rows, "Catalog_2026-05-30.pdf");

function todayStr() {
  return new Date()
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function fetchLogoBuffer(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch("/logo.png");
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

// Stack-safe base64 (avoids "Maximum call stack" on large logos)
async function logoBase64(): Promise<string | null> {
  const buf = await fetchLogoBuffer();
  if (!buf) return null;
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:image/png;base64,${btoa(binary)}`;
}

// Read a PNG's natural pixel size from its IHDR header (big-endian width@16, height@20)
function pngDims(buf: ArrayBuffer): { w: number; h: number } | null {
  try {
    const dv = new DataView(buf);
    if (dv.getUint32(0) !== 0x89504e47) return null;
    return { w: dv.getUint32(16), h: dv.getUint32(20) };
  } catch {
    return null;
  }
}

// Logo as base64 + its real pixel dimensions (so we can keep the aspect ratio)
async function logoBundle(): Promise<{ base64: string; w: number; h: number } | null> {
  const buf = await fetchLogoBuffer();
  if (!buf) return null;
  const dims = pngDims(buf) || { w: 3, h: 2 };
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return { base64: btoa(binary), w: dims.w, h: dims.h };
}

// ── Branded XLSX ──────────────────────────────────────────────────────────────
export async function exportBrandedXlsx(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "EMM Hardware ERP";
  const ws = wb.addWorksheet("Report");
  const colCount = headers.length;

  // Row 1 — centered, colored title bar
  ws.mergeCells(1, 1, 1, colCount);
  const titleCell = ws.getCell("A1");
  titleCell.value = `EMM Hardware ERP — ${title}  |  ${todayStr()}`;
  titleCell.font = { bold: true, size: 13, color: { argb: "FFC8202F" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 36;

  // Logo top-left, over the title bar (base64 — avoids the ArrayBuffer->Buffer cast)
  try {
    const info = await logoBundle();
    if (info) {
      const imgId = wb.addImage({ base64: info.base64, extension: "png" });
      const ratio = info.w / info.h;
      const h = 40, w = Math.round(h * ratio);   // fit to a 40px-tall box; width follows the real ratio
      ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: w, height: h } });
    }
  } catch {
    /* logo is optional */
  }

  // Row 2 — colored header row
  const headerRow = ws.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC8202F" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: "FFFFFFFF" } } };
  });
  headerRow.height = 20;

  // Data rows with alternating fill
  rows.forEach((row, i) => {
    const r = ws.addRow(row.map(String));
    const bg = i % 2 === 0 ? "FFF9FAFB" : "FFFFFFFF";
    r.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.font = { size: 9 };
      cell.alignment = { vertical: "middle" };
    });
  });

  // Auto-fit from header + data only — ignore the merged title bar in row 1
  // (counting the long title made every column stretch to the cap)
  ws.columns.forEach((col, i) => {
    let max = String(headers[i] ?? "").length;
    col.eachCell?.({ includeEmpty: false }, (cell, rowNumber) => {
      if (rowNumber === 1) return;
      const len = String(cell.value ?? "").length;
      if (len > max) max = len;
    });
    col.width = Math.min(Math.max(max + 2, 10), 40);
  });

  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
  );
}

// ── Branded PDF ───────────────────────────────────────────────────────────────
export async function exportBrandedPdf(
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  const M = 12;

  // Logo top-left — preserve its real aspect ratio (never squished)
  const logo = await logoBase64();
  if (logo) {
    const maxW = 30, maxH = 18;
    let w = maxW, h = maxH;
    try {
      const props = doc.getImageProperties(logo);
      const ratio = (props.width || 1) / (props.height || 1);
      w = maxW; h = w / ratio;
      if (h > maxH) { h = maxH; w = h * ratio; }
    } catch { w = maxW; h = maxW * 0.66; }
    doc.addImage(logo, "PNG", M, 8, w, h);
  } else {
    doc.setTextColor(200, 32, 47);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("EMM HARDWARE ERP", M, 16);
  }

  // Centered title (brand red)
  doc.setTextColor(200, 32, 47);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageW / 2, 16, { align: "center" });

  // Centered subtitle
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 116, 124);
  doc.text(`${subtitle.toUpperCase()}  ·  GENERATED ${todayStr()}`, pageW / 2, 23, { align: "center" });

  // Red accent line under the header
  doc.setDrawColor(200, 32, 47);
  doc.setLineWidth(0.8);
  doc.line(M, 30, pageW - M, 30);

  autoTable(doc, {
    startY: 36,
    head: [headers],
    body: rows.map((r) => r.map(String)),
    styles: {
      font: "courier",
      fontSize: 8,
      cellPadding: 3,
      textColor: [40, 44, 52],
      fillColor: [255, 255, 255],
      lineColor: [222, 226, 230],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [200, 32, 47],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "left",
    },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    margin: { left: M, right: M },
    theme: "grid",
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 140;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120, 120, 120);
  doc.text(`Confidential — EMM Hardware ERP · ${new Date().toISOString()}`, pageW / 2, finalY + 10, {
    align: "center",
  });

  doc.save(filename);
}