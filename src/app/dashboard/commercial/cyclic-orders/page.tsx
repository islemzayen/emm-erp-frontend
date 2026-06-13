"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { useEffect, useState } from "react";
import {
  cyclicOrderService,
  CyclicOrder,
  CreateCyclicOrderPayload,
} from "@/services/commercial/cyclicOrderService";
import { customerService, Customer } from "@/services/commercial/customerService";
import { stockProductService, StockProduct } from "@/services/stock/stockProductService";
import {
  RotateCcw,
  Plus,
  Pencil,
  ToggleLeft,
  ToggleRight,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";
const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400";

const FREQUENCY_PRESETS = [
  { label: "Monthly (30d)", value: 30 },
  { label: "Every 3 months (90d)", value: 90 },
  { label: "Every 6 months (180d)", value: 180 },
  { label: "Yearly (365d)", value: 365 },
];

const emptyForm: CreateCyclicOrderPayload = {
  customerId: "",
  customerName: "",
  productId: "",
  quantity: 1,
  frequencyDays: 90,
  nextDueDate: "",
  notes: "",
};

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

export default function CommercialCyclicOrdersPage() {
  const { t } = useLanguage();
  const [cyclics, setCyclics] = useState<CyclicOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CyclicOrder | null>(null);
  const [form, setForm] = useState<CreateCyclicOrderPayload>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");
      const [cyclicsData, customersData, productsData] = await Promise.all([
        cyclicOrderService.getAll(),
        customerService.getAll(),
        stockProductService.getAll(),
      ]);
      setCyclics(cyclicsData);
      setCustomers(customersData);
      setProducts(
        productsData.filter((product) => product.status === "ACTIVE" && product.type === "PRODUIT_FINI")
      );
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError, "Failed to load recurring customer orders"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setShowForm(true);
  };

  const openEdit = (cyclic: CyclicOrder) => {
    setEditing(cyclic);
    setForm({
      customerId: typeof cyclic.customerId === "object" ? cyclic.customerId?._id || "" : "",
      customerName: cyclic.customerName,
      productId: cyclic.productId._id,
      quantity: cyclic.quantity,
      frequencyDays: cyclic.frequencyDays,
      nextDueDate: cyclic.nextDueDate.slice(0, 10),
      notes: cyclic.notes || "",
    });
    setError("");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.customerId || !form.productId || !form.nextDueDate) {
      setError(t("customerRequiredProductDate"));
      return;
    }

    const customer = customers.find((entry) => entry._id === form.customerId);
    const payload = { ...form, customerName: customer?.name || form.customerName };

    try {
      setSaving(true);
      setError("");
      if (editing) {
        await cyclicOrderService.update(editing._id, {
          quantity: payload.quantity,
          frequencyDays: payload.frequencyDays,
          nextDueDate: payload.nextDueDate,
          notes: payload.notes,
        });
      } else {
        await cyclicOrderService.create(payload);
      }
      setShowForm(false);
      await fetchAll();
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError, "Failed to save recurring order"));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      setTogglingId(id);
      await cyclicOrderService.toggleActive(id);
      await fetchAll();
    } catch (toggleError: unknown) {
      setError(getErrorMessage(toggleError, "Failed to update recurring order"));
    } finally {
      setTogglingId(null);
    }
  };

  const now = new Date();
  const overdue = cyclics.filter((cyclic) => cyclic.active && new Date(cyclic.nextDueDate) <= now);
  const upcoming = cyclics.filter((cyclic) => cyclic.active && new Date(cyclic.nextDueDate) > now);
  const inactive = cyclics.filter((cyclic) => !cyclic.active);

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "COMMERCIAL_MANAGER"]}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Commercial · ERP
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <RotateCcw size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {t("recurringOrdersTitle")}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t("recurringOrdersSub")}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            <Plus size={15} /> {t("newRecurringOrder")}
          </button>
        </div>

        {error && !showForm && (
          <div className="flex items-start justify-between rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
            <button onClick={() => setError("")} className="ml-4 shrink-0 hover:opacity-70">
              <X size={14} />
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: t("overdueLabel"), value: overdue.length, color: "text-rose-600 dark:text-rose-400" },
            { label: t("upcomingLabel"), value: upcoming.length, color: "text-amber-600 dark:text-amber-400" },
            { label: t("inactiveCountLabel"), value: inactive.length, color: "text-slate-400" },
          ].map((item) => (
            <div key={item.label} className={`${surface} px-5 py-4`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
              <p className={`mt-2 text-3xl font-bold ${item.color}`}>{item.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-sky-200 bg-sky-50 px-6 py-4 text-sm text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/20 dark:text-sky-300">
          {t("recurringInfoText")}
        </div>

        {loading ? (
          <div className={`${surface} flex items-center justify-center gap-2 py-16 text-sm text-slate-400`}>
            <Loader2 size={18} className="animate-spin" /> Loading...
          </div>
        ) : cyclics.length === 0 ? (
          <div className={`${surface} flex flex-col items-center justify-center gap-2 py-16 text-sm text-slate-400`}>
            <RotateCcw size={32} className="opacity-30" />
            {t("noRecurringOrders")}
          </div>
        ) : (
          <div className={`${surface} overflow-hidden`}>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {cyclics.map((cyclic) => {
                const isOverdue = cyclic.active && new Date(cyclic.nextDueDate) <= now;
                const daysUntil = Math.ceil(
                  (new Date(cyclic.nextDueDate).getTime() - now.getTime()) / 86400000
                );

                return (
                  <div
                    key={cyclic._id}
                    className={`flex flex-wrap items-center gap-4 px-5 py-4 ${!cyclic.active ? "opacity-50" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900 dark:text-white">{cyclic.customerName}</p>
                        {isOverdue && (
                          <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                            <AlertCircle size={9} /> {t("overdueLabel")}
                          </span>
                        )}
                        {!isOverdue && cyclic.active && daysUntil <= 14 && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                            In {daysUntil}d
                          </span>
                        )}
                        {!cyclic.active && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400 dark:bg-slate-800">
                            {t("inactiveCountLabel")}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {cyclic.productId
                          ? `${cyclic.productId.name} (${cyclic.productId.sku})`
                          : "—"}{" "}
                        ·{" "}
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {cyclic.quantity} {cyclic.productId?.unit}
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        Every {cyclic.frequencyDays} days · Next:{" "}
                        {new Date(cyclic.nextDueDate).toLocaleDateString("fr-TN")}
                        {cyclic.lastFiredAt &&
                          ` · Last draft: ${new Date(cyclic.lastFiredAt).toLocaleDateString("fr-TN")}`}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => openEdit(cyclic)}
                        className="flex items-center gap-1 rounded-2xl border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <Pencil size={11} />
                      </button>
                      <button
                        onClick={() => handleToggle(cyclic._id)}
                        disabled={togglingId === cyclic._id}
                        className="flex items-center gap-1 rounded-2xl border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        {togglingId === cyclic._id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : cyclic.active ? (
                          <ToggleRight size={13} className="text-emerald-600" />
                        ) : (
                          <ToggleLeft size={13} />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                    <RotateCcw size={16} className="text-slate-600 dark:text-slate-300" />
                  </div>
                  <h2 className="text-base font-semibold text-slate-950 dark:text-white">
                    {editing ? t("editRecurringOrder") || `Edit ${t("newRecurringOrder")}` : t("newRecurringOrder")}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setError("");
                  }}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4 p-6">
                {!editing && (
                  <div>
                    <label className={labelClass}>{t("customerField")} *</label>
                    <select
                      value={form.customerId}
                      onChange={(event) => setForm({ ...form, customerId: event.target.value })}
                      className={inputClass}
                    >
                      <option value="">{t("selectLabel")}</option>
                      {customers
                        .filter((customer) => customer.active !== false)
                        .map((customer) => (
                          <option key={customer._id} value={customer._id}>
                            {customer.name}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {!editing && (
                  <div>
                    <label className={labelClass}>{t("productField")} *</label>
                    <select
                      value={form.productId}
                      onChange={(event) => setForm({ ...form, productId: event.target.value })}
                      className={inputClass}
                    >
                      <option value="">{t("selectLabel")}</option>
                      {products.map((product) => (
                        <option key={product._id} value={product._id}>
                          {product.name} ({product.sku})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>{t("quantityField")} *</label>
                    <input
                      type="number"
                      min={1}
                      value={form.quantity}
                      onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t("frequencyField")} *</label>
                    <select
                      value={form.frequencyDays}
                      onChange={(event) => setForm({ ...form, frequencyDays: Number(event.target.value) })}
                      className={inputClass}
                    >
                      {FREQUENCY_PRESETS.map((preset) => (
                        <option key={preset.value} value={preset.value}>
                          {preset.label}
                        </option>
                      ))}
                      <option value={form.frequencyDays}>Custom: {form.frequencyDays}d</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>{t("nextDateField")} *</label>
                  <input
                    type="date"
                    value={form.nextDueDate}
                    onChange={(event) => setForm({ ...form, nextDueDate: event.target.value })}
                    className={inputClass}
                  />
                </div>

                {error && (
                  <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
                    {error}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
                <button
                  onClick={() => {
                    setShowForm(false);
                    setError("");
                  }}
                  className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
