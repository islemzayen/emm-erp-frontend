"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { customerInvoiceService, type CustomerInvoice } from "@/services/commercial/customerInvoiceService";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { financeService, type CompanySettings } from "@/services/finance/financeService";
import { useLanguage } from "@/context/LanguageContext";
import { FileText, Loader2, Plus, Printer, Search, X, BadgeCheck, Clock, AlertCircle, CircleDashed } from "lucide-react";
import { devisService, type Devis } from "@/services/commercial/devisService";

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

function getErrorMessage(err: unknown, fallback: string) {
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof err.response === "object" &&
    err.response !== null &&
    "data" in err.response &&
    typeof err.response.data === "object" &&
    err.response.data !== null &&
    "message" in err.response.data &&
    typeof err.response.data.message === "string"
  ) {
    return err.response.data.message;
  }
  return fallback;
}

function roundAmount(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 1000) / 1000;
}

// ─── Montant en lettres (French, TND) ────────────────────────────────────────
function numToWordsFR(n: number): string {
  if (n === 0) return "zéro";
  const ones = ["","un","deux","trois","quatre","cinq","six","sept","huit","neuf",
    "dix","onze","douze","treize","quatorze","quinze","seize","dix-sept","dix-huit","dix-neuf"];
  const tens = ["","","vingt","trente","quarante","cinquante","soixante","soixante","quatre-vingt","quatre-vingt"];
  let r = "";
  if (n >= 1000000) { r += numToWordsFR(Math.floor(n / 1000000)) + " million "; n %= 1000000; }
  if (n >= 1000) {
    if (Math.floor(n / 1000) === 1) r += "mille ";
    else r += numToWordsFR(Math.floor(n / 1000)) + " mille ";
    n %= 1000;
  }
  if (n >= 100) {
    if (Math.floor(n / 100) === 1) r += "cent ";
    else r += ones[Math.floor(n / 100)] + " cent ";
    n %= 100;
  }
  if (n >= 20) {
    const t = Math.floor(n / 10), o = n % 10;
    if (t === 7 || t === 9) { r += tens[t] + "-" + ones[10 + o] + " "; }
    else if (t === 8) { r += (o === 0 ? "quatre-vingts" : "quatre-vingt-" + ones[o]) + " "; }
    else { r += tens[t] + (o === 1 ? "-et-un" : o > 0 ? "-" + ones[o] : "") + " "; }
  } else if (n > 0) { r += ones[n] + " "; }
  return r.trim();
}

function montantEnLettres(montant: number): string {
  const totalMillimes = Math.round(montant * 1000);
  const dinars = Math.floor(totalMillimes / 1000);
  const millimes = totalMillimes % 1000;
  let r = numToWordsFR(dinars) + (dinars > 1 ? " dinars" : " dinar");
  if (millimes > 0) r += " et " + numToWordsFR(millimes) + (millimes > 1 ? " millimes" : " millime");
  return r.charAt(0).toUpperCase() + r.slice(1);
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  ESPECE: "Espèces", CHEQUE: "Chèque", VIREMENT: "Virement bancaire",
  KUMBIL: "Kumbil", MIXED: "Mode mixte", UNSET: "—",
};
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  NON_PAYEE: "Non payée", PARTIELLEMENT_PAYEE: "Partiellement payée",
  PENDING_CHEQUE: "Chèque en attente", PAYEE: "Payée",
};
const TEJ_STATUS_LABELS: Record<string, string> = {
  NOT_SUBMITTED: "Non soumis", PENDING: "En attente DGI",
  VALIDATED: "Validé DGI", REJECTED: "Rejeté DGI",
};

