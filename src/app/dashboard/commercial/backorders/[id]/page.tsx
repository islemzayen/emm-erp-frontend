"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { backorderService, BackOrder } from "@/services/commercial/backorderService";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle,
  Factory,
  Loader2,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const statusColors: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  FULFILLED: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
  CANCELLED: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300",
};

const productionStatusColors: Record<string, string> = {
  NONE: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  PENDING: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  DONE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
};

export default function BackorderDetailPage() {
  const params = useParams<{ id: string }>();
  const { t } = useLanguage();
  const [bo, setBo] = useState<BackOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchBo = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await backorderService.getById(params.id);
      setBo(data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load backorder");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) fetchBo();
  }, [params.id]);

  const runAction = async (action: "fulfill" | "cancel" | "markDone") => {
    if (!bo) return;
    try {
      setActionId(action);
      setError("");
      if (action === "fulfill") await backorderService.fulfill(bo._id);
      if (action === "cancel") await backorderService.cancel(bo._id);
      if (action === "markDone") await backorderService.markProductionDone(bo._id);
      await fetchBo();
    } catch (err: any) {
      setError(err.response?.data?.message || `Failed to ${action} backorder`);
    } finally {
      setActionId(null);
    }
  };

  const totalBackordered = bo?.lines.reduce((s, l) => s + l.quantityBackordered, 0) ?? 0;
  const totalOrdered = bo?.lines.reduce((s, l) => s + l.quantityOrdered, 0) ?? 0;
  const totalReserved = bo?.lines.reduce((s, l) => s + l.quantityReserved, 0) ?? 0;

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "COMMERCIAL_MANAGER"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950/30">
            <RotateCcw size={18} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {t("commercialModule")} · ERP
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              {t("backorderDetailTitle")}
            </h1>
          </div>
        </div>

        <Link
          href="/dashboard/commercial/backorders"
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={14} /> {t("backToOrders")}
        </Link>

        {error && (
          <div className="flex items-start justify-between rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
            <button onClick={() => setError("")} className="ml-4 shrink-0 hover:opacity-70">
              <X size={14} />
            </button>
          </div>
        )}

        {loading ? (
          <div className={`${surface} flex items-center justify-center gap-2 py-16 text-sm text-slate-500`}>
            <Loader2 size={16} className="animate-spin" /> {t("loading")}
          </div>
        ) : !bo ? (
          <div className={`${surface} px-6 py-12 text-sm text-slate-500`}>{t("backorderNotFound")}</div>
        ) : (
          <>
            <div className="grid gap-6 xl:grid-cols-3">
              {/* Info card */}
              <div className={`${surface} p-6 xl:col-span-2`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      {t("backorderListTitle")}
                    </p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                      {bo.orderNo}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {bo.customerName}
                    </p>
                    {bo.salesOrderId && (
                      <Link
                        href={`/dashboard/commercial/orders/${bo.salesOrderId._id}`}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Sales order: {bo.salesOrderId.orderNo} ({bo.salesOrderId.status})
                      </Link>
                    )}
                  </div>

                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors[bo.status] ?? statusColors.PENDING}`}>
                    {bo.status}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${productionStatusColors[bo.productionRequestStatus || "NONE"] ?? productionStatusColors.NONE}`}
                  >
                    Production {bo.productionRequestStatus || "NONE"}
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap gap-4 text-[11px] text-slate-500 dark:text-slate-400">
                  {bo.createdAt && <span>{t("createdOnLabel")}: {new Date(bo.createdAt).toLocaleDateString("fr-TN")}</span>}
                  {bo.productionRequestedAt && <span>Production requested: {new Date(bo.productionRequestedAt).toLocaleDateString("fr-TN")}</span>}
                  {bo.productionCompletedAt && <span>Production done: {new Date(bo.productionCompletedAt).toLocaleDateString("fr-TN")}</span>}
                  {bo.fulfilledAt && <span>{t("fulfilled")}: {new Date(bo.fulfilledAt).toLocaleDateString("fr-TN")}</span>}
                  {bo.cancelledAt && <span>{t("cancelled")}: {new Date(bo.cancelledAt).toLocaleDateString("fr-TN")}</span>}
                </div>
              </div>

              {/* Right panel: KPIs + actions */}
              <div className="space-y-4">
                <div className={`${surface} p-6`}>
                  <div className="space-y-3">
                    {[
                      { label: t("orderedQtyLabel"), value: totalOrdered, color: "text-slate-900 dark:text-white" },
                      { label: t("reservedQtyLabel"), value: totalReserved, color: "text-teal-700 dark:text-teal-400" },
                      { label: t("pendingQtyLabel"), value: totalBackordered, color: "text-amber-700 dark:text-amber-400" },
                    ].map((kpi) => (
                      <div key={kpi.label} className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{kpi.label}</span>
                        <span className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {bo.status === "PENDING" && (
                  <div className={`${surface} p-6`}>
                    <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      {t("actionsCol")}
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => runAction("fulfill")}
                        disabled={!!actionId}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
                      >
                        {actionId === "fulfill" ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        {t("fulfillBackorderAction")}
                      </button>
                      <button
                        onClick={() => runAction("cancel")}
                        disabled={!!actionId}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400"
                      >
                        <XCircle size={14} /> {t("cancelBackorderAction")}
                      </button>
                      {bo.productionRequestStatus === "PENDING" && (
                        <button
                          onClick={() => runAction("markDone")}
                          disabled={!!actionId}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                        >
                          <Factory size={14} /> Mark production done
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Lines table */}
            <div className={`${surface} overflow-hidden`}>
              <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                <h2 className="font-semibold text-slate-950 dark:text-white">{t("backorderListTitle")} — {t("lineCountLabel")}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      {[t("product"), t("sku"), t("orderedQtyLabel"), t("reservedQtyLabel"), t("pendingQtyLabel")].map((h) => (
                        <th key={h} className="px-6 py-3 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {bo.lines.map((line, idx) => (
                      <tr key={idx}>
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                          {line.productId?.name || "—"}
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                          {line.productId?.sku || "—"}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{line.quantityOrdered}</td>
                        <td className="px-6 py-4 text-teal-600 dark:text-teal-400">{line.quantityReserved}</td>
                        <td className="px-6 py-4">
                          <span className={`font-semibold ${line.quantityBackordered > 0 ? "text-amber-700 dark:text-amber-400" : "text-slate-400"}`}>
                            {line.quantityBackordered}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
