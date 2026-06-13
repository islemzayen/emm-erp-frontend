"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { backorderService, BackOrder } from "@/services/commercial/backorderService";
import { useEffect, useMemo, useState } from "react";
import {
  RotateCcw,
  Loader2,
  Search,
  CheckCircle,
  XCircle,
  ChevronDown,
  X,
  ExternalLink,
  Factory,
} from "lucide-react";
import Link from "next/link";

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

function statusBadge(status: string) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    FULFILLED: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
    CANCELLED: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300",
  };
  return map[status] ?? "bg-slate-100 text-slate-600";
}

function productionStatusBadge(status?: string) {
  const map: Record<string, string> = {
    NONE: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    PENDING: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    DONE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  };
  return map[status || "NONE"] ?? map.NONE;
}

export default function BackordersPage() {
  const { t } = useLanguage();

  const [backorders, setBackorders] = useState<BackOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await backorderService.getAll();
      setBackorders(data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load backorders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const runAction = async (action: "fulfill" | "cancel" | "markDone", id: string) => {
    try {
      setActionId(id);
      setError("");
      if (action === "fulfill") await backorderService.fulfill(id);
      if (action === "cancel") await backorderService.cancel(id);
      if (action === "markDone") await backorderService.markProductionDone(id);
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to ${action} backorder`);
    } finally {
      setActionId(null);
    }
  };

  const kpis = useMemo(() => ({
    total: backorders.length,
    pending: backorders.filter((b) => b.status === "PENDING").length,
    fulfilled: backorders.filter((b) => b.status === "FULFILLED").length,
    cancelled: backorders.filter((b) => b.status === "CANCELLED").length,
  }), [backorders]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return backorders.filter((b) => {
      const matchSearch =
        b.orderNo.toLowerCase().includes(q) ||
        b.customerName.toLowerCase().includes(q);
      const matchStatus = statusFilter === "ALL" || b.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [backorders, search, statusFilter]);

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "COMMERCIAL_MANAGER"]}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {t("commercialModule")} · ERP
          </p>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950/30">
              <RotateCcw size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                {t("backorderListTitle")}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("backordersSub")}
              </p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start justify-between rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
            <button onClick={() => setError("")} className="ml-4 shrink-0 hover:opacity-70">
              <X size={14} />
            </button>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: t("totalLabel"), value: kpis.total, color: "text-slate-900 dark:text-white" },
            { label: t("pending"), value: kpis.pending, color: "text-amber-700 dark:text-amber-400" },
            { label: t("fulfilled"), value: kpis.fulfilled, color: "text-teal-700 dark:text-teal-400" },
            { label: t("cancelled"), value: kpis.cancelled, color: "text-rose-600 dark:text-rose-400" },
          ].map((kpi) => (
            <div key={kpi.label} className={`${surface} px-6 py-5`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                {kpi.label}
              </p>
              <p className={`mt-2 text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* List */}
        <div className={`${surface} overflow-hidden`}>
          <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-slate-950 dark:text-white">
              {t("backorderListTitle")}
              <span className="ml-2 text-sm font-normal text-slate-400">{filtered.length}</span>
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchCommercialOrders") || "Search..."}
                  className="w-52 rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
              >
                <option value="ALL">{t("allStatus")}</option>
                <option value="PENDING">{t("pending")}</option>
                <option value="FULFILLED">{t("fulfilled")}</option>
                <option value="CANCELLED">{t("cancelled")}</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> {t("loading")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-sm text-slate-400">
              <RotateCcw size={32} className="opacity-30" />
              {backorders.length === 0
                ? t("noBackorders")
                : t("noMatch")}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((bo) => {
                const isExpanded = expandedId === bo._id;
                const busy = actionId === bo._id;

                return (
                  <div key={bo._id}>
                    <div className="flex flex-wrap items-center gap-4 px-6 py-4">
                      {/* Expand */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : bo._id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                      >
                        <ChevronDown
                          size={14}
                          className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/dashboard/commercial/backorders/${bo._id}`}
                            className="inline-flex items-center gap-1 font-semibold text-slate-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                          >
                            {bo.orderNo}
                            <ExternalLink size={11} className="opacity-40" />
                          </Link>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusBadge(bo.status)}`}
                          >
                            {bo.status}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${productionStatusBadge(bo.productionRequestStatus)}`}
                          >
                            <Factory size={10} />
                            Production {bo.productionRequestStatus || "NONE"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                          {bo.customerName}
                          <span className="ml-2 text-[11px] text-slate-400">
                            · {bo.lines.length} {t("lineCountLabel")}
                          </span>
                        </p>
                      </div>

                      {/* Backorder qty summary */}
                      <div className="text-right">
                        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                          {bo.lines.reduce((s, l) => s + l.quantityBackordered, 0)} units backordered
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {bo.createdAt && new Date(bo.createdAt).toLocaleDateString("fr-TN")}
                        </p>
                      </div>

                      {/* Actions */}
                      {bo.status === "PENDING" && (
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            onClick={() => runAction("fulfill", bo._id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-2xl bg-teal-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
                          >
                            {busy ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                            {t("fulfillBackorderAction")}
                          </button>
                          <button
                            onClick={() => runAction("cancel", bo._id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400"
                          >
                            <XCircle size={11} /> {t("cancel")}
                          </button>
                          {bo.productionRequestStatus === "PENDING" && (
                            <button
                              onClick={() => runAction("markDone", bo._id)}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                            >
                              <CheckCircle size={11} /> Mark done
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expanded lines */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800">
                              {[t("product"), t("orderedQtyLabel"), t("reservedQtyLabel"), t("pendingQtyLabel")].map((h) => (
                                <th
                                  key={h}
                                  className="pb-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400"
                                >
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {bo.lines.map((line, idx) => (
                              <tr key={idx}>
                                <td className="py-2.5 font-medium text-slate-900 dark:text-white">
                                  {line.productId?.name || "—"}
                                  {line.productId?.sku && (
                                    <span className="ml-1.5 text-[11px] text-slate-400">
                                      ({line.productId.sku})
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 text-slate-600 dark:text-slate-300">
                                  {line.quantityOrdered}
                                </td>
                                <td className="py-2.5 text-teal-600 dark:text-teal-400">
                                  {line.quantityReserved}
                                </td>
                                <td className="py-2.5 font-semibold text-amber-700 dark:text-amber-400">
                                  {line.quantityBackordered}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
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
