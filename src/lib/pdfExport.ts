export function exportToCsv(
  columns: string[],
  rows: (string | number)[][],
  filename: string
) {
  const esc = (v: string | number) => {
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
  const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export async function exportToPdf(
  title: string,
  subtitle: string,
  columns: string[],
  rows: (string | number)[][],
  filename: string
) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Load EMM logo
  let logoDataUrl: string | null = null;
  try {
    const res = await fetch("/EMMlogo.png");
    const blob = await res.blob();
    logoDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch { /* logo optional */ }

  const PAGE_W = 297;
  const MARGIN = 14;
  const HEADER_H = 24;

  // White header area — logo top-left
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", MARGIN, 5, 22, 14);
  }

  // Title & subtitle to the right of the logo
  const textX = logoDataUrl ? MARGIN + 26 : MARGIN;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text(title, textX, 11);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(subtitle, textX, 17);

  const printedAt = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  } as Intl.DateTimeFormatOptions);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 100, 100);
  doc.text(`Imprimé le : ${printedAt}`, PAGE_W - MARGIN, 17, { align: "right" });

  // Thin separator line under header
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, HEADER_H, PAGE_W - MARGIN, HEADER_H);

  autoTable(doc, {
    head: [columns],
    body: rows,
    startY: HEADER_H + 2,
    margin: { left: MARGIN, right: MARGIN },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      fillColor: [255, 255, 255],
    },
    headStyles: {
      fillColor: [0, 0, 0],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    rowPageBreak: "auto",
    didDrawPage: (data) => {
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `Page ${data.pageNumber} / ${pageCount}`,
        PAGE_W / 2,
        210 - 5,
        { align: "center" }
      );
    },
  });

  doc.save(filename);
}

// ─── French number-to-words (TND: dinars + millimes) ────────────────────────
function frenchWords(amount: number): string {
  const ONES = [
    "", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
    "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize",
    "dix-sept", "dix-huit", "dix-neuf",
  ];
  const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante"];

  function lt100(n: number): string {
    if (n < 20) return ONES[n];
    const t = Math.floor(n / 10), o = n % 10;
    if (t === 7) return o === 0 ? "soixante-dix" : o === 1 ? "soixante et onze" : "soixante-" + ONES[10 + o];
    if (t === 8) return o === 0 ? "quatre-vingts" : "quatre-vingt-" + ONES[o];
    if (t === 9) return "quatre-vingt-" + ONES[10 + o];
    return o === 0 ? TENS[t] : o === 1 ? TENS[t] + " et un" : TENS[t] + "-" + ONES[o];
  }

  function lt1000(n: number): string {
    if (n < 100) return lt100(n);
    const h = Math.floor(n / 100), r = n % 100;
    const hs = h === 1 ? "cent" : ONES[h] + " cent";
    return r === 0 ? hs + (h > 1 ? "s" : "") : hs + " " + lt100(r);
  }

  function convert(n: number): string {
    if (n === 0) return "zéro";
    let res = "", rem = n;
    if (rem >= 1_000_000) {
      const m = Math.floor(rem / 1_000_000);
      res += (m === 1 ? "un million" : lt1000(m) + " millions") + " ";
      rem %= 1_000_000;
    }
    if (rem >= 1_000) {
      const k = Math.floor(rem / 1_000);
      res += (k === 1 ? "mille" : lt1000(k) + " mille") + " ";
      rem %= 1_000;
    }
    if (rem > 0) res += lt1000(rem);
    return res.trim();
  }

  const abs = Math.abs(amount);
  const dinars = Math.floor(abs);
  const millimes = Math.round((abs - dinars) * 1000);
  const w =
    convert(dinars) +
    (dinars !== 1 ? " dinars" : " dinar") +
    (millimes > 0
      ? " et " + convert(millimes) + (millimes !== 1 ? " millimes" : " millime")
      : "");
  return w.charAt(0).toUpperCase() + w.slice(1);
}

// ─── Invoice template types ──────────────────────────────────────────────────
export interface InvoiceTemplateLine {
  ref?: string;
  description: string;
  qty: number;
  unitPrice: number;
  totalHt: number;
}

export interface InvoiceTemplateOptions {
  docType?: string;
  companyRole?: string;
  invoiceNo: string;
  invoiceDate?: string | null;
  dueDate?: string | null;
  orderNo?: string | null;
  paymentMethod?: string;
  paymentStatus?: string;
  company?: {
    name?: string;
    address?: string;
    phone?: string;
    email?: string;
    mf?: string;
    rne?: string;
    rib?: string;
    bank?: string;
    agence?: string;
  };
  party: { label: string; name: string; mf?: string; address?: string };
  lines?: InvoiceTemplateLine[];
  subtotalHt?: number;
  fodecRate?: number;
  totalFodec?: number;
  tvaRate?: number;
  totalVat?: number;
  totalBeforeStamp?: number;
  timbreFiscal?: number;
  totalTtc: number;
  amountPaid?: number;
}

