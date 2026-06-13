"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { salesOrderService, type SalesOrder } from "@/services/commercial/salesOrderService";
import { commercialDocumentService } from "@/services/commercial/commercialDocumentService";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, FileText, Loader2, Package, Printer, Save, Search, ShoppingCart, X } from "lucide-react";

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

function getErrorMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }

  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ORDONNANCED: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    PREPARED: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    CANCELLED: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300",
    SHIPPED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  };
  return map[status] ?? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

function groupByDepot(order: SalesOrder) {
  const groups = new Map<
    string,
    {
      depotName: string;
      prepared: boolean;
      preparedAt?: string | null;
      preparedBy?: string | null;
      lines: SalesOrder["lines"];
    }
  >();

  order.lines.forEach((line) => {
    const depotName = line.depotId?.name || "No depot";
    const key = line.depotId?._id || `none:${depotName}`;
    const existing = groups.get(key);

    if (existing) {
      existing.lines.push(line);
      existing.prepared = existing.prepared && Boolean(line.depotPreparedAt);
      if (!existing.preparedAt && line.depotPreparedAt) existing.preparedAt = line.depotPreparedAt;
      if (!existing.preparedBy && line.depotPreparedBy?.name) {
        existing.preparedBy = line.depotPreparedBy.name;
      }
      return;
    }

    groups.set(key, {
      depotName,
      prepared: Boolean(line.depotPreparedAt),
      preparedAt: line.depotPreparedAt,
      preparedBy: line.depotPreparedBy?.name || null,
      lines: [line],
    });
  });

  return Array.from(groups.values());
}

