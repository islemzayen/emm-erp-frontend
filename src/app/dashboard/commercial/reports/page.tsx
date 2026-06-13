"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { salesOrderService, SalesOrder } from "@/services/commercial/salesOrderService";
import { backorderService } from "@/services/commercial/backorderService";
import { devisService, type Devis } from "@/services/commercial/devisService";
import { customerInvoiceService, type CustomerInvoice } from "@/services/commercial/customerInvoiceService";
import { exportToPdf, exportToCsv, openClientDocument } from "@/lib/pdfExport";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Loader2,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  DollarSign,
  Package,
  FileText,
  FileSpreadsheet,
  Download,
  Printer,
  History,
} from "lucide-react";

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

type Period = "7" | "30" | "90" | "ALL";

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

function orderRevenue(order: SalesOrder): number {
  return order.lines.reduce((s, l) => s + l.quantity * (l.unitPrice || 0), 0);
}

function filterByPeriod(orders: SalesOrder[], period: Period): SalesOrder[] {
  if (period === "ALL") return orders;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Number(period));
  return orders.filter((o) => o.createdAt && new Date(o.createdAt) >= cutoff);
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(key: string): string {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("fr-TN", {
    month: "short",
    year: "2-digit",
  });
}

interface ExportEntry { label: string; filename: string; at: string }

const fmt = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const tnd = (v: number) => v.toLocaleString("fr-TN", { minimumFractionDigits: 3 });

