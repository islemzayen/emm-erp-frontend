"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { stockInventoryService } from "@/services/stock/stockInventoryService";
import { purchaseReceiptService, type PurchaseReceipt } from "@/services/purchase/purchaseReceiptService";
import { stockMovementService } from "@/services/stock/stockMovementService";
import { useEffect, useState } from "react";
import {
  FileText, Loader2, ClipboardList, Truck,
  Download, FileSpreadsheet, Clock, Package, BarChart3, ArrowLeftRight,
} from "lucide-react";
import { exportToPdf, exportToCsv } from "@/lib/pdfExport";

interface Movement {
  _id: string;
  productId?: { _id: string; name: string; sku: string } | null;
  type: string;
  quantity: number;
  previousOnHand: number;
  newOnHand: number;
  depotId?: { _id: string; name: string } | null;
  sourceModule?: string;
  reason?: string;
  createdAt: string;
  createdBy?: { _id: string; name: string } | null;
}

interface InventorySession {
  _id: string;
  code: string;
  type: "PERIODIC" | "PERMANENT";
  status: "IN_PROGRESS" | "SENT_TO_DEPOT" | "PENDING_APPROVAL" | "CLOSED";
  depotId?: { _id: string; name: string } | null;
  startedBy?: { _id: string; name: string } | null;
  createdAt: string;
  closedAt?: string | null;
}

const fmt = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const monthLabel = () =>
  new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).toUpperCase();

interface ExportEntry { label: string; filename: string; at: string }

