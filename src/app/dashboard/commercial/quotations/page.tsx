"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { devisService, type Devis } from "@/services/commercial/devisService";
import { useEffect, useMemo, useRef, useState } from "react";
import { financeService, type CompanySettings } from "@/services/finance/financeService";
import { FileText, Loader2, Printer, Search } from "lucide-react";

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

function statusBadgeClass(status: Devis["status"]) {
  switch (status) {
    case "ACCEPTED": return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300";
    case "REJECTED":
    case "CANCELLED": return "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    case "SENT": return "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300";
    default: return "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300";
  }
}

function statusLabel(status: Devis["status"]) {
  switch (status) {
    case "PENDING": return "En attente";
    case "SENT": return "Envoyé";
    case "ACCEPTED": return "Accepté";
    case "REJECTED": return "Refusé";
    case "CANCELLED": return "Annulé";
    default: return status;
  }
}

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

const DEVIS_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente", SENT: "Envoyé", ACCEPTED: "Accepté",
  REJECTED: "Refusé", CANCELLED: "Annulé",
};

function openDevisDocument(devis: Devis, settings: CompanySettings | null) {
  const order = devis.salesOrderId;
  const tvaRate = devis.applyTva ? (devis.tvaRate ?? 19) : 0;
  const fodecRate = devis.applyFodec ? (devis.fodecRate ?? 1) : 0;
  const issueDate = new Date(devis.issueDate || Date.now()).toLocaleDateString("fr-TN");
  const dueDate = devis.dueDate ? new Date(devis.dueDate).toLocaleDateString("fr-TN") : "—";

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

  const totalRemise = devis.lines.reduce(
    (s, l) => s + (Number((l as any).discountAmount) || 0),
    0
  );
  const totalBrutHt = devis.lines.reduce(
    (s, l) => s + Number(l.baseUnitHt || 0) * Number(l.quantity || 0),
    0
  );

  const rows = devis.lines.map((line, idx) => {
    const brutHt = Number(line.baseUnitHt || 0) * Number(line.quantity || 0);
    const disc   = Number((line as any).discount || 0);
    return `
    <tr style="background:${idx % 2 === 0 ? "#fff" : "#f8fafc"}">
      <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:center;color:#64748b;font-size:12px">${idx + 1}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;font-size:11px;color:#64748b">${line.productId?.sku || "—"}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;font-size:13px">${line.productId?.name || "—"}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:center;font-size:13px">${line.quantity}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:right;font-size:13px">${line.baseUnitHt.toFixed(3)}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:center;font-size:12px;color:#64748b">${disc > 0 ? `${disc}%` : "—"}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:right;font-size:13px;font-weight:600">${line.subtotalHt.toFixed(3)}</td>
    </tr>`;
  }).join("");

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
            <td style="font-size:11px;font-weight:600;padding:2px 0;color:${statusColor}">${DEVIS_STATUS_LABELS[devis.status] || devis.status}</td>
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
        ${devis.customerAddress ? `<div style="font-size:11px;color:#64748b;margin-top:3px">Adresse : ${devis.customerAddress}</div>` : ""}
        ${(devis.customerMf || devis.customerId?.mf) ? `<div style="font-size:11px;color:#64748b;margin-top:1px">MF : ${devis.customerMf || devis.customerId?.mf}</div>` : ""}
      </td>
    </tr>
  </table>

  <!-- ═══ PRODUCT TABLE ═══ -->
  <table style="margin-bottom:0;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden">
    <thead>
      <tr style="background:#0f172a;color:#fff">
        <th style="padding:9px 10px;text-align:center;font-size:11px;width:32px">N°</th>
        <th style="padding:9px 10px;text-align:left;font-size:11px;width:70px">Réf.</th>
        <th style="padding:9px 10px;text-align:left;font-size:11px">Désignation</th>
        <th style="padding:9px 10px;text-align:center;font-size:11px;width:50px">Qté</th>
        <th style="padding:9px 10px;text-align:right;font-size:11px;width:100px">P.U. HT (TND)</th>
        <th style="padding:9px 10px;text-align:center;font-size:11px;width:60px">Remise</th>
        <th style="padding:9px 10px;text-align:right;font-size:11px;width:110px">Montant HT (TND)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <!-- ═══ BOTTOM ANCHOR ═══ -->
  <div style="margin-top:auto">

  <!-- ═══ TAX SUMMARY ═══ -->
  <div style="display:flex;justify-content:flex-end;margin-top:16px;margin-bottom:16px">
    <table style="width:280px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 6px 6px;overflow:hidden">
      <tr style="background:#f8fafc">
        <td style="padding:6px 12px;font-size:12px;color:#64748b">Total brut HT</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px;font-weight:600">${totalBrutHt.toFixed(3)} TND</td>
      </tr>
      ${totalRemise > 0 ? `<tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b">Remise</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px;color:#dc2626">- ${totalRemise.toFixed(3)} TND</td>
      </tr>` : ""}
      <tr style="background:#f8fafc">
        <td style="padding:6px 12px;font-size:12px;color:#0f172a;font-weight:600">Total Net HT</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px;font-weight:600">${devis.subtotalHt.toFixed(3)} TND</td>
      </tr>
      ${fodecRate > 0 ? `<tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b">FODEC (${fodecRate}%)</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px">${devis.totalFodec.toFixed(3)} TND</td>
      </tr>` : ""}
      ${tvaRate > 0 ? `<tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b">TVA (${tvaRate}%)</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px">${devis.totalVat.toFixed(3)} TND</td>
      </tr>` : ""}
      <tr style="background:#f8fafc">
        <td style="padding:6px 12px;font-size:12px;color:#64748b">Avant timbre</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px">${devis.totalBeforeStamp.toFixed(3)} TND</td>
      </tr>
      <tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b">Timbre fiscal</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px">${devis.timbreFiscal.toFixed(3)} TND</td>
      </tr>
      <tr style="background:#0f172a">
        <td style="padding:9px 12px;font-size:13px;font-weight:700;color:#fff">TOTAL TTC</td>
        <td style="padding:9px 12px;text-align:right;font-size:13px;font-weight:700;color:#fff">${devis.totalTtc.toFixed(3)} TND</td>
      </tr>
    </table>
  </div>

  <!-- ═══ MONTANT EN LETTRES ═══ -->
  <div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;margin-bottom:16px;background:#f8fafc">
    <span style="font-size:11px;color:#64748b">Arrêté le présent devis à la somme de : </span>
    <strong style="font-size:12px">${montantEnLettres(devis.totalTtc)}</strong>
  </div>

  <!-- ═══ FOOTER ═══ -->
  <div style="border-top:1px solid #e2e8f0;padding-top:12px;display:flex;justify-content:space-between;align-items:flex-start">
    <div style="font-size:10px;color:#64748b;max-width:55%">
      <strong style="color:#0f172a">Conditions de validité :</strong> Ce devis est valable jusqu'au ${dueDate}.<br/>
      Toute commande passée après cette date devra faire l'objet d'un nouveau devis.<br/>
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

export default function CommercialQuotationsPage() {
  const [documents, setDocuments] = useState<Devis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const settingsRef = useRef<CompanySettings | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        if (!settingsRef.current) {
          financeService.getSettings().then((s) => { settingsRef.current = s; }).catch(() => {});
        }
        setDocuments(await devisService.getAll());
      } catch (err: unknown) {
        setError(getErrorMessage(err, "Failed to load quotations"));
      } finally {
        setLoading(false);
      }
    };

    load();
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

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "COMMERCIAL_MANAGER"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            Devis
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Consultez les devis générés pour chaque commande commerciale.
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
            placeholder="Rechercher par numéro, client ou commande..."
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none dark:text-white"
          />
        </div>

        {loading ? (
          <div className={`${surface} flex items-center justify-center gap-2 py-16 text-sm text-slate-500 dark:text-slate-400`}>
            <Loader2 size={16} className="animate-spin" />
            Chargement des devis...
          </div>
        ) : (
          <div className={`${surface} overflow-hidden`}>
            {!filtered.length ? (
              <div className="flex flex-col items-center justify-center py-16">
                <FileText size={32} className="mb-3 text-slate-300 dark:text-slate-700" />
                <p className="text-sm text-slate-400 dark:text-slate-500">Aucun devis trouvé</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50">
                    <tr>
                      {["N° Devis", "Commande", "Client", "Statut", "Total TTC", "Actions"].map((label) => (
                        <th key={label} className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filtered.map((doc) => (
                      <tr key={doc._id}>
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{doc.devisNo}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{doc.salesOrderId?.orderNo || "-"}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{doc.customerName}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(doc.status)}`}>
                            {statusLabel(doc.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                          {doc.totalTtc.toLocaleString("fr-TN", { minimumFractionDigits: 3 })} TND
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => openDevisDocument(doc, settingsRef.current)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <Printer size={14} />
                            Imprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
