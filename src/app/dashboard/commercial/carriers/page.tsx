"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { carrierService, Carrier, CreateCarrierPayload } from "@/services/commercial/carrierService";
import { useEffect, useState } from "react";
import {
  Truck,
  Plus,
  Loader2,
  Search,
  X,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Phone,
  Mail,
} from "lucide-react";

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const emptyForm: CreateCarrierPayload = {
  name: "",
  code: "",
  contactEmail: "",
  contactPhone: "",
  baseRateFlat: 0,
  transitDays: 2,
  notes: "",
};

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

export default function CarriersPage() {
  const { t } = useLanguage();
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateCarrierPayload>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchCarriers = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await carrierService.getAll();
      setCarriers(data);
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to load carriers"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCarriers();
  }, []);

  const filtered = carriers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (carrier: Carrier) => {
    setEditingId(carrier._id);
    setForm({
      name: carrier.name,
      code: carrier.code,
      contactEmail: carrier.contactEmail || "",
      contactPhone: carrier.contactPhone || "",
      baseRateFlat: carrier.baseRateFlat,
      transitDays: carrier.transitDays ?? 2,
      notes: carrier.notes || "",
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      setError(t("nameAndCodeRequired"));
      return;
    }
    try {
      setSaving(true);
      setError("");
      if (editingId) {
        await carrierService.update(editingId, form);
      } else {
        await carrierService.create(form);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await fetchCarriers();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to save carrier"));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      setTogglingId(id);
      await carrierService.toggleActive(id);
      await fetchCarriers();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to toggle carrier"));
    } finally {
      setTogglingId(null);
    }
  };

  const activeCount = carriers.filter((c) => c.active).length;

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
                <Truck size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {t("carriersTitle") || "Carriers"}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t("carriersSub") || "Manage shipping carriers and rate configuration"}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
          >
            <Plus size={15} />
            {t("addCarrier") || "Add Carrier"}
          </button>
        </div>

        {error && (
          <div className="flex items-start justify-between rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
            <button onClick={() => setError("")} className="ml-4 shrink-0 hover:opacity-70">
              <X size={14} />
            </button>
          </div>
        )}

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {[
            { label: t("carriersKpi") || "Total Carriers", value: carriers.length, color: "text-slate-900 dark:text-white" },
            { label: t("active") || "Active", value: activeCount, color: "text-emerald-700 dark:text-emerald-400" },
            { label: t("inactive") || "Inactive", value: carriers.length - activeCount, color: "text-slate-400" },
          ].map((kpi) => (
            <div key={kpi.label} className={`${surface} px-6 py-5`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                {kpi.label}
              </p>
              <p className={`mt-2 text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Form panel */}
        {showForm && (
          <div className={`${surface} p-6`}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-semibold text-slate-950 dark:text-white">
                {editingId ? t("editCarrier") || "Edit Carrier" : t("addCarrier") || "Add Carrier"}
              </h2>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t("carrierName") || "Carrier Name"} *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: DHL Express"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t("codeLabel")} *
                </label>
                <input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="Ex: DHL"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t("contactEmail") || "Contact Email"}
                </label>
                <input
                  type="email"
                  value={form.contactEmail || ""}
                  onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                  placeholder="contact@carrier.com"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t("contactPhone") || "Contact Phone"}
                </label>
                <input
                  value={form.contactPhone || ""}
                  onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                  placeholder="+216 XX XXX XXX"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  {t("baseRateFlat") || "Flat Rate (TND)"}
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.baseRateFlat ?? 0}
                  onChange={(e) => setForm((f) => ({ ...f, baseRateFlat: parseFloat(e.target.value) || 0 }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  Transit Days
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={form.transitDays ?? 2}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      transitDays: parseInt(e.target.value || "0", 10) || 0,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950"
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                {t("save") || "Save"}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
                className="rounded-2xl border border-slate-200 px-5 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {t("cancel") || "Cancel"}
              </button>
            </div>
          </div>
        )}

        {/* Carriers list */}
        <div className={`${surface} overflow-hidden`}>
          <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-slate-950 dark:text-white">
              {t("carriersTitle") || "Carriers"}
              <span className="ml-2 text-sm font-normal text-slate-400">{filtered.length}</span>
            </h2>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchCarriers")}
                className="w-52 rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-xs text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> {t("loading")}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-slate-400 dark:text-slate-500">
              <Truck size={30} className="opacity-30" />
              {t("noCarriers") || "No carriers found"}
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((carrier) => (
                <div
                  key={carrier._id}
                  className="flex flex-wrap items-center gap-4 px-6 py-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                    <Truck size={16} className="text-slate-500 dark:text-slate-400" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {carrier.name}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        {carrier.code}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          carrier.active
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {carrier.active ? t("active") || "Active" : t("inactive") || "Inactive"}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-4 text-[11px] text-slate-400">
                      {carrier.contactEmail && (
                        <span className="flex items-center gap-1">
                          <Mail size={10} /> {carrier.contactEmail}
                        </span>
                      )}
                      {carrier.contactPhone && (
                        <span className="flex items-center gap-1">
                          <Phone size={10} /> {carrier.contactPhone}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                    <p>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {carrier.baseRateFlat.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} TND
                      </span>{" "}
                      {t("flatRate") || "flat"}
                    </p>
                    <p className="mt-1">
                      Transit: <span className="font-medium text-slate-900 dark:text-white">{carrier.transitDays ?? 2}</span> day(s)
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => openEdit(carrier)}
                      className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Edit2 size={11} />
                      {t("edit") || "Edit"}
                    </button>
                    <button
                      onClick={() => handleToggle(carrier._id)}
                      disabled={togglingId === carrier._id}
                      className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
                        carrier.active
                          ? "bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400"
                          : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400"
                      }`}
                    >
                      {togglingId === carrier._id ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : carrier.active ? (
                        <ToggleRight size={11} />
                      ) : (
                        <ToggleLeft size={11} />
                      )}
                      {carrier.active ? t("deactivate") || "Deactivate" : t("activate") || "Activate"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