function openInvoiceDocument(invoice: CustomerInvoice, settings: CompanySettings | null) {
  const order = invoice.salesOrderId;
  const tvaRate = invoice.applyTva ? (invoice.tvaRate ?? 19) : 0;
  const fodecRate = invoice.applyFodec ? (invoice.fodecRate ?? 1) : 0;
  const issueDate = new Date(invoice.issueDate || Date.now()).toLocaleDateString("fr-TN");
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("fr-TN") : "—";

  const s = settings;
  const companyName = s?.companyName || "EMM TN";
  const companyAddress = s?.address || "Route de Gabès Km 6, Sfax, Tunisie";
  const companyPhone = s?.phone || "+(216) 98 241 790";
  const companyEmail = s?.email || "info@emmtn.com";
  const companyMf = s?.mf || "";
  const companyRne = s?.rne || "";
  const companyRib = s?.rib || "";
  const companyIban = s?.iban || "";
  const companyBank = s?.bank || "";
  const companyAgence = s?.agence || "";

  const r = (v: number) => Math.round((v + Number.EPSILON) * 1000) / 1000;
  const processedLines = invoice.lines.map((line) => {
    const qty       = Number(line.quantity || 0);
    const unitPrice = Number(line.baseUnitHt || 0);
    const disc      = Number((line as any).discount || 0);
    const brutHT    = r(qty * unitPrice);
    const remiseAmt = Number((line as any).discountAmount || 0) > 0
      ? Number((line as any).discountAmount)
      : r(brutHT * disc / 100);
    const montantHT = r(brutHT - remiseAmt);
    return { line, qty, unitPrice, disc, brutHT, remiseAmt, montantHT };
  });

  const totalBrutHT = r(processedLines.reduce((s, l) => s + l.brutHT, 0));
  const totalRemise = r(processedLines.reduce((s, l) => s + l.remiseAmt, 0));
  const totalNetHT  = invoice.subtotalHt ?? r(totalBrutHT - totalRemise);
  const timbre      = invoice.timbreFiscal ?? 1;

  const MIN_ROWS = 16;
  const dataRows = processedLines.map(({ line, qty, unitPrice, disc, montantHT }, idx) => `
    <tr style="background:${idx % 2 === 0 ? "#fff" : "#f8fafc"}">
      <td style="padding:7px 10px;font-size:11px;color:#64748b;border-right:1px solid #e2e8f0">${line.productId?.sku || "—"}</td>
      <td style="padding:7px 10px;font-size:12px;border-right:1px solid #e2e8f0">${line.productId?.name || "—"}</td>
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

  const isSupplier = invoice.invoiceType === "SUPPLIER";
  const tejStatusLabel = TEJ_STATUS_LABELS[invoice.tejStatus || "NOT_SUBMITTED"] || invoice.tejStatus || "Non soumis";
  const tejColor = invoice.tejStatus === "VALIDATED" ? "#16a34a" : invoice.tejStatus === "REJECTED" ? "#dc2626" : "#94a3b8";
  const isTejValidated = invoice.tejStatus === "VALIDATED";

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>Facture ${invoice.invoiceNo}</title>
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

  <!-- ═══ HEADER ═══ -->
  <table style="margin-bottom:18px">
    <tr>
      <td style="vertical-align:top;width:55%">
        <!-- Company block -->
        <img src="${window.location.origin}/EMMlogo.png" alt="${companyName}" style="height:60px;max-width:180px;object-fit:contain;display:block;margin-bottom:8px"/>
        <div style="font-size:11px;color:#64748b;margin-top:3px">${companyAddress}</div>
        <div style="font-size:11px;color:#64748b;margin-top:1px">Tél : ${companyPhone} &nbsp;·&nbsp; ${companyEmail}</div>
        ${companyMf || companyRne ? `<div style="font-size:11px;color:#64748b;margin-top:4px">${companyMf ? `<strong>MF :</strong> ${companyMf}` : ""}${companyMf && companyRne ? " &nbsp;|&nbsp; " : ""}${companyRne ? `<strong>RNE :</strong> ${companyRne}` : ""}</div>` : ""}
        ${companyRib ? `<div style="font-size:11px;color:#64748b;margin-top:1px"><strong>RIB :</strong> ${companyRib}${companyBank ? ` &nbsp;(${companyBank}${companyAgence ? " — " + companyAgence : ""})` : ""}</div>` : ""}
      </td>
      <td style="vertical-align:top;text-align:right;width:45%">
        <!-- Invoice identity -->
        <div style="font-size:26px;font-weight:700;letter-spacing:-1px;color:#0f172a">FACTURE</div>
        <div style="font-size:15px;font-weight:600;color:#334155;margin-top:2px">${invoice.invoiceNo}</div>
        <table style="margin-top:10px;margin-left:auto;width:auto">
          <tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Date :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0">${issueDate}</td>
          </tr>
          <tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Échéance :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0">${dueDate}</td>
          </tr>
          <tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Règlement :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0">${PAYMENT_METHOD_LABELS[invoice.paymentMethod] || "—"}</td>
          </tr>
          <tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Statut :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0;color:${invoice.paymentStatus === "PAYEE" ? "#16a34a" : "#0f172a"}">${PAYMENT_STATUS_LABELS[invoice.paymentStatus] || invoice.paymentStatus}</td>
          </tr>
          <tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Commande :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0">${order?.orderNo || "—"}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  ${isSupplier ? `<!-- ═══ TEJ BAND ═══ -->
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 14px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between">
    <div>
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;font-weight:600">Plateforme TEJ — DGI e-Facturation</div>
      <div style="font-size:13px;font-weight:700;margin-top:3px;color:#0f172a">${invoice.tejReference || "NON SOUMIS"}</div>
      <div style="font-size:10px;margin-top:2px;color:${tejColor};font-weight:600">${tejStatusLabel}</div>
    </div>
    <div style="font-size:9px;color:#94a3b8;text-align:right">
      ${isTejValidated ? `<span style="color:#16a34a;font-size:10px;font-weight:700">✓ Validé DGI</span><br/>` : ""}
      Document fiscal électronique<br/>conforme à la loi n°2024-x
    </div>
  </div>` : ""}

  <!-- ═══ VENDOR / CLIENT ═══ -->
  <table style="margin-bottom:16px">
    <tr>
      <td style="width:48%;vertical-align:top;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;font-weight:600;margin-bottom:6px">Vendeur</div>
        <div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px">
          <img src="${window.location.origin}/EMMlogo.png" alt="${companyName}" style="height:22px;object-fit:contain"/>
          ${companyName}
        </div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">${companyAddress}</div>
        ${companyMf ? `<div style="font-size:11px;color:#64748b;margin-top:1px">MF : ${companyMf}</div>` : ""}
      </td>
      <td style="width:4%"></td>
      <td style="width:48%;vertical-align:top;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;font-weight:600;margin-bottom:6px">Client / Destinataire</div>
        <div style="font-size:13px;font-weight:700">${invoice.customerName}</div>
        ${invoice.customerMf ? `<div style="font-size:11px;color:#64748b;margin-top:3px">MF : ${invoice.customerMf}</div>` : ""}
        ${invoice.customerAddress ? `<div style="font-size:11px;color:#64748b;margin-top:1px">Adresse : ${invoice.customerAddress}</div>` : ""}
      </td>
    </tr>
  </table>

  <!-- PRODUCT TABLE -->
  <table style="border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;margin-bottom:0;border-collapse:collapse">
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
        <td style="padding:6px 12px;text-align:right;font-size:12px;color:#dc2626;border-bottom:1px solid #e2e8f0">- ${totalRemise.toFixed(3)} TND</td>
      </tr>` : ""}
      <tr style="background:#f8fafc">
        <td style="padding:6px 12px;font-size:12px;font-weight:600;color:#0f172a;border-bottom:1px solid #e2e8f0">Total Net HT</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px;font-weight:600;border-bottom:1px solid #e2e8f0">${(totalNetHT ?? 0).toFixed(3)} TND</td>
      </tr>
      ${fodecRate > 0 ? `<tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0">FODEC (${fodecRate}%)</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px;border-bottom:1px solid #e2e8f0">${invoice.totalFodec.toFixed(3)} TND</td>
      </tr>` : ""}
      ${tvaRate > 0 ? `<tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0">TVA (${tvaRate}%)</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px;border-bottom:1px solid #e2e8f0">${invoice.totalVat.toFixed(3)} TND</td>
      </tr>` : ""}
      <tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0">Timbre fiscal</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px;border-bottom:1px solid #e2e8f0">${timbre.toFixed(3)} TND</td>
      </tr>
      <tr style="background:#0f172a">
        <td style="padding:9px 12px;font-size:13px;font-weight:700;color:#fff">NET À PAYER TTC</td>
        <td style="padding:9px 12px;text-align:right;font-size:13px;font-weight:700;color:#fff">${invoice.totalTtc.toFixed(3)} TND</td>
      </tr>
    </table>
  </div>

  <!-- MONTANT EN LETTRES -->
  <div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;margin-bottom:12px;background:#f8fafc">
    <span style="font-size:11px;color:#64748b">Arrêté la présente facture à la somme de : </span>
    <strong style="font-size:12px">${montantEnLettres(invoice.totalTtc)}</strong>
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
    ${companyName}${companyMf ? " · MF : " + companyMf : ""}${companyRne ? " · RNE : " + companyRne : ""} · ${companyAddress} · ${companyPhone} · ${companyEmail}
  </div>

  </div><!-- end bottom anchor -->

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

export default function FinanceReceivablesPage() {
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [acceptedDevis, setAcceptedDevis] = useState<Devis[]>([]);
  const [selectedDevisId, setSelectedDevisId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const settingsRef = useRef<CompanySettings | null>(null);

  const [typeFilter, setTypeFilter] = useState<"CLIENT" | "SUPPLIER">("CLIENT");

  const [tejOpen, setTejOpen] = useState(false);
  const [tejInvoice, setTejInvoice] = useState<CustomerInvoice | null>(null);
  const [tejRef, setTejRef] = useState("");
  const [tejStatus, setTejStatus] = useState<"NOT_SUBMITTED" | "PENDING" | "VALIDATED" | "REJECTED">("NOT_SUBMITTED");
  const [tejSaving, setTejSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      if (!settingsRef.current) {
        financeService.getSettings().then((s) => { settingsRef.current = s; }).catch(() => {});
      }
      const data = await customerInvoiceService.getAll();
      setInvoices(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load receivables"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);


  const filteredInvoices = useMemo(() => {
    const query  = search.toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : null;
    const toTs   = dateTo   ? new Date(dateTo   + "T23:59:59").getTime() : null;
    return invoices.filter((doc) => {
      const matchSearch = [
        doc.invoiceNo,
        doc.customerName,
        doc.salesOrderId?.orderNo || "",
        doc.salesOrderId?.status || "",
      ].join(" ").toLowerCase().includes(query);
      if (!matchSearch) return false;

      if (fromTs || toTs) {
        const issued = doc.issueDate ? new Date(doc.issueDate).getTime() : null;
        if (issued == null) return false;
        if (fromTs && issued < fromTs) return false;
        if (toTs   && issued > toTs)   return false;
      }
      return true;
    });
  }, [invoices, search, dateFrom, dateTo]);



  const openTej = (invoice: CustomerInvoice) => {
    setTejInvoice(invoice);
    setTejRef(invoice.tejReference || "");
    setTejStatus(invoice.tejStatus || "NOT_SUBMITTED");
    setTejOpen(true);
  };

  const saveTej = async () => {
    if (!tejInvoice) return;
    try {
      setTejSaving(true);
      await financeService.updateInvoiceTej(tejInvoice._id, {
        tejReference: tejRef,
        tejStatus,
      });
      setTejOpen(false);
      await load();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Échec de la mise à jour TEJ"));
    } finally {
      setTejSaving(false);
    }
  };

  const openCreateModal = async () => {
    try {
      setError("");
      const [allDevis, existingInvoices] = await Promise.all([
        devisService.getAll(),
        customerInvoiceService.getAll(),
      ]);
      const invoicedOrderIds = new Set(
        existingInvoices.map((inv) => inv.salesOrderId?._id || (inv.salesOrderId as unknown as string))
      );
      const available = allDevis.filter(
        (d) =>
          d.status === "ACCEPTED" &&
          !invoicedOrderIds.has(d.salesOrderId?._id || (d.salesOrderId as unknown as string))
      );
      setAcceptedDevis(available);
      setSelectedDevisId(null);
      setCreateOpen(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Échec du chargement des devis acceptés"));
    }
  };

  const handleCreateInvoice = async () => {
    if (!selectedDevisId) return;
    try {
      setCreating(true);
      setError("");
      await devisService.createInvoice(selectedDevisId);
      setCreateOpen(false);
      await load();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Échec de la création de la facture"));
    } finally {
      setCreating(false);
    }
  };

  const tejBadge = (inv: CustomerInvoice) => {
    const s = inv.tejStatus || "NOT_SUBMITTED";
    if (s === "VALIDATED") return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"><BadgeCheck size={10} />{t("fin_tej_ok")}</span>;
    if (s === "PENDING") return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"><Clock size={10} />{t("fin_tej_pending")}</span>;
    if (s === "REJECTED") return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-950/30 dark:text-rose-400"><AlertCircle size={10} />{t("fin_tej_rejected")}</span>;
    return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"><CircleDashed size={10} />{t("fin_tej_notSubmitted")}</span>;
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "FINANCE_MANAGER"]}>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              {t("fin_recTitle")}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t("fin_recSubtitle")}
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
          >
            <Plus size={15} />
            {t("fin_createInvoice")}
          </button>
        </div>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        ) : null}

        <div className={`${surface} flex flex-wrap items-center gap-3 px-5 py-3.5`}>
          <div className="flex flex-1 items-center gap-3 min-w-[200px]">
            <Search size={15} className="shrink-0 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("fin_searchReceivables")}
              className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Du</label>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Au</label>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                title="Réinitialiser les dates"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div
            className={`${surface} flex items-center justify-center gap-2 py-16 text-sm text-slate-500 dark:text-slate-400`}
          >
            <Loader2 size={16} className="animate-spin" />
            {t("fin_loadingReceivables")}
          </div>
        ) : (
          <div className={`${surface} overflow-hidden`}>
            <div className="flex items-center gap-1 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              {(["CLIENT", "SUPPLIER"] as const).map((tp) => {
                const count = filteredInvoices.filter((inv) => (inv.invoiceType || "CLIENT") === tp).length;
                return (
                  <button
                    key={tp}
                    onClick={() => setTypeFilter(tp)}
                    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium transition ${
                      typeFilter === tp
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                    }`}
                  >
                    {tp === "CLIENT" ? t("fin_client") : t("fin_supplier")}
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${typeFilter === tp ? "bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-950" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {!filteredInvoices.filter((inv) => (inv.invoiceType || "CLIENT") === typeFilter).length ? (
              <div className="flex flex-col items-center justify-center py-16">
                <FileText size={32} className="mb-3 text-slate-300 dark:text-slate-700" />
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  {t("fin_noInvoices")}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredInvoices.filter((inv) => (inv.invoiceType || "CLIENT") === typeFilter).map((invoice) => {
                  return (
                    <div
                      key={invoice._id}
                      className="grid gap-3 px-6 py-4 md:grid-cols-[1.2fr_1fr_0.8fr_auto]"
                    >
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {invoice.invoiceNo}
                        </p>
                        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                          {invoice.salesOrderId?.orderNo || "-"} · {invoice.customerName}
                        </p>
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        <p>{invoice.salesOrderId?.status || "-"}</p>
                        <p>{invoice.paymentStatus}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {invoice.totalTtc.toLocaleString("fr-TN", {
                            minimumFractionDigits: 3,
                          })}{" "}
                          {t("fin_tnd")}
                        </p>
                        {invoice.invoiceType === "SUPPLIER" && (
                          <div className="mt-1 flex justify-end">{tejBadge(invoice)}</div>
                        )}
                      </div>
                      <div className="flex items-center justify-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); openInvoiceDocument(invoice, settingsRef.current); }}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          <Printer size={14} />
                          {t("fin_print")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tejOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
            <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-950 dark:text-white">{t("fin_tejRef")}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{tejInvoice?.invoiceNo}</p>
                </div>
                <button onClick={() => setTejOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <label className="block text-sm">
                  <span className="mb-1.5 block text-slate-600 dark:text-slate-300">{t("fin_tejFiscalId")}</span>
                  <input
                    className={inputClass}
                    placeholder={t("fin_tejRefPlaceholder")}
                    value={tejRef}
                    onChange={(e) => setTejRef(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1.5 block text-slate-600 dark:text-slate-300">{t("fin_status")}</span>
                  <select
                    className={inputClass}
                    value={tejStatus}
                    onChange={(e) => setTejStatus(e.target.value as typeof tejStatus)}
                  >
                    <option value="NOT_SUBMITTED">{t("fin_notSubmittedLabel")}</option>
                    <option value="PENDING">{t("fin_pendingValidation")}</option>
                    <option value="VALIDATED">{t("fin_validatedDGI")}</option>
                    <option value="REJECTED">{t("fin_rejectedDGI")}</option>
                  </select>
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setTejOpen(false)} className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200">
                  {t("fin_cancel")}
                </button>
                <button
                  onClick={saveTej}
                  disabled={tejSaving}
                  className="rounded-2xl border border-black bg-black px-4 py-2.5 text-sm font-medium text-white shadow-sm disabled:opacity-60"
                >
                  {tejSaving ? t("fin_saving") : t("fin_save")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {createOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-950 dark:text-white">{t("fin_createInvoiceTitle")}</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {t("fin_selectQuote")}
                  </p>
                </div>
                <button
                  onClick={() => setCreateOpen(false)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={16} />
                </button>
              </div>

              {acceptedDevis.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <FileText size={28} className="mb-2 text-slate-300 dark:text-slate-700" />
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    {t("fin_noAcceptedQuotes")}
                  </p>
                </div>
              ) : (
                <div className="max-h-72 space-y-2 overflow-y-auto">
                  {acceptedDevis.map((d) => (
                    <button
                      key={d._id}
                      onClick={() => setSelectedDevisId(d._id)}
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                        selectedDevisId === d._id
                          ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                          : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                      }`}
                    >
                      <p className={`text-sm font-semibold ${selectedDevisId === d._id ? "text-white dark:text-slate-950" : "text-slate-900 dark:text-white"}`}>
                        {d.devisNo}
                      </p>
                      <p className={`mt-0.5 text-xs ${selectedDevisId === d._id ? "text-slate-300 dark:text-slate-600" : "text-slate-500 dark:text-slate-400"}`}>
                        {d.salesOrderId?.orderNo || "—"} · {d.customerName} · {d.totalTtc.toLocaleString("fr-TN", { minimumFractionDigits: 3 })} {t("fin_tnd")}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setCreateOpen(false)}
                  className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  {t("fin_cancel")}
                </button>
                <button
                  onClick={handleCreateInvoice}
                  disabled={!selectedDevisId || creating}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-slate-950"
                >
                  {creating && <Loader2 size={13} className="animate-spin" />}
                  {t("fin_createInvoice")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
