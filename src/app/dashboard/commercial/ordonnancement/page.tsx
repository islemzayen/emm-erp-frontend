"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import {
  salesOrderService,
  type SalesOrder,
  type SalesOrderOrdonnanceLinePayload,
} from "@/services/commercial/salesOrderService";
import { stockDepotService, type Depot } from "@/services/stock/stockDepotService";
import { stockItemService } from "@/services/stock/stockItemService";
import { vehicleService } from "@/services/commercial/vehicleService";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Factory,
  Lock,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Suspense } from "react";

type StockItem = {
  productId: {
    _id: string;
    sku: string;
    name: string;
    type: "PRODUIT_FINI" | "SOUS_ENSEMBLE" | "COMPOSANT" | "MATIERE_PREMIERE";
  };
  quantityAvailable: number;
};

type DraftOrder = SalesOrder & {
  lines: (SalesOrder["lines"][number] & {
    productId: NonNullable<SalesOrder["lines"][number]["productId"]>;
  })[];
};

type AllocationRow = {
  depotId: string;
  allocatedQuantity: number;
};

type DraftLineState = {
  allocations: AllocationRow[];
};

type DraftState = {
  plannedStartDate: string;
  plannedEndDate: string;
  lines: Record<string, DraftLineState>;
};

const surface =
  "rounded-[28px] border border-slate-200/90 bg-white/95 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95";
const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white";
const sideWidth = 260;
const dayCount = 14;

function hasProduct(
  line: SalesOrder["lines"][number]
): line is DraftOrder["lines"][number] {
  return Boolean(line.productId);
}

function getWeekStart(date: Date) {
  const value = new Date(date);
  const diff = value.getDay() === 0 ? -6 : 1 - value.getDay();
  value.setDate(value.getDate() + diff);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dayLabel(date: Date) {
  return date
    .toLocaleDateString("fr-TN", { weekday: "short" })
    .slice(0, 1)
    .toUpperCase();
}

function weekNumber(date: Date) {
  const firstWeek = getWeekStart(new Date(date.getFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - firstWeek.getTime()) / 86400000) + 1) / 7);
}

function orderBarClass(order: DraftOrder, risk: boolean) {
  if (risk) return "bg-red-500 text-white";
  if (order.isUrgent) return "bg-red-600 text-white";
  if (order.source === "RECURRING") return "bg-violet-500 text-white";
  return "bg-slate-950 text-white dark:bg-white dark:text-slate-950";
}

function lineKey(lineIndex: number) {
  return String(lineIndex);
}

function totalAllocated(allocations: AllocationRow[] = []) {
  return allocations.reduce(
    (sum, allocation) => sum + Math.max(0, Number(allocation.allocatedQuantity || 0)),
    0
  );
}

function normalizeAllocations(allocations: AllocationRow[]) {
  return allocations.filter(
    (allocation) =>
      allocation.depotId && Math.max(0, Number(allocation.allocatedQuantity || 0)) > 0
  );
}

