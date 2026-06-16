"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { salesOrderService, type SalesOrder } from "@/services/commercial/salesOrderService";
import { stockDepotService } from "@/services/stock/stockDepotService";
import { financeService, type CompanySettings } from "@/services/finance/financeService";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Loader2,
  Package,
  Printer,
  Search,
  XCircle,
} from "lucide-react";

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

function openPreparationDocument(order: SalesOrder, settings: CompanySettings | null) {
  const customer = typeof order.customerId === "object" && order.customerId !== null ? order.customerId : null;
  const customerMf = customer?.mf || "";
  const customerAddress = customer?.address || "";

  const s = settings;
  const companyName    = s?.companyName || "EMM TN";
  const companyAddress = s?.address    || "Route de Gabès Km 6, Sfax, Tunisie";
  const companyPhone   = s?.phone      || "+(216) 98 241 790";
  const companyEmail   = s?.email      || "info@emmtn.com";
  const companyMf      = s?.mf        || "";
  const companyRne     = s?.rne       || "";
  const companyRib     = s?.rib       || "";
  const companyIban    = s?.iban      || "";
  const companyBank    = s?.bank      || "";
  const companyAgence  = s?.agence    || "";

  const issueDate = new Date().toLocaleDateString("fr-TN");
  const promisedDate = order.promisedDate
    ? new Date(order.promisedDate).toLocaleDateString("fr-TN")
    : "—";

  // Compute totals from lines
  const VAT_RATE = 0.19;
  const FODEC_RATE = 0.01;
  const TIMBRE = 1;

  const subtotalHt = order.lines.reduce((sum, l) => {
    const qty = l.allocatedQuantity ?? l.quantity;
    const lineHt = qty * (l.unitPrice || 0) * (1 - ((l.discount || 0) / 100));
    return sum + lineHt;
  }, 0);
  const totalFodec   = subtotalHt * FODEC_RATE;
  const totalVat     = (subtotalHt + totalFodec) * VAT_RATE;
  const totalBeforeStamp = subtotalHt + totalFodec + totalVat;
  const totalTtc     = totalBeforeStamp + TIMBRE;

  const rows = order.lines.map((line, idx) => {
    const qty = line.allocatedQuantity ?? line.quantity;
    const lineHt = qty * (line.unitPrice || 0) * (1 - ((line.discount || 0) / 100));
    return `
    <tr style="background:${idx % 2 === 0 ? "#fff" : "#f8fafc"}">
      <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:center;color:#64748b;font-size:12px">${idx + 1}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;font-size:11px;color:#64748b">${line.productId?.sku || "—"}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;font-size:13px">${line.productId?.name || "—"}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:center;font-size:13px">${qty}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:right;font-size:13px">${(line.unitPrice || 0).toFixed(3)}</td>
      <td style="border:1px solid #e2e8f0;padding:7px 10px;text-align:right;font-size:13px;font-weight:600">${lineHt.toFixed(3)}</td>
    </tr>`;
  }).join("");

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>Bon de préparation ${order.orderNo}</title>
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
        <img src="${window.location.origin}/logo.png" alt="${companyName}" style="height:60px;max-width:180px;object-fit:contain;display:block;margin-bottom:8px"/>
        <div style="font-size:11px;color:#64748b;margin-top:3px">${companyAddress}</div>
        <div style="font-size:11px;color:#64748b;margin-top:1px">Tél : ${companyPhone} &nbsp;·&nbsp; ${companyEmail}</div>
        ${companyMf || companyRne ? `<div style="font-size:11px;color:#64748b;margin-top:4px">${companyMf ? `<strong>MF :</strong> ${companyMf}` : ""}${companyMf && companyRne ? " &nbsp;|&nbsp; " : ""}${companyRne ? `<strong>RNE :</strong> ${companyRne}` : ""}</div>` : ""}
        ${companyRib ? `<div style="font-size:11px;color:#64748b;margin-top:1px"><strong>RIB :</strong> ${companyRib}${companyBank ? ` &nbsp;(${companyBank}${companyAgence ? " — " + companyAgence : ""})` : ""}</div>` : ""}
      </td>
      <td style="vertical-align:top;text-align:right;width:45%">
        <div style="font-size:26px;font-weight:700;letter-spacing:-1px;color:#0f172a">BON DE PRÉPARATION</div>
        <div style="font-size:15px;font-weight:600;color:#334155;margin-top:2px">${order.orderNo}</div>
        <table style="margin-top:10px;margin-left:auto;width:auto">
          <tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Date :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0">${issueDate}</td>
          </tr>
          <tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Date promise :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0">${promisedDate}</td>
          </tr>
          <tr>
            <td style="font-size:11px;color:#64748b;padding:2px 8px 2px 0;text-align:right">Statut :</td>
            <td style="font-size:11px;font-weight:600;padding:2px 0">${order.status}</td>
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
          <img src="${window.location.origin}/logo.png" alt="${companyName}" style="height:22px;object-fit:contain"/>
          ${companyName}
        </div>
        <div style="font-size:11px;color:#64748b;margin-top:3px">${companyAddress}</div>
        ${companyMf ? `<div style="font-size:11px;color:#64748b;margin-top:1px">MF : ${companyMf}</div>` : ""}
      </td>
      <td style="width:4%"></td>
      <td style="width:48%;vertical-align:top;border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px">
        <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;font-weight:600;margin-bottom:6px">Client / Destinataire</div>
        <div style="font-size:13px;font-weight:700">${order.customerName}</div>
        ${customerAddress ? `<div style="font-size:11px;color:#64748b;margin-top:3px">Adresse : ${customerAddress}</div>` : ""}
        ${customerMf ? `<div style="font-size:11px;color:#64748b;margin-top:1px">MF : ${customerMf}</div>` : ""}
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
        <th style="padding:9px 10px;text-align:right;font-size:11px;width:110px">P.U. HT (TND)</th>
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
        <td style="padding:6px 12px;text-align:right;font-size:12px;font-weight:600">${subtotalHt.toFixed(3)} TND</td>
      </tr>
      <tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b">FODEC (1%)</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px">${totalFodec.toFixed(3)} TND</td>
      </tr>
      <tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b">TVA (19%)</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px">${totalVat.toFixed(3)} TND</td>
      </tr>
      <tr style="background:#f8fafc">
        <td style="padding:6px 12px;font-size:12px;color:#64748b">Avant timbre</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px">${totalBeforeStamp.toFixed(3)} TND</td>
      </tr>
      <tr>
        <td style="padding:6px 12px;font-size:12px;color:#64748b">Timbre fiscal</td>
        <td style="padding:6px 12px;text-align:right;font-size:12px">${TIMBRE.toFixed(3)} TND</td>
      </tr>
      <tr style="background:#0f172a">
        <td style="padding:9px 12px;font-size:13px;font-weight:700;color:#fff">TOTAL TTC</td>
        <td style="padding:9px 12px;text-align:right;font-size:13px;font-weight:700;color:#fff">${totalTtc.toFixed(3)} TND</td>
      </tr>
    </table>
  </div>

  <!-- ═══ MONTANT EN LETTRES ═══ -->
  <div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;margin-bottom:16px;background:#f8fafc">
    <span style="font-size:11px;color:#64748b">Arrêté le présent bon à la somme de : </span>
    <strong style="font-size:12px">${montantEnLettres(totalTtc)}</strong>
  </div>

  <!-- ═══ FOOTER ═══ -->
  <div style="border-top:1px solid #e2e8f0;padding-top:12px;display:flex;justify-content:space-between;align-items:flex-start">
    <div style="font-size:10px;color:#64748b;max-width:55%">
      <strong style="color:#0f172a">Signatures</strong><br/>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:10px">
        <div style="border-top:1px solid #334155;padding-top:6px">Préparé par</div>
        <div style="border-top:1px solid #334155;padding-top:6px">Validé par</div>
      </div>
    </div>
    <div style="font-size:10px;color:#64748b;text-align:right">
      <strong style="color:#0f172a">Coordonnées bancaires</strong><br/>
      ${companyRib  ? `RIB : ${companyRib}<br/>`  : ""}
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

export default function DepotPreparationPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [depotId, setDepotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const settingsRef = useRef<CompanySettings | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError("");
      const [data, depots, companySettings] = await Promise.all([
        salesOrderService.getAll(),
        stockDepotService.getAll(),
        financeService.getSettings().catch(() => null),
      ]);
      settingsRef.current = companySettings;
      setDepotId(depots.find((depot) => depot.managerId?._id === user?.id)?._id || null);
      setOrders(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load depot preparation orders"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user?.id]);

  const handlePrepare = async (id: string) => {
    try {
      setActionId(id);
      setError("");
      const preparedOrder = await salesOrderService.prepare(id);
      await salesOrderService.markPickingSlipPrinted(id);
      openPreparationDocument(preparedOrder, settingsRef.current);
      await fetchOrders();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to mark order as prepared"));
    } finally {
      setActionId(null);
    }
  };

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

  const handlePrintPreparation = async (order: SalesOrder) => {
    try {
      setActionId(order._id);
      setError("");
      if (!order.pickingSlipPrintedAt) {
        await salesOrderService.markPickingSlipPrinted(order._id);
      }
      openPreparationDocument(order, settingsRef.current);
      await fetchOrders();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to print preparation document"));
    } finally {
      setActionId(null);
    }
  };

  const depotOrders = useMemo(() => {
    if (!depotId) return [];
    return orders
      .filter((order) => ["ORDONNANCED", "PREPARED"].includes(order.status))
      .map((order) => ({
        ...order,
        lines: order.lines.filter((line) => line.depotId?._id === depotId),
      }))
      .filter((order) => order.lines.length > 0);
  }, [depotId, orders]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return depotOrders.filter(
      (order) =>
        order.orderNo.toLowerCase().includes(q) ||
        order.customerName.toLowerCase().includes(q)
    );
  }, [depotOrders, search]);

  const totalUnits = useMemo(
    () =>
      filtered.reduce(
        (sum, order) => sum + order.lines.reduce((lineSum, line) => lineSum + line.quantity, 0),
        0
      ),
    [filtered]
  );

  return (
    <ProtectedRoute allowedRoles={["DEPOT_MANAGER"]}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Depot · ERP
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <Package size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  Preparation Orders
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Prepare your depot quantities, then print and validate picking from the same page.
                </p>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="flex items-start justify-between rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
            <button onClick={() => setError("")} className="ml-4 shrink-0 hover:opacity-70">
              <XCircle size={14} />
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            {
              label: "Waiting Preparation",
              value: depotOrders.filter((order) =>
                order.lines.some((line) => !line.depotPreparedAt)
              ).length,
              color: "text-blue-700 dark:text-blue-400",
            },
            {
              label: "Ready To Validate",
              value: depotOrders.filter(
                (order) =>
                  order.status === "PREPARED" &&
                  !order.packingValidatedAt &&
                  !!order.pickingSlipPrintedAt
              ).length,
              color: "text-amber-700 dark:text-amber-400",
            },
            {
              label: "Units In Depot",
              value: totalUnits,
              color: "text-violet-700 dark:text-violet-400",
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
              Depot orders
              <span className="ml-2 text-sm font-normal text-slate-400">{filtered.length}</span>
            </h2>

            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search depot orders"
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
              <ClipboardCheck size={32} className="opacity-30" />
              {depotOrders.length === 0 ? "No orders assigned to your depot." : "No matching orders."}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((order) => {
                const isExpanded = expandedId === order._id;
                const busy = actionId === order._id;
                const depotLinesPending = order.lines.some((line) => !line.depotPreparedAt);
                const canValidatePicking =
                  order.status === "PREPARED" &&
                  !order.packingValidatedAt &&
                  !!order.pickingSlipPrintedAt;

                return (
                  <div key={order._id}>
                    <div className="flex flex-wrap items-center gap-4 px-6 py-4">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : order._id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                      >
                        <ChevronDown size={14} className={`transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {order.orderNo}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                              order.status === "PREPARED"
                                ? "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                                : "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                            }`}
                          >
                            {order.status}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                          {order.customerName}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {order.lines.reduce((sum, line) => sum + line.quantity, 0)} units
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {depotLinesPending ? (
                          <button
                            onClick={() => handlePrepare(order._id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-950 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950"
                          >
                            {busy ? <Loader2 size={11} className="animate-spin" /> : <Package size={11} />}
                            Mark prepared
                          </button>
                        ) : order.packingValidatedAt ? (
                          <span className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                            <CheckCircle2 size={11} />
                            Picking validated
                          </span>
                        ) : canValidatePicking ? (
                          <>
                            <button
                              onClick={() => handlePrintPreparation(order)}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              {busy ? <Loader2 size={11} className="animate-spin" /> : <Printer size={11} />}
                              Print preparation
                            </button>
                            <button
                              onClick={() => handleValidatePicking(order._id)}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-600 disabled:opacity-50"
                            >
                              {busy ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                              Validate picking
                            </button>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">
                            <Package size={11} />
                            Waiting other depots
                          </span>
                        )}
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800">
                              {["Product", t("quantity"), "Status"].map((header) => (
                                <th
                                  key={header}
                                  className="pb-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400"
                                >
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {order.lines.map((line, index) => (
                              <tr key={index}>
                                <td className="py-2.5 font-medium text-slate-900 dark:text-white">
                                  {line.productId?.name || "—"}
                                </td>
                                <td className="py-2.5 text-slate-600 dark:text-slate-300">
                                  {line.quantity}
                                </td>
                                <td className="py-2.5 text-slate-600 dark:text-slate-300">
                                  {line.depotPreparedAt ? "Prepared" : "Pending"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}