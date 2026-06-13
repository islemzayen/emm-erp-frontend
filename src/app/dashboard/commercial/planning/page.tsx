"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import {
  deliveryPlanService,
  DeliveryPlan,
  CreateDeliveryPlanPayload,
  DeliveryPlanType,
} from "@/services/commercial/deliveryPlanService";
import { customerService } from "@/services/commercial/customerService";
import type { Customer } from "@/services/commercial/customerService";
import { SalesOrder } from "@/services/commercial/salesOrderService";
import { carrierService, Carrier } from "@/services/commercial/carrierService";
import { vehicleService, Vehicle } from "@/services/commercial/vehicleService";
import {
  getAllDiscoverableZones,
  getCustomerRegionKey,
  getCustomerRegionLabel,
  normalizeRegionValue,
} from "@/lib/regionHierarchy";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Gauge,
  Loader2,
  Plus,
  X,
  Truck,
  CheckCircle,
  PlayCircle,
  XCircle,
  ChevronDown,
  Package,
  MapPin,
} from "lucide-react";

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

function getErrorMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "data" in error.response &&
    error.response.data &&
    typeof error.response.data === "object" &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    PLANNED:
      "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    IN_PROGRESS:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    COMPLETED:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    RETURNED:
      "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    CANCELLED:
      "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  };
  return map[status] ?? "bg-slate-100 text-slate-600";
}

const TUNISIA_GOVERNORATES = [
  "Ariana","Béja","Ben Arous","Bizerte","Gabès","Gafsa","Jendouba",
  "Kairouan","Kasserine","Kébili","Le Kef","Mahdia","La Manouba","Médenine",
  "Monastir","Nabeul","Sfax","Sidi Bouzid","Siliana","Sousse",
  "Tataouine","Tozeur","Tunis","Zaghouan",
];

const emptyForm = (): CreateDeliveryPlanPayload => ({
  planDate: new Date().toISOString().slice(0, 10),
  carrierId: "",
  zone: "",
  startDate: new Date().toISOString().slice(0, 10),
  fuelAddedLiters: 0,
  livreurName: "",
  orderIds: [],
  notes: "",
  planType: "SHIPMENT",
});

function planNoPreview(planDate: string) {
  if (!planDate) return "Auto: PLAN-1-03/2026, PLAN-2-03/2026...";
  const date = new Date(planDate);
  if (Number.isNaN(date.getTime())) return "Auto";
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear());
  return `Auto: PLAN-1-${month}/${year}, PLAN-2-${month}/${year}...`;
}

