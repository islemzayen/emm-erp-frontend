"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle,
  Factory,
  Loader2,
  PlayCircle,
  Settings,
  X,
} from "lucide-react";
import { backorderService, BackOrder } from "@/services/commercial/backorderService";
import {
  productionOrderService,
  ProductionOrder,
} from "@/services/production/productionOrderService";
import { workCenterService, WorkCenter } from "@/services/production/workCenterService";

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const priorityColor: Record<string, string> = {
  URGENT: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  HIGH: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  NORMAL: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  LOW: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

const statusColor: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  SCHEDULED: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  IN_PROGRESS: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  COMPLETED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  CANCELLED: "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500",
};

type Tab = "needs" | "orders";

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
  return fallback;
}

export default function ProductionPage() {
  const [tab, setTab] = useState<Tab>("needs");
  const [backorders, setBackorders] = useState<BackOrder[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [generatedResult, setGeneratedResult] = useState<Record<string, number>>({});
  const [scheduleForm, setScheduleForm] = useState<{
    orderId: string;
    workCenterId: string;
    scheduledStart: string;
    scheduledEnd: string;
  } | null>(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");
      const [backorderData, orderData, workCenterData] = await Promise.all([
        backorderService.getAll(),
        productionOrderService.getAll(),
        workCenterService.getActive(),
      ]);
      setBackorders(backorderData);
      setOrders(orderData);
      setWorkCenters(workCenterData);
    } catch {
      setError("Erreur lors du chargement des donnees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const pendingBackorders = useMemo(
    () => backorders.filter((backorder) => backorder.status === "PENDING"),
    [backorders]
  );

  const filteredOrders = useMemo(
    () => (statusFilter === "ALL" ? orders : orders.filter((order) => order.status === statusFilter)),
    [orders, statusFilter]
  );

  const handleGenerate = async (backorderId: string) => {
    try {
      setGeneratingId(backorderId);
      const result = await productionOrderService.createFromBackorder(backorderId);
      setGeneratedResult((prev) => ({ ...prev, [backorderId]: result.orders.length }));
      setTab("orders");
      await fetchAll();
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Erreur lors de la generation"));
    } finally {
      setGeneratingId(null);
    }
  };

  const handleAction = async (type: "start" | "complete" | "cancel", id: string) => {
    try {
      setActionId(id);
      if (type === "start") await productionOrderService.start(id);
      if (type === "complete") await productionOrderService.complete(id);
      if (type === "cancel") await productionOrderService.cancel(id);
      await fetchAll();
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Erreur"));
    } finally {
      setActionId(null);
    }
  };

  const handleSchedule = async () => {
    if (!scheduleForm) return;
    try {
      setActionId(scheduleForm.orderId);
      await productionOrderService.schedule(scheduleForm.orderId, {
        workCenterId: scheduleForm.workCenterId,
        scheduledStart: scheduleForm.scheduledStart,
        scheduledEnd: scheduleForm.scheduledEnd,
      });
      setScheduleForm(null);
      await fetchAll();
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Erreur"));
    } finally {
      setActionId(null);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "STOCK_MANAGER", "COMMERCIAL_MANAGER"]}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Production · ERP
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <Factory size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  Support Production
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Minimal execution support for shortages coming from commercial backorders.
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/dashboard/production/work-centers"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Settings size={14} /> Centres
            </Link>
          </div>
        </div>

        {error && (
          <div className="flex items-start justify-between rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
            <button onClick={() => setError("")} className="ml-4 shrink-0 hover:opacity-70">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
          {[
            { id: "needs" as Tab, label: "Besoins Production", badge: pendingBackorders.length },
            { id: "orders" as Tab, label: "Ordres", badge: orders.filter((o) => o.status === "IN_PROGRESS").length },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-xs font-medium transition ${
                tab === item.id
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              }`}
            >
              {item.label}
              {item.badge > 0 && (
                <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className={`${surface} flex items-center justify-center gap-2 py-20 text-sm text-slate-400`}>
            <Loader2 size={18} className="animate-spin" /> Chargement...
          </div>
        ) : (
          <>
            {tab === "needs" && (
              <div className="space-y-4">
                {pendingBackorders.length === 0 ? (
                  <div className={`${surface} py-16 text-center text-sm text-slate-400`}>
                    Aucun besoin de production en attente.
                  </div>
                ) : (
                  pendingBackorders.map((backorder) => {
                    const totalQty = backorder.lines.reduce((sum, line) => sum + line.quantityBackordered, 0);
                    const isExpanded = expandedId === backorder._id;
                    const generated = generatedResult[backorder._id];
                    return (
                      <div key={backorder._id} className={`${surface} overflow-hidden`}>
                        <div className="flex flex-wrap items-start gap-4 p-5">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : backorder._id)}
                            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            {isExpanded ? "-" : "+"}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-white">{backorder.orderNo}</span>
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                {backorder.status}
                              </span>
                              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                                Reliquat
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {backorder.customerName} · {backorder.lines.length} ligne{backorder.lines.length > 1 ? "s" : ""} · {totalQty} unites a produire
                            </p>
                            {backorder.salesOrderId && (
                              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                                Commande source: {backorder.salesOrderId.orderNo}
                              </p>
                            )}
                            {generated !== undefined && (
                              <p className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400">
                                {generated} ordre{generated !== 1 ? "s" : ""} genere{generated !== 1 ? "s" : ""}.
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleGenerate(backorder._id)}
                            disabled={generatingId === backorder._id}
                            className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-xs font-medium text-white transition hover:bg-slate-800 disabled:opacity-40 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                          >
                            {generatingId === backorder._id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Factory size={12} />
                            )}
                            Generer Production
                          </button>
                        </div>
                        {isExpanded && (
                          <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                            <div className="space-y-2">
                              {backorder.lines.map((line, index) => (
                                <div
                                  key={`${backorder._id}-${line.productId?._id ?? index}`}
                                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                                >
                                  <div>
                                    <p className="font-medium text-slate-900 dark:text-white">
                                      {line.productId?.name || "Produit supprime"}
                                    </p>
                                    <p className="text-xs text-slate-500">{line.productId?.sku || "Sans SKU"}</p>
                                  </div>
                                  <div className="text-right text-xs text-slate-500">
                                    <p>Commande: {line.quantityOrdered}</p>
                                    <p>Reserve: {line.quantityReserved}</p>
                                    <p className="font-medium text-rose-600 dark:text-rose-400">
                                      A produire: {line.quantityBackordered}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {tab === "orders" && (
              <div className={`${surface} overflow-hidden`}>
                <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                  {["ALL", "DRAFT", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        statusFilter === status
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {status === "ALL" ? "Tous" : status.replace("_", " ")}
                    </button>
                  ))}
                </div>
                {filteredOrders.length === 0 ? (
                  <div className="py-16 text-center text-sm text-slate-400">Aucun ordre.</div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredOrders.map((order) => (
                      <div key={order._id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-white">{order.orderNo}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor[order.status]}`}>
                              {order.status.replace("_", " ")}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityColor[order.priority]}`}>
                              {order.priority}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {order.productId.name} · {order.quantity} {order.productId.unit}
                            {order.workCenterId ? ` · ${order.workCenterId.name}` : ""}
                            {order.scheduledStart
                              ? ` · Prevu ${new Date(order.scheduledStart).toLocaleDateString("fr-TN")}`
                              : ""}
                          </p>
                          {order.backorderId && (
                            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                              Reliquat source: {order.backorderId.orderNo}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          {order.status === "DRAFT" && (
                            <button
                              onClick={() =>
                                setScheduleForm({
                                  orderId: order._id,
                                  workCenterId: "",
                                  scheduledStart: "",
                                  scheduledEnd: "",
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-2xl border border-blue-200 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:text-blue-400"
                            >
                              <CalendarDays size={11} /> Planifier
                            </button>
                          )}
                          {order.status === "SCHEDULED" && (
                            <button
                              onClick={() => handleAction("start", order._id)}
                              disabled={actionId === order._id}
                              className="inline-flex items-center gap-1 rounded-2xl bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                            >
                              {actionId === order._id ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <PlayCircle size={11} />
                              )}
                              Demarrer
                            </button>
                          )}
                          {order.status === "IN_PROGRESS" && (
                            <button
                              onClick={() => handleAction("complete", order._id)}
                              disabled={actionId === order._id}
                              className="inline-flex items-center gap-1 rounded-2xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {actionId === order._id ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <CheckCircle size={11} />
                              )}
                              Terminer
                            </button>
                          )}
                          {["DRAFT", "SCHEDULED", "IN_PROGRESS"].includes(order.status) && (
                            <button
                              onClick={() => handleAction("cancel", order._id)}
                              disabled={actionId === order._id}
                              className="inline-flex items-center gap-1 rounded-2xl border border-rose-200 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/40 dark:text-rose-400"
                            >
                              <X size={11} /> Annuler
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {scheduleForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                <h2 className="font-semibold text-slate-950 dark:text-white">Planifier l&apos;ordre</h2>
                <button onClick={() => setScheduleForm(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-4 p-6">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Centre de travail
                  </label>
                  <select
                    value={scheduleForm.workCenterId}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, workCenterId: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  >
                    <option value="">Selectionner</option>
                    {workCenters.map((workCenter) => (
                      <option key={workCenter._id} value={workCenter._id}>
                        {workCenter.name} ({workCenter.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Date debut
                  </label>
                  <input
                    type="date"
                    value={scheduleForm.scheduledStart}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledStart: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Date fin
                  </label>
                  <input
                    type="date"
                    value={scheduleForm.scheduledEnd}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledEnd: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
                <button
                  onClick={() => setScheduleForm(null)}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSchedule}
                  disabled={!!actionId}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950"
                >
                  {actionId ? <Loader2 size={13} className="animate-spin" /> : null}
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