export default function DepotRapportsPage() {
  const [inventories, setInventories] = useState<InventorySession[]>([]);
  const [receipts, setReceipts]       = useState<PurchaseReceipt[]>([]);
  const [movements, setMovements]     = useState<Movement[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [exporting, setExporting]     = useState<string | null>(null);
  const [exportLog, setExportLog]     = useState<ExportEntry[]>([]);

  // Period for movement export — defaults to current month
  const firstOfMonth = (() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
  })();
  const today = new Date().toISOString().slice(0, 10);
  const [movFrom, setMovFrom] = useState(firstOfMonth);
  const [movTo, setMovTo]     = useState(today);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      stockInventoryService.getAll(),
      purchaseReceiptService.getMine(),
      stockMovementService.getAll(),
    ])
      .then(([inv, rec, mov]) => { setInventories(inv); setReceipts(rec); setMovements(mov); })
      .catch((e) => setError(e?.response?.data?.message || "Erreur de chargement"))
      .finally(() => setLoading(false));
  }, []);

  const filteredMovements = () => {
    const fromTs = new Date(movFrom + "T00:00:00").getTime();
    const toTs   = new Date(movTo   + "T23:59:59").getTime();
    return movements.filter((m) => {
      const t = new Date(m.createdAt).getTime();
      return t >= fromTs && t <= toTs;
    });
  };

  const formatMovementQty = (m: Movement) => {
    if (m.type === "ENTRY") return `+${m.quantity}`;
    if (m.type === "EXIT" || m.type === "DEDUCTION") return `-${m.quantity}`;
    return String(m.quantity);
  };

  const makeMovementsPdf = async () => {
    setExporting("mov-pdf");
    const rows = filteredMovements().map((m) => [
      new Date(m.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      m.productId?.sku ?? "—",
      m.productId?.name ?? "—",
      m.type,
      formatMovementQty(m),
      String(m.newOnHand),
      m.depotId?.name ?? m.sourceModule ?? "—",
      m.reason ?? "—",
    ]);
    const cols = ["Date", "Réf.", "Produit", "Type", "Qté", "Stock après", "Source", "Raison"];
    const filename = `mouvements-${movFrom}_${movTo}.pdf`;
    try {
      await exportToPdf(
        "Mouvements de stock",
        `Période : ${fmt(movFrom)} → ${fmt(movTo)}  ·  ${rows.length} mouvement(s)`,
        cols, rows, filename
      );
      logExport(`Mouvements ${movFrom} → ${movTo} — PDF`, filename);
    } finally { setExporting(null); }
  };

  const makeMovementsCsv = () => {
    const rows = filteredMovements().map((m) => [
      new Date(m.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      m.productId?.sku ?? "—",
      m.productId?.name ?? "—",
      m.type,
      formatMovementQty(m),
      String(m.newOnHand),
      m.depotId?.name ?? m.sourceModule ?? "—",
      m.reason ?? "—",
    ]);
    const cols = ["Date", "Réf.", "Produit", "Type", "Qté", "Stock après", "Source", "Raison"];
    const filename = `mouvements-${movFrom}_${movTo}.csv`;
    exportToCsv(cols, rows, filename);
    logExport(`Mouvements ${movFrom} → ${movTo} — CSV`, filename);
  };

  const logExport = (label: string, filename: string) => {
    setExportLog((prev) => [
      { label, filename, at: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) },
      ...prev,
    ]);
  };

  const makeInventairesPdf = async () => {
    setExporting("inv-pdf");
    const cols = ["Code", "Type", "Dépôt", "Statut", "Créé par", "Date création", "Clôturé le"];
    const rows = inventories.map((i) => [
      i.code, i.type, i.depotId?.name ?? "—",
      i.status.replace(/_/g, " "), i.startedBy?.name ?? "—",
      fmt(i.createdAt), fmt(i.closedAt),
    ]);
    const filename = `inventaires-depot-${new Date().toISOString().slice(0, 10)}.pdf`;
    try { await exportToPdf("Inventaires Dépôt", `${inventories.length} enregistrement(s)`, cols, rows, filename); logExport("Inventaires — PDF", filename); }
    finally { setExporting(null); }
  };
  const makeInventairesCsv = () => {
    const cols = ["Code", "Type", "Dépôt", "Statut", "Créé par", "Date création", "Clôturé le"];
    const rows = inventories.map((i) => [
      i.code, i.type, i.depotId?.name ?? "—",
      i.status.replace(/_/g, " "), i.startedBy?.name ?? "—",
      fmt(i.createdAt), fmt(i.closedAt),
    ]);
    const filename = `inventaires-depot-${new Date().toISOString().slice(0, 10)}.csv`;
    exportToCsv(cols, rows, filename); logExport("Inventaires — CSV", filename);
  };

  const makeReceptionsPdf = async () => {
    setExporting("rec-pdf");
    const cols = ["N° Bon", "Fournisseur", "N° Commande", "Dépôt", "Statut", "Lignes", "Date"];
    const rows = receipts.map((r) => [
      r.receiptNo, r.supplierId?.name ?? "—",
      r.purchaseOrderId?.orderNo ?? "—", r.depotId?.name ?? "—",
      r.receiptStatus.replace(/_/g, " "), r.lines?.length ?? 0, fmt(r.createdAt),
    ]);
    const filename = `receptions-depot-${new Date().toISOString().slice(0, 10)}.pdf`;
    try { await exportToPdf("Bons de Réception", `${receipts.length} enregistrement(s)`, cols, rows, filename); logExport("Réceptions — PDF", filename); }
    finally { setExporting(null); }
  };
  const makeReceptionsCsv = () => {
    const cols = ["N° Bon", "Fournisseur", "N° Commande", "Dépôt", "Statut", "Lignes", "Date"];
    const rows = receipts.map((r) => [
      r.receiptNo, r.supplierId?.name ?? "—",
      r.purchaseOrderId?.orderNo ?? "—", r.depotId?.name ?? "—",
      r.receiptStatus.replace(/_/g, " "), r.lines?.length ?? 0, fmt(r.createdAt),
    ]);
    const filename = `receptions-depot-${new Date().toISOString().slice(0, 10)}.csv`;
    exportToCsv(cols, rows, filename); logExport("Réceptions — CSV", filename);
  };

  const exportAllCsv = () => { makeInventairesCsv(); makeReceptionsCsv(); };

  const statCards = [
    {
      label: "GÉNÉRÉS", value: String(exportLog.length), sub: "Cette session",
      icon: <Download size={18} />,
      iconBg: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
    },
    {
      label: "INVENTAIRES", value: String(inventories.length), sub: "Tous statuts",
      icon: <ClipboardList size={18} />,
      iconBg: "bg-teal-100 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400",
    },
    {
      label: "BONS DE RÉCEPTION", value: String(receipts.length), sub: "Tous statuts",
      icon: <Truck size={18} />,
      iconBg: "bg-teal-100 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400",
    },
    {
      label: "MOUVEMENTS", value: String(movements.length), sub: "Total enregistré",
      icon: <ArrowLeftRight size={18} />,
      iconBg: "bg-teal-100 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400",
    },
  ];

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "DEPOT_MANAGER", "STOCK_MANAGER"]}>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              Dépôt <span className="text-teal-500">Reports</span>
            </h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              EMM ERP · DÉPÔT
            </p>
          </div>
          <button
            onClick={exportAllCsv}
            className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-5 py-2.5 text-sm font-semibold uppercase tracking-wider text-white transition hover:bg-teal-700"
          >
            <Download size={15} /> Export All CSV
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
            <Loader2 size={16} className="animate-spin" /> Chargement...
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {statCards.map((card, i) => (
                <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl ${card.iconBg}`}>
                    {card.icon}
                  </div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{card.label}</p>
                  <p className="mt-1 text-3xl font-bold text-slate-950 dark:text-white">{card.value}</p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Report cards + export log */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

              <div className="lg:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2 content-start">

                {/* Inventaires report card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
                      <ClipboardList size={20} />
                    </div>
                    <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[10px] font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">Tous statuts</span>
                  </div>
                  <h3 className="font-bold text-slate-950 dark:text-white">Rapport Inventaires</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Sessions d'inventaire avec dépôt, type, statut et responsable.</p>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{monthLabel()}</p>
                  <div className="mt-4 flex gap-2">
                    <button onClick={makeInventairesPdf} disabled={!!exporting}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-teal-700 disabled:opacity-50"
                    >
                      {exporting === "inv-pdf" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Export PDF
                    </button>
                    <button onClick={makeInventairesCsv} disabled={!!exporting}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Download size={12} /> Export CSV
                    </button>
                  </div>
                </div>

                {/* Bons de réception report card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
                      <Truck size={20} />
                    </div>
                    <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[10px] font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">Tous statuts</span>
                  </div>
                  <h3 className="font-bold text-slate-950 dark:text-white">Rapport Réceptions</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Bons de réception avec fournisseur, dépôt, lignes et statut qualité.</p>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{monthLabel()}</p>
                  <div className="mt-4 flex gap-2">
                    <button onClick={makeReceptionsPdf} disabled={!!exporting}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-teal-700 disabled:opacity-50"
                    >
                      {exporting === "rec-pdf" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Export PDF
                    </button>
                    <button onClick={makeReceptionsCsv} disabled={!!exporting}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Download size={12} /> Export CSV
                    </button>
                  </div>
                </div>

                {/* Movements export card (with period selection) */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:col-span-2">
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
                      <ArrowLeftRight size={20} />
                    </div>
                    <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[10px] font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                      {filteredMovements().length} dans la période
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-950 dark:text-white">Rapport Mouvements</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    Sélectionnez une période pour exporter les mouvements de stock du dépôt (entrées, sorties, ajustements...).
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Du
                      </label>
                      <input
                        type="date"
                        value={movFrom}
                        max={movTo}
                        onChange={(e) => setMovFrom(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Au
                      </label>
                      <input
                        type="date"
                        value={movTo}
                        min={movFrom}
                        max={today}
                        onChange={(e) => setMovTo(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button onClick={makeMovementsPdf} disabled={!!exporting || filteredMovements().length === 0}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-teal-700 disabled:opacity-50"
                    >
                      {exporting === "mov-pdf" ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Export PDF
                    </button>
                    <button onClick={makeMovementsCsv} disabled={!!exporting || filteredMovements().length === 0}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Download size={12} /> Export CSV
                    </button>
                  </div>
                </div>

                {/* Inventaires quick list */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:col-span-2">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      <BarChart3 size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-950 dark:text-white">Inventaires récents</h3>
                      <p className="text-[11px] text-slate-400">Aperçu des dernières sessions</p>
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-100 divide-y divide-slate-100 dark:border-slate-800 dark:divide-slate-800">
                    {inventories.length === 0 ? (
                      <p className="py-4 text-center text-xs text-slate-400">Aucun inventaire</p>
                    ) : inventories.slice(0, 10).map((inv) => (
                      <div key={inv._id} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                        <div>
                          <p className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{inv.code}</p>
                          <p className="text-[10px] text-slate-400">{inv.depotId?.name ?? "—"} · {inv.type} · {fmt(inv.createdAt)}</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          inv.status === "CLOSED" ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" :
                          inv.status === "PENDING_APPROVAL" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" :
                          inv.status === "SENT_TO_DEPOT" ? "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300" :
                          "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                        }`}>
                          {inv.status.replace(/_/g, " ")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Export log */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 h-fit">
                <p className="text-base font-bold text-slate-950 dark:text-white">Export Log</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">Cette session</p>
                <div className="mt-5">
                  {exportLog.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                        <FileSpreadsheet size={16} className="text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-400 dark:text-slate-500">No exports yet</p>
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-600">Files appear here after download</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {exportLog.map((entry, i) => (
                        <div key={i} className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950">
                          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-700">
                            <Download size={11} className="text-slate-500 dark:text-slate-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-300">{entry.label}</p>
                            <p className="truncate text-[10px] text-slate-400 dark:text-slate-500">{entry.filename}</p>
                          </div>
                          <div className="ml-auto flex shrink-0 items-center gap-1 text-[10px] text-slate-400">
                            <Clock size={9} /> {entry.at}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick stats */}
                <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <p className="mb-3 text-xs font-bold text-slate-700 dark:text-slate-300">Résumé</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950">
                      <div className="flex items-center gap-2">
                        <Package size={13} className="text-teal-500" />
                        <span className="text-xs text-slate-600 dark:text-slate-400">Réceptions complètes</span>
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {receipts.filter((r) => r.receiptStatus === "FULL").length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950">
                      <div className="flex items-center gap-2">
                        <ClipboardList size={13} className="text-teal-500" />
                        <span className="text-xs text-slate-600 dark:text-slate-400">Inventaires clôturés</span>
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {inventories.filter((i) => i.status === "CLOSED").length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