export default function PlanningPage() {
  const { t } = useLanguage();

  const [plans, setPlans] = useState<DeliveryPlan[]>([]);
  const [unassigned, setUnassigned] = useState<SalesOrder[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [coveredGovs, setCoveredGovs] = useState<string[]>([]);
  const [discoveredGovs, setDiscoveredGovs] = useState<string[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateDeliveryPlanPayload>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [returnPlanId, setReturnPlanId] = useState<string | null>(null);
  const [returnOrderId, setReturnOrderId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [completePlanId, setCompletePlanId] = useState<string | null>(null);
  const [completeKm, setCompleteKm] = useState<string>("");

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");
      const [plansData, unassignedData, discoveredGovsData, carriersData, vehiclesData, customersData] = await Promise.all([
        deliveryPlanService.getAll(),
        deliveryPlanService.getUnassigned(),
        deliveryPlanService.getDiscoveredZones(),
        carrierService.getActive(),
        vehicleService.getActive(),
        customerService.getAll(),
      ]);
      setPlans(plansData);
      setUnassigned(unassignedData);
      setDiscoveredGovs(discoveredGovsData);
      setCarriers(carriersData);
      setVehicles(vehiclesData);
      setCustomers(customersData);
      const customerRegions = [
        ...new Set(customersData.map((customer) => getCustomerRegionLabel(customer)).filter(Boolean)),
      ];
      setCoveredGovs(customerRegions as string[]);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load planning data"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const toggleOrder = (orderId: string) => {
    setForm((f) => {
      const ids = f.orderIds || [];
      return {
        ...f,
        orderIds: ids.includes(orderId)
          ? ids.filter((id) => id !== orderId)
          : [...ids, orderId],
      };
    });
  };

  const availableDiscoverGovs = useMemo(() => {
    const discovered = new Set(discoveredGovs.map((zone) => normalizeRegionValue(zone)));
    const covered = new Set(coveredGovs.map((zone) => normalizeRegionValue(zone)));
    return getAllDiscoverableZones().filter((zone) => {
      const key = normalizeRegionValue(zone);
      return !discovered.has(key) && !covered.has(key);
    });
  }, [coveredGovs, discoveredGovs]);

  const shipmentGovs = useMemo(
    () =>
      [...new Set(coveredGovs.map((gov) => String(gov).trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [coveredGovs]
  );

  const customerByName = useMemo(
    () =>
      new Map(
        customers.map((customer) => [customer.name.trim().toLowerCase(), customer] as const)
      ),
    [customers]
  );

  const deliveryPlaceLabel = (order: SalesOrder) => {
    if (order.shipmentAddress?.trim()) return order.shipmentAddress.trim();
    const customer = customerByName.get(order.customerName.trim().toLowerCase());
    if (!customer) return "Destination not set";

    const parts = [customer.address, customer.city, getCustomerRegionLabel(customer)]
      .map((value) => String(value || "").trim())
      .filter(Boolean);

    return parts.length > 0 ? parts.join(", ") : "Destination not set";
  };

  const orderRegionLabel = (order: SalesOrder) => {
    const customer = customerByName.get(order.customerName.trim().toLowerCase());
    return customer ? getCustomerRegionLabel(customer) : "";
  };

  const filteredUnassigned = useMemo(() => {
    if (form.planType !== "SHIPMENT" || !form.zone?.trim()) {
      return unassigned;
    }

    const selected = normalizeRegionValue(form.zone);
    return unassigned.filter((order) => normalizeRegionValue(orderRegionLabel(order)) === selected);
  }, [form.planType, form.zone, unassigned, customerByName]);

  const selectedOrders = useMemo(
    () => filteredUnassigned.filter((order) => (form.orderIds || []).includes(order._id)),
    [filteredUnassigned, form.orderIds]
  );

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle._id === form.vehicleId) || null,
    [form.vehicleId, vehicles]
  );

  const selectedPackets = useMemo(
    () =>
      selectedOrders.reduce(
        (sum, order) =>
          sum +
          order.lines.reduce((lineSum, line) => lineSum + Math.max(0, Number(line.quantity || 0)), 0),
        0
      ),
    [selectedOrders]
  );

  const capacityExceeded = Boolean(
    form.planType === "SHIPMENT" &&
      selectedVehicle &&
      selectedVehicle.capacityPackets > 0 &&
      selectedPackets > selectedVehicle.capacityPackets
  );

  useEffect(() => {
    if (form.planType !== "SHIPMENT" || !form.zone?.trim()) return;

    const allowedIds = new Set(filteredUnassigned.map((order) => order._id));
    setForm((current) => ({
      ...current,
      orderIds: (current.orderIds || []).filter((id) => allowedIds.has(id)),
    }));
  }, [filteredUnassigned, form.planType, form.zone]);

  const kpis = useMemo(() => ({
    total: plans.length,
    planned: plans.filter((p) => p.status === "PLANNED").length,
    inProgress: plans.filter((p) => p.status === "IN_PROGRESS").length,
    completed: plans.filter((p) => p.status === "COMPLETED").length,
    returned: plans.filter((p) => p.status === "RETURNED").length,
    unassigned: filteredUnassigned.length,
  }), [filteredUnassigned.length, plans]);

  const handleCreate = async () => {
    if (!form.planDate) {
      setError("Plan date is required");
      return;
    }
    if (form.planType === "DISCOVER" && !form.zone) {
      setError("Zone is required for discover plans");
      return;
    }
    if (form.planType === "SHIPMENT" && capacityExceeded) {
      setError(
        `Vehicle capacity exceeded: ${selectedVehicle?.capacityPackets || 0} units max, ${selectedPackets} selected`
      );
      return;
    }
    try {
      setSaving(true);
      setError("");
      await deliveryPlanService.create({
        ...form,
        carrierId: form.carrierId || undefined,
        vehicleId: form.vehicleId || undefined,
      });
      setShowForm(false);
      setForm(emptyForm());
      await fetchAll();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to create plan"));
    } finally {
      setSaving(false);
    }
  };

  const handleStart = async (id: string) => {
    try {
      setActionId(id);
      await deliveryPlanService.start(id);
      await fetchAll();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to start delivery"));
    } finally {
      setActionId(null);
    }
  };

  const handleComplete = async (id: string, km: number) => {
    try {
      setActionId(id);
      await deliveryPlanService.complete(id, km);
      await fetchAll();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to complete delivery"));
    } finally {
      setActionId(null);
      setCompletePlanId(null);
      setCompleteKm("");
    }
  };

  const handleReturn = async (id: string, reason: string, orderId?: string | null) => {
    try {
      setActionId(id);
      await deliveryPlanService.returnPlan(id, reason, orderId || undefined);
      await fetchAll();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to return delivery"));
    } finally {
      setActionId(null);
      setReturnPlanId(null);
      setReturnOrderId(null);
      setReturnReason("");
    }
  };

  const handleCancel = async (id: string) => {
    try {
      setActionId(id);
      await deliveryPlanService.cancel(id);
      await fetchAll();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to cancel plan"));
    } finally {
      setActionId(null);
    }
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
                <CalendarDays size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {t("deliveryPlanning") || "Delivery Planning"}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t("deliveryPlanningSub") || "Schedule and group prepared orders for delivery runs"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setShowForm(true); setForm(emptyForm()); }}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
            >
              <Plus size={15} />
              {t("newPlan") || "New Plan"}
            </button>
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

        {returnPlanId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
            <div className={`${surface} w-full max-w-lg p-6`}>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                  Return reason
                </h2>
                <button
                  onClick={() => {
                    setReturnPlanId(null);
                    setReturnOrderId(null);
                    setReturnReason("");
                  }}
                  className="text-slate-400 transition hover:text-slate-700 dark:hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
                Type the reason before creating the return request for this order.
              </p>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                rows={4}
                placeholder="Reason for return"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => handleReturn(returnPlanId, returnReason, returnOrderId)}
                  disabled={!returnReason.trim() || actionId === returnPlanId}
                  className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
                >
                  {actionId === returnPlanId && <Loader2 size={14} className="animate-spin" />}
                  Confirm return
                </button>
                <button
                  onClick={() => {
                    setReturnPlanId(null);
                    setReturnOrderId(null);
                    setReturnReason("");
                  }}
                  className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Complete delivery — km modal */}
        {completePlanId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
            <div className={`${surface} w-full max-w-sm p-6`}>
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                  <Gauge size={18} />
                </div>
                <div>
                  <p className="font-bold text-slate-950 dark:text-white">Terminer la livraison</p>
                  <p className="text-xs text-slate-400">Entrez les kilomètres parcourus</p>
                </div>
              </div>

              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Kilométrage (km)
              </label>
              <input
                type="number"
                min={0}
                step="0.1"
                value={completeKm}
                onChange={(e) => setCompleteKm(e.target.value)}
                placeholder="ex: 142.5"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                autoFocus
              />

              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => { setCompletePlanId(null); setCompleteKm(""); }}
                  className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  onClick={() => void handleComplete(completePlanId, Number(completeKm) || 0)}
                  disabled={!completeKm || Number(completeKm) < 0 || actionId === completePlanId}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {actionId === completePlanId ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
          {[
            { label: t("totalPlans") || "Total Plans", value: kpis.total, color: "text-slate-900 dark:text-white" },
            { label: t("planned") || "Planned", value: kpis.planned, color: "text-blue-700 dark:text-blue-400" },
            { label: t("inProgress") || "In Progress", value: kpis.inProgress, color: "text-amber-700 dark:text-amber-400" },
            { label: t("completedDeliveries") || "Completed", value: kpis.completed, color: "text-emerald-700 dark:text-emerald-400" },
            { label: "Returned", value: kpis.returned, color: "text-rose-600 dark:text-rose-400" },
            { label: t("unassignedOrders") || "Orders Ready For Delivery", value: kpis.unassigned, color: kpis.unassigned > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400" },
          ].map((kpi) => (
            <div key={kpi.label} className={`${surface} px-5 py-4`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                {kpi.label}
              </p>
              <p className={`mt-2 text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          {/* Orders ready for delivery */}
          <div className={`${surface} overflow-hidden`}>
            <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <h2 className="font-semibold text-slate-950 dark:text-white">
                {t("unassignedOrders") || "Orders Ready For Delivery"}
                <span className="ml-2 text-sm font-normal text-slate-400">
                  {filteredUnassigned.length}
                </span>
              </h2>
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                Orders ready after preparation and picking validation
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                <Loader2 size={14} className="animate-spin" /> {t("loading")}
              </div>
            ) : filteredUnassigned.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-slate-400 dark:text-slate-500">
                <CheckCircle size={28} className="text-emerald-400 opacity-60" />
                {form.planType === "SHIPMENT" && form.zone
                  ? "No ready orders found in this region"
                  : "All ready orders are assigned"}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUnassigned.map((order) => (
                  <div key={order._id} className="px-6 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {order.orderNo}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {order.customerName}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                          Deliver to: {deliveryPlaceLabel(order)}
                        </p>
                      </div>
                      <div className="text-right text-[11px] text-slate-400">
                        {order.preparedAt && (
                          <p>{new Date(order.preparedAt).toLocaleDateString("fr-TN")}</p>
                        )}
                        {order.carrierId && (
                          <p className="flex items-center gap-1 justify-end">
                            <Truck size={9} />
                            {order.carrierId?.code}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Plans list */}
          <div className="xl:col-span-2 space-y-4">
            {/* New plan form */}
            {showForm && (
              <div className={`${surface} p-6`}>
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="font-semibold text-slate-950 dark:text-white">
                    {t("newPlan") || "New Delivery Plan"}
                  </h2>
                  <button
                    onClick={() => setShowForm(false)}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Plan type toggle */}
                <div className="mb-5 flex gap-2">
                  {(["SHIPMENT", "DISCOVER"] as const).map((type: DeliveryPlanType) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          planType: type,
                          zone: "",
                          orderIds: [],
                          carrierId: type === "DISCOVER" ? "" : f.carrierId,
                          vehicleId: type === "DISCOVER" ? "" : f.vehicleId,
                        }))
                      }
                      className={`flex-1 rounded-2xl border py-2.5 text-sm font-medium transition ${
                        form.planType === type
                          ? type === "SHIPMENT"
                            ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                            : "border-amber-500 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                      }`}
                    >
                      {type === "SHIPMENT" ? t("deliveryPlanLabel") : t("explorationPlanLabel")}
                    </button>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                      {t("planNo") || "Plan No."}
                    </label>
                    <input
                      value={planNoPreview(form.planDate)}
                      disabled
                      className="w-full cursor-not-allowed rounded-2xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-500 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                      End Date *
                    </label>
                    <input
                      type="date"
                      value={form.planDate}
                      onChange={(e) => setForm((f) => ({ ...f, planDate: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                      {t("startDateLabel")}
                    </label>
                    <input
                      type="date"
                      value={form.startDate || ""}
                      onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                      {t("carrier") || "Carrier"}
                    </label>
                    <select
                      value={form.carrierId || ""}
                      onChange={(e) => setForm((f) => ({ ...f, carrierId: e.target.value }))}
                      disabled={form.planType === "DISCOVER"}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    >
                      <option value="">— {t("carrier") || "Carrier"} —</option>
                      {carriers.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                      Vehicle
                    </label>
                    <select
                      value={form.vehicleId || ""}
                      onChange={(e) => setForm((f) => ({ ...f, vehicleId: e.target.value }))}
                      disabled={form.planType === "DISCOVER"}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    >
                      <option value="">— Vehicle —</option>
                      {vehicles.map((vehicle) => (
                        <option key={vehicle._id} value={vehicle._id}>
                          {vehicle.matricule}
                        </option>
                      ))}
                    </select>
                    {form.planType === "SHIPMENT" && selectedVehicle ? (
                      <p
                        className={`mt-1 text-[11px] ${
                          capacityExceeded
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        Capacity: {selectedVehicle.capacityPackets} units · Selected: {selectedPackets}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                      {t("zone") || "Zone / Région"}
                    </label>
                    <select
                      value={form.zone || ""}
                      onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    >
                      <option value="">{t("selectRegionPlaceholder")}</option>
                      {(form.planType === "DISCOVER" ? availableDiscoverGovs : shipmentGovs).map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                    {form.planType === "DISCOVER" ? (
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {availableDiscoverGovs.length} / {getAllDiscoverableZones().length} zones are still not discovered.
                      </p>
                    ) : shipmentGovs.length > 0 && (
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {shipmentGovs.length} zones currently have customers.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                      Fuel Added (L)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={form.fuelAddedLiters ?? 0}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          fuelAddedLiters: Math.max(0, Number(e.target.value || 0)),
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                </div>

                {/* Livreur */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    Livreur
                  </label>
                  <input
                    type="text"
                    value={form.livreurName ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, livreurName: e.target.value }))}
                    placeholder="Nom du livreur"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  />
                </div>

                {/* Order selection — only for SHIPMENT plans */}
                {form.planType === "SHIPMENT" && filteredUnassigned.length > 0 && (
                  <div className="mt-4">
                    <label className="mb-2 block text-xs font-medium text-slate-600 dark:text-slate-300">
                      {t("selectOrders") || "Select orders to include"}{" "}
                      <span className="text-slate-400">({form.orderIds?.length || 0} selected)</span>
                    </label>
                    <div className="max-h-48 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredUnassigned.map((order) => {
                        const selected = (form.orderIds || []).includes(order._id);
                        return (
                          <button
                            key={order._id}
                            type="button"
                            onClick={() => toggleOrder(order._id)}
                            className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition ${
                              selected
                                ? "bg-blue-50 dark:bg-blue-950/30"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                            }`}
                          >
                            <div
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                selected
                                  ? "border-blue-500 bg-blue-500"
                                  : "border-slate-300 dark:border-slate-600"
                              }`}
                            >
                              {selected && (
                                <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                                  <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="font-medium text-slate-900 dark:text-white">
                                {order.orderNo}
                              </span>
                              <span className="ml-2 text-slate-500 dark:text-slate-400">
                                {order.customerName}
                              </span>
                            </div>
                            {order.carrierId && (
                              <span className="shrink-0 text-[10px] text-slate-400">
                                {order.carrierId?.code}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={handleCreate}
                    disabled={saving || capacityExceeded}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950"
                  >
                    {saving && <Loader2 size={13} className="animate-spin" />}
                    {t("createPlan") || "Create Plan"}
                  </button>
                  <button
                    onClick={() => setShowForm(false)}
                    className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {t("cancel") || "Cancel"}
                  </button>
                </div>
              </div>
            )}

            {/* Plans */}
            {loading ? (
              <div className={`${surface} flex items-center justify-center gap-2 py-16 text-sm text-slate-500`}>
                <Loader2 size={16} className="animate-spin" /> {t("loading")}
              </div>
            ) : plans.length === 0 ? (
              <div className={`${surface} flex flex-col items-center justify-center gap-2 py-16 text-sm text-slate-400 dark:text-slate-500`}>
                <CalendarDays size={32} className="opacity-30" />
                {t("noPlans") || "No delivery plans yet"}
              </div>
            ) : (
              plans.map((plan) => {
                const isExpanded = expandedId === plan._id;
                const busy = actionId === plan._id;
                return (
                  <div key={plan._id} className={`${surface} overflow-hidden`}>
                    <div className="flex flex-wrap items-center gap-4 px-6 py-4">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : plan._id)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                      >
                        <ChevronDown
                          size={14}
                          className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {plan.planNo}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusBadge(plan.status)}`}
                          >
                            {plan.status.replace("_", " ")}
                          </span>
                          {plan.planType === "DISCOVER" && (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                              Découverte
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <CalendarDays size={10} />
                            {new Date(plan.planDate).toLocaleDateString("fr-TN")}
                          </span>
                          {plan.startDate && (
                            <span className="flex items-center gap-1">
                              <CalendarDays size={10} />
                              Start: {new Date(plan.startDate).toLocaleDateString("fr-TN")}
                            </span>
                          )}
                          {plan.zone && (
                            <span className="flex items-center gap-1">
                              <MapPin size={10} /> {plan.zone}
                            </span>
                          )}
                          {plan.carrierId && (
                            <span className="flex items-center gap-1">
                              <Truck size={10} /> {plan.carrierId?.name}
                            </span>
                          )}
                          {plan.vehicleId && (
                            <span className="flex items-center gap-1">
                              <Truck size={10} /> {plan.vehicleId.matricule}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            Fuel:{" "}
                            {Number(plan.fuelAddedLiters || 0).toLocaleString("fr-TN", {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            })}{" "}
                            L
                          </span>
                          {plan.distanceKm != null && (
                            <span className="flex items-center gap-1">
                              <Gauge size={10} />
                              {Number(plan.distanceKm).toLocaleString("fr-TN", {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1,
                              })}{" "}
                              km
                            </span>
                          )}
                          {plan.planType === "SHIPMENT" ? (
                            <span className="flex items-center gap-1">
                              <Package size={10} /> {plan.orderIds.length} orders
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <MapPin size={10} /> {t("explorationPlanLabel")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {plan.status === "PLANNED" && (
                          <button
                            onClick={() => handleStart(plan._id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-600 disabled:opacity-50"
                          >
                            {busy ? <Loader2 size={11} className="animate-spin" /> : <PlayCircle size={11} />}
                            {t("startDelivery") || "Start"}
                          </button>
                        )}
                        {plan.status === "IN_PROGRESS" && (
                          <>
                            <button
                              onClick={() => { setCompletePlanId(plan._id); setCompleteKm(""); }}
                              disabled={busy}
                              className="inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {busy ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                              {t("completeDelivery") || "Complete & Deliver"}
                            </button>
                          </>
                        )}
                        {(plan.status === "PLANNED" || plan.status === "IN_PROGRESS") && (
                          <button
                            onClick={() => handleCancel(plan._id)}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-200 px-3 py-1.5 text-xs text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900/40 dark:text-rose-400"
                          >
                            {busy ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                            {t("cancel") || "Cancel"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expanded order list */}
                    {isExpanded && plan.orderIds.length > 0 && (
                      <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          {t("orders") || "Orders"}
                        </p>
                        <div className="space-y-2">
                          {plan.orderIds.map((order) => {
                            const returnedOrderIds = new Set(
                              (plan.returnedOrderIds || []).map((value) =>
                                typeof value === "string" ? value : value._id
                              )
                            );
                            const orderReturnedInPlan = returnedOrderIds.has(order._id);
                            const total = order.lines.reduce(
                              (sum, l) => sum + l.quantity * l.unitPrice,
                              0
                            );
                            return (
                              <div
                                key={order._id}
                                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
                              >
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                                    {order.orderNo}
                                  </p>
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge(order.status)}`}>
                                      {order.status}
                                    </span>
                                  </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {order.customerName}
                                </p>
                                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                                  Deliver to: {deliveryPlaceLabel(order)}
                                </p>
                              </div>
                                <div className="text-right text-xs text-slate-500">
                                  <p className="font-medium text-slate-900 dark:text-white">
                                    {total.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} TND
                                  </p>
                                  <p>{order.lines.length} line{order.lines.length !== 1 ? "s" : ""}</p>
                                  {plan.status === "IN_PROGRESS" && !orderReturnedInPlan && (
                                    <button
                                      onClick={() => {
                                        setReturnPlanId(plan._id);
                                        setReturnOrderId(order._id);
                                        setReturnReason("");
                                      }}
                                      disabled={busy}
                                      className="mt-2 inline-flex items-center gap-1.5 rounded-2xl bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
                                    >
                                      {busy ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                                      Returned
                                    </button>
                                  )}
                                  {orderReturnedInPlan && (
                                    <p className="mt-2 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                                      Return created
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {plan.completedAt && (
                          <p className="mt-3 text-[11px] text-emerald-600 dark:text-emerald-400">
                            Completed {new Date(plan.completedAt).toLocaleDateString("fr-TN")}
                          </p>
                        )}
                        <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                          Fuel added:{" "}
                          {Number(plan.fuelAddedLiters || 0).toLocaleString("fr-TN", {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}{" "}
                          L
                        </p>
                        {plan.returnedAt && (
                          <p className="mt-3 text-[11px] text-rose-600 dark:text-rose-400">
                            Returned {new Date(plan.returnedAt).toLocaleDateString("fr-TN")}
                          </p>
                        )}
                        {plan.rmaIds && plan.rmaIds.length > 0 && (
                          <div className="mt-3 space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              Returns
                            </p>
                            {plan.rmaIds.map((rma) => (
                              <p key={rma._id} className="text-[11px] text-rose-600 dark:text-rose-400">
                                {rma.rmaNo} · {rma.orderNo}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