async function buildBLPdf(order: SalesOrder): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const autoTable  = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, MARGIN = 14, PAGE_H = 297;
  const r = (v: number) => Math.round((v + Number.EPSILON) * 1000) / 1000;

  // ── Logo ──────────────────────────────────────────────────────────────────
  let logoDataUrl: string | null = null;
  try {
    const res  = await fetch("/EMMlogo.png");
    const blob = await res.blob();
    logoDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch { /* optional */ }
  if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", MARGIN, 8, 28, 18);

  // ── Company ───────────────────────────────────────────────────────────────
  doc.setFontSize(8).setFont("helvetica", "normal").setTextColor(100, 116, 139);
  doc.text("Route de Gabès Km 6, Sfax, Tunisie", MARGIN, 30);
  doc.text("Tél : +(216) 98 241 790  ·  info@emmtn.com", MARGIN, 34);

  // ── BL header (right) ─────────────────────────────────────────────────────
  doc.setFontSize(20).setFont("helvetica", "bold").setTextColor(15, 23, 42);
  doc.text("BON DE LIVRAISON", W - MARGIN, 14, { align: "right" });
  doc.setFontSize(11).setFont("helvetica", "normal").setTextColor(51, 65, 85);
  doc.text(order.orderNo, W - MARGIN, 21, { align: "right" });
  doc.setFontSize(8).setTextColor(100, 116, 139);
  const issueDate = new Date().toLocaleDateString("fr-FR");
  doc.text(`Date : ${issueDate}`, W - MARGIN, 27, { align: "right" });
  doc.text(`Client : ${order.customerName}`, W - MARGIN, 32, { align: "right" });

  // ── Separator ─────────────────────────────────────────────────────────────
  doc.setDrawColor(226, 232, 240);
  doc.line(MARGIN, 40, W - MARGIN, 40);

  // ── Emitter / Client boxes ────────────────────────────────────────────────
  const boxY = 43, boxH = 20;
  doc.setFillColor(248, 250, 252).setDrawColor(226, 232, 240);
  doc.roundedRect(MARGIN, boxY, 85, boxH, 2, 2, "FD");
  doc.roundedRect(W / 2 + 2, boxY, 85, boxH, 2, 2, "FD");

  doc.setFontSize(7).setFont("helvetica", "bold").setTextColor(100, 116, 139);
  doc.text("ÉMETTEUR", MARGIN + 3, boxY + 5);
  doc.text("CLIENT / DESTINATAIRE", W / 2 + 5, boxY + 5);
  doc.setFontSize(9).setFont("helvetica", "bold").setTextColor(15, 23, 42);
  doc.text("EMM TN", MARGIN + 3, boxY + 11);
  doc.text(order.customerName, W / 2 + 5, boxY + 11);
  doc.setFontSize(7.5).setFont("helvetica", "normal").setTextColor(100, 116, 139);
  doc.text("Route de Gabès Km 6, Sfax", MARGIN + 3, boxY + 16);

  // ── Compute line totals ───────────────────────────────────────────────────
  const lines = (order.lines || []) as any[];
  const PDF_MIN_ROWS = 16;
  const dataTableRows = lines.map((line: any) => {
    const qty       = Number(line.quantity  || 0);
    const unitPrice = Number(line.unitPrice || 0);
    const disc      = Number(line.discount  || 0);
    const brutHT    = r(qty * unitPrice);
    const remiseAmt = r(brutHT * disc / 100);
    const montantHT = r(brutHT - remiseAmt);
    return [
      line.productId?.sku  || "—",
      line.productId?.name || "—",
      qty.toString(),
      r(unitPrice).toFixed(3),
      disc > 0 ? `${disc}%` : "—",
      montantHT.toFixed(3),
    ];
  });
  const tableRows = [
    ...dataTableRows,
    ...Array.from({ length: Math.max(0, PDF_MIN_ROWS - dataTableRows.length) }, () => ["", "", "", "", "", ""]),
  ];

  const totalBrutHT  = r(lines.reduce((s, l) => s + Number(l.quantity||0)*Number(l.unitPrice||0), 0));
  const totalRemise  = r(lines.reduce((s, l) => {
    const b = Number(l.quantity||0)*Number(l.unitPrice||0);
    return s + r(b * Number(l.discount||0) / 100);
  }, 0));
  const totalNetHT   = r(totalBrutHT - totalRemise);
  const tvaRate      = 19;
  const tvaAmt       = r(totalNetHT * tvaRate / 100);
  const timbre       = 1;
  const totalTTC     = r(totalNetHT + tvaAmt + timbre);

  // ── Products table ────────────────────────────────────────────────────────
  const tableStartY = boxY + boxH + 5;

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: W - MARGIN * 2,
    head: [["Référence", "Désignation", "Qté", "Prix HT", "Remise", "Montant HT"]],
    body: tableRows,
    styles: { fontSize: 8, cellPadding: 2.8, lineWidth: 0, minCellHeight: 8 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", fontSize: 8, lineWidth: 0 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.3,
    didDrawCell: (data: any) => {
      const totalCols = 6;
      if (data.column.index < totalCols - 1) {
        const color = data.row.section === "head" ? [255, 255, 255] : [226, 232, 240];
        doc.setDrawColor(color[0], color[1], color[2]);
        doc.setLineWidth(0.2);
        doc.line(
          data.cell.x + data.cell.width,
          data.cell.y,
          data.cell.x + data.cell.width,
          data.cell.y + data.cell.height
        );
      }
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 24, halign: "right" },
      4: { cellWidth: 18, halign: "center" },
      5: { cellWidth: 26, halign: "right", fontStyle: "bold" },
    },
  });

  const afterTable = (doc as any).lastAutoTable.finalY;

  // ── Totals box (bottom-right) ─────────────────────────────────────────────
  const totalsX   = W - MARGIN - 72;
  const totalsY   = afterTable + 6;
  const rowH      = 7;
  const col1W     = 42, col2W = 30;

  const totalsRows: [string, string, boolean, boolean][] = [
    ["Total HT",           `${totalBrutHT.toFixed(3)} TND`,  false, false],
    ["Remise",             `- ${totalRemise.toFixed(3)} TND`, false, false],
    ["Total Net HT",       `${totalNetHT.toFixed(3)} TND`,   false, true],
    [`TVA (${tvaRate}%)`,  `${tvaAmt.toFixed(3)} TND`,       false, false],
    ["Timbre fiscal",      `${timbre.toFixed(3)} TND`,        false, false],
    ["TOTAL TTC",          `${totalTTC.toFixed(3)} TND`,      true,  true],
  ];

  doc.setDrawColor(226, 232, 240).setLineWidth(0.2);

  totalsRows.forEach(([label, value, isDark, isBold], i) => {
    const y = totalsY + i * rowH;
    if (isDark) {
      doc.setFillColor(15, 23, 42);
      doc.rect(totalsX, y, col1W + col2W, rowH, "F");
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 252 : 255);
      doc.rect(totalsX, y, col1W + col2W, rowH, "F");
      doc.setTextColor(15, 23, 42);
    }
    doc.setDrawColor(226, 232, 240);
    doc.rect(totalsX, y, col1W + col2W, rowH, "S");

    const fontStyle = isBold ? "bold" : "normal";
    doc.setFontSize(8).setFont("helvetica", fontStyle);
    doc.text(label, totalsX + 3, y + rowH - 2);
    doc.text(value, totalsX + col1W + col2W - 3, y + rowH - 2, { align: "right" });
  });

  // ── Single signature zone (right-aligned, below totals) ──────────────────
  const sigY    = totalsY + totalsRows.length * rowH + 8;
  const sigBoxW = 72;
  const sigBoxH = 18;
  const sigX    = totalsX;

  doc.setFontSize(7.5).setFont("helvetica", "bold").setTextColor(100, 116, 139);
  doc.text("SIGNATURE", sigX + sigBoxW / 2, sigY, { align: "center" });

  doc.setDrawColor(203, 213, 225).setLineWidth(0.3).setLineDashPattern([1.5, 1.5], 0);
  doc.roundedRect(sigX, sigY + 3, sigBoxW, sigBoxH, 1, 1);
  doc.setLineDashPattern([], 0);

  doc.setFontSize(7).setFont("helvetica", "normal").setTextColor(148, 163, 184);
  doc.text("Signature & Cachet", sigX + sigBoxW / 2, sigY + 3 + sigBoxH + 4, { align: "center" });

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setDrawColor(226, 232, 240).setLineWidth(0.2);
  doc.line(MARGIN, PAGE_H - 10, W - MARGIN, PAGE_H - 10);
  doc.setFontSize(7).setFont("helvetica", "normal").setTextColor(148, 163, 184);
  doc.text("EMM TN · Route de Gabès Km 6, Sfax · +(216) 98 241 790 · info@emmtn.com",
    W / 2, PAGE_H - 6, { align: "center" });

  return doc.output("blob");
}

