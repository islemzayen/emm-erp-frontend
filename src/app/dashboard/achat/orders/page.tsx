"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import {
  purchaseOrderService,
  PurchaseOrder,
} from "@/services/purchase/purchaseOrderService";
import { purchaseSettingService, PurchaseSettings } from "@/services/purchase/purchaseSettingService";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ShoppingCart,
  Search,
  Loader2,
  CheckCircle2,
  Send,
  PackageCheck,
  Archive,
  Printer,
  X,
  FileText,
  Clock,
  Plus,
  Hourglass,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

function getErr(err: unknown, fallback = "Une erreur est survenue"): string {
  if (err && typeof err === "object" && "response" in err) {
    const r = (err as { response: { data?: { message?: string } } }).response;
    if (typeof r.data?.message === "string") return r.data.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Brouillon",
  VALIDATED: "Validé",
  SENT: "Envoyé",
  RECEIVED: "Reçu",
  CLOSED: "Clôturé",
  CANCELLED: "Annulé",
};

const STATUS_CLS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  VALIDATED: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  SENT: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  RECEIVED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  CLOSED: "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
  CANCELLED: "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400",
};

function fmt(n: number) {
  return (n ?? 0).toLocaleString("fr-TN", { minimumFractionDigits: 3 });
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-TN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─── Print Document (BL-style layout) ────────────────────────────────────────

function PrintDocument({
  order,
}: {
  order: PurchaseOrder;
  settings: PurchaseSettings | null;
}) {
  const companyName    = "EMM TN";
  const companyAddress = "Route de Gabès Km 6, Sfax, Tunisie";
  const companyPhone   = "+(216) 98 241 790";
  const companyEmail   = "info@emmtn.com";
  const issueDate      = new Date(order.createdAt || Date.now()).toLocaleDateString("fr-TN");
  const r = (v: number) => Math.round((v + Number.EPSILON) * 1000) / 1000;

  const processedLines = order.lines.map((line) => {
    const qty       = Number(line.quantity || 0);
    const unitPrice = Number(line.unitPrice || 0);
    const disc      = Number(line.discountRate || 0);
    const brutHT    = r(qty * unitPrice);
    const remiseAmt = r(brutHT * disc / 100);
    const montantHT = r(brutHT - remiseAmt);
    return { line, qty, unitPrice, disc, brutHT, remiseAmt, montantHT };
  });

  const totalBrutHT = r(processedLines.reduce((s, l) => s + l.brutHT, 0));
  const totalRemise = r(processedLines.reduce((s, l) => s + l.remiseAmt, 0));
  const totalNetHT  = order.subtotalHt ?? r(totalBrutHT - totalRemise);
  const fodecRate   = order.fodecRate ?? 1;
  const tvaRate     = order.vatRate ?? 19;
  const totalFodec  = order.totalFodec ?? 0;
  const totalVat    = order.totalVat ?? 0;
  const timbre      = order.timbreFiscal ?? 1;
  const totalTTC    = order.totalTtc;

  const MIN_ROWS = 16;
  const emptyRowsCount = Math.max(0, MIN_ROWS - processedLines.length);

  const logoSrc = typeof window !== "undefined" ? `${window.location.origin}/EMMlogo.png` : "/EMMlogo.png";

  return (
    <div id="bc-print-area" style={{ fontFamily: "Arial, sans-serif", fontSize: 13, color: "#0f172a", background: "#fff", maxWidth: 794, margin: "0 auto", padding: "24px 28px", display: "flex", flexDirection: "column", minHeight: "261mm" }}>

      {/* HEADER */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
        <tbody>
          <tr>
            <td style={{ verticalAlign: "top", width: "55%" }}>
              <img src={logoSrc} alt={companyName} style={{ height: 60, maxWidth: 180, objectFit: "contain", display: "block", marginBottom: 8 }} />
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{companyAddress}</div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>Tél : {companyPhone} &nbsp;·&nbsp; {companyEmail}</div>
            </td>
            <td style={{ verticalAlign: "top", textAlign: "right", width: "45%" }}>
              <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-1px", color: "#0f172a" }}>BON DE COMMANDE</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#334155", marginTop: 2 }}>{order.orderNo}</div>
              <table style={{ marginTop: 10, marginLeft: "auto", width: "auto", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ fontSize: 11, color: "#64748b", padding: "2px 8px 2px 0", textAlign: "right" }}>Date :</td>
                    <td style={{ fontSize: 11, fontWeight: 600, padding: "2px 0" }}>{issueDate}</td>
                  </tr>
                  <tr>
                    <td style={{ fontSize: 11, color: "#64748b", padding: "2px 8px 2px 0", textAlign: "right" }}>Fournisseur :</td>
                    <td style={{ fontSize: 11, fontWeight: 600, padding: "2px 0" }}>{order.supplierId.name}</td>
                  </tr>
                  {order.tenderId && (
                    <tr>
                      <td style={{ fontSize: 11, color: "#64748b", padding: "2px 8px 2px 0", textAlign: "right" }}>AO :</td>
                      <td style={{ fontSize: 11, fontWeight: 600, padding: "2px 0" }}>{order.tenderId.tenderNo}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* EMETTEUR / FOURNISSEUR */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ width: "48%", verticalAlign: "top", border: "1px solid #e2e8f0", borderRadius: 6, padding: "10px 14px" }}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "#64748b", fontWeight: 600, marginBottom: 6 }}>Émetteur</div>
              <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                <img src={logoSrc} alt={companyName} style={{ height: 22, objectFit: "contain" }} />
                {companyName}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{companyAddress}</div>
            </td>
            <td style={{ width: "4%" }}></td>
            <td style={{ width: "48%", verticalAlign: "top", border: "1px solid #e2e8f0", borderRadius: 6, padding: "10px 14px" }}>
              <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "#64748b", fontWeight: 600, marginBottom: 6 }}>Fournisseur</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{order.supplierId.name}</div>
              {order.supplierId.supplierNo && <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>N° : {order.supplierId.supplierNo}</div>}
              {order.supplierId.paymentTerms && <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>Conditions : {order.supplierId.paymentTerms}</div>}
            </td>
          </tr>
        </tbody>
      </table>

      {/* PRODUCT TABLE */}
      <table style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden", borderCollapse: "collapse", marginBottom: 0 }}>
        <thead>
          <tr style={{ background: "#0f172a", color: "#fff" }}>
            <th style={{ padding: "9px 10px", textAlign: "left", fontSize: 11, width: 90, borderRight: "1px solid rgba(255,255,255,0.15)" }}>Référence</th>
            <th style={{ padding: "9px 10px", textAlign: "left", fontSize: 11, borderRight: "1px solid rgba(255,255,255,0.15)" }}>Désignation</th>
            <th style={{ padding: "9px 10px", textAlign: "center", fontSize: 11, width: 50, borderRight: "1px solid rgba(255,255,255,0.15)" }}>Qté</th>
            <th style={{ padding: "9px 10px", textAlign: "right", fontSize: 11, width: 90, borderRight: "1px solid rgba(255,255,255,0.15)" }}>Prix HT (TND)</th>
            <th style={{ padding: "9px 10px", textAlign: "center", fontSize: 11, width: 60, borderRight: "1px solid rgba(255,255,255,0.15)" }}>Remise</th>
            <th style={{ padding: "9px 10px", textAlign: "right", fontSize: 11, width: 100 }}>Montant HT (TND)</th>
          </tr>
        </thead>
        <tbody>
          {processedLines.map(({ line, qty, unitPrice, disc, montantHT }, idx) => (
            <tr key={line._id} style={{ background: idx % 2 === 0 ? "#fff" : "#f8fafc" }}>
              <td style={{ padding: "7px 10px", fontSize: 11, color: "#64748b", borderRight: "1px solid #e2e8f0" }}>{line.productId?.sku || "—"}</td>
              <td style={{ padding: "7px 10px", fontSize: 12, borderRight: "1px solid #e2e8f0" }}>{line.productId?.name || line.description || "—"}</td>
              <td style={{ padding: "7px 10px", textAlign: "center", fontSize: 12, fontWeight: 600, borderRight: "1px solid #e2e8f0" }}>{qty}</td>
              <td style={{ padding: "7px 10px", textAlign: "right", fontSize: 12, borderRight: "1px solid #e2e8f0" }}>{unitPrice.toFixed(3)}</td>
              <td style={{ padding: "7px 10px", textAlign: "center", fontSize: 12, color: "#64748b", borderRight: "1px solid #e2e8f0" }}>{disc > 0 ? `${disc}%` : "—"}</td>
              <td style={{ padding: "7px 10px", textAlign: "right", fontSize: 12, fontWeight: 600 }}>{montantHT.toFixed(3)}</td>
            </tr>
          ))}
          {Array.from({ length: emptyRowsCount }).map((_, idx) => (
            <tr key={`empty-${idx}`} style={{ height: 28, background: (processedLines.length + idx) % 2 === 0 ? "#fff" : "#f8fafc" }}>
              <td style={{ borderRight: "1px solid #e2e8f0" }}></td>
              <td style={{ borderRight: "1px solid #e2e8f0" }}></td>
              <td style={{ borderRight: "1px solid #e2e8f0" }}></td>
              <td style={{ borderRight: "1px solid #e2e8f0" }}></td>
              <td style={{ borderRight: "1px solid #e2e8f0" }}></td>
              <td></td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* BOTTOM ANCHOR */}
      <div style={{ marginTop: "auto" }}>

        {/* TOTALS */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, marginBottom: 16 }}>
          <table style={{ width: 260, border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden", borderCollapse: "collapse" }}>
            <tbody>
              <tr style={{ background: "#f8fafc" }}>
                <td style={{ padding: "6px 12px", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Total HT</td>
                <td style={{ padding: "6px 12px", textAlign: "right", fontSize: 12, fontWeight: 600, borderBottom: "1px solid #e2e8f0" }}>{totalBrutHT.toFixed(3)} TND</td>
              </tr>
              {totalRemise > 0 && (
                <tr>
                  <td style={{ padding: "6px 12px", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Remise</td>
                  <td style={{ padding: "6px 12px", textAlign: "right", fontSize: 12, borderBottom: "1px solid #e2e8f0" }}>- {totalRemise.toFixed(3)} TND</td>
                </tr>
              )}
              <tr style={{ background: "#f8fafc" }}>
                <td style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#0f172a", borderBottom: "1px solid #e2e8f0" }}>Total Net HT</td>
                <td style={{ padding: "6px 12px", textAlign: "right", fontSize: 12, fontWeight: 600, borderBottom: "1px solid #e2e8f0" }}>{(totalNetHT ?? 0).toFixed(3)} TND</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 12px", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>FODEC ({fodecRate}%)</td>
                <td style={{ padding: "6px 12px", textAlign: "right", fontSize: 12, borderBottom: "1px solid #e2e8f0" }}>{totalFodec.toFixed(3)} TND</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 12px", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>TVA ({tvaRate}%)</td>
                <td style={{ padding: "6px 12px", textAlign: "right", fontSize: 12, borderBottom: "1px solid #e2e8f0" }}>{totalVat.toFixed(3)} TND</td>
              </tr>
              <tr>
                <td style={{ padding: "6px 12px", fontSize: 12, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Timbre fiscal</td>
                <td style={{ padding: "6px 12px", textAlign: "right", fontSize: 12, borderBottom: "1px solid #e2e8f0" }}>{timbre.toFixed(3)} TND</td>
              </tr>
              <tr style={{ background: "#0f172a" }}>
                <td style={{ padding: "9px 12px", fontSize: 13, fontWeight: 700, color: "#fff" }}>TOTAL TTC</td>
                <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#fff" }}>{totalTTC.toFixed(3)} TND</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* SIGNATURE */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
          <div style={{ width: 260, textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748b", marginBottom: 8 }}>Signature</div>
            <div style={{ height: 52, border: "1px dashed #cbd5e1", borderRadius: 4 }}></div>
            <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 6 }}>Signature &amp; Cachet</div>
          </div>
        </div>

        {/* FOOTER */}
        <div style={{ marginTop: 20, borderTop: "1px solid #e2e8f0", paddingTop: 10, textAlign: "center", fontSize: 9, color: "#94a3b8" }}>
          {companyName} · {companyAddress} · {companyPhone} · {companyEmail}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [settings, setSettings] = useState<PurchaseSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [printOrder, setPrintOrder] = useState<PurchaseOrder | null>(null);


  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");
      const [ordersData, settingsData] = await Promise.all([
        purchaseOrderService.getAll(),
        purchaseSettingService.get(),
      ]);
      setOrders(ordersData);
      setSettings(settingsData);
    } catch (err) {
      setError(getErr(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      const matchStatus = statusFilter === "ALL" || o.status === statusFilter;
      const matchSearch =
        !q ||
        [o.orderNo, o.supplierId.name, o.supplierId.supplierNo,
          o.purchaseRequestId?.requestNo, o.tenderId?.tenderNo]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      return matchStatus && matchSearch;
    });
  }, [orders, search, statusFilter]);

  const stats = useMemo(() => ({
    total: orders.length,
    draft: orders.filter((o) => o.status === "DRAFT").length,
    validated: orders.filter((o) => o.status === "VALIDATED").length,
    sent: orders.filter((o) => o.status === "SENT").length,
    received: orders.filter((o) => o.status === "RECEIVED").length,
    closed: orders.filter((o) => o.status === "CLOSED").length,
    cancelled: orders.filter((o) => o.status === "CANCELLED").length,
  }), [orders]);

  const handleStatus = async (id: string, status: "VALIDATED" | "SENT" | "CLOSED") => {
    setActionLoading(id + status);
    try {
      await purchaseOrderService.updateStatus(id, status);
      await fetchAll();
    } catch (err) {
      setError(getErr(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (id: string) => {
    setActionLoading(id + "CANCELLED");
    try {
      await purchaseOrderService.cancel(id);
      await fetchAll();
    } catch (err) {
      setError(getErr(err));
    } finally {
      setActionLoading(null);
    }
  };


  const handlePrint = () => {
    const el = document.getElementById("bc-print-area");
    if (!el) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<html><head><title>${printOrder?.orderNo ?? "BC"}</title>` +
      `<style>body{font-family:sans-serif;margin:0;padding:0;color:#0f172a;}` +
      `@media print{body{-webkit-print-color-adjust:exact;}}</style></head>` +
      `<body>${el.innerHTML}</body></html>`
    );
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };

  const STATUS_FILTERS = ["ALL", "DRAFT", "VALIDATED", "SENT", "RECEIVED", "CLOSED", "CANCELLED"];

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "PURCHASE_MANAGER"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Achats · ERP
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <ShoppingCart size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  Bons de Commande
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Suivi des commandes fournisseurs · générés automatiquement depuis les AO
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center justify-between rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
            <button onClick={() => setError("")}><X size={14} /></button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 md:grid-cols-7">
          {[
            { label: "Total", value: stats.total, Icon: FileText, cls: "text-slate-600 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-800" },
            { label: "Brouillon", value: stats.draft, Icon: FileText, cls: "text-slate-500", bg: "bg-slate-50 dark:bg-slate-800/50" },
            { label: "Validés", value: stats.validated, Icon: CheckCircle2, cls: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30" },
            { label: "Envoyés", value: stats.sent, Icon: Send, cls: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" },
            { label: "Reçus", value: stats.received, Icon: PackageCheck, cls: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
            { label: "Clôturés", value: stats.closed, Icon: Archive, cls: "text-slate-400", bg: "bg-slate-100 dark:bg-slate-800" },
            { label: "Annulés", value: stats.cancelled, Icon: X, cls: "text-rose-500 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/30" },
          ].map(({ label, value, Icon, cls, bg }) => (
            <div key={label} className={`${surface} flex items-center gap-3 px-4 py-4`}>
              <div className={`rounded-xl p-2 ${bg}`}>
                <Icon size={14} className={cls} />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</p>
                <p className="text-xl font-bold text-slate-950 dark:text-white">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className={`${surface} overflow-hidden`}>
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 md:flex-row md:items-center dark:border-slate-800">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Liste des BCs</h2>
              <p className="mt-0.5 text-sm text-slate-500">{filtered.length} bon(s)</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                    statusFilter === s
                      ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {s === "ALL" ? "Tous" : STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher BC, fournisseur..."
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Chargement...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <ShoppingCart size={20} className="text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">Aucun bon de commande</p>
              <p className="mt-1 text-xs text-slate-400">
                Les BCs sont générés automatiquement après adjudication d&apos;un AO
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    <th className="px-6 py-3 font-medium">N° BC</th>
                    <th className="px-6 py-3 font-medium">Référence</th>
                    <th className="px-6 py-3 font-medium">Fournisseur</th>
                    <th className="px-6 py-3 font-medium">Produit</th>
                    <th className="px-6 py-3 font-medium text-right">Montant TTC</th>
                    <th className="px-6 py-3 font-medium">Statut</th>
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((order) => {
                    const line = order.lines[0];
                    const busy = (s: string) => actionLoading === order._id + s;
                    return (
                      <tr key={order._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20">
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs font-bold text-slate-950 dark:text-white">
                            {order.orderNo}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {order.tenderId
                            ? `AO · ${order.tenderId.tenderNo}`
                            : order.purchaseRequestId
                            ? `DA · ${order.purchaseRequestId.requestNo}`
                            : "—"}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-900 dark:text-white">{order.supplierId.name}</p>
                          <p className="text-xs text-slate-400">{order.supplierId.supplierNo}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                          {line ? (
                            <>
                              {line.productId?.name ?? line.description ?? "—"}
                              <span className="ml-1 text-xs text-slate-400">× {line.quantity}</span>
                            </>
                          ) : "—"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="font-bold text-slate-950 dark:text-white">{fmt(order.totalTtc)}</span>
                          <span className="ml-1 text-xs text-slate-400">TND</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_CLS[order.status] ?? ""}`}>
                            {STATUS_LABEL[order.status] ?? order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">{fmtDate(order.createdAt)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setPrintOrder(order)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Voir / Imprimer"
                            >
                              <Printer size={14} />
                            </button>

                            {order.status === "DRAFT" && (
                              <>
                                <button
                                  onClick={() => handleStatus(order._id, "VALIDATED")}
                                  disabled={!!actionLoading}
                                  className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-blue-500 disabled:opacity-60"
                                >
                                  {busy("VALIDATED") ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                                  Valider
                                </button>
                                <button
                                  onClick={() => handleCancel(order._id)}
                                  disabled={!!actionLoading}
                                  className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-60 dark:border-rose-800 dark:bg-rose-950/20 dark:text-rose-400"
                                >
                                  {busy("CANCELLED") ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />}
                                  Annuler
                                </button>
                              </>
                            )}

                            {order.status === "VALIDATED" && (
                              <button
                                onClick={() => handleStatus(order._id, "SENT")}
                                disabled={!!actionLoading}
                                className="inline-flex items-center gap-1 rounded-xl bg-amber-500 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-amber-400 disabled:opacity-60"
                              >
                                {busy("SENT") ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                                Envoyer
                              </button>
                            )}

                            {order.status === "SENT" && (
                              <span className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                                <Hourglass size={10} />
                                En attente de réception
                              </span>
                            )}

                            {order.status === "RECEIVED" && (
                              <button
                                onClick={() => handleStatus(order._id, "CLOSED")}
                                disabled={!!actionLoading}
                                className="inline-flex items-center gap-1 rounded-xl bg-slate-700 px-2.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-slate-600 disabled:opacity-60"
                              >
                                {busy("CLOSED") ? <Loader2 size={10} className="animate-spin" /> : <Archive size={10} />}
                                Clôturer
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>


      {/* ── Print Modal ───────────────────────────────────────────────────────── */}
      {printOrder && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="my-4 w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div className="flex items-center gap-2">
                <FileText size={15} className="text-slate-500" />
                <span className="font-semibold text-slate-950">{printOrder.orderNo}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_CLS[printOrder.status]}`}>
                  {STATUS_LABEL[printOrder.status]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  <Printer size={13} />
                  Imprimer / PDF
                </button>
                <button
                  onClick={() => setPrintOrder(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-slate-100"
                >
                  <X size={15} />
                </button>
              </div>
            </div>
            <PrintDocument order={printOrder} settings={settings} />
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
