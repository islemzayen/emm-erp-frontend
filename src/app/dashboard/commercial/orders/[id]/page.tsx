"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { salesOrderService, SalesOrder } from "@/services/commercial/salesOrderService";
import { rmaService } from "@/services/commercial/rmaService";
import { useParams } from "next/navigation";
import { useLanguage } from "@/context/LanguageContext";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Loader2,
  Package,
  RotateCcw,
  ShoppingCart,
  ShieldCheck,
  ShieldX,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const statusColors: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  ORDONNANCED: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  CONFIRMED: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  PREPARED: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  SHIPPED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  DELIVERED: "bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
  RETURNED: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  CLOSED: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  CANCELLED: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
};

function lineAmount(line: { quantity: number; unitPrice: number; discount?: number }) {
  const subtotal = line.quantity * (line.unitPrice || 0);
  return subtotal * (1 - Math.min(100, Math.max(0, line.discount || 0)) / 100);
}

function isLate(order: SalesOrder): boolean {
  if (!order.promisedDate) return false;
  if (["DELIVERED", "RETURNED", "CLOSED", "CANCELLED"].includes(order.status)) return false;
  return new Date(order.promisedDate) < new Date();
}

function hasPlanningRisk(order: SalesOrder): boolean {
  if (!order.promisedDate || !order.plannedEndDate) return false;
  return new Date(order.plannedEndDate) > new Date(order.promisedDate);
}

function getErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object" &&
    (error as { response?: { data?: unknown } }).response !== null
  ) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === "string") {
      return response.data.message;
    }
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export default function CommercialOrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const isManager = user?.role === "ADMIN" || user?.role === "COMMERCIAL_MANAGER";

  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [canCloseReturned, setCanCloseReturned] = useState(false);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      setError("");
      const [data, rmas] = await Promise.all([
        salesOrderService.getById(params.id),
        rmaService.getAll(),
      ]);
      setOrder(data);
      const relatedRmas = rmas.filter((rma) => rma.salesOrderId?._id === params.id);
      setCanCloseReturned(
        relatedRmas.length > 0 && relatedRmas.every((rma) => rma.status === "CLOSED")
      );
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to load order"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) fetchOrder();
  }, [params.id]);

  const total = useMemo(() => {
    if (!order) return 0;
    return order.lines.reduce((sum, line) => sum + lineAmount(line), 0);
  }, [order]);

  const runAction = async (fn: () => Promise<unknown>) => {
    try {
      setActionId("busy");
      setError("");
      await fn();
      await fetchOrder();
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Action failed"));
    } finally {
      setActionId(null);
    }
  };

  const busy = actionId === "busy";

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "COMMERCIAL_MANAGER"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <ShoppingCart size={18} className="text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Commercial · ERP
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              {t("orderDetailsTitle")}
            </h1>
          </div>
        </div>

        <Link
          href="/dashboard/commercial/orders"
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
        ) : !order ? (
          <div className={`${surface} px-6 py-12 text-sm text-slate-500`}>{t("noOrdersYet")}</div>
        ) : (
          <>
            <div className="grid gap-6 xl:grid-cols-3">
              {/* Main info card */}
              <div className={`${surface} p-6 xl:col-span-2`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      {t("orderNumber")}
                    </p>
                    <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                      {order.orderNo}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {order.customerName}
                    </p>
                    {(order.plannedStartDate || order.plannedEndDate) && (
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                        {order.plannedStartDate
                          ? `${t("plannedStartLabel")}: ${new Date(order.plannedStartDate).toLocaleDateString("fr-TN")}`
                          : ""}
                        {order.plannedStartDate && order.plannedEndDate ? " · " : ""}
                        {order.plannedEndDate
                          ? `${t("plannedEndLabel")}: ${new Date(order.plannedEndDate).toLocaleDateString("fr-TN")}`
                          : ""}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {order.source === "RECURRING" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                        {t("recurringLabel")}
                      </span>
                    )}
                    {order.splitFromOrderId && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-950 px-2.5 py-1 text-xs font-semibold text-white dark:bg-white dark:text-slate-950">
                        Split Order
                      </span>
                    )}
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors[order.status] ?? statusColors.DRAFT}`}>
                      {order.status}
                    </span>
                    {order.isUrgent && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">
                        <Zap size={11} /> {t("urgent")}
                      </span>
                    )}
                    {isLate(order) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                        <Clock size={11} /> {t("lateStatus")}
                      </span>
                    )}
                    {hasPlanningRisk(order) && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                        <Clock size={11} /> {t("planningRiskLabel")}
                      </span>
                    )}
                    {order.isUrgent && order.shipApproval?.status === "PENDING" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                        <Clock size={11} /> {t("awaitingApprovalBadge")}
                      </span>
                    )}
                    {order.isUrgent && order.shipApproval?.status === "APPROVED" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                        <ShieldCheck size={11} /> {t("shipApprovedBadge")}
                      </span>
                    )}
                    {order.isUrgent && order.shipApproval?.status === "REJECTED" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
                        <ShieldX size={11} /> {t("approvalRejectedBadge")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Timestamps */}
                <div className="mt-5 flex flex-wrap gap-4 text-[11px] text-slate-500 dark:text-slate-400">
                  {order.createdAt && <span>{t("createdOnLabel")}: {new Date(order.createdAt).toLocaleDateString("fr-TN")}</span>}
                  {order.promisedDate && (
                    <span className={isLate(order) ? "text-rose-500 dark:text-rose-400" : ""}>
                      {t("promisedDateLabel")}: {new Date(order.promisedDate).toLocaleDateString("fr-TN")}
                    </span>
                  )}
                  {order.preparedAt && <span>{t("preparedOnLabel")}: {new Date(order.preparedAt).toLocaleDateString("fr-TN")}</span>}
                  {order.shippedAt && <span>{t("shippedOnLabel")}: {new Date(order.shippedAt).toLocaleDateString("fr-TN")}</span>}
                  {order.deliveredAt && <span>{t("deliveredOnLabel")}: {new Date(order.deliveredAt).toLocaleDateString("fr-TN")}</span>}
                  {order.closedAt && <span>{t("closedAtLabel")}: {new Date(order.closedAt).toLocaleDateString("fr-TN")}</span>}
                  {order.vehicleId?.matricule && <span>{t("carrier")}: {order.vehicleId.matricule}</span>}
                  {!order.vehicleId?.matricule && order.trackingNumber && <span>{t("trackingNo")}: {order.trackingNumber}</span>}
                </div>

                {order.isUrgent && order.shipApproval?.status === "REJECTED" && order.shipApproval.rejectionReason && (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
                    {t("rejectionReason")}: {order.shipApproval.rejectionReason}
                  </div>
                )}

                {order.notes && (
                  <div className="mt-4 rounded-2xl border border-slate-100 p-4 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
                    {order.notes}
                  </div>
                )}
                {order.splitFromOrderId && (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                    This order was created from a split waiting quantity.
                  </div>
                )}
              </div>

              {/* Right panel: total + actions */}
              <div className="space-y-4">
                <div className={`${surface} p-6`}>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    {t("totalLabel")}
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
                    {total.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} TND
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {order.lines.length} {t("lineCountLabel")}
                  </p>
                </div>

                {/* Actions */}
                <div className={`${surface} p-6`}>
                  <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    {t("actionsPanelTitle")}
                  </p>
                  <div className="flex flex-col gap-2">
                    {/* Confirm DRAFT */}
                    {order.status === "DRAFT" && isManager && (
                      <button
                        onClick={() => runAction(() => salesOrderService.confirm(order._id))}
                        disabled={busy}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                        {t("confirm")}
                      </button>
                    )}

                    {order.status === "CONFIRMED" && isManager && (
                      <Link
                        href={`/dashboard/commercial/ordonnancement?order=${order._id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-amber-600"
                      >
                        <Clock size={14} />
                        {t("ordonanceAction")}
                      </Link>
                    )}

                    {/* Mark / unmark urgent */}
                    {isManager && !["SHIPPED", "DELIVERED", "CLOSED", "CANCELLED"].includes(order.status) && (
                      <button
                        onClick={() => runAction(() => salesOrderService.markUrgent(order._id, !order.isUrgent))}
                        disabled={busy}
                        className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 ${
                          order.isUrgent
                            ? "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-400"
                            : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        }`}
                      >
                        <Zap size={14} />
                        {order.isUrgent ? t("unmarkUrgent") : t("markUrgent")}
                      </button>
                    )}

                    {order.status === "ORDONNANCED" && (
                      <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <Package size={14} />
                        {t("preparationPageTitle") || "Preparation"}
                      </span>
                    )}

                    {order.isUrgent && order.shipApproval?.status === "PENDING" && (
                      <span className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
                        <Clock size={14} />
                        {t("awaitingApproval")}
                      </span>
                    )}

                    {isManager && order.isUrgent && order.shipApproval?.status === "PENDING" && (
                      <Link
                        href="/dashboard/commercial/approvals"
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                      >
                        <ShieldCheck size={14} />
                        {t("approvalQueueTitle")}
                      </Link>
                    )}

                    {order.status === "DELIVERED" && isManager && canCloseReturned && (
                      <button
                        onClick={() => runAction(() => salesOrderService.markReturned(order._id))}
                        disabled={busy}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                        Returned
                      </button>
                    )}

                    {isManager && order.status === "DELIVERED" && (
                      <button
                        onClick={() => runAction(() => salesOrderService.reorder(order._id))}
                        disabled={busy}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                      >
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
                        Reorder
                      </button>
                    )}

                    {/* Cancel: managers only, before ordonnancement */}
                    {isManager && order.status === "DRAFT" && (
                      <button
                        onClick={() => runAction(() => salesOrderService.cancel(order._id))}
                        disabled={busy}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400"
                      >
                        <XCircle size={14} /> {t("cancel")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Order Lines */}
            <div className={`${surface} overflow-hidden`}>
              <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                <h2 className="font-semibold text-slate-950 dark:text-white">{t("orderLines")}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                      {[t("product"), "SKU", t("quantity"), t("unitPrice"), "Remise %", t("amount")].map((h) => (
                        <th key={h} className="px-6 py-3 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {order.lines.map((line, idx) => (
                      <tr key={idx}>
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                          {line.productId?.name || "—"}
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                          {line.productId?.sku || "—"}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{line.quantity}</td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                          {line.unitPrice.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} TND
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{line.discount || 0}%</td>
                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                          {lineAmount(line).toLocaleString("fr-TN", { minimumFractionDigits: 2 })} TND
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 dark:border-slate-800">
                      <td colSpan={5} className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t("totalTnd")}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-950 dark:text-white">
                        {total.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} TND
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
