"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { devisService, type Devis } from "@/services/commercial/devisService";
import { useEffect, useMemo, useRef, useState } from "react";
import { financeService, type CompanySettings } from "@/services/finance/financeService";
import { useLanguage } from "@/context/LanguageContext";
import { CheckCircle2, ChevronDown, FileText, Loader2, Printer, Search, Trash2 } from "lucide-react";

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

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

function openQuotationDocument(devis: Devis, settings: CompanySettings | null, statusLabels: Record<string, string>) {
  const order = devis.salesOrderId;
  const tvaRate = devis.applyTva ? (devis.tvaRate ?? 19) : 0;
  const fodecRate = devis.applyFodec ? (devis.fodecRate ?? 1) : 0;
  const issueDate = new Date(devis.issueDate || Date.now()).toLocaleDateString("fr-TN");
  const dueDate = devis.dueDate ? new Date(devis.dueDate).toLocaleDateString("fr-TN") : "—";
  const r = (v: number) => Math.round((v + Number.EPSILON) * 1000) / 1000;

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

  const statusColor = devis.status === "ACCEPTED" ? "#16a34a"
    : devis.status === "REJECTED" || devis.status === "CANCELLED" ? "#94a3b8"
    : "#0f172a";

  // Process lines: compute brut, remise amount, and montant net per line
  const processedLines = devis.lines.map((line) => {
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
  const totalNetHT  = devis.subtotalHt ?? r(totalBrutHT - totalRemise);
  const timbre      = devis.timbreFiscal ?? 1;

  // Padded rows so the table always fills to a min height (BL style)
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

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>Devis ${devis.devisNo}</title>
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
        <img src="${window.location.origin}/EMMlogo.png" alt="${companyName}" style="height:60px;max-width:180px;object-fit:contain;display:block;margin-bottom:8px"/>
        <div style="font-size:11px;color:#64748b;margin-top:3px">${companyAddress}</div>
        <div style="font-size:11px;color:#64748b;margin-top:1px">Tél : ${companyPhone} &nbsp;·&nbsp; ${companyEmail}</div>
        ${companyMf || companyRne ? `<div style="font-size:11px;color:#64748b;margin-top:4px">${companyMf ? `<strong>MF :</strong> ${companyMf}` : ""}${companyMf && companyRne ? " &nbsp;|&nbsp; " : ""}${companyRne ? `<strong>RNE :</strong> ${companyRne}` : ""}</div>` : ""}
        ${companyRib ? `<div style="font-size:11px;color:#64748b;margin-top:1px"><strong>RIB :</strong> ${companyRib}${companyBank ? ` &nbsp;(${companyBank}${companyAgence ? " — " + companyAgence : ""})` : ""}</div>` : ""}
      </td>
      <td style="vertical-align:top;text-align:right;width:45%">
        <div style="font-size:26px;font-weight:700;letter-spacing:-1px;color:#0f172a">DEVIS</div>
        <div style="font-size:15px;font-weight:600;color:#334155;margin-top:2px">${devis.devisNo}</div>
        <table style="margin-top:10px;margin-left:auto;width:auto">
          <tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Date :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0">${issueDate}</td>
          </tr>
          <tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Validité :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0">${dueDate}</td>
          </tr>
          <tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Statut :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0;color:${statusColor}">${statusLabels[devis.status] || devis.status}</td>
          </tr>
          <tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Commande :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0">${order?.orderNo || "—"}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- ═══ ÉMETTEUR / CLIENT ═══ -->
  <table style="margin-bottom:16px">
    <tr>
      <td style="width:48%;vertical-align:top;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;font-weight:600;margin-bottom:6px">Émetteur</div>
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
        <div style="font-size:13px;font-weight:700">${devis.customerName}</div>
        ${devis.customerMf ? `<div style="font-size:11px;color:#64748b;margin-top:3px">MF : ${devis.customerMf}</div>` : ""}
        ${devis.customerAddress ? `<div style="font-size:11px;color:#64748b;margin-top:1px">Adresse : ${devis.customerAddress}</div>` : ""}
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
        <td style="padding:6px 12px;text-align:right;font-size:12px;border-bottom:1px solid #e2e8f0">${devis.totalFodec.toFixed(3)} TND</td>
      </tr>` : ""}
      ${tvaRate > 0 ? `<tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0">TVA (${tvaRate}%)</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px;border-bottom:1px solid #e2e8f0">${devis.totalVat.toFixed(3)} TND</td>
      </tr>` : ""}
      <tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b;border-bottom:1px solid #e2e8f0">Timbre fiscal</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px;border-bottom:1px solid #e2e8f0">${timbre.toFixed(3)} TND</td>
      </tr>
      <tr style="background:#0f172a">
        <td style="padding:9px 12px;font-size:13px;font-weight:700;color:#fff">TOTAL TTC</td>
        <td style="padding:9px 12px;text-align:right;font-size:13px;font-weight:700;color:#fff">${devis.totalTtc.toFixed(3)} TND</td>
      </tr>
    </table>
  </div>

  <!-- MONTANT EN LETTRES -->
  <div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;margin-bottom:12px;background:#f8fafc">
    <span style="font-size:11px;color:#64748b">Arrêté le présent devis à la somme de : </span>
    <strong style="font-size:12px">${montantEnLettres(devis.totalTtc)}</strong>
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

export default function FinanceQuotationsPage() {
  const { t } = useLanguage();

  function statusBadge(status: Devis["status"]) {
    switch (status) {
      case "PENDING":
        return { label: t("fin_quotPending"), cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" };
      case "SENT":
        return { label: t("fin_quotSent"), cls: "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300" };
      case "ACCEPTED":
        return { label: t("fin_quotAccepted"), cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" };
      case "REJECTED":
        return { label: t("fin_quotRefused"), cls: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300" };
      case "CANCELLED":
        return { label: t("fin_quotCancelled"), cls: "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400" };
      default:
        return { label: status, cls: "bg-slate-100 text-slate-600" };
    }
  }

  const statusLabels: Record<string, string> = {
    PENDING: t("fin_quotPending"),
    SENT: t("fin_quotSent"),
    ACCEPTED: t("fin_quotAccepted"),
    REJECTED: t("fin_quotRefused"),
    CANCELLED: t("fin_quotCancelled"),
  };

  const [documents, setDocuments] = useState<Devis[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const settingsRef = useRef<CompanySettings | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      if (!settingsRef.current) {
        financeService.getSettings().then((s) => { settingsRef.current = s; }).catch(() => {});
      }
      const all = await devisService.getAll();
      setDocuments(all);
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("fin_loadQuotesFailed")));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return documents.filter((doc) =>
      [doc.devisNo, doc.customerName, doc.salesOrderId?.orderNo || "", doc.status]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [documents, search]);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    try {
      setActionId(id);
      setError("");
      await fn();
      await load();
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("fin_actionFailed")));
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id: string) => {
    await act(id, () => devisService.deleteById(id));
    setDeleteConfirmId(null);
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "FINANCE_MANAGER"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            {t("fin_quotTitle")}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t("fin_quotSubtitle")}
          </p>
        </div>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        ) : null}

        <div className={`${surface} flex items-center gap-3 px-5 py-3.5`}>
          <Search size={15} className="shrink-0 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("fin_quotSearch")}
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none dark:text-white"
          />
        </div>

        {loading ? (
          <div className={`${surface} flex items-center justify-center gap-2 py-16 text-sm text-slate-500 dark:text-slate-400`}>
            <Loader2 size={16} className="animate-spin" />
            {t("fin_loadingQuotes")}
          </div>
        ) : (
          <div className={`${surface}`}>
            {!filtered.length ? (
              <div className="flex flex-col items-center justify-center py-16">
                <FileText size={32} className="mb-3 text-slate-300 dark:text-slate-700" />
                <p className="text-sm text-slate-400 dark:text-slate-500">{t("fin_noQuotes")}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((doc) => {
                  const badge = statusBadge(doc.status);
                  const busy = actionId === doc._id;
                  const canAccept = ["PENDING", "SENT"].includes(doc.status);

                  return (
                    <div
                      key={doc._id}
                      className="grid w-full gap-3 px-6 py-4 md:grid-cols-[1.1fr_1fr_0.7fr_auto]"
                    >
                      {/* Identity */}
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{doc.devisNo}</p>
                        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                          {doc.salesOrderId?.orderNo || "-"} · {doc.customerName}
                        </p>
                      </div>

                      {/* Amounts */}
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        <p>
                          {t("fin_totalTtcLabel")}{" "}
                          <span className="font-medium text-slate-900 dark:text-white">
                            {doc.totalTtc.toLocaleString("fr-TN", { minimumFractionDigits: 3 })} {t("fin_tnd")}
                          </span>
                        </p>
                        <p>
                          {t("fin_orderLabel")}{" "}
                          <span className="font-medium text-slate-900 dark:text-white">
                            {doc.salesOrderId?.status || "-"}
                          </span>
                        </p>
                      </div>

                      {/* Status badge */}
                      <div className="flex items-center">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>

                      {/* Actions dropdown */}
                      <div className="relative flex items-center justify-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === doc._id ? null : doc._id); }}
                          disabled={busy}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                        >
                          {busy ? <Loader2 size={13} className="animate-spin" /> : null}
                          {t("fin_actions")}
                          <ChevronDown size={13} className={`transition-transform ${openMenuId === doc._id ? "rotate-180" : ""}`} />
                        </button>

                        {openMenuId === doc._id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                            <div
                              className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
                            >
                              <button
                                onClick={() => { setOpenMenuId(null); openQuotationDocument(doc, settingsRef.current, statusLabels); }}
                                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                <Printer size={14} className="text-slate-400" />
                                {t("fin_print")}
                              </button>

                              <button
                                onClick={() => { setOpenMenuId(null); act(doc._id, () => devisService.accept(doc._id)); }}
                                disabled={!canAccept}
                                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm transition hover:bg-slate-50 disabled:cursor-default disabled:opacity-50 dark:hover:bg-slate-800"
                              >
                                <CheckCircle2 size={14} className={canAccept ? "text-emerald-500" : "text-slate-300"} />
                                <span className={canAccept ? "text-slate-700 dark:text-slate-200" : "text-slate-400"}>
                                  {t("fin_accept")}
                                </span>
                              </button>

                              <div className="mx-3 border-t border-slate-100 dark:border-slate-800" />

                              <button
                                onClick={() => { setOpenMenuId(null); setDeleteConfirmId(doc._id); }}
                                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/20"
                              >
                                <Trash2 size={14} />
                                {t("fin_delete")}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {deleteConfirmId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-semibold text-slate-950 dark:text-white">{t("fin_deleteConfirm")}</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {t("fin_deleteWarning")}
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
              >
                {t("fin_cancel")}
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={actionId === deleteConfirmId}
                className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {actionId === deleteConfirmId && <Loader2 size={13} className="animate-spin" />}
                {t("fin_delete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ProtectedRoute>
  );
}