// ─── Full invoice PDF matching Tunisian invoice layout ───────────────────────
export async function printInvoiceTemplate(
  opts: InvoiceTemplateOptions,
  filename: string
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, ML = 14, MR = 14;

  const co = opts.company ?? {};
  const cName   = co.name    || "Notre Société";
  const cAddr   = co.address || "";
  const cPhone  = co.phone   || "";
  const cEmail  = co.email   || "";
  const cMf     = co.mf      || "";
  const cRne    = co.rne     || "";
  const cRib    = co.rib     || "";
  const cBank   = co.bank    || "";
  const cAgence = co.agence  || "";

  const initials = cName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2) || "CO";

  const fmtD = (v?: string | null) =>
    v
      ? new Date(v).toLocaleDateString("fr-FR", {
          day: "2-digit", month: "2-digit", year: "numeric",
        })
      : "—";

  const fmtN = (v?: number | null) =>
    v != null
      ? new Intl.NumberFormat("fr-FR", {
          minimumFractionDigits: 3,
          maximumFractionDigits: 3,
        }).format(v) + " TND"
      : "—";

  // ── Letterhead ─────────────────────────────────────────────────────────────
  doc.setFillColor(59, 130, 246);
  doc.circle(22, 22, 11, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(initials, 22, 25, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(20, 20, 20);
  doc.text(cName, 37, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  if (cAddr) doc.text(cAddr, 37, 21);
  const contact = [cPhone, cEmail].filter(Boolean).join("   |   ");
  if (contact) doc.text(contact, 37, 27);

  doc.setFontSize(6.5);
  doc.setTextColor(140, 140, 140);
  const mfRne = [cMf ? `MF : ${cMf}` : "", cRne ? `RNE : ${cRne}` : ""]
    .filter(Boolean)
    .join("   |   ");
  if (mfRne) doc.text(mfRne, 37, 33);

  // FACTURE label + invoice number (right block)
  const docLabel = (opts.docType || "FACTURE").toUpperCase();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(160, 160, 160);
  doc.text(docLabel, W - MR, 13, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(15, 15, 15);
  doc.text(opts.invoiceNo, W - MR, 24, { align: "right" });

  // Meta grid (2 columns, right side)
  const metaItems = [
    { label: "Date",      value: fmtD(opts.invoiceDate) },
    { label: "Statut",    value: (opts.paymentStatus ?? "—").replace(/_/g, " ") },
    { label: "Échéance",  value: fmtD(opts.dueDate) },
    { label: "Règlement", value: opts.paymentMethod ?? "—" },
    { label: "Commande",  value: opts.orderNo ?? "—" },
  ];
  const metaX = 130, metaCW = (W - MR - metaX) / 2;
  metaItems.forEach((m, i) => {
    const x = metaX + (i % 2) * metaCW;
    const y = 33 + Math.floor(i / 2) * 9;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(160, 160, 160);
    doc.text(m.label.toUpperCase(), x, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 30, 30);
    doc.text(String(m.value), x, y + 5);
  });

  // ── Separator ──────────────────────────────────────────────────────────────
  const sepY = 57;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.4);
  doc.line(ML, sepY, W - MR, sepY);

  // ── Party boxes ────────────────────────────────────────────────────────────
  const bY = 61, bH = 26, bW = (W - ML - MR - 6) / 2;

  // VENDEUR (left)
  doc.setFillColor(248, 249, 250);
  doc.setDrawColor(220, 228, 236);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, bY, bW, bH, 2, 2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(160, 160, 160);
  doc.text((opts.companyRole || "VENDEUR").toUpperCase(), ML + 4, bY + 5.5);
  doc.setFillColor(59, 130, 246);
  doc.circle(ML + 8, bY + 15, 4.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5);
  doc.setTextColor(255, 255, 255);
  doc.text(initials, ML + 8, bY + 16.5, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(20, 20, 20);
  doc.text((doc.splitTextToSize(cName, bW - 18) as string[])[0], ML + 16, bY + 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 100, 100);
  if (cAddr) doc.text(cAddr.substring(0, 38), ML + 16, bY + 18.5);
  if (cMf)   doc.text(`MF : ${cMf}`, ML + 16, bY + 23.5);

  // CLIENT (right)
  const cliX = ML + bW + 6;
  doc.setFillColor(248, 249, 250);
  doc.roundedRect(cliX, bY, bW, bH, 2, 2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(160, 160, 160);
  doc.text(opts.party.label.toUpperCase(), cliX + 4, bY + 5.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(20, 20, 20);
  doc.text(
    (doc.splitTextToSize(opts.party.name, bW - 8) as string[])[0],
    cliX + 4,
    bY + 13
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(100, 100, 100);
  let py = bY + 18.5;
  if (opts.party.mf)      { doc.text(`MF : ${opts.party.mf}`, cliX + 4, py); py += 5; }
  if (opts.party.address) doc.text(opts.party.address.substring(0, 38), cliX + 4, py);

  // ── Line items table ───────────────────────────────────────────────────────
  const tblY = bY + bH + 6;
  const tableRows: (string | number)[][] = (opts.lines ?? []).map((l, i) => [
    i + 1,
    l.ref ?? "—",
    l.description,
    l.qty,
    fmtN(l.unitPrice),
    fmtN(l.totalHt),
  ]);
  while (tableRows.length < 8) tableRows.push(["", "", "", "", "", ""]);

  autoTable(doc, {
    head: [["N°", "Réf.", "Désignation", "Qté", "P.U. HT (TND)", "Montant HT (TND)"]],
    body: tableRows,
    startY: tblY,
    margin: { left: ML, right: MR },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 30, 30],
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
      minCellHeight: 6.5,
    },
    headStyles: {
      fillColor: [20, 20, 20],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 9, halign: "center" },
      1: { cellWidth: 22 },
      2: { cellWidth: "auto" },
      3: { cellWidth: 13, halign: "center" },
      4: { cellWidth: 30, halign: "right" },
      5: { cellWidth: 34, halign: "right" },
    },
    alternateRowStyles: { fillColor: [250, 251, 252] },
    tableLineWidth: 0.1,
    tableLineColor: [210, 210, 210],
  });

  let sy = (doc as any).lastAutoTable.finalY + 7;

  // ── Financial summary ──────────────────────────────────────────────────────
  const sumX = W - MR - 88;
  const rowH = 7;

  if (opts.subtotalHt !== undefined) {
    const summaryRows = [
      { label: "Total brut HT",                          value: fmtN(opts.subtotalHt) },
      { label: `FODEC (${opts.fodecRate ?? 1} %)`,       value: fmtN(opts.totalFodec ?? 0) },
      { label: `TVA (${opts.tvaRate ?? 19} %)`,          value: fmtN(opts.totalVat ?? 0) },
      { label: "Avant timbre",                           value: fmtN(opts.totalBeforeStamp) },
      { label: "Timbre fiscal",                          value: fmtN(opts.timbreFiscal ?? 0) },
    ];
    summaryRows.forEach((r, i) => {
      doc.setFillColor(i % 2 === 0 ? 250 : 255, 251, 252);
      doc.rect(sumX, sy, 88, rowH, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      doc.text(r.label, sumX + 3, sy + 5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text(r.value, W - MR - 2, sy + 5, { align: "right" });
      sy += rowH;
    });
    doc.setDrawColor(150, 150, 150);
    doc.setLineWidth(0.5);
    doc.line(sumX, sy + 1, W - MR, sy + 1);
    sy += 5;
  }

  // NET À PAYER TTC
  doc.setFillColor(15, 15, 15);
  doc.roundedRect(sumX, sy, 88, 9, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text("NET À PAYER TTC", sumX + 4, sy + 6);
  doc.text(fmtN(opts.totalTtc), W - MR - 2, sy + 6, { align: "right" });
  sy += 14;

  // ── Amount in words ────────────────────────────────────────────────────────
  const wY = sy + 2;
  doc.setFillColor(248, 249, 250);
  doc.setDrawColor(220, 228, 236);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, wY, W - ML - MR, 16, 2, 2, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(140, 140, 140);
  doc.text("Arrêté la présente facture à la somme de :", ML + 5, wY + 6);
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(7.5);
  doc.setTextColor(20, 20, 20);
  const wordLines = doc.splitTextToSize(frenchWords(opts.totalTtc), W - ML - MR - 10) as string[];
  doc.text(wordLines[0], ML + 5, wY + 13);

  // ── Footer ─────────────────────────────────────────────────────────────────
  const fY = Math.max(wY + 22, 253);
  const fCW = (W - ML - MR) / 3;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(50, 50, 50);
  doc.text("Conditions de règlement", ML, fY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(100, 100, 100);
  doc.text(opts.paymentMethod ?? "Selon conditions convenues", ML, fY + 5);

  const bkX = ML + fCW;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(50, 50, 50);
  doc.text("Coordonnées bancaires", bkX, fY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(100, 100, 100);
  if (cRib)  doc.text(`RIB : ${cRib}`, bkX, fY + 5);
  if (cBank) doc.text(`Banque : ${cBank}${cAgence ? ` — ${cAgence}` : ""}`, bkX, fY + 10);

  const lgX = ML + fCW * 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.setTextColor(180, 40, 40);
  const legalLines = doc.splitTextToSize(
    "Tout retard de paiement entraîne des pénalités de retard. TVA selon les taux légaux en vigueur. Document généré automatiquement.",
    fCW - 4
  ) as string[];
  doc.text(legalLines, lgX, fY, { lineHeightFactor: 1.5 });

  // ── Bottom bar ─────────────────────────────────────────────────────────────
  doc.setFillColor(15, 15, 15);
  doc.rect(0, 279, W, 18, "F");
  const barText = [cName, cAddr, contact, mfRne].filter(Boolean).join("   •   ");
  const barLines = doc.splitTextToSize(barText, W - 28) as string[];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(170, 170, 170);
  doc.text(barLines[0], W / 2, 289, { align: "center" });

  doc.save(filename);
}

// ─── Supplier invoice HTML print (same design as receivables page) ──────────
export interface FournisseurDocumentOptions {
  invoiceNo: string;
  supplierRef?: string;
  supplierName: string;
  orderNo?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  paymentStatus?: string;
  company?: {
    name?: string; address?: string; phone?: string; email?: string;
    mf?: string; rne?: string; rib?: string; iban?: string; bank?: string; agence?: string;
  };
  subtotalHt?: number;
  fodecRate?: number;
  totalFodec?: number;
  tvaRate?: number;
  totalVat?: number;
  totalBeforeStamp?: number;
  timbreFiscal?: number;
  totalTtc: number;
  amountPaid?: number;
}

export function openFournisseurDocument(opts: FournisseurDocumentOptions): void {
  const co = opts.company ?? {};
  const companyName    = co.name    || "Notre Société";
  const companyAddress = co.address || "";
  const companyPhone   = co.phone   || "";
  const companyEmail   = co.email   || "";
  const companyMf      = co.mf      || "";
  const companyRne     = co.rne     || "";
  const companyRib     = co.rib     || "";
  const companyIban    = co.iban    || "";
  const companyBank    = co.bank    || "";
  const companyAgence  = co.agence  || "";

  const fmtDate = (v?: string | null) =>
    v ? new Date(v + (v.includes("T") ? "" : "T12:00:00")).toLocaleDateString("fr-TN") : "—";

  const STATUS_LABEL: Record<string, string> = {
    PENDING_APPROVAL: "En attente", APPROVED: "Approuvée",
    REJECTED: "Rejetée", PARTIALLY_PAID: "Part. payée", PAID: "Payée",
    OPEN: "Ouverte", SETTLED: "Soldée",
  };
  const STATUS_COLOR: Record<string, string> = {
    PAID: "#16a34a", SETTLED: "#16a34a", APPROVED: "#2563eb",
    PARTIALLY_PAID: "#d97706", PENDING_APPROVAL: "#d97706",
    REJECTED: "#dc2626", OPEN: "#64748b",
  };
  const st = opts.paymentStatus ?? "";

  const hasBreakdown = opts.subtotalHt !== undefined;
  const amountInWords = frenchWords(opts.totalTtc);

  const taxRows = hasBreakdown
    ? `
      <tr style="background:#f8fafc">
        <td style="padding:6px 12px;font-size:12px;color:#64748b">Total brut HT</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px;font-weight:600">${opts.subtotalHt!.toFixed(3)} TND</td>
      </tr>
      ${(opts.totalFodec ?? 0) > 0 ? `<tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b">FODEC (${opts.fodecRate ?? 1}%)</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px">${(opts.totalFodec ?? 0).toFixed(3)} TND</td>
      </tr>` : ""}
      ${(opts.totalVat ?? 0) > 0 ? `<tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b">TVA (${opts.tvaRate ?? 19}%)</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px">${(opts.totalVat ?? 0).toFixed(3)} TND</td>
      </tr>` : ""}
      <tr style="background:#f8fafc">
        <td style="padding:6px 12px;font-size:12px;color:#64748b">Avant timbre</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px">${(opts.totalBeforeStamp ?? 0).toFixed(3)} TND</td>
      </tr>
      <tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b">Timbre fiscal</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px">${(opts.timbreFiscal ?? 0).toFixed(3)} TND</td>
      </tr>`
    : `${opts.amountPaid !== undefined ? `
      <tr style="background:#f8fafc">
        <td style="padding:6px 12px;font-size:12px;color:#64748b">Montant payé</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px;font-weight:600;color:#16a34a">${opts.amountPaid.toFixed(3)} TND</td>
      </tr>
      <tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b">Restant dû</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px;font-weight:600;color:#dc2626">${Math.max(0, opts.totalTtc - opts.amountPaid).toFixed(3)} TND</td>
      </tr>` : ""}`;

  // Product table: single summary row when no line items
  const productRow = `
    <tr>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:center;color:#64748b;font-size:12px">1</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;font-size:11px;color:#64748b">${opts.supplierRef || opts.invoiceNo}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;font-size:13px">Facture fournisseur — ${opts.supplierName}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:center;font-size:13px">1</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:right;font-size:13px">${hasBreakdown ? opts.subtotalHt!.toFixed(3) : opts.totalTtc.toFixed(3)}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:right;font-size:13px;font-weight:600">${hasBreakdown ? opts.subtotalHt!.toFixed(3) : opts.totalTtc.toFixed(3)}</td>
    </tr>`;

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>Facture Fournisseur ${opts.invoiceNo}</title>
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
  <table style="margin-bottom:18px">
    <tr>
      <td style="vertical-align:top;width:55%">
        <img src="${typeof window !== "undefined" ? window.location.origin : ""}/EMMlogo.png" alt="${companyName}" style="height:60px;max-width:180px;object-fit:contain;display:block;margin-bottom:8px"/>
        <div style="font-size:11px;color:#64748b;margin-top:3px">${companyAddress}</div>
        <div style="font-size:11px;color:#64748b;margin-top:1px">Tél : ${companyPhone} &nbsp;·&nbsp; ${companyEmail}</div>
        ${companyMf || companyRne ? `<div style="font-size:11px;color:#64748b;margin-top:4px">${companyMf ? `<strong>MF :</strong> ${companyMf}` : ""}${companyMf && companyRne ? " &nbsp;|&nbsp; " : ""}${companyRne ? `<strong>RNE :</strong> ${companyRne}` : ""}</div>` : ""}
        ${companyRib ? `<div style="font-size:11px;color:#64748b;margin-top:1px"><strong>RIB :</strong> ${companyRib}${companyBank ? ` &nbsp;(${companyBank}${companyAgence ? " — " + companyAgence : ""})` : ""}</div>` : ""}
      </td>
      <td style="vertical-align:top;text-align:right;width:45%">
        <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;color:#64748b;text-transform:uppercase;margin-bottom:4px">Facture Fournisseur</div>
        <div style="font-size:26px;font-weight:700;letter-spacing:-1px;color:#0f172a">${opts.invoiceNo}</div>
        ${opts.supplierRef ? `<div style="font-size:11px;color:#64748b;margin-top:2px">Réf. fournisseur : ${opts.supplierRef}</div>` : ""}
        <table style="margin-top:10px;margin-left:auto;width:auto">
          <tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Date :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0">${fmtDate(opts.invoiceDate)}</td>
          </tr>
          <tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Échéance :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0">${fmtDate(opts.dueDate)}</td>
          </tr>
          <tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Statut :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0;color:${STATUS_COLOR[st] ?? "#0f172a"}">${STATUS_LABEL[st] ?? st.replace(/_/g, " ")}</td>
          </tr>
          ${opts.orderNo ? `<tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Commande :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0">${opts.orderNo}</td>
          </tr>` : ""}
        </table>
      </td>
    </tr>
  </table>

  <!-- ACHETEUR / FOURNISSEUR -->
  <table style="margin-bottom:16px">
    <tr>
      <td style="width:48%;vertical-align:top;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;font-weight:600;margin-bottom:6px">Acheteur</div>
        <div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px">
          <img src="${typeof window !== "undefined" ? window.location.origin : ""}/EMMlogo.png" alt="${companyName}" style="height:22px;object-fit:contain"/>
          ${companyName}
        </div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">${companyAddress}</div>
        ${companyMf ? `<div style="font-size:11px;color:#64748b;margin-top:1px">MF : ${companyMf}</div>` : ""}
      </td>
      <td style="width:4%"></td>
      <td style="width:48%;vertical-align:top;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;font-weight:600;margin-bottom:6px">Fournisseur</div>
        <div style="font-size:13px;font-weight:700">${opts.supplierName}</div>
      </td>
    </tr>
  </table>

  <!-- PRODUCT TABLE -->
  <table style="margin-bottom:0;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden">
    <thead>
      <tr style="background:#0f172a;color:#fff">
        <th style="padding:9px 10px;text-align:center;font-size:11px;width:32px">N°</th>
        <th style="padding:9px 10px;text-align:left;font-size:11px;width:70px">Réf.</th>
        <th style="padding:9px 10px;text-align:left;font-size:11px">Désignation</th>
        <th style="padding:9px 10px;text-align:center;font-size:11px;width:50px">Qté</th>
        <th style="padding:9px 10px;text-align:right;font-size:11px;width:110px">P.U. HT (TND)</th>
        <th style="padding:9px 10px;text-align:right;font-size:11px;width:110px">Montant HT (TND)</th>
      </tr>
    </thead>
    <tbody>${productRow}</tbody>
  </table>

  <!-- BOTTOM ANCHOR -->
  <div style="margin-top:auto">

  <!-- TAX SUMMARY -->
  <div style="display:flex;justify-content:flex-end;margin-top:16px;margin-bottom:16px">
    <table style="width:280px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 6px 6px;overflow:hidden">
      ${taxRows}
      <tr style="background:#0f172a">
        <td style="padding:9px 12px;font-size:13px;font-weight:700;color:#fff">NET À PAYER TTC</td>
        <td style="padding:9px 12px;text-align:right;font-size:13px;font-weight:700;color:#fff">${opts.totalTtc.toFixed(3)} TND</td>
      </tr>
    </table>
  </div>

  <!-- MONTANT EN LETTRES -->
  <div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;margin-bottom:16px;background:#f8fafc">
    <span style="font-size:11px;color:#64748b">Arrêté la présente facture à la somme de : </span>
    <strong style="font-size:12px">${amountInWords}</strong>
  </div>

  <!-- FOOTER -->
  <div style="border-top:1px solid #e2e8f0;padding-top:12px;display:flex;justify-content:space-between;align-items:flex-start">
    <div style="font-size:10px;color:#64748b;max-width:55%">
      <strong style="color:#0f172a">Conditions de règlement :</strong> Selon conditions convenues<br/>
      Tout retard de paiement entraîne des pénalités au taux légal en vigueur.<br/>
      En cas de litige, compétence exclusive du Tribunal de Commerce de Tunis.
    </div>
    <div style="font-size:10px;color:#64748b;text-align:right">
      <strong style="color:#0f172a">Coordonnées bancaires</strong><br/>
      ${companyRib ? `RIB : ${companyRib}<br/>` : ""}
      ${companyIban ? `IBAN : ${companyIban}<br/>` : ""}
      ${companyBank ? `Banque : ${companyBank}${companyAgence ? " · Agence : " + companyAgence : ""}` : ""}
    </div>
  </div>

  <div style="margin-top:14px;text-align:center;font-size:9px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:10px">
    ${companyName}${companyMf ? " · MF : " + companyMf : ""}${companyRne ? " · RNE : " + companyRne : ""} · ${companyAddress} · ${companyPhone} · ${companyEmail}
  </div>

  </div>

</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=750");
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }
}

// ─── Client invoice HTML print (same design as finance/receivables page) ─────
export interface ClientDocumentOptions {
  invoiceNo: string;
  orderNo?: string | null;
  customerName: string;
  customerMf?: string;
  customerAddress?: string;
  invoiceDate?: string | null;
  dueDate?: string | null;
  paymentStatus?: string;
  paymentMethod?: string;
  company?: {
    name?: string; address?: string; phone?: string; email?: string;
    mf?: string; rne?: string; rib?: string; iban?: string; bank?: string; agence?: string;
  };
  lines?: Array<{ ref?: string; description: string; qty: number; unitPrice: number; totalHt: number }>;
  subtotalHt?: number;
  fodecRate?: number;
  totalFodec?: number;
  tvaRate?: number;
  totalVat?: number;
  totalBeforeStamp?: number;
  timbreFiscal?: number;
  totalTtc: number;
  amountPaid?: number;
}

export function openClientDocument(opts: ClientDocumentOptions): void {
  const co = opts.company ?? {};
  const companyName    = co.name    || "Notre Société";
  const companyAddress = co.address || "";
  const companyPhone   = co.phone   || "";
  const companyEmail   = co.email   || "";
  const companyMf      = co.mf      || "";
  const companyRne     = co.rne     || "";
  const companyRib     = co.rib     || "";
  const companyIban    = co.iban    || "";
  const companyBank    = co.bank    || "";
  const companyAgence  = co.agence  || "";

  const fmtDate = (v?: string | null) =>
    v ? new Date(v + (v.includes("T") ? "" : "T12:00:00")).toLocaleDateString("fr-TN") : "—";

  const PAYMENT_METHOD: Record<string, string> = {
    ESPECE: "Espèces", CHEQUE: "Chèque", VIREMENT: "Virement bancaire",
    KUMBIL: "Kumbil", MIXED: "Mode mixte", UNSET: "—",
  };
  const PAYMENT_STATUS: Record<string, string> = {
    NON_PAYEE: "Non payée", PARTIELLEMENT_PAYEE: "Partiellement payée",
    PENDING_CHEQUE: "Chèque en attente", PAYEE: "Payée",
  };
  const STATUS_COLOR: Record<string, string> = {
    PAYEE: "#16a34a", PARTIELLEMENT_PAYEE: "#d97706",
    PENDING_CHEQUE: "#7c3aed", NON_PAYEE: "#64748b",
  };

  const st  = opts.paymentStatus ?? "";
  const pm  = opts.paymentMethod ?? "";
  const hasBreakdown = opts.subtotalHt !== undefined;
  const amountInWords = frenchWords(opts.totalTtc);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  // Product rows
  const productRows = opts.lines && opts.lines.length > 0
    ? opts.lines.map((l, idx) => `
      <tr style="background:${idx % 2 === 0 ? "#fff" : "#f8fafc"}">
        <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:center;color:#64748b;font-size:12px">${idx + 1}</td>
        <td style="border:1px solid #e2e8f0;padding:7px 10px;font-size:11px;color:#64748b">${l.ref || "—"}</td>
        <td style="border:1px solid #e2e8f0;padding:7px 10px;font-size:13px">${l.description}</td>
        <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:center;font-size:13px">${l.qty}</td>
        <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:right;font-size:13px">${l.unitPrice.toFixed(3)}</td>
        <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:right;font-size:13px;font-weight:600">${l.totalHt.toFixed(3)}</td>
      </tr>`).join("")
    : `<tr>
        <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:center;color:#64748b;font-size:12px">1</td>
        <td style="border:1px solid #e2e8f0;padding:7px 10px;font-size:11px;color:#64748b">${opts.invoiceNo}</td>
        <td style="border:1px solid #e2e8f0;padding:7px 10px;font-size:13px">Facture client — ${opts.customerName}</td>
        <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:center;font-size:13px">1</td>
        <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:right;font-size:13px">${hasBreakdown ? opts.subtotalHt!.toFixed(3) : opts.totalTtc.toFixed(3)}</td>
        <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:right;font-size:13px;font-weight:600">${hasBreakdown ? opts.subtotalHt!.toFixed(3) : opts.totalTtc.toFixed(3)}</td>
      </tr>`;

  const taxRows = hasBreakdown
    ? `
      <tr style="background:#f8fafc">
        <td style="padding:6px 12px;font-size:12px;color:#64748b">Total brut HT</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px;font-weight:600">${opts.subtotalHt!.toFixed(3)} TND</td>
      </tr>
      ${(opts.totalFodec ?? 0) > 0 ? `<tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b">FODEC (${opts.fodecRate ?? 1}%)</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px">${(opts.totalFodec ?? 0).toFixed(3)} TND</td>
      </tr>` : ""}
      ${(opts.totalVat ?? 0) > 0 ? `<tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b">TVA (${opts.tvaRate ?? 19}%)</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px">${(opts.totalVat ?? 0).toFixed(3)} TND</td>
      </tr>` : ""}
      <tr style="background:#f8fafc">
        <td style="padding:6px 12px;font-size:12px;color:#64748b">Avant timbre</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px">${(opts.totalBeforeStamp ?? 0).toFixed(3)} TND</td>
      </tr>
      <tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b">Timbre fiscal</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px">${(opts.timbreFiscal ?? 0).toFixed(3)} TND</td>
      </tr>`
    : `${opts.amountPaid !== undefined ? `
      <tr style="background:#f8fafc">
        <td style="padding:6px 12px;font-size:12px;color:#64748b">Montant payé</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px;font-weight:600;color:#16a34a">${opts.amountPaid.toFixed(3)} TND</td>
      </tr>
      <tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b">Restant dû</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px;font-weight:600;color:#dc2626">${Math.max(0, opts.totalTtc - opts.amountPaid).toFixed(3)} TND</td>
      </tr>` : ""}`;

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>Facture ${opts.invoiceNo}</title>
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
  <table style="margin-bottom:18px">
    <tr>
      <td style="vertical-align:top;width:55%">
        <img src="${origin}/EMMlogo.png" alt="${companyName}" style="height:60px;max-width:180px;object-fit:contain;display:block;margin-bottom:8px"/>
        <div style="font-size:11px;color:#64748b;margin-top:3px">${companyAddress}</div>
        <div style="font-size:11px;color:#64748b;margin-top:1px">Tél : ${companyPhone} &nbsp;·&nbsp; ${companyEmail}</div>
        ${companyMf || companyRne ? `<div style="font-size:11px;color:#64748b;margin-top:4px">${companyMf ? `<strong>MF :</strong> ${companyMf}` : ""}${companyMf && companyRne ? " &nbsp;|&nbsp; " : ""}${companyRne ? `<strong>RNE :</strong> ${companyRne}` : ""}</div>` : ""}
        ${companyRib ? `<div style="font-size:11px;color:#64748b;margin-top:1px"><strong>RIB :</strong> ${companyRib}${companyBank ? ` &nbsp;(${companyBank}${companyAgence ? " — " + companyAgence : ""})` : ""}</div>` : ""}
      </td>
      <td style="vertical-align:top;text-align:right;width:45%">
        <div style="font-size:26px;font-weight:700;letter-spacing:-1px;color:#0f172a">FACTURE</div>
        <div style="font-size:15px;font-weight:600;color:#334155;margin-top:2px">${opts.invoiceNo}</div>
        <table style="margin-top:10px;margin-left:auto;width:auto">
          <tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Date :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0">${fmtDate(opts.invoiceDate)}</td>
          </tr>
          <tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Échéance :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0">${fmtDate(opts.dueDate)}</td>
          </tr>
          <tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Règlement :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0">${PAYMENT_METHOD[pm] || pm || "—"}</td>
          </tr>
          <tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Statut :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0;color:${STATUS_COLOR[st] ?? "#0f172a"}">${PAYMENT_STATUS[st] || st.replace(/_/g, " ") || "—"}</td>
          </tr>
          ${opts.orderNo ? `<tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Commande :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0">${opts.orderNo}</td>
          </tr>` : ""}
        </table>
      </td>
    </tr>
  </table>

  <!-- VENDOR / CLIENT -->
  <table style="margin-bottom:16px">
    <tr>
      <td style="width:48%;vertical-align:top;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;font-weight:600;margin-bottom:6px">Vendeur</div>
        <div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px">
          <img src="${origin}/EMMlogo.png" alt="${companyName}" style="height:22px;object-fit:contain"/>
          ${companyName}
        </div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">${companyAddress}</div>
        ${companyMf ? `<div style="font-size:11px;color:#64748b;margin-top:1px">MF : ${companyMf}</div>` : ""}
      </td>
      <td style="width:4%"></td>
      <td style="width:48%;vertical-align:top;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;font-weight:600;margin-bottom:6px">Client / Destinataire</div>
        <div style="font-size:13px;font-weight:700">${opts.customerName}</div>
        ${opts.customerMf ? `<div style="font-size:11px;color:#64748b;margin-top:3px">MF : ${opts.customerMf}</div>` : ""}
        ${opts.customerAddress ? `<div style="font-size:11px;color:#64748b;margin-top:1px">Adresse : ${opts.customerAddress}</div>` : ""}
      </td>
    </tr>
  </table>

  <!-- PRODUCT TABLE -->
  <table style="margin-bottom:0;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden">
    <thead>
      <tr style="background:#0f172a;color:#fff">
        <th style="padding:9px 10px;text-align:center;font-size:11px;width:32px">N°</th>
        <th style="padding:9px 10px;text-align:left;font-size:11px;width:70px">Réf.</th>
        <th style="padding:9px 10px;text-align:left;font-size:11px">Désignation</th>
        <th style="padding:9px 10px;text-align:center;font-size:11px;width:50px">Qté</th>
        <th style="padding:9px 10px;text-align:right;font-size:11px;width:110px">P.U. HT (TND)</th>
        <th style="padding:9px 10px;text-align:right;font-size:11px;width:110px">Montant HT (TND)</th>
      </tr>
    </thead>
    <tbody>${productRows}</tbody>
  </table>

  <!-- BOTTOM ANCHOR -->
  <div style="margin-top:auto">

  <!-- TAX SUMMARY -->
  <div style="display:flex;justify-content:flex-end;margin-top:16px;margin-bottom:16px">
    <table style="width:280px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 6px 6px;overflow:hidden">
      ${taxRows}
      <tr style="background:#0f172a">
        <td style="padding:9px 12px;font-size:13px;font-weight:700;color:#fff">NET À PAYER TTC</td>
        <td style="padding:9px 12px;text-align:right;font-size:13px;font-weight:700;color:#fff">${opts.totalTtc.toFixed(3)} TND</td>
      </tr>
    </table>
  </div>

  <!-- MONTANT EN LETTRES -->
  <div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;margin-bottom:16px;background:#f8fafc">
    <span style="font-size:11px;color:#64748b">Arrêté la présente facture à la somme de : </span>
    <strong style="font-size:12px">${amountInWords}</strong>
  </div>

  <!-- FOOTER -->
  <div style="border-top:1px solid #e2e8f0;padding-top:12px;display:flex;justify-content:space-between;align-items:flex-start">
    <div style="font-size:10px;color:#64748b;max-width:55%">
      <strong style="color:#0f172a">Conditions de règlement :</strong> ${PAYMENT_METHOD[pm] || "Selon conditions convenues"}<br/>
      Tout retard de paiement entraîne des pénalités au taux légal en vigueur.<br/>
      En cas de litige, compétence exclusive du Tribunal de Commerce de Tunis.
    </div>
    <div style="font-size:10px;color:#64748b;text-align:right">
      <strong style="color:#0f172a">Coordonnées bancaires</strong><br/>
      ${companyRib ? `RIB : ${companyRib}<br/>` : ""}
      ${companyIban ? `IBAN : ${companyIban}<br/>` : ""}
      ${companyBank ? `Banque : ${companyBank}${companyAgence ? " · Agence : " + companyAgence : ""}` : ""}
    </div>
  </div>

  <div style="margin-top:14px;text-align:center;font-size:9px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:10px">
    ${companyName}${companyMf ? " · MF : " + companyMf : ""}${companyRne ? " · RNE : " + companyRne : ""} · ${companyAddress} · ${companyPhone} · ${companyEmail}
  </div>

  </div>

</div>
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=750");
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }
}

// ─── Traite commerciale (Kambial / Lettre de change) ────────────────────────
export interface KambialTemplateOptions {
  installmentNumber: number;
  totalInstallments: number;
  amount: number;
  dueDate: string;
  issueDate?: string;
  invoiceNo: string;
  customerName: string;
  customerAddress?: string;
  customerMf?: string;
  company?: {
    name?: string;
    address?: string;
    phone?: string;
    mf?: string;
    rib?: string;
    bank?: string;
    agence?: string;
  };
}

// Calibration offsets — adjust if text doesn't align on your printed form
const K_OFFSET_X = 0;  // mm — shift everything left/right
const K_OFFSET_Y = 0;  // mm — shift everything up/down

export async function printKambialTemplate(
  opts: KambialTemplateOptions,
  filename: string
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  // A4 landscape — same format as the physical pre-printed Tunisian lettre de change
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const co = opts.company ?? {};
  const cName   = co.name    || "";
  const cAddr   = co.address || "";
  const cMf     = co.mf      || "";
  const cRib    = co.rib     || "";
  const cBank   = co.bank    || "";
  const cAgence = co.agence  || "";

  const issueDate = opts.issueDate ?? new Date().toISOString();
  const fmtD = (v: string) =>
    new Date(v + (v.includes("T") ? "" : "T12:00:00"))
      .toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  const fmtN = (v: number) =>
    v.toLocaleString("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  // Helper: place text with global offset applied
  const put = (
    text: string,
    x: number,
    y: number,
    size: number,
    bold = false,
    align: "left" | "center" | "right" = "left"
  ) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(0, 0, 0);
    doc.text(text, x + K_OFFSET_X, y + K_OFFSET_Y, { align });
  };

  // ── Field positions (mm from top-left of page) ────────────────────────────
  // These coordinates are calibrated to the standard Tunisian lettre de change
  // pre-printed form. Adjust K_OFFSET_X / K_OFFSET_Y at the top of this file
  // if the printed text is shifted left/right/up/down on your physical form.

  // ROW 1 — Echéance + city + issue date + amount
  put(fmtD(opts.dueDate),                    112,  37, 8, true);   // Echéance value
  put(cBank || "Tunis",                       178,  37, 8);          // "A" city
  put(fmtD(issueDate),                        112,  48, 8);          // "Le" date
  put(fmtN(opts.amount),                      258,  38, 10, true, "center"); // Montant (top box)

  // ROW 2 — Tireur (company) + customer name + second amount
  put(cName,                                   12,  65, 8, true);   // Tireur
  if (cAddr)
    put(cAddr,                                 12,  72, 7);
  put(opts.customerName,                       70,  82, 9, true);   // Payez à l'ordre de
  put(fmtN(opts.amount),                      258,  68, 10, true, "center"); // Montant (second box)
  put(`${opts.installmentNumber}/${opts.totalInstallments}`, 248, 76, 7);   // Noa

  // ROW 3 — Montant en lettres + data cells
  const words = frenchWords(opts.amount);
  const wordLines = doc.splitTextToSize(words, 95) as string[];
  put(wordLines[0] || "",                      12,  98, 7, true);
  if (wordLines[1])
    put(wordLines[1],                          12, 104, 7, true);
  put(cBank || "Tunis",                       116,  98, 7);          // Lieu de création
  put(fmtD(issueDate),                        152,  98, 7);          // Date de création
  put(fmtD(opts.dueDate),                     188,  98, 7);          // Echéance cell
  put(opts.customerName.substring(0, 18),     223,  98, 7);          // Nom du client
  put(cMf || "",                              258,  98, 7);           // Codes Banques

  // ROW 4 — RIB du Tireur + Le + Valeur en + Domiciliation
  put(cRib || "",                              12, 115, 7);           // RIB du Tireur
  put(fmtD(issueDate),                         82, 115, 7);           // Le
  put(`${fmtN(opts.amount)} TND`,             148, 115, 7);           // Valeur en
  const domicil = cBank ? `${cBank}${cAgence ? ` ${cAgence}` : ""}` : "";
  put(domicil,                                222, 115, 7);           // Domiciliation

  // ROW 5 — N° de compte + Nom et adresse du Tiré
  put(opts.customerName,                      142, 128, 7, true);    // Nom du Tiré
  if (opts.customerAddress)
    put(opts.customerAddress.substring(0, 50), 142, 135, 7);         // Adresse du Tiré
  if (opts.customerMf)
    put(`MF: ${opts.customerMf}`,             142, 141, 6);

  doc.save(filename);
}

// ─── Bon de Réception HTML print ──────────────────────────────────────────────

export interface BonReceptionDocumentOptions {
  receiptNo: string;
  supplierName: string;
  orderNo?: string | null;
  depotName?: string | null;
  receiptStatus?: string;
  invoiceDate?: string | null;
  notes?: string;
  company?: {
    name?: string; address?: string; phone?: string; email?: string;
    mf?: string; rne?: string; rib?: string; iban?: string; bank?: string; agence?: string;
  };
  lines?: Array<{
    sku?: string;
    name: string;
    orderedQty: number;
    receivedQty: number;
    acceptedQty: number;
    qualityStatus: string;
    lotRef?: string;
  }>;
}

export function openBonReceptionDocument(opts: BonReceptionDocumentOptions): void {
  const co = opts.company ?? {};
  const companyName    = co.name    || "Notre Société";
  const companyAddress = co.address || "";
  const companyPhone   = co.phone   || "";
  const companyEmail   = co.email   || "";
  const companyMf      = co.mf      || "";
  const companyRne     = co.rne     || "";
  const companyRib     = co.rib     || "";
  const companyBank    = co.bank    || "";

  const fmtDate = (v?: string | null) =>
    v ? new Date(v + (v.includes("T") ? "" : "T12:00:00")).toLocaleDateString("fr-TN") : "—";

  const STATUS_LABEL: Record<string, string> = {
    PARTIAL: "Réception partielle", FULL: "Réception complète", LITIGATION: "Litige",
  };
  const STATUS_COLOR: Record<string, string> = {
    FULL: "#16a34a", PARTIAL: "#d97706", LITIGATION: "#dc2626",
  };
  const st = opts.receiptStatus ?? "";
  const stLabel = STATUS_LABEL[st] || st.replace(/_/g, " ");
  const stColor = STATUS_COLOR[st] || "#64748b";

  const QUALITY_LABEL: Record<string, string> = {
    ACCEPTED: "Accepté", WITH_RESERVATION: "Avec réserve", REJECTED: "Rejeté",
  };
  const QUALITY_COLOR: Record<string, string> = {
    ACCEPTED: "#16a34a", WITH_RESERVATION: "#d97706", REJECTED: "#dc2626",
  };

  const lineRows = (opts.lines ?? []).map((l, i) => `
    <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f8fafc"}">
      <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:center;color:#64748b;font-size:12px">${i + 1}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;font-size:11px;color:#64748b">${l.sku || "—"}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;font-size:13px">${l.name}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:center;font-size:13px">${l.orderedQty}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:center;font-size:13px">${l.receivedQty}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:center;font-size:13px">${l.acceptedQty}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:center;font-size:12px;color:${QUALITY_COLOR[l.qualityStatus] || "#64748b"};font-weight:600">${QUALITY_LABEL[l.qualityStatus] || l.qualityStatus}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;font-size:11px;color:#64748b">${l.lotRef || "—"}</td>
    </tr>`).join("");

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>Bon de Réception ${opts.receiptNo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #1e293b; background: #fff; }
    @page { size: A4 landscape; margin: 12mm 14mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
<div style="max-width:940px;margin:0 auto;padding:0 4px">

  <div style="background:#0f766e;color:#fff;padding:14px 20px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center">
    <div>
      <div style="font-size:20px;font-weight:800;letter-spacing:0.5px">BON DE RÉCEPTION</div>
      <div style="font-size:11px;opacity:.8;margin-top:3px">N° ${opts.receiptNo}</div>
    </div>
    <div style="text-align:right;font-size:11px;opacity:.85">
      <div style="font-size:16px;font-weight:700">${companyName}</div>
      ${companyAddress ? `<div>${companyAddress}</div>` : ""}
      ${companyMf ? `<div>MF: ${companyMf}</div>` : ""}
    </div>
  </div>

  <div style="border:1px solid #e2e8f0;border-top:none;padding:12px 20px;background:#f8fafc;display:flex;gap:32px;flex-wrap:wrap">
    <div><span style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em">Date</span><br/><strong>${fmtDate(opts.invoiceDate)}</strong></div>
    <div><span style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em">N° Commande</span><br/><strong>${opts.orderNo || "—"}</strong></div>
    <div><span style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em">Dépôt</span><br/><strong>${opts.depotName || "—"}</strong></div>
    <div><span style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em">Statut</span><br/><span style="font-weight:700;color:${stColor}">${stLabel}</span></div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid #e2e8f0;border-top:none">
    <div style="padding:16px 20px;border-right:1px solid #e2e8f0">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-bottom:8px">Acheteur / Destinataire</div>
      <div style="font-weight:700;font-size:14px;color:#0f766e">${companyName}</div>
      ${companyAddress ? `<div style="font-size:12px;color:#64748b;margin-top:3px">${companyAddress}</div>` : ""}
      ${companyPhone ? `<div style="font-size:12px;color:#64748b">Tél : ${companyPhone}</div>` : ""}
      ${companyEmail ? `<div style="font-size:12px;color:#64748b">${companyEmail}</div>` : ""}
      ${companyMf ? `<div style="font-size:12px;color:#64748b;margin-top:4px">MF : ${companyMf}</div>` : ""}
      ${companyRne ? `<div style="font-size:12px;color:#64748b">RNE : ${companyRne}</div>` : ""}
    </div>
    <div style="padding:16px 20px;background:#f8fafc">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#94a3b8;margin-bottom:8px">Fournisseur</div>
      <div style="font-weight:700;font-size:14px">${opts.supplierName}</div>
      ${companyRib ? `<div style="font-size:12px;color:#64748b;margin-top:4px">RIB : ${companyRib}</div>` : ""}
      ${companyBank ? `<div style="font-size:12px;color:#64748b">Banque : ${companyBank}</div>` : ""}
    </div>
  </div>

  <div style="margin-top:16px">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#0f766e;color:#fff">
          <th style="padding:8px 10px;text-align:center;font-size:11px;width:36px">#</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;width:80px">Réf / SKU</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px">Produit</th>
          <th style="padding:8px 10px;text-align:center;font-size:11px;width:80px">Qté cmdée</th>
          <th style="padding:8px 10px;text-align:center;font-size:11px;width:80px">Qté reçue</th>
          <th style="padding:8px 10px;text-align:center;font-size:11px;width:80px">Qté acceptée</th>
          <th style="padding:8px 10px;text-align:center;font-size:11px;width:100px">Qualité</th>
          <th style="padding:8px 10px;text-align:left;font-size:11px;width:80px">Lot</th>
        </tr>
      </thead>
      <tbody>
        ${lineRows || `<tr><td colspan="8" style="padding:20px;text-align:center;color:#94a3b8;font-size:12px">Aucune ligne</td></tr>`}
      </tbody>
    </table>
  </div>

  ${opts.notes ? `
  <div style="margin-top:16px;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;background:#fffbeb">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:#92400e;margin-bottom:6px">Notes</div>
    <div style="font-size:13px;color:#78350f">${opts.notes}</div>
  </div>` : ""}

  <div style="display:flex;justify-content:flex-end;margin-top:16px">
    <table style="border-collapse:collapse;min-width:260px">
      <tr style="background:#f8fafc">
        <td style="padding:8px 14px;font-size:12px;color:#64748b">Total lignes</td>
        <td style="padding:8px 14px;text-align:right;font-size:13px;font-weight:700">${(opts.lines ?? []).length} ligne${(opts.lines ?? []).length !== 1 ? "s" : ""}</td>
      </tr>
      <tr>
        <td style="padding:8px 14px;font-size:12px;color:#64748b">Total reçu</td>
        <td style="padding:8px 14px;text-align:right;font-size:13px;font-weight:700">${(opts.lines ?? []).reduce((s, l) => s + l.receivedQty, 0)} unités</td>
      </tr>
      <tr style="background:#0f766e">
        <td style="padding:10px 14px;font-size:13px;font-weight:700;color:#fff">Total accepté</td>
        <td style="padding:10px 14px;text-align:right;font-size:14px;font-weight:800;color:#fff">${(opts.lines ?? []).reduce((s, l) => s + l.acceptedQty, 0)} unités</td>
      </tr>
    </table>
  </div>

  <div style="margin-top:24px;border-top:2px solid #e2e8f0;padding-top:12px;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8">
    <span>${companyName}${companyMf ? ` · MF ${companyMf}` : ""}</span>
    <span>Imprimé le ${new Date().toLocaleDateString("fr-TN", { day: "2-digit", month: "long", year: "numeric" } as Intl.DateTimeFormatOptions)}</span>
    <span>Bon de réception ${opts.receiptNo}</span>
  </div>

</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 400);
}

// ─── Legacy receipt/document print (non-invoice layout) ─────────────────────
export async function printInvoicePdf(
  docType: string,
  docNo: string,
  partyLabel: string,
  partyName: string,
  details: { label: string; value: string }[],
  amounts: { label: string; value: string; bold?: boolean; green?: boolean; red?: boolean }[],
  filename: string
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const W = 210, ML = 14, MR = 14, bodyW = W - ML - MR;

  doc.setFillColor(15, 15, 15);
  doc.rect(0, 0, W, 28, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.text(docType.toUpperCase(), ML, 10);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text(docNo, ML, 22);

  const printedAt = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.text(`Imprimé le : ${printedAt}`, W - MR, 22, { align: "right" });

  const halfW = bodyW / 2 - 3;
  const boxY = 34, boxH = 24;

  doc.setFillColor(248, 249, 250);
  doc.setDrawColor(220, 228, 236);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML, boxY, halfW, boxH, 2, 2, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 150);
  doc.text(partyLabel.toUpperCase(), ML + 4, boxY + 7);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20, 20, 20);
  const nameLines = doc.splitTextToSize(partyName, halfW - 8) as string[];
  doc.text(nameLines[0], ML + 4, boxY + 17);

  const detX = ML + halfW + 6;
  const detColW = (W - MR - detX) / 2;

  details.forEach((d, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = detX + col * detColW;
    const y = boxY + 3 + row * 13;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(150, 150, 150);
    doc.text(d.label.toUpperCase(), x, y + 3);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(25, 25, 25);
    doc.text(d.value, x, y + 10);
  });

  const sepY = boxY + Math.max(boxH, Math.ceil(details.length / 2) * 13) + 8;
  doc.setDrawColor(220, 228, 236);
  doc.setLineWidth(0.4);
  doc.line(ML, sepY, W - MR, sepY);

  const amtHeaderY = sepY + 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text("RÉCAPITULATIF FINANCIER", ML, amtHeaderY);

  const tblY = amtHeaderY + 5;
  const rowH = 9;

  amounts.forEach((a, idx) => {
    const y = tblY + idx * rowH;

    doc.setFillColor(a.bold ? 241 : idx % 2 === 0 ? 248 : 255, a.bold ? 245 : 249, a.bold ? 249 : 250);
    doc.rect(ML, y, bodyW, rowH, "F");

    const fs = a.bold ? "bold" : "normal";
    const size = a.bold ? 9 : 8.5;
    doc.setFont("helvetica", fs);
    doc.setFontSize(size);
    doc.setTextColor(a.green ? 22 : a.red ? 220 : 50, a.green ? 163 : a.red ? 38 : 50, a.green ? 74 : a.red ? 38 : 50);
    doc.text(a.label, ML + 5, y + rowH - 3);

    doc.setFont("helvetica", fs);
    doc.setFontSize(size);
    doc.text(a.value, W - MR - 5, y + rowH - 3, { align: "right" });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(ML, y + rowH, W - MR, y + rowH);
  });

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.rect(ML, tblY, bodyW, amounts.length * rowH, "S");

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(ML, 287, W - MR, 287);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text("Page 1 / 1", W / 2, 292, { align: "center" });

  doc.save(filename);
}