function printHtml(html: string) {
  const win = window.open("", "_blank", "width=900,height=750");
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }
}

function buildBLHtml(order: SalesOrder): string {
  const companyName    = "EMM TN";
  const companyAddress = "Route de Gabès Km 6, Sfax, Tunisie";
  const companyPhone   = "+(216) 98 241 790";
  const companyEmail   = "info@emmtn.com";
  const issueDate = new Date().toLocaleDateString("fr-TN");
  const r = (v: number) => Math.round((v + Number.EPSILON) * 1000) / 1000;

  const processedLines = order.lines.map((line) => {
    const qty       = Number(line.quantity  || 0);
    const unitPrice = Number((line as any).unitPrice || 0);
    const disc      = Number((line as any).discount  || 0);
    const brutHT    = r(qty * unitPrice);
    const remiseAmt = r(brutHT * disc / 100);
    const montantHT = r(brutHT - remiseAmt);
    return { line, qty, unitPrice, disc, brutHT, remiseAmt, montantHT };
  });

  const totalBrutHT = r(processedLines.reduce((s, l) => s + l.brutHT, 0));
  const totalRemise = r(processedLines.reduce((s, l) => s + l.remiseAmt, 0));
  const totalNetHT  = r(totalBrutHT - totalRemise);
  const tvaRate     = 19;
  const tvaAmt      = r(totalNetHT * tvaRate / 100);
  const timbre      = 1;
  const totalTTC    = r(totalNetHT + tvaAmt + timbre);

  const MIN_ROWS = 16;
  const dataRows = processedLines.map(({ line, qty, unitPrice, disc, montantHT }, idx) => `
    <tr style="background:${idx % 2 === 0 ? "#fff" : "#f8fafc"}">
      <td style="padding:7px 10px;font-size:11px;color:#64748b;border-right:1px solid #e2e8f0">${(line.productId as any)?.sku || "—"}</td>
      <td style="padding:7px 10px;font-size:12px;border-right:1px solid #e2e8f0">${(line.productId as any)?.name || "—"}</td>
      <td style="padding:7px 10px;text-align:center;font-size:12px;font-weight:600;border-right:1px solid #e2e8f0">${qty}</td>
      <td style="padding:7px 10px;text-align:right;font-size:12px;border-right:1px solid #e2e8f0">${unitPrice.toFixed(3)}</td>
      <td style="padding:7px 10px;text-align:center;font-size:12px;color:#64748b;border-right:1px solid #e2e8f0">${disc > 0 ? disc + "%" : "—"}</td>
      <td style="padding:7px 10px;text-align:right;font-size:12px;font-weight:600">${montantHT.toFixed(3)}</td>
    </tr>`).join("");

  const emptyRowsCount = Math.max(0, MIN_ROWS - processedLines.length);
  const emptyRows = Array.from({ length: emptyRowsCount }).map((_, idx) => `
    <tr style="height:28px;background:${(processedLines.length + idx) % 2 === 0 ? "#fff" : "#f8fafc"}">
      <td style="border-right:1px solid #e2e8f0"></td>
      <td style="border-right:1px solid #e2e8f0"></td>
      <td style="border-right:1px solid #e2e8f0"></td>
      <td style="border-right:1px solid #e2e8f0"></td>
      <td style="border-right:1px solid #e2e8f0"></td>
      <td></td>
    </tr>`).join("");

  const rows = dataRows + emptyRows;

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>Bon de Livraison ${order.orderNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #0f172a; background: #fff; }
    @page { size: A4; margin: 18mm 15mm; }
    @media print { body { padding: 0; } }
    .page { max-width: 794px; margin: 0 auto; padding: 24px 28px; display:flex; flex-direction:column; min-height:261mm; }
    table { border-collapse: collapse; width: 100%; }
    th { font-weight: 600; }
  </style>
</head>
<body>
<div class="page">

  <!-- HEADER -->
  <table style="margin-bottom:20px">
    <tr>
      <td style="vertical-align:top;width:55%">
        <img src="${window.location.origin}/EMMlogo.png" alt="${companyName}" style="height:60px;max-width:180px;object-fit:contain;display:block;margin-bottom:8px"/>
        <div style="font-size:11px;color:#64748b;margin-top:3px">${companyAddress}</div>
        <div style="font-size:11px;color:#64748b;margin-top:1px">Tél : ${companyPhone} &nbsp;·&nbsp; ${companyEmail}</div>
      </td>
      <td style="vertical-align:top;text-align:right;width:45%">
        <div style="font-size:26px;font-weight:700;letter-spacing:-1px;color:#0f172a">BON DE LIVRAISON</div>
        <div style="font-size:15px;font-weight:600;color:#334155;margin-top:2px">${order.orderNo}</div>
        <table style="margin-top:10px;margin-left:auto;width:auto">
          <tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Date :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0">${issueDate}</td>
          </tr>
          <tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Client :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0">${order.customerName}</td>
          </tr>
          <tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Statut :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0">${order.status}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- EMETTEUR / CLIENT -->
  <table style="margin-bottom:16px">
    <tr>
      <td style="width:48%;vertical-align:top;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;font-weight:600;margin-bottom:6px">Émetteur</div>
        <div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px">
          <img src="${window.location.origin}/EMMlogo.png" alt="${companyName}" style="height:22px;object-fit:contain"/>
          ${companyName}
        </div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">${companyAddress}</div>
      </td>
      <td style="width:4%"></td>
      <td style="width:48%;vertical-align:top;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;font-weight:600;margin-bottom:6px">Client / Destinataire</div>
        <div style="font-size:13px;font-weight:700">${order.customerName}</div>
      </td>
    </tr>
  </table>

  <!-- PRODUCT TABLE -->
  <table style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:0">
    <thead>
      <tr style="background:#0f172a;color:#fff">
        <th style="padding:9px 10px;text-align:left;font-size:11px;width:90px;border-right:1px solid rgba(255,255,255,0.15)">Référence</th>
        <th style="padding:9px 10px;text-align:left;font-size:11px;border-right:1px solid rgba(255,255,255,0.15)">Désignation</th>
        <th style="padding:9px 10px;text-align:center;font-size:11px;width:50px;border-right:1px solid rgba(255,255,255,0.15)">Qté</th>
        <th style="padding:9px 10px;text-align:right;font-size:11px;width:90px;border-right:1px solid rgba(255,255,255,0.15)">Prix HT (TND)</th>
        <th style="padding:9px 10px;text-align:center;font-size:11px;width:60px;border-right:1px solid rgba(255,255,255,0.15)">Remise</th>
        <th style="padding:9px 10px;text-align:right;font-size:11px;width:100px">Montant HT (TND)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <!-- BOTTOM ANCHOR -->
  <div style="margin-top:auto">

  <!-- TOTALS -->
  <div style="display:flex;justify-content:flex-end;margin-top:16px;margin-bottom:16px">
    <table style="width:260px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;border-collapse:collapse">
      <tr style="background:#f8fafc">
        <td style="padding:6px 12px;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0">Total HT</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px;font-weight:600;border-bottom:1px solid #e2e8f0">${totalBrutHT.toFixed(3)} TND</td>
      </tr>
      ${totalRemise > 0 ? `<tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0">Remise</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px;border-bottom:1px solid #e2e8f0">- ${totalRemise.toFixed(3)} TND</td>
      </tr>` : ""}
      <tr style="background:#f8fafc">
        <td style="padding:6px 12px;font-size:12px;font-weight:600;color:#0f172a;border-bottom:1px solid #e2e8f0">Total Net HT</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px;font-weight:600;border-bottom:1px solid #e2e8f0">${totalNetHT.toFixed(3)} TND</td>
      </tr>
      <tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0">TVA (${tvaRate}%)</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px;border-bottom:1px solid #e2e8f0">${tvaAmt.toFixed(3)} TND</td>
      </tr>
      <tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0">Timbre fiscal</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px;border-bottom:1px solid #e2e8f0">${timbre.toFixed(3)} TND</td>
      </tr>
      <tr style="background:#0f172a">
        <td style="padding:9px 12px;font-size:13px;font-weight:700;color:#fff">TOTAL TTC</td>
        <td style="padding:9px 12px;text-align:right;font-size:13px;font-weight:700;color:#fff">${totalTTC.toFixed(3)} TND</td>
      </tr>
    </table>
  </div>

  <!-- SIGNATURE -->
  <div style="display:flex;justify-content:flex-end;margin-top:10px">
    <div style="width:260px;text-align:center">
      <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin-bottom:8px">Signature</div>
      <div style="height:52px;border:1px dashed #cbd5e1;border-radius:4px"></div>
      <div style="font-size:9px;color:#94a3b8;margin-top:6px">Signature &amp; Cachet</div>
    </div>
  </div>

  <!-- FOOTER -->
  <div style="margin-top:20px;border-top:1px solid #e2e8f0;padding-top:10px;text-align:center;font-size:9px;color:#94a3b8">
    ${companyName} · ${companyAddress} · ${companyPhone} · ${companyEmail}
  </div>

  </div><!-- end bottom anchor -->

</div>
</body>
</html>`;

  return html;
}

export default function CommercialPreparationPage() {
  const { t } = useLanguage();

  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [blPrompt, setBlPrompt]     = useState<{ order: SalesOrder; html: string } | null>(null);
  const [savingDoc, setSavingDoc]   = useState(false);
  const [saveMsg, setSaveMsg]       = useState("");

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError("");
      setOrders(await salesOrderService.getAll());
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load preparation orders"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleValidatePicking = async (id: string) => {
    try {
      setActionId(id);
      setError("");
      await salesOrderService.validatePacking(id);
      await fetchOrders();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to validate picking"));
    } finally {
      setActionId(null);
    }
  };

  const handlePrintBL = (order: SalesOrder) => {
    const html = buildBLHtml(order);
    setSaveMsg("");
    setBlPrompt({ order, html });
  };

  const handleBlAction = async (save: boolean) => {
    if (!blPrompt) return;
    if (save) {
      setSavingDoc(true);
      try {
        const { order } = blPrompt;
        const pdfBlob = await buildBLPdf(order);
        const date    = new Date().toISOString().slice(0, 10);
        const file    = new File([pdfBlob], `BL-${order.orderNo}-${date}.pdf`, { type: "application/pdf" });
        await commercialDocumentService.upload(file, `Bon de Livraison - ${order.orderNo}`);
        setSaveMsg("Sauvegardé dans les documents.");
      } catch {
        setSaveMsg("Échec de la sauvegarde.");
      } finally {
        setSavingDoc(false);
      }
    }
    printHtml(blPrompt.html);
    if (!save) setBlPrompt(null);
  };

  const preparationOrders = useMemo(
    () => orders.filter((order) => ["ORDONNANCED", "PREPARED"].includes(order.status)),
    [orders]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return preparationOrders.filter(
      (order) =>
        order.orderNo.toLowerCase().includes(q) ||
        order.customerName.toLowerCase().includes(q)
    );
  }, [preparationOrders, search]);

  const totalUnits = useMemo(
    () =>
      filtered.reduce(
        (sum, order) => sum + order.lines.reduce((lineSum, line) => lineSum + line.quantity, 0),
        0
      ),
    [filtered]
  );

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "COMMERCIAL_MANAGER"]}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {t("commercialModule")} · ERP
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <Package size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {t("prepared") || "Preparation"}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Wait for depot preparation, then validate picking when depot work is done.
                </p>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="flex items-start justify-between rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            {
              label: "Waiting Depot",
              value: orders.filter((order) => order.status === "ORDONNANCED").length,
              color: "text-blue-700 dark:text-blue-400",
            },
            {
              label: t("preparedPendingPackingLabel"),
              value: orders.filter((order) => order.status === "PREPARED" && !order.packingValidatedAt)
                .length,
              color: "text-amber-700 dark:text-amber-400",
            },
            {
              label: t("unitsToPrepareLabel"),
              value: totalUnits,
              color: "text-violet-700 dark:text-violet-400",
            },
            {
              label: t("readyForShipping"),
              value: orders.filter((order) => order.status === "PREPARED" && !!order.packingValidatedAt)
                .length,
              color: "text-emerald-700 dark:text-emerald-400",
            },
          ].map((kpi) => (
            <div key={kpi.label} className={`${surface} px-6 py-5`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                {kpi.label}
              </p>
              <p className={`mt-2 text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className={`${surface} overflow-hidden`}>
          <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-slate-950 dark:text-white">
              {t("ordersToPrepare")}
              <span className="ml-2 text-sm font-normal text-slate-400">{filtered.length}</span>
            </h2>

            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("searchConfirmedOrders")}
                className="w-56 rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> {t("loading")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-sm text-slate-400 dark:text-slate-500">
              <ShoppingCart size={32} className="opacity-30" />
              {preparationOrders.length === 0 ? "No orders in preparation flow yet" : t("noPreparationMatch")}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((order) => {
                const isExpanded = expandedId === order._id;
                const busy = actionId === order._id;
                const depotGroups = groupByDepot(order);
                const allDepotsPrepared = depotGroups.every((group) => group.prepared);
                const canValidatePicking =
                  (order.status === "PREPARED" || allDepotsPrepared) &&
                  !order.packingValidatedAt;

                return (
                  <div key={order._id}>
                    <div className="flex flex-wrap items-center gap-4 px-6 py-4">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : order._id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                      >
                        <ChevronDown
                          size={16}
                          className={`transition ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900 dark:text-white">{order.orderNo}</p>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusBadge(order.status)}`}>
                            {order.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {order.customerName}
                        </p>
                      </div>

                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        <p>{order.lines.reduce((sum, line) => sum + line.quantity, 0)} units</p>
                        <p>{depotGroups.length} depot(s)</p>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {order.packingValidatedAt ? (
                          <>
                            <button
                              onClick={() => handlePrintBL(order)}
                              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <Printer size={12} />
                              Imprimer BL
                            </button>
                            <span className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                              <Package size={12} />
                              Picking validated
                            </span>
                          </>
                        ) : canValidatePicking ? (
                          <>
                            <button
                              onClick={() => handlePrintBL(order)}
                              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <Printer size={12} />
                              Imprimer BL
                            </button>
                            <button
                              onClick={() => handleValidatePicking(order._id)}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-950 px-3 py-2 text-xs font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                            >
                              {busy ? <Loader2 size={12} className="animate-spin" /> : <Package size={12} />}
                              Validate Picking
                            </button>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                            <Package size={12} />
                            Waiting depot
                          </span>
                        )}
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="grid gap-4 bg-slate-50 px-6 pb-6 pt-2 dark:bg-slate-950/40 md:grid-cols-2">
                        {depotGroups.map((group) => (
                          <div
                            key={`${order._id}-${group.depotName}`}
                            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                          >
                            <div className="mb-3 flex items-center justify-between">
                              <div>
                                <p className="font-medium text-slate-900 dark:text-white">{group.depotName}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {group.lines.reduce((sum, line) => sum + line.quantity, 0)} units
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                                  group.prepared
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                    : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                                }`}
                              >
                                {group.prepared ? "Prepared" : "Waiting depot"}
                              </span>
                            </div>

                            <div className="space-y-2">
                              {group.lines.map((line, index) => (
                                <div
                                  key={`${group.depotName}-${index}`}
                                  className="flex items-center justify-between rounded-2xl border border-slate-100 px-3 py-2 text-sm dark:border-slate-800"
                                >
                                  <div>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                      {line.productId?.name || "Unknown product"}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      {line.productId?.sku || "—"}
                                    </p>
                                  </div>
                                  <span className="font-semibold text-slate-900 dark:text-white">
                                    {line.quantity}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {group.preparedAt ? (
                              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                                Prepared {new Date(group.preparedAt).toLocaleString("fr-TN")}
                                {group.preparedBy ? ` by ${group.preparedBy}` : ""}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* BL save/print confirmation modal */}
      {blPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950/30 dark:text-teal-400">
                  <FileText size={18} />
                </div>
                <div>
                  <p className="font-bold text-slate-950 dark:text-white">Bon de Livraison</p>
                  <p className="text-xs text-slate-400">{blPrompt.order.orderNo} · {blPrompt.order.customerName}</p>
                </div>
              </div>
              <button
                onClick={() => setBlPrompt(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition"
              >
                <X size={16} />
              </button>
            </div>

            <p className="mb-5 text-sm text-slate-600 dark:text-slate-300">
              Voulez-vous sauvegarder ce BL dans la page Documents avant d'imprimer ?
            </p>

            {saveMsg && (
              <p className={`mb-4 rounded-2xl px-4 py-2.5 text-sm font-medium ${
                saveMsg.startsWith("Sauvegardé")
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                  : "bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400"
              }`}>
                {saveMsg}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => handleBlAction(false)}
                disabled={savingDoc}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Printer size={14} /> Imprimer seulement
              </button>
              <button
                onClick={() => handleBlAction(true)}
                disabled={savingDoc}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-teal-600 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
              >
                {savingDoc ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Sauvegarder et imprimer
              </button>
            </div>

            {saveMsg.startsWith("Sauvegardé") && (
              <button
                onClick={() => setBlPrompt(null)}
                className="mt-3 w-full rounded-2xl py-2 text-xs text-slate-400 hover:text-slate-600 transition"
              >
                Fermer
              </button>
            )}
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
