"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Search, TriangleAlert, ShoppingCart, X, Clock, CheckCircle2, ChevronLeft, ChevronRight, Factory } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 20;
import { stockAlertService } from "@/services/stock/stockAlertService";
import { purchaseRequestService } from "@/services/purchase/purchaseRequestService";

interface Product {
  _id: string;
  sku: string;
  name: string;
  type: "PRODUIT_FINI" | "SOUS_ENSEMBLE" | "COMPOSANT" | "MATIERE_PREMIERE";
}

interface StockAlert {
  _id: string;
  productId: Product;
  thresholdRuleId?: { _id: string; minQuantity?: number } | null;
  type: "LOW_STOCK" | "OUT_OF_STOCK" | "NEGATIVE_RISK" | "SYSTEM";
  title: string;
  message: string;
  currentQuantity: number;
  thresholdQuantity?: number | null;
  status: "OPEN" | "ACKNOWLEDGED" | "PENDING" | "CLOSED";
  createdAt: string;
  updatedAt: string;
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.18 }}
        className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <X size={13} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </div>
  );
}

export default function StockAlertsPage() {
  const { t } = useLanguage();

  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "ACKNOWLEDGED" | "PENDING" | "CLOSED">("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [purchaseAlert, setPurchaseAlert] = useState<StockAlert | null>(null);
  const [prQuantity, setPrQuantity] = useState("");
  const [prPriority, setPrPriority] = useState<"LOW" | "NORMAL" | "URGENT">("NORMAL");
  const [prNotes, setPrNotes] = useState("");
  const [prSubmitting, setPrSubmitting] = useState(false);
  const [prError, setPrError] = useState("");

  const surface =
    "rounded-3xl border border-slate-200 bg-white shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900";

  const inputClass =
    "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800";

  const labelClass =
    "mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400";

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await stockAlertService.getAll();
      setAlerts(data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return alerts.filter((alert) => {
      const matchSearch =
        alert.productId?.name?.toLowerCase().includes(q) ||
        alert.productId?.sku?.toLowerCase().includes(q) ||
        alert.type.toLowerCase().includes(q) ||
        alert.title.toLowerCase().includes(q) ||
        alert.message.toLowerCase().includes(q);
      const matchStatus = statusFilter === "ALL" ? true : alert.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [alerts, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const stats = useMemo(
    () => ({
      total: alerts.length,
      open: alerts.filter((a) => a.status === "OPEN").length,
      pending: alerts.filter((a) => a.status === "PENDING").length,
      closed: alerts.filter((a) => a.status === "CLOSED").length,
    }),
    [alerts]
  );

  const updateStatus = async (id: string, status: "OPEN" | "ACKNOWLEDGED" | "CLOSED") => {
    try {
      setUpdatingId(id);
      await stockAlertService.updateStatus(id, status);
      await fetchAlerts();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update alert");
    } finally {
      setUpdatingId(null);
    }
  };

  const openPurchaseModal = (alert: StockAlert) => {
    setPurchaseAlert(alert);
    setPrQuantity("");
    setPrPriority("NORMAL");
    setPrNotes("");
    setPrError("");
  };

  const handleCreatePurchaseRequest = async () => {
    if (!purchaseAlert) return;
    if (!prQuantity || Number(prQuantity) < 1) {
      setPrError("Quantity must be at least 1");
      return;
    }
    try {
      setPrSubmitting(true);
      setPrError("");
      const requestNo = `PR-${Date.now()}`;
      await purchaseRequestService.createFromAlert(purchaseAlert._id, {
        requestNo,
        requestedQuantity: Number(prQuantity),
        priority: prPriority,
        notes: prNotes,
      });
      setPurchaseAlert(null);
      await fetchAlerts();
    } catch (err: any) {
      setPrError(err.response?.data?.message || "Failed to create purchase request");
    } finally {
      setPrSubmitting(false);
    }
  };

  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const typeBadge = (type: StockAlert["type"]) => {
    if (type === "OUT_OF_STOCK") return "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
    if (type === "LOW_STOCK") return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
    if (type === "NEGATIVE_RISK") return "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300";
    return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  };

  const statusBadge = (status: StockAlert["status"]) => {
    if (status === "OPEN") return "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
    if (status === "ACKNOWLEDGED") return "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
    if (status === "PENDING") return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "STOCK_MANAGER"]}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Stock Module · ERP
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              {t("stockAlertsMenu")}{" "}
              <span className="text-slate-400 dark:text-slate-500">Monitoring</span>
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            { label: "Total Alerts", value: String(stats.total), sub: "all alerts", Icon: TriangleAlert },
            { label: "Open", value: String(stats.open), sub: "requires action", Icon: TriangleAlert },
            { label: "Pending Purchase", value: String(stats.pending), sub: "awaiting purchase", Icon: Clock },
            { label: "Closed", value: String(stats.closed), sub: "resolved alerts", Icon: CheckCircle2 },
          ].map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`${surface} flex items-center gap-4 px-5 py-5`}
            >
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <card.Icon size={16} />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {card.label}
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {card.value}
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{card.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className={`${surface} overflow-hidden`}>
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center dark:border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                {t("stockAlertsMenu")}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {filtered.length} {t("ofText")} {alerts.length} {t("records")}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800"
                  placeholder={t("search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              >
                <option value="ALL">All Status</option>
                <option value="OPEN">OPEN</option>
                <option value="PENDING">PENDING</option>
                <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 size={16} className="animate-spin" />
              {t("loading")}
            </div>
          ) : error ? (
            <div className="px-6 py-10 text-sm text-rose-600 dark:text-rose-400">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              {t("noResults")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    <th className="px-6 py-3 font-medium">{t("product")}</th>
                    <th className="px-6 py-3 font-medium">{t("sku")}</th>
                    <th className="px-6 py-3 font-medium">{t("type")}</th>
                    <th className="px-6 py-3 font-medium">{t("current")}</th>
                    <th className="px-6 py-3 font-medium">{t("minimum")}</th>
                    <th className="px-6 py-3 font-medium">{t("status")}</th>
                    <th className="px-6 py-3 font-medium">{t("date")}</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {paginated.map((alert, i) => (
                    <motion.tr
                      key={alert._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="transition hover:bg-slate-50 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">
                            {alert.productId?.name || "—"}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {alert.message}
                          </p>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {alert.productId?.sku || "—"}
                      </td>

                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${typeBadge(alert.type)}`}>
                          {alert.type}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {alert.currentQuantity}
                      </td>

                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {alert.thresholdQuantity ?? alert.thresholdRuleId?.minQuantity ?? "—"}
                      </td>

                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(alert.status)}`}>
                          {alert.status === "PENDING" && <Clock size={10} />}
                          {alert.status}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                        {formatDateTime(alert.createdAt)}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {alert.status === "OPEN" && alert.productId?.type === "MATIERE_PREMIERE" && (
                            <button
                              onClick={() => openPurchaseModal(alert)}
                              disabled={updatingId === alert._id}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-60 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300 dark:hover:bg-blue-950/40"
                            >
                              <ShoppingCart size={11} />
                              {t("requestPurchase")}
                            </button>
                          )}

                          {alert.status === "OPEN" && alert.productId?.type !== "MATIERE_PREMIERE" && (
                            <button
                              disabled
                              className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 opacity-60 dark:border-violet-900/40 dark:bg-violet-950/20 dark:text-violet-300"
                            >
                              <Factory size={11} />
                              {t("requestProduction")}
                            </button>
                          )}

                          {alert.status === "PENDING" && (
                            <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                              <Clock size={11} />
                              {t("pending")}
                            </span>
                          )}

                          {alert.status === "CLOSED" && (
                            <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                              <CheckCircle2 size={11} />
                              {t("closed")}
                            </span>
                          )}

                          {(alert.status === "CLOSED" || alert.status === "ACKNOWLEDGED") && (
                            <button
                              onClick={() => updateStatus(alert._id, "OPEN")}
                              disabled={updatingId === alert._id}
                              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              {updatingId === alert._id ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                t("reopen")
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Page {page} of {totalPages} · {filtered.length} records
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…" ? (
                      <span key={`e${i}`} className="px-1 text-xs text-slate-400">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-xl text-xs font-medium transition ${
                          page === p
                            ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                            : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {purchaseAlert && (
          <Modal title={t("createPurchaseRequest")} onClose={() => setPurchaseAlert(null)}>
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
                <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">{t("product")}</p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                  {purchaseAlert.productId?.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  SKU: {purchaseAlert.productId?.sku} · {t("currentStock")}: {purchaseAlert.currentQuantity}
                </p>
              </div>

              {prError && (
                <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-600 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400">
                  <X size={13} />
                  {prError}
                </div>
              )}

              <div>
                <label className={labelClass}>{t("quantityToRequest")}</label>
                <input
                  className={inputClass}
                  type="number"
                  min="1"
                  placeholder="e.g. 50"
                  value={prQuantity}
                  onChange={(e) => setPrQuantity(e.target.value)}
                />
              </div>

              <div>
                <label className={labelClass}>{t("priority")}</label>
                <select
                  className={inputClass}
                  value={prPriority}
                  onChange={(e) => setPrPriority(e.target.value as typeof prPriority)}
                >
                  <option value="LOW">{t("low")}</option>
                  <option value="NORMAL">{t("normal")}</option>
                  <option value="URGENT">{t("urgent")}</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>{t("notesOptional")}</label>
                <textarea
                  className={`${inputClass} resize-none`}
                  rows={2}
                  placeholder="Additional notes..."
                  value={prNotes}
                  onChange={(e) => setPrNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleCreatePurchaseRequest}
                  disabled={prSubmitting}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                >
                  {prSubmitting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ShoppingCart size={14} />
                  )}
                  {t("sendPurchaseRequest")}
                </button>
                <button
                  onClick={() => setPurchaseAlert(null)}
                  disabled={prSubmitting}
                  className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </ProtectedRoute>
  );
}