export default function CommercialReportsPage() {
  const { t } = useLanguage();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [backorderCount, setBackorderCount] = useState(0);
  const [devis, setDevis] = useState<Devis[]>([]);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<Period>("30");
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportLog, setExportLog] = useState<ExportEntry[]>([]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError("");
        const [orderData, boData, devisData, invoiceData] = await Promise.all([
          salesOrderService.getAll(),
          backorderService.getAll(),
          devisService.getAll(),
          customerInvoiceService.getAll(),
        ]);
        setOrders(orderData);
        setBackorderCount(boData.length);
        setDevis(devisData);
        setInvoices(invoiceData);
      } catch (err: unknown) {
        setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to load report data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const logExport = (label: string, filename: string) => {
    setExportLog((prev) => [
      { label, filename, at: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) },
      ...prev.slice(0, 19),
    ]);
  };

  const makeDevisPdf = async () => {
    setExporting("devis-pdf");
    const cols = ["N° Devis", "Client", "Statut", "Date", "Total TTC (TND)"];
    const rows = devis.map((d) => [d.devisNo, d.customerName, d.status, fmt(d.issueDate), tnd(d.totalTtc)]);
    const filename = `devis-${new Date().toISOString().slice(0, 10)}.pdf`;
    await exportToPdf("Liste des Devis", `${devis.length} devis exportés`, cols, rows, filename);
    logExport("Devis PDF", filename);
    setExporting(null);
  };

  const makeDevisCsv = () => {
    const cols = ["N° Devis", "Client", "Statut", "Date", "Total TTC (TND)"];
    const rows = devis.map((d) => [d.devisNo, d.customerName, d.status, fmt(d.issueDate), tnd(d.totalTtc)]);
    const filename = `devis-${new Date().toISOString().slice(0, 10)}.csv`;
    exportToCsv(cols, rows, filename);
    logExport("Devis CSV", filename);
  };

  const makeCommandesPdf = async () => {
    setExporting("cmd-pdf");
    const cols = ["N° Commande", "Client", "Statut", "Total (TND)"];
    const rows = orders.map((o) => [
      o.orderNo,
      o.customerName,
      o.status,
      tnd(o.lines.reduce((s, l) => s + l.quantity * (l.unitPrice || 0), 0)),
    ]);
    const filename = `commandes-${new Date().toISOString().slice(0, 10)}.pdf`;
    await exportToPdf("Liste des Commandes", `${orders.length} commandes exportées`, cols, rows, filename);
    logExport("Commandes PDF", filename);
    setExporting(null);
  };

  const makeCommandesCsv = () => {
    const cols = ["N° Commande", "Client", "Statut", "Total (TND)"];
    const rows = orders.map((o) => [
      o.orderNo,
      o.customerName,
      o.status,
      tnd(o.lines.reduce((s, l) => s + l.quantity * (l.unitPrice || 0), 0)),
    ]);
    const filename = `commandes-${new Date().toISOString().slice(0, 10)}.csv`;
    exportToCsv(cols, rows, filename);
    logExport("Commandes CSV", filename);
  };

  const makeFacturesPdf = async () => {
    setExporting("fac-pdf");
    const cols = ["N° Facture", "Client", "Statut paiement", "Date", "Total TTC (TND)"];
    const rows = invoices.map((i) => [i.invoiceNo, i.customerName, i.paymentStatus, fmt(i.issueDate), tnd(i.totalTtc)]);
    const filename = `factures-${new Date().toISOString().slice(0, 10)}.pdf`;
    await exportToPdf("Liste des Factures", `${invoices.length} factures exportées`, cols, rows, filename);
    logExport("Factures PDF", filename);
    setExporting(null);
  };

  const makeFacturesCsv = () => {
    const cols = ["N° Facture", "Client", "Statut paiement", "Date", "Total TTC (TND)"];
    const rows = invoices.map((i) => [i.invoiceNo, i.customerName, i.paymentStatus, fmt(i.issueDate), tnd(i.totalTtc)]);
    const filename = `factures-${new Date().toISOString().slice(0, 10)}.csv`;
    exportToCsv(cols, rows, filename);
    logExport("Factures CSV", filename);
  };

  const printInvoice = (inv: CustomerInvoice) => {
    openClientDocument({
      invoiceNo: inv.invoiceNo,
      orderNo: inv.salesOrderId?.orderNo ?? null,
      customerName: inv.customerName,
      customerMf: (inv as { customerMf?: string }).customerMf,
      invoiceDate: inv.issueDate,
      dueDate: inv.dueDate,
      paymentStatus: inv.paymentStatus,
      paymentMethod: inv.paymentMethod,
      company: undefined,
      lines: inv.lines.map((l) => ({
        ref: l.productId?.sku,
        description: l.productId?.name ?? "—",
        qty: l.quantity,
        unitPrice: l.inputUnitPrice,
        totalHt: l.subtotalHt,
      })),
      subtotalHt: inv.subtotalHt,
      fodecRate: inv.fodecRate,
      totalFodec: inv.totalFodec,
      tvaRate: inv.tvaRate,
      totalVat: inv.totalVat,
      totalBeforeStamp: inv.totalBeforeStamp,
      timbreFiscal: inv.timbreFiscal,
      totalTtc: inv.totalTtc,
      amountPaid: inv.amountPaid,
    });
    logExport(`Facture ${inv.invoiceNo}`, `facture-${inv.invoiceNo}.pdf`);
  };

  const reportCards = [
    {
      key: "devis",
      icon: <FileText size={18} />,
      iconBg: "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400",
      badge: `${devis.length} devis`,
      title: "Devis",
      description: "Exporter la liste complète des devis avec statuts et montants",
      pdfKey: "devis-pdf",
      onPdf: makeDevisPdf,
      onCsv: makeDevisCsv,
    },
    {
      key: "commandes",
      icon: <Package size={18} />,
      iconBg: "bg-violet-50 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400",
      badge: `${orders.length} commandes`,
      title: "Commandes",
      description: "Exporter la liste des commandes avec statuts et totaux",
      pdfKey: "cmd-pdf",
      onPdf: makeCommandesPdf,
      onCsv: makeCommandesCsv,
    },
    {
      key: "factures",
      icon: <DollarSign size={18} />,
      iconBg: "bg-teal-50 text-teal-600 dark:bg-teal-950/30 dark:text-teal-400",
      badge: `${invoices.length} factures`,
      title: "Factures",
      description: "Exporter la liste des factures clients avec statuts de paiement",
      pdfKey: "fac-pdf",
      onPdf: makeFacturesPdf,
      onCsv: makeFacturesCsv,
    },
  ];

  const filtered = useMemo(() => filterByPeriod(orders, period), [orders, period]);

  const metrics = useMemo(() => {
    const total = filtered.length;
    const delivered = filtered.filter((o) => o.status === "DELIVERED");
    const cancelled = filtered.filter((o) => o.status === "CANCELLED");
    const nonCancelled = filtered.filter((o) => o.status !== "CANCELLED");
    const logisticsOrders = filtered.filter(
      (o) =>
        ["SHIPPED", "DELIVERED", "CLOSED"].includes(o.status) &&
        typeof o.shippingCost === "number"
    );

    const revenue = nonCancelled.reduce((s, o) => s + orderRevenue(o), 0);
    const avgOrderValue = nonCancelled.length > 0 ? revenue / nonCancelled.length : 0;
    const totalShippingCost = logisticsOrders.reduce(
      (sum, order) => sum + (order.shippingCost || 0),
      0
    );
    const avgShippingCost =
      logisticsOrders.length > 0 ? totalShippingCost / logisticsOrders.length : 0;

    // On-time delivery rate
    const deliveredWithPromise = delivered.filter((o) => o.promisedDate && o.deliveredAt);
    const onTime = deliveredWithPromise.filter(
      (o) => new Date(o.deliveredAt!) <= new Date(o.promisedDate!)
    );
    const onTimeRate =
      deliveredWithPromise.length > 0
        ? Math.round((onTime.length / deliveredWithPromise.length) * 100)
        : null;

    // Avg delivery time (createdAt → deliveredAt)
    const deliveredWithBoth = delivered.filter((o) => o.createdAt && o.deliveredAt);
    const avgDeliveryDays =
      deliveredWithBoth.length > 0
        ? Math.round(
            deliveredWithBoth.reduce((s, o) => s + daysBetween(o.createdAt!, o.deliveredAt!), 0) /
              deliveredWithBoth.length
          )
        : null;

    // Cancellation rate
    const cancelRate = total > 0 ? Math.round((cancelled.length / total) * 100) : 0;

    // Status breakdown
    const byStatus: Record<string, number> = {};
    for (const o of filtered) {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    }

    return {
      total,
      revenue,
      avgOrderValue,
      totalShippingCost,
      avgShippingCost,
      onTimeRate,
      avgDeliveryDays,
      cancelRate,
      deliveredCount: delivered.length,
      cancelledCount: cancelled.length,
      byStatus,
    };
  }, [filtered]);

  // Revenue by month (last 6 months from ALL orders, not period-filtered)
  const revenueByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 5);
    cutoff.setDate(1);

    for (const o of orders) {
      if (!o.createdAt || o.status === "CANCELLED") continue;
      if (new Date(o.createdAt) < cutoff) continue;
      const key = getMonthKey(o.createdAt);
      map[key] = (map[key] || 0) + orderRevenue(o);
    }

    const keys = Object.keys(map).sort();
    const max = Math.max(...Object.values(map), 1);
    return keys.map((k) => ({ label: formatMonth(k), value: map[k], pct: (map[k] / max) * 100 }));
  }, [orders]);

  const periodOptions: { value: Period; label: string }[] = [
    { value: "7", label: "7 jours" },
    { value: "30", label: "30 jours" },
    { value: "90", label: "90 jours" },
    { value: "ALL", label: "Tout" },
  ];

  const statusColors: Record<string, string> = {
    DRAFT: "bg-slate-400",
    CONFIRMED: "bg-blue-500",
    PREPARED: "bg-violet-500",
    SHIPPED: "bg-emerald-500",
    DELIVERED: "bg-teal-500",
    CLOSED: "bg-slate-500",
    CANCELLED: "bg-rose-500",
  };

  const statusLabels: Record<string, string> = {
    DRAFT: t("draft"),
    CONFIRMED: t("confirmedOrders"),
    PREPARED: t("prepared") || "Prepared",
    SHIPPED: t("shipped"),
    DELIVERED: t("delivered") || "Delivered",
    CLOSED: "Clôturée",
    CANCELLED: t("cancelled"),
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "COMMERCIAL_MANAGER"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {t("commercialModule")} · ERP
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <BarChart3 size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {t("reportsKpi") || "Reports & KPIs"}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t("reportsKpiSub") || "Logistics performance indicators"}
                </p>
              </div>
            </div>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900">
            {periodOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                  period === opt.value
                    ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className={`${surface} flex items-center justify-center gap-2 py-20 text-sm text-slate-500`}>
            <Loader2 size={16} className="animate-spin" /> {t("loading")}
          </div>
        ) : (
          <>
            {/* ── KPI cards ── */}
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
              {/* Revenue */}
              <div className={`${surface} p-5`}>
                <div className="inline-flex rounded-2xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
                  <TrendingUp size={16} />
                </div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                  {t("totalSalesRevenue")}
                </p>
                <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {metrics.revenue.toLocaleString("fr-TN", { minimumFractionDigits: 0 })} TND
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {metrics.total} {t("totalOrdersKpi").toLowerCase()}
                </p>
              </div>

              {/* On-time delivery rate */}
              <div className={`${surface} p-5`}>
                <div className="inline-flex rounded-2xl bg-teal-50 p-2.5 text-teal-600 dark:bg-teal-950/30 dark:text-teal-400">
                  <CheckCircle size={16} />
                </div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                  {t("onTimeRate") || "On-Time Delivery"}
                </p>
                <p className={`mt-1.5 text-2xl font-bold tracking-tight ${
                  metrics.onTimeRate === null
                    ? "text-slate-400"
                    : metrics.onTimeRate >= 80
                    ? "text-teal-700 dark:text-teal-400"
                    : metrics.onTimeRate >= 60
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}>
                  {metrics.onTimeRate === null ? "—" : `${metrics.onTimeRate}%`}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {metrics.deliveredCount} {t("delivered") || "delivered"}
                </p>
              </div>

              {/* Avg delivery time */}
              <div className={`${surface} p-5`}>
                <div className="inline-flex rounded-2xl bg-violet-50 p-2.5 text-violet-600 dark:bg-violet-950/30 dark:text-violet-400">
                  <Clock size={16} />
                </div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                  {t("avgDeliveryTime") || "Avg Delivery Time"}
                </p>
                <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {metrics.avgDeliveryDays === null ? "—" : `${metrics.avgDeliveryDays}j`}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t("avgDeliveryTimeSub") || "from order to delivery"}
                </p>
              </div>

              {/* Cancellation rate */}
              <div className={`${surface} p-5`}>
                <div className={`inline-flex rounded-2xl p-2.5 ${
                  metrics.cancelRate > 20
                    ? "bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}>
                  <XCircle size={16} />
                </div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                  {t("cancelRate") || "Cancellation Rate"}
                </p>
                <p className={`mt-1.5 text-2xl font-bold tracking-tight ${
                  metrics.cancelRate > 20 ? "text-rose-600 dark:text-rose-400" : "text-slate-950 dark:text-white"
                }`}>
                  {metrics.cancelRate}%
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {metrics.cancelledCount} {t("cancelled")}
                </p>
              </div>
            </div>

            {/* ── Secondary KPIs ── */}
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
              <div className={`${surface} px-6 py-5`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                  {t("avgOrderValue") || "Avg Order Value"}
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
                  {metrics.avgOrderValue.toLocaleString("fr-TN", { minimumFractionDigits: 0 })} TND
                </p>
              </div>
              <div className={`${surface} px-6 py-5`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                  {t("deliveredOrders") || "Delivered"}
                </p>
                <p className="mt-2 text-2xl font-bold text-teal-700 dark:text-teal-400">
                  {metrics.deliveredCount}
                </p>
              </div>
              <div className={`${surface} px-6 py-5`}>
                <div className="inline-flex rounded-2xl bg-amber-50 p-2.5 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                  <DollarSign size={16} />
                </div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                  {t("avgShippingCost") || "Avg Shipping Cost"}
                </p>
                <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
                  {metrics.avgShippingCost.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} TND
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {metrics.totalShippingCost.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} TND total
                </p>
              </div>
              <div className={`${surface} px-6 py-5`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                  {t("backorders") || "Backorders"}
                </p>
                <p className={`mt-2 text-2xl font-bold ${backorderCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-950 dark:text-white"}`}>
                  {backorderCount}
                </p>
              </div>
              <div className={`${surface} px-6 py-5`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                  {t("lateOrders") || "Late Orders"}
                </p>
                <p className={`mt-2 text-2xl font-bold ${
                  orders.filter(
                    (o) =>
                      o.promisedDate &&
                      ["DRAFT", "CONFIRMED", "PREPARED", "SHIPPED"].includes(o.status) &&
                      new Date(o.promisedDate) < new Date()
                  ).length > 0
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-slate-950 dark:text-white"
                }`}>
                  {orders.filter(
                    (o) =>
                      o.promisedDate &&
                      ["DRAFT", "CONFIRMED", "PREPARED", "SHIPPED"].includes(o.status) &&
                      new Date(o.promisedDate) < new Date()
                  ).length}
                </p>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-5">
              {/* ── Revenue chart (last 6 months) ── */}
              <div className={`${surface} p-6 xl:col-span-3`}>
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold text-slate-950 dark:text-white">
                      {t("revenueByMonth") || "Revenue by Month"}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {t("last6Months") || "Last 6 months (non-cancelled orders)"}
                    </p>
                  </div>
                  <BarChart3 size={16} className="text-slate-400" />
                </div>

                {revenueByMonth.length === 0 ? (
                  <div className="flex h-48 items-center justify-center text-sm text-slate-400">
                    {t("noData") || "No data"}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {revenueByMonth.map((m) => (
                      <div key={m.label} className="flex items-center gap-3">
                        <span className="w-14 shrink-0 text-right text-[11px] text-slate-500 dark:text-slate-400">
                          {m.label}
                        </span>
                        <div className="flex flex-1 items-center gap-2">
                          <div className="h-6 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className="h-full rounded-full bg-blue-500 transition-all duration-500"
                              style={{ width: `${m.pct}%` }}
                            />
                          </div>
                          <span className="w-24 shrink-0 text-right text-xs font-medium text-slate-700 dark:text-slate-300">
                            {m.value.toLocaleString("fr-TN", { minimumFractionDigits: 0 })} TND
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Status breakdown ── */}
              <div className={`${surface} p-6 xl:col-span-2`}>
                <div className="mb-5">
                  <h2 className="font-semibold text-slate-950 dark:text-white">
                    {t("statusBreakdown") || "Status Breakdown"}
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {period === "ALL" ? t("allTime") || "All time" : `${t("last") || "Last"} ${period} ${t("days") || "days"}`}
                  </p>
                </div>

                {metrics.total === 0 ? (
                  <div className="flex h-48 items-center justify-center text-sm text-slate-400">
                    {t("noData") || "No data"}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(metrics.byStatus)
                      .sort((a, b) => b[1] - a[1])
                      .map(([status, count]) => (
                        <div key={status} className="flex items-center gap-3">
                          <div className="flex items-center gap-2 w-28 shrink-0">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${statusColors[status] || "bg-slate-400"}`} />
                            <span className="text-xs text-slate-600 dark:text-slate-300 truncate">
                              {statusLabels[status] || status}
                            </span>
                          </div>
                          <div className="flex flex-1 items-center gap-2">
                            <div className="h-5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${statusColors[status] || "bg-slate-400"}`}
                                style={{ width: `${(count / metrics.total) * 100}%` }}
                              />
                            </div>
                            <span className="w-8 shrink-0 text-right text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {count}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {/* On-time gauge */}
                {metrics.onTimeRate !== null && (
                  <div className="mt-6 rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {t("onTimeRate") || "On-Time Delivery"}
                      </p>
                      <p className={`text-sm font-bold ${
                        metrics.onTimeRate >= 80
                          ? "text-teal-600 dark:text-teal-400"
                          : metrics.onTimeRate >= 60
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}>
                        {metrics.onTimeRate}%
                      </p>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          metrics.onTimeRate >= 80
                            ? "bg-teal-500"
                            : metrics.onTimeRate >= 60
                            ? "bg-amber-500"
                            : "bg-rose-500"
                        }`}
                        style={{ width: `${metrics.onTimeRate}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      {t("onTimeRateSub") || "Orders delivered before promised date"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Alert summary ── */}
            {(metrics.onTimeRate !== null && metrics.onTimeRate < 60) ||
            metrics.cancelRate > 20 ||
            backorderCount > 0 ? (
              <div className={`${surface} p-6`}>
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle size={16} className="text-amber-500" />
                  <h2 className="font-semibold text-slate-950 dark:text-white">
                    {t("performanceAlerts") || "Performance Alerts"}
                  </h2>
                </div>
                <div className="space-y-2">
                  {metrics.onTimeRate !== null && metrics.onTimeRate < 60 && (
                    <div className="flex items-center gap-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-950/20 dark:text-rose-400">
                      <XCircle size={14} className="shrink-0" />
                      {t("alertOnTime") || `On-time delivery rate is low: ${metrics.onTimeRate}%`}
                    </div>
                  )}
                  {metrics.cancelRate > 20 && (
                    <div className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
                      <AlertTriangle size={14} className="shrink-0" />
                      {t("alertCancelRate") || `High cancellation rate: ${metrics.cancelRate}%`}
                    </div>
                  )}
                  {backorderCount > 0 && (
                    <div className="flex items-center gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
                      <Package size={14} className="shrink-0" />
                      {`${backorderCount} backorder${backorderCount > 1 ? "s" : ""} pending`}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

          {/* ── Export report cards ── */}
          <div>
            <h2 className="mb-4 font-semibold text-slate-950 dark:text-white">Rapports &amp; Exports</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {reportCards.map((card) => (
                <div key={card.key} className={`${surface} p-5`}>
                  <div className="mb-4 flex items-start justify-between">
                    <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${card.iconBg}`}>
                      {card.icon}
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {card.badge}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-950 dark:text-white">{card.title}</p>
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{card.description}</p>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => void card.onPdf()}
                      disabled={exporting === card.pdfKey}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-950 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                    >
                      {exporting === card.pdfKey
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Download size={12} />}
                      PDF
                    </button>
                    <button
                      onClick={card.onCsv}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <FileSpreadsheet size={12} />
                      CSV
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Recent invoices ── */}
          {invoices.length > 0 && (
            <div className={`${surface}`}>
              <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <p className="font-semibold text-slate-950 dark:text-white">Factures récentes</p>
                <p className="mt-0.5 text-xs text-slate-400">Imprimer une facture individuelle</p>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {invoices.slice(0, 10).map((inv) => (
                  <div key={inv._id} className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/20">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{inv.invoiceNo}</p>
                      <p className="text-xs text-slate-400">{inv.customerName} · {fmt(inv.issueDate)} · {tnd(inv.totalTtc)} TND</p>
                    </div>
                    <button
                      onClick={() => printInvoice(inv)}
                      title="Imprimer"
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                    >
                      <Printer size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Export log ── */}
          {exportLog.length > 0 && (
            <div className={`${surface} p-5`}>
              <div className="mb-3 flex items-center gap-2">
                <History size={14} className="text-slate-400" />
                <p className="text-sm font-semibold text-slate-950 dark:text-white">Journal des exports</p>
              </div>
              <div className="space-y-1.5">
                {exportLog.map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="w-10 shrink-0 font-mono text-slate-400">{entry.at}</span>
                    <span className="flex-1 truncate">{entry.label}</span>
                    <span className="truncate text-slate-400 dark:text-slate-500">{entry.filename}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  </ProtectedRoute>
  );
}
