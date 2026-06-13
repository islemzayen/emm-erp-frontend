"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { stockInventoryService } from "@/services/stock/stockInventoryService";
import { purchaseReceiptService, type PurchaseReceipt } from "@/services/purchase/purchaseReceiptService";
import { purchaseInvoiceService, type PurchaseInvoice } from "@/services/purchase/purchaseInvoiceService";
import { useEffect, useState } from "react";
import {
  ClipboardList, Loader2, Truck, Receipt,
  Download, DollarSign, FileSpreadsheet, Clock, FileText,
} from "lucide-react";
import { financeService, type CompanySettings } from "@/services/finance/financeService";
import { exportToPdf, exportToCsv } from "@/lib/pdfExport";

interface InventorySession {
  _id: string; code: string;
  type: "PERIODIC" | "PERMANENT";
  status: "IN_PROGRESS" | "SENT_TO_DEPOT" | "PENDING_APPROVAL" | "CLOSED";
  depotId?: { _id: string; name: string } | null;
  startedBy?: { _id: string; name: string } | null;
  createdAt: string; closedAt?: string | null;
}

const fmt = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const tnd = (v: number) => v.toLocaleString("fr-TN", { minimumFractionDigits: 3 });

const monthLabel = () =>
  new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" }).toUpperCase();

interface ExportEntry { label: string; filename: string; at: string }

interface ReportCard {
  key: string;
  icon: React.ReactNode;
  badge: string;
  title: string;
  description: string;
  onPdf: () => Promise<void>;
  onCsv: () => void;
}

export default function StockDocumentsPage() {
  const [inventories, setInventories] = useState<InventorySession[]>([]);
  const [receipts, setReceipts]       = useState<PurchaseReceipt[]>([]);
  const [invoices, setInvoices]       = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [settings, setSettings]       = useState<CompanySettings | null>(null);
  const [exporting, setExporting]     = useState<string | null>(null);
  const [exportLog, setExportLog]     = useState<ExportEntry[]>([]);

  useEffect(() => {
    setLoading(true);
    financeService.getSettings().then(setSettings).catch(() => {});
    Promise.all([
      stockInventoryService.getAll(),
      purchaseReceiptService.getMine(),
      purchaseInvoiceService.getAll(),
    ])
      .then(([inv, rec, inv2]) => { setInventories(inv); setReceipts(rec); setInvoices(inv2); })
      .catch((e) => setError(e?.response?.data?.message || "Erreur de chargement"))
      .finally(() => setLoading(false));
  }, []);

  const logExport = (label: string, filename: string) => {
    setExportLog((prev) => [
      { label, filename, at: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) },
      ...prev,
    ]);
  };

  const totalTtc = invoices.reduce((s, i) => s + (i.totalTtc ?? 0), 0);

  // ── PDF / CSV helpers ─────────────────────────────────────────────────────

  const makeInventairesPdf = async () => {
    setExporting("inv-pdf");
    const cols = ["Code", "Type", "Dépôt", "Statut", "Date création", "Clôturé le"];
    const rows = inventories.map((i) => [i.code, i.type, i.depotId?.name ?? "—", i.status.replace(/_/g, " "), fmt(i.createdAt), fmt(i.closedAt)]);
    const fn = `inventaires-${new Date().toISOString().slice(0, 10)}.pdf`;
    try { await exportToPdf("Inventaires", `${inventories.length} session(s)`, cols, rows, fn); logExport("Inventaires — PDF", fn); }
    finally { setExporting(null); }
  };
  const makeInventairesCsv = () => {
    const cols = ["Code", "Type", "Dépôt", "Statut", "Date création", "Clôturé le"];
    const rows = inventories.map((i) => [i.code, i.type, i.depotId?.name ?? "—", i.status.replace(/_/g, " "), fmt(i.createdAt), fmt(i.closedAt)]);
    const fn = `inventaires-${new Date().toISOString().slice(0, 10)}.csv`;
    exportToCsv(cols, rows, fn); logExport("Inventaires — CSV", fn);
  };

  const makeReceptionsPdf = async () => {
    setExporting("rec-pdf");
    const cols = ["N° Bon", "Fournisseur", "N° Commande", "Dépôt", "Statut", "Lignes", "Date"];
    const rows = receipts.map((r) => [r.receiptNo, r.supplierId?.name ?? "—", r.purchaseOrderId?.orderNo ?? "—", r.depotId?.name ?? "—", r.receiptStatus, r.lines?.length ?? 0, fmt(r.createdAt)]);
    const fn = `receptions-${new Date().toISOString().slice(0, 10)}.pdf`;
    try { await exportToPdf("Bons de réception", `${receipts.length} bon(s)`, cols, rows, fn); logExport("Réceptions — PDF", fn); }
    finally { setExporting(null); }
  };
  const makeReceptionsCsv = () => {
    const cols = ["N° Bon", "Fournisseur", "N° Commande", "Dépôt", "Statut", "Lignes", "Date"];
    const rows = receipts.map((r) => [r.receiptNo, r.supplierId?.name ?? "—", r.purchaseOrderId?.orderNo ?? "—", r.depotId?.name ?? "—", r.receiptStatus, r.lines?.length ?? 0, fmt(r.createdAt)]);
    const fn = `receptions-${new Date().toISOString().slice(0, 10)}.csv`;
    exportToCsv(cols, rows, fn); logExport("Réceptions — CSV", fn);
  };

  const makeFacturesPdf = async () => {
    setExporting("fac-pdf");
    const cols = ["N° Facture", "Fournisseur", "Statut", "Total TTC", "Payé", "Date"];
    const rows = invoices.map((i) => [i.invoiceNo, i.supplierId?.name ?? "—", i.status.replace(/_/g, " "), `${tnd(i.totalTtc)} TND`, `${tnd(i.amountPaid)} TND`, fmt(i.invoiceDate)]);
    const fn = `factures-fournisseurs-${new Date().toISOString().slice(0, 10)}.pdf`;
    try { await exportToPdf("Factures fournisseurs", `${invoices.length} facture(s)`, cols, rows, fn); logExport("Factures — PDF", fn); }
    finally { setExporting(null); }
  };
  const makeFacturesCsv = () => {
    const cols = ["N° Facture", "Fournisseur", "Statut", "Total TTC", "Payé", "Date"];
    const rows = invoices.map((i) => [i.invoiceNo, i.supplierId?.name ?? "—", i.status.replace(/_/g, " "), `${tnd(i.totalTtc)} TND`, `${tnd(i.amountPaid)} TND`, fmt(i.invoiceDate)]);
    const fn = `factures-fournisseurs-${new Date().toISOString().slice(0, 10)}.csv`;
    exportToCsv(cols, rows, fn); logExport("Factures — CSV", fn);
  };

  const exportAllCsv = () => { makeInventairesCsv(); makeReceptionsCsv(); makeFacturesCsv(); };

  const reports: ReportCard[] = [
    {
      key: "inv", icon: <ClipboardList size={20} />,
      badge: "Toutes sessions",
      title: "Rapport Inventaires",
      description: "Sessions d'inventaire avec code, type, dépôt, statut et dates de clôture.",
      onPdf: makeInventairesPdf, onCsv: makeInventairesCsv,
    },
    {
      key: "rec", icon: <Truck size={20} />,
      badge: "Toutes réceptions",
      title: "Rapport Réceptions",
      description: "Bons de réception avec fournisseur, commande liée, dépôt et statut.",
      onPdf: makeReceptionsPdf, onCsv: makeReceptionsCsv,
    },
    {
      key: "fac", icon: <Receipt size={20} />,
      badge: "Tous statuts",
      title: "Rapport Factures Fournisseurs",
      description: "Factures fournisseurs avec FODEC, TVA, timbre fiscal et montants payés.",
      onPdf: makeFacturesPdf, onCsv: makeFacturesCsv,
    },
  ];

  const statCards = [
    {
      label: "TOTAL RAPPORTS", value: "3", sub: "Disponibles",
      icon: <FileText size={18} />,
      iconBg: "bg-teal-100 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400",
    },
    {
      label: "GÉNÉRÉS", value: String(exportLog.length), sub: "Cette session",
      icon: <Download size={18} />,
      iconBg: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
    },
    {
      label: "TOTAL DOCUMENTS", value: String(inventories.length + receipts.length + invoices.length), sub: "Tous modules",
      icon: <ClipboardList size={18} />,
      iconBg: "bg-teal-100 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400",
    },
    {
      label: "TOTAL FACTURES TTC", value: tnd(totalTtc), sub: "TND — Fournisseurs",
      icon: <DollarSign size={18} />,
      iconBg: "bg-teal-100 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400",
      large: true,
    },
  ];

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "STOCK_MANAGER", "DEPOT_MANAGER"]}>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              Stock <span className="text-teal-500">Reports</span>
            </h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              EMM ERP · STOCK
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
                  {card.large ? (
                    <p className="mt-1 text-xl font-bold leading-tight text-slate-950 dark:text-white">
                      {card.value}<br /><span className="text-sm font-semibold text-slate-500">TND</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-3xl font-bold text-slate-950 dark:text-white">{card.value}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{card.sub}</p>
                </div>
              ))}
            </div>

            {/* Report cards + export log */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

              <div className="lg:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2 content-start">
                {reports.map((r) => {
                  const isPdfLoading = exporting === `${r.key}-pdf`;
                  return (
                    <div key={r.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-start justify-between gap-2 mb-4">
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-100 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
                          {r.icon}
                        </div>
                        <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[10px] font-semibold text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                          {r.badge}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-950 dark:text-white">{r.title}</h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{r.description}</p>
                      <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{monthLabel()}</p>
                      <div className="mt-4 flex gap-2">
                        <button onClick={r.onPdf} disabled={!!exporting}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-teal-700 disabled:opacity-50"
                        >
                          {isPdfLoading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Export PDF
                        </button>
                        <button onClick={r.onCsv} disabled={!!exporting}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Download size={12} /> Export CSV
                        </button>
                      </div>
                    </div>
                  );
                })}

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
              </div>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