function OrdonnancementContent() {
  const params = useSearchParams();
  const focusId = params.get("order");

  const [orders, setOrders] = useState<DraftOrder[]>([]);
  const [stockByProduct, setStockByProduct] = useState<Record<string, number>>({});
  const [stockByProductDepot, setStockByProductDepot] = useState<Record<string, number>>({});
  const [depots, setDepots] = useState<Depot[]>([]);
  const [maxVehicleCapacity, setMaxVehicleCapacity] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestingProduction, setRequestingProduction] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async (preserveSelectedId?: string | null, clearSelection = false) => {
    try {
      setLoading(true);
      setError("");

      const [orderData, itemData, depotData, vehicleData] = await Promise.all([
        salesOrderService.getAll(),
        stockItemService.getAll(),
        stockDepotService.getAll(),
        vehicleService.getActive(),
      ]);

      const maxCapacity = vehicleData.reduce(
        (max, vehicle) => Math.max(max, Number(vehicle.capacityPackets || 0)),
        0
      );
      setMaxVehicleCapacity(maxCapacity);

      const visibleOrders = (orderData as SalesOrder[])
        .filter((order) => {
          if (order.status === "DELIVERED") return false;
          return order.status === "CONFIRMED" || order.status === "ORDONNANCED";
        })
        .map((order) => ({
          ...order,
          lines: order.lines.filter(hasProduct),
        }))
        .filter((order) => order.lines.length > 0)
        .sort((a, b) => Number(Boolean(b.isUrgent)) - Number(Boolean(a.isUrgent)));

      const productIds = Array.from(
        new Set(
          visibleOrders.flatMap((order) => order.lines.map((line) => line.productId._id))
        )
      );
      const depotAvailability = await stockItemService.getAvailabilityByDepot(productIds);

      setOrders(visibleOrders);
      setStockByProduct(
        Object.fromEntries(
          (itemData as StockItem[])
            .filter((item) => Boolean(item.productId?._id))
            .map((item) => [item.productId._id, item.quantityAvailable || 0])
        )
      );
      setStockByProductDepot(
        Object.fromEntries(
          depotAvailability.rows
            .filter((row) => row.depotId)
            .map((row) => [`${row.productId}::${row.depotId}`, row.quantityAvailable || 0])
        )
      );
      setDepots((depotData as Depot[]).filter((depot) => depot.status === "ACTIVE"));
      setDrafts(
        Object.fromEntries(
          visibleOrders.map((order) => [
            order._id,
            {
              plannedStartDate: toDateInput(
                new Date(order.plannedStartDate || order.createdAt || Date.now())
              ),
              plannedEndDate: toDateInput(
                new Date(
                  order.plannedEndDate ||
                    addDays(new Date(order.plannedStartDate || order.createdAt || Date.now()), 2)
                )
              ),
              lines: Object.fromEntries(
                order.lines.map((line, index) => [
                  lineKey(index),
                  {
                    allocations:
                      line.depotId && (line.allocatedQuantity || 0) > 0
                        ? [
                            {
                              depotId: line.depotId._id,
                              allocatedQuantity: line.allocatedQuantity || 0,
                            },
                          ]
                        : [],
                  },
                ])
              ),
            },
          ])
        )
      );

      if (clearSelection) {
        setSelectedId(null);
      } else {
        const keptId = preserveSelectedId && visibleOrders.find((o) => o._id === preserveSelectedId)?._id;
        const initialSelected =
          keptId ||
          (focusId && visibleOrders.find((order) => order._id === focusId)?._id) ||
          visibleOrders[0]?._id ||
          null;
        setSelectedId(initialSelected);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load ordonnancement");
    } finally {
      setLoading(false);
    }
  }, [focusId]);

  useEffect(() => { void load(); }, [load]);

  const days = useMemo(
    () => Array.from({ length: dayCount }, (_, index) => addDays(weekStart, index)),
    [weekStart]
  );

  const totalAllocatedByProduct = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const order of orders) {
      const draft = drafts[order._id];
      if (!draft) continue;
      order.lines.forEach((line, index) => {
        const key = lineKey(index);
        const product = line.productId!;
        totals[product._id] =
          (totals[product._id] || 0) +
          totalAllocated(draft.lines[key]?.allocations || []);
      });
    }
    return totals;
  }, [drafts, orders]);

  const totalAllocatedByProductDepot = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const order of orders) {
      const draft = drafts[order._id];
      if (!draft) continue;
      order.lines.forEach((line, index) => {
        const product = line.productId!;
        for (const allocation of draft.lines[lineKey(index)]?.allocations || []) {
          if (!allocation.depotId) continue;
          const key = `${product._id}::${allocation.depotId}`;
          totals[key] = (totals[key] || 0) + (allocation.allocatedQuantity || 0);
        }
      });
    }
    return totals;
  }, [drafts, orders]);

  const selectedOrder = orders.find((order) => order._id === selectedId) || null;
  const selectedDraft = selectedOrder ? drafts[selectedOrder._id] : null;
  const isReadOnly = selectedOrder?.status === "ORDONNANCED";

  const getCompatibleDepots = (productType?: string) =>
    depots.filter((depot) => {
      const wantsMp = productType === "MATIERE_PREMIERE";
      if (depot.productTypeScope === "MP_PF") return true;
      if (wantsMp) return depot.productTypeScope === "MP";
      return depot.productTypeScope === "PF";
    });

  const getAllocationContext = (
    productId: string,
    depotId: string,
    currentQty: number
  ) => {
    const productDepotKey = `${productId}::${depotId}`;
    const globalRemaining = Math.max(
      0,
      (stockByProduct[productId] || 0) -
        ((totalAllocatedByProduct[productId] || 0) - currentQty)
    );
    const depotRemaining = Math.max(
      0,
      (stockByProductDepot[productDepotKey] || 0) -
        ((totalAllocatedByProductDepot[productDepotKey] || 0) - currentQty)
    );
    return {
      globalRemaining,
      depotRemaining,
      effectiveRemaining: Math.min(globalRemaining, depotRemaining),
    };
  };

  const buildPayloadLines = (order: DraftOrder): SalesOrderOrdonnanceLinePayload[] =>
    order.lines.map((line, index) => {
      const product = line.productId!;
      return {
        lineIndex: index,
        productId: product._id,
        allocations: normalizeAllocations(
          drafts[order._id]?.lines[lineKey(index)]?.allocations || []
        ),
      };
    });

  const saveBoard = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await salesOrderService.ordonanceBulk({
        orders: orders.map((order) => ({
          orderId: order._id,
          plannedStartDate: drafts[order._id].plannedStartDate,
          plannedEndDate: drafts[order._id].plannedEndDate,
          lines: buildPayloadLines(order),
        })),
      });

      setSuccess("Ordonnancement saved.");
      await load(null, true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save ordonnancement");
    } finally {
      setSaving(false);
    }
  };

  const requestProduction = async () => {
    if (!selectedOrder) return;

    try {
      setRequestingProduction(true);
      setError("");
      setSuccess("");

      await salesOrderService.requestProduction(selectedOrder._id, {
        lines: buildPayloadLines(selectedOrder),
      });

      setSuccess("Production request created. You can follow it in Backorders.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to request production");
    } finally {
      setRequestingProduction(false);
    }
  };

  const setOrderDate = (
    orderId: string,
    key: "plannedStartDate" | "plannedEndDate",
    value: string
  ) => {
    setDrafts((current) => ({
      ...current,
      [orderId]: {
        ...current[orderId],
        [key]: value,
      },
    }));
  };

  const addAllocationRow = (orderId: string, lineIndex: number) => {
    const key = lineKey(lineIndex);
    setDrafts((current) => ({
      ...current,
      [orderId]: {
        ...current[orderId],
        lines: {
          ...current[orderId].lines,
          [key]: {
            allocations: [...(current[orderId].lines[key]?.allocations || []), { depotId: "", allocatedQuantity: 0 }],
          },
        },
      },
    }));
  };

  const removeAllocationRow = (orderId: string, lineIndex: number, allocationIndex: number) => {
    const key = lineKey(lineIndex);
    setDrafts((current) => ({
      ...current,
      [orderId]: {
        ...current[orderId],
        lines: {
          ...current[orderId].lines,
          [key]: {
            allocations: (current[orderId].lines[key]?.allocations || []).filter(
              (_, index) => index !== allocationIndex
            ),
          },
        },
      },
    }));
  };

  const updateAllocation = (
    orderId: string,
    lineIndex: number,
    allocationIndex: number,
    patch: Partial<AllocationRow>
  ) => {
    const order = orders.find((entry) => entry._id === orderId);
    const line = order?.lines[lineIndex];
    if (!line) return;

    const key = lineKey(lineIndex);
    const currentAllocations = drafts[orderId]?.lines[key]?.allocations || [];
    const currentAllocation = currentAllocations[allocationIndex] || {
      depotId: "",
      allocatedQuantity: 0,
    };
    const nextAllocation = { ...currentAllocation, ...patch };
    const normalizedQty = Math.max(0, Number(nextAllocation.allocatedQuantity || 0));
    const nextAllocations = currentAllocations.map((allocation, index) =>
      index === allocationIndex
        ? { depotId: nextAllocation.depotId, allocatedQuantity: normalizedQty }
        : allocation
    );

    const totalWithoutCurrent = totalAllocated(nextAllocations) - normalizedQty;
    let cappedQty = Math.min(normalizedQty, Math.max(0, line.quantity - totalWithoutCurrent));

    // Cap by the largest active vehicle's packet capacity — a single allocation
    // cannot exceed what the biggest available vehicle can carry.
    if (maxVehicleCapacity > 0) {
      cappedQty = Math.min(cappedQty, maxVehicleCapacity);
    }

    if (nextAllocation.depotId) {
      const product = line.productId!;
      const context = getAllocationContext(
        product._id,
        nextAllocation.depotId,
        currentAllocation.allocatedQuantity || 0
      );
      cappedQty = Math.min(cappedQty, context.effectiveRemaining);
    }

    nextAllocations[allocationIndex] = {
      depotId: nextAllocation.depotId,
      allocatedQuantity: cappedQty,
    };

    setDrafts((current) => ({
      ...current,
      [orderId]: {
        ...current[orderId],
        lines: {
          ...current[orderId].lines,
          [key]: { allocations: nextAllocations },
        },
      },
    }));
  };

  const hasRisk = (order: DraftOrder) => {
    const draft = drafts[order._id];
    if (!draft) return false;

    const lateRisk =
      Boolean(order.promisedDate) &&
      new Date(draft.plannedEndDate) > new Date(order.promisedDate as string);
    const shortageRisk =
      Boolean(order.isUrgent) &&
      order.lines.some((line, index) => {
        const allocated = totalAllocated(draft.lines[lineKey(index)]?.allocations || []);
        return allocated < line.quantity;
      });

    return lateRisk || shortageRisk;
  };

  const getBarStyle = (order: DraftOrder) => {
    const draft = drafts[order._id];
    if (!draft) return null;

    const startDate = new Date(draft.plannedStartDate);
    const endDate = new Date(draft.plannedEndDate);
    const rangeStart = days[0];
    const rangeEnd = addDays(days[days.length - 1], 1);

    if (endDate < rangeStart || startDate > rangeEnd) return null;

    const visibleStart = startDate < rangeStart ? rangeStart : startDate;
    const visibleEnd = endDate > rangeEnd ? rangeEnd : endDate;
    const leftDays = (visibleStart.getTime() - rangeStart.getTime()) / 86400000;
    const widthDays = Math.max(1, (visibleEnd.getTime() - visibleStart.getTime()) / 86400000 + 1);

    return {
      left: `${(leftDays / dayCount) * 100}%`,
      width: `${(widthDays / dayCount) * 100}%`,
    };
  };

  const canRequestProduction = useMemo(() => {
    if (!selectedOrder || !selectedDraft) return false;

    return selectedOrder.lines.some((line, index) => {
      const product = line.productId!;
      const allocated = totalAllocated(selectedDraft.lines[lineKey(index)]?.allocations || []);
      const remainingQty = Math.max(0, line.quantity - allocated);
      if (remainingQty <= 0) return false;
      const remainingGlobal = Math.max(
        0,
        (stockByProduct[product._id] || 0) -
          ((totalAllocatedByProduct[product._id] || 0) - allocated)
      );
      return remainingGlobal <= 0;
    });
  }, [selectedDraft, selectedOrder, stockByProduct, totalAllocatedByProduct]);

  const blockingIssues = useMemo(() => {
    return orders.flatMap((order) => {
      const draft = drafts[order._id];
      if (!draft) return [];

      const issues: string[] = [];
      if (!draft.plannedStartDate || !draft.plannedEndDate) {
        issues.push(`${order.orderNo}: missing planned dates`);
      }
      if (
        draft.plannedStartDate &&
        draft.plannedEndDate &&
        new Date(draft.plannedEndDate) < new Date(draft.plannedStartDate)
      ) {
        issues.push(`${order.orderNo}: end date is before start date`);
      }

      order.lines.forEach((line, index) => {
        const product = line.productId!;
        const allocations = draft.lines[lineKey(index)]?.allocations || [];
        if (totalAllocated(allocations) > line.quantity) {
          issues.push(`${order.orderNo}: allocated quantity exceeds ordered quantity for ${product.name}`);
        }
        allocations.forEach((allocation) => {
          if (allocation.allocatedQuantity > 0 && !allocation.depotId) {
            issues.push(`${order.orderNo}: select a depot for ${product.name}`);
          }
        });
      });

      return issues;
    });
  }, [drafts, orders]);

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "COMMERCIAL_MANAGER"]}>
      <div className="space-y-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Commercial · ERP
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              Ordonnancement
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Split each line across depots, keep remaining demand visible, and prepare each
              depot quantity separately before packing validation.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setWeekStart((value) => addDays(value, -7))}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <ChevronLeft size={16} />
              Prev. week
            </button>

            <div className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-white">
              Week {weekNumber(weekStart)} -{" "}
              {days[0].toLocaleDateString("fr-TN", { month: "short", day: "numeric" })} /{" "}
              {days[days.length - 1].toLocaleDateString("fr-TN", { month: "short", day: "numeric" })}
            </div>

            <button
              onClick={() => setWeekStart((value) => addDays(value, 7))}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Next week
              <ChevronRight size={16} />
            </button>

            <button
              onClick={saveBoard}
              disabled={saving || loading || orders.length === 0 || blockingIssues.length > 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Save board
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        ) : null}

        {!error && blockingIssues.length > 0 ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
            Save is blocked until these planning issues are fixed: {blockingIssues[0]}
            {blockingIssues.length > 1 ? ` (+${blockingIssues.length - 1} more)` : ""}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
            {success}
          </div>
        ) : null}

        {loading ? (
          <div className={`${surface} flex items-center justify-center gap-2 py-20 text-sm text-slate-500 dark:text-slate-400`}>
            <Loader2 size={18} className="animate-spin" />
            Loading ordonnancement...
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className={`${surface} overflow-hidden`}>
              <div
                className="grid border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/60"
                style={{ gridTemplateColumns: `${sideWidth}px repeat(${dayCount}, minmax(0, 1fr))` }}
              >
                <div className="px-6 py-5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  Order / Customer
                </div>
                {days.map((day) => (
                  <div
                    key={day.toISOString()}
                    className="border-l border-slate-200 px-2 py-4 text-center dark:border-slate-800"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      {dayLabel(day)}
                    </div>
                    <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                      {day.getDate()}
                    </div>
                  </div>
                ))}
              </div>

              {!orders.length ? (
                <div className="py-20 text-center text-sm text-slate-500 dark:text-slate-400">
                  No plannable orders to show.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {orders.map((order) => {
                    const bar = getBarStyle(order);
                    const risk = hasRisk(order);
                    const draft = drafts[order._id];
                    const allocatedQty = order.lines.reduce(
                      (sum, _, index) => sum + totalAllocated(draft?.lines[lineKey(index)]?.allocations || []),
                      0
                    );

                    return (
                      <button
                        key={order._id}
                        onClick={() => setSelectedId(order._id)}
                        className={`grid w-full text-left transition hover:bg-slate-50/80 dark:hover:bg-slate-950/40 ${
                          selectedId === order._id ? "bg-slate-50 dark:bg-slate-950/40" : ""
                        }`}
                        style={{ gridTemplateColumns: `${sideWidth}px repeat(${dayCount}, minmax(0, 1fr))` }}
                      >
                        <div className="border-r border-slate-200 px-6 py-5 dark:border-slate-800">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-lg font-bold text-slate-950 dark:text-white">
                                {order.orderNo}
                              </p>
                              <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                                {order.customerName}
                              </p>
                              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                {allocatedQty} allocated ·{" "}
                                {order.lines.reduce((sum, line) => sum + line.quantity, 0)} ordered
                              </p>
                            </div>

                            {risk ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
                                <AlertTriangle size={11} />
                                {order.isUrgent ? "Urgent" : "Risk"}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="relative col-span-14">
                          <div
                            className="absolute inset-0 grid"
                            style={{ gridTemplateColumns: `repeat(${dayCount}, minmax(0, 1fr))` }}
                          >
                            {days.map((day) => (
                              <div
                                key={`${order._id}-${day.toISOString()}`}
                                className="border-l border-slate-100 dark:border-slate-800"
                              />
                            ))}
                          </div>

                          {bar ? (
                            <div
                              className={`absolute inset-y-4 rounded-2xl px-4 text-sm font-semibold shadow-[0_14px_30px_-16px_rgba(15,23,42,0.45)] ${orderBarClass(order, risk)}`}
                              style={bar}
                            >
                              <div className="flex h-11 items-center justify-between gap-3">
                                <span>{order.orderNo}</span>
                                <span className="hidden text-[11px] font-medium text-white/80 md:inline">
                                  {order.lines.length} lines
                                </span>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={`${surface} p-6`}>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Planning panel
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Split each line by depot. Each depot quantity will later appear separately in preparation.
              </p>
              {!selectedOrder || !selectedDraft ? (
                <div className="mt-10 rounded-3xl border border-dashed border-slate-300 bg-slate-50/70 px-6 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
                  Select a row from the board.
                </div>
              ) : (
                <div className="mt-6 space-y-5">
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={requestProduction}
                      disabled={isReadOnly || requestingProduction || !canRequestProduction}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
                    >
                      {requestingProduction ? (
                        <Loader2 size={15} className="animate-spin" />
                      ) : (
                        <Factory size={15} />
                      )}
                      Request production
                    </button>
                    {!canRequestProduction && !isReadOnly ? (
                      <p className="self-center text-xs text-slate-500 dark:text-slate-400">
                        Production request is available only when remaining stock is 0.
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        {selectedOrder.orderNo}
                      </p>
                      {isReadOnly && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          <Lock size={10} />
                          Ordonnancé
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-lg font-bold text-slate-950 dark:text-white">
                      {selectedOrder.customerName}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        Start
                      </label>
                      <input
                        type="date"
                        className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
                        value={selectedDraft.plannedStartDate}
                        disabled={isReadOnly}
                        onChange={(event) =>
                          setOrderDate(selectedOrder._id, "plannedStartDate", event.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        End
                      </label>
                      <input
                        type="date"
                        className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
                        value={selectedDraft.plannedEndDate}
                        disabled={isReadOnly}
                        onChange={(event) =>
                          setOrderDate(selectedOrder._id, "plannedEndDate", event.target.value)
                        }
                      />
                    </div>
                  </div>

                  {selectedOrder.lines.map((line, index) => {
                    const product = line.productId!;
                    const key = lineKey(index);
                    const lineState = selectedDraft.lines[key] || { allocations: [] };
                    const allocations = lineState.allocations;
                    const allocated = totalAllocated(allocations);
                    const production = Math.max(0, line.quantity - allocated);
                    const remainingGlobal = Math.max(
                      0,
                      (stockByProduct[product._id] || 0) -
                        ((totalAllocatedByProduct[product._id] || 0) - allocated)
                    );
                    const compatibleDepots = getCompatibleDepots(product.type);
                    const visibleAllocations =
                      allocations.length > 0 ? allocations : [{ depotId: "", allocatedQuantity: 0 }];

                    return (
                      <div
                        key={`${selectedOrder._id}-${key}`}
                        className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {product.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {product.sku}
                            </p>
                          </div>
                          <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                            <div>
                              Ordered:{" "}
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {line.quantity}
                              </span>
                            </div>
                            <div>
                              Global stock:{" "}
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {remainingGlobal}
                              </span>
                            </div>
                            <div>
                              Production:{" "}
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {production}
                              </span>
                            </div>
                            {maxVehicleCapacity > 0 ? (
                              <div>
                                Max / véhicule:{" "}
                                <span className="font-semibold text-slate-900 dark:text-white">
                                  {maxVehicleCapacity}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          {visibleAllocations.map((allocation, allocationIndex) => {
                            const optionMap: Record<string, number> = {};
                            compatibleDepots.forEach((depot) => {
                              const context = getAllocationContext(
                                product._id,
                                depot._id,
                                allocation.depotId === depot._id ? allocation.allocatedQuantity : 0
                              );
                              optionMap[depot._id] = context.effectiveRemaining;
                            });

                            return (
                              <div
                                key={`${key}-${allocationIndex}`}
                                className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950"
                              >
                                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px_42px]">
                                  <select
                                    className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
                                    value={allocation.depotId}
                                    disabled={isReadOnly}
                                    onChange={(event) =>
                                      updateAllocation(selectedOrder._id, index, allocationIndex, {
                                        depotId: event.target.value,
                                      })
                                    }
                                  >
                                    <option value="">Select depot</option>
                                    {compatibleDepots.map((depot) => (
                                      <option key={depot._id} value={depot._id}>
                                        {depot.name} ({optionMap[depot._id] || 0} available)
                                      </option>
                                    ))}
                                  </select>

                                  <input
                                    type="number"
                                    min={0}
                                    max={
                                      maxVehicleCapacity > 0
                                        ? Math.min(line.quantity, maxVehicleCapacity)
                                        : line.quantity
                                    }
                                    className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
                                    value={allocation.allocatedQuantity}
                                    disabled={isReadOnly}
                                    onChange={(event) =>
                                      updateAllocation(selectedOrder._id, index, allocationIndex, {
                                        allocatedQuantity: Number(event.target.value),
                                      })
                                    }
                                  />

                                  <button
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() =>
                                      removeAllocationRow(selectedOrder._id, index, allocationIndex)
                                    }
                                    className="inline-flex h-[46px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>

                                {allocation.depotId ? (
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Depot available:{" "}
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                      {optionMap[allocation.depotId] || 0}
                                    </span>
                                  </p>
                                ) : null}
                              </div>
                            );
                          })}

                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => addAllocationRow(selectedOrder._id, index)}
                              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              <Plus size={14} />
                              Add depot split
                            </button>
                          )}
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-3 text-center text-xs">
                          <div className="rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-950">
                            <div className="text-slate-500 dark:text-slate-400">Ordered</div>
                            <div className="mt-1 font-semibold text-slate-900 dark:text-white">
                              {line.quantity}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-800/70">
                            <div className="text-slate-500 dark:text-slate-400">Allocated</div>
                            <div className="mt-1 font-semibold text-slate-900 dark:text-white">
                              {allocated}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-amber-50 px-3 py-2 dark:bg-amber-950/20">
                            <div className="text-slate-500 dark:text-slate-400">Production</div>
                            <div className="mt-1 font-semibold text-amber-700 dark:text-amber-300">
                              {production}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
export default function OrdonnancementPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin" />
        Loading...
      </div>
    }>
      <OrdonnancementContent />
    </Suspense>
  );
}