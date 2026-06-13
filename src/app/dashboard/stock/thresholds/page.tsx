"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { stockThresholdService } from "@/services/stock/stockThresholdService";
import { stockProductService } from "@/services/stock/stockProductService";

interface Product {
  _id: string;
  sku: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
}

interface ThresholdRule {
  _id: string;
  productId: Product;
  minQuantity: number;
  alertEnabled: boolean;
  isActive: boolean;
  notifyRoles: string[];
  createdAt: string;
}

interface ThresholdFormState {
  productId: string;
  minQuantity: string;
  alertEnabled: boolean;
  isActive: boolean;
  notifyRoles: string[];
}

const NOTIFY_ROLE_OPTIONS = ["ADMIN", "STOCK_MANAGER"];
const FIXED_NOTIFY_ROLES = ["ADMIN", "STOCK_MANAGER"];

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.16 }}
        className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export default function StockThresholdsPage() {
  const { t } = useLanguage();

  const [rules, setRules] = useState<ThresholdRule[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [skuFilter, setSkuFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const [selected, setSelected] = useState<ThresholdRule | null>(null);

  const emptyForm: ThresholdFormState = {
    productId: "",
    minQuantity: "",
    alertEnabled: true,
    isActive: true,
    notifyRoles: ["ADMIN", "STOCK_MANAGER"],
  };

  const [form, setForm] = useState<ThresholdFormState>(emptyForm);

  const surface =
    "rounded-3xl border border-slate-200 bg-white shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900";

  const inputClass =
    "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800";

  const labelClass =
    "mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400";

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");
      const [ruleData, productData] = await Promise.all([
        stockThresholdService.getAll(),
        stockProductService.getAll(),
      ]);
      setRules(ruleData);
      setProducts(productData.filter((p: Product) => p.status === "ACTIVE"));
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load threshold rules");
    } finally {
      setLoading(false);
    }
  };

  const usedProductIds = useMemo(
    () => new Set(rules.map((r) => r.productId?._id)),
    [rules]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rules.filter((r) => {
      const p = r.productId;
      return (
        (p?.name || "").toLowerCase().includes(q) ||
        (p?.sku || "").toLowerCase().includes(q) ||
        r.notifyRoles.join(",").toLowerCase().includes(q)
      );
    }).filter((r) =>
      skuFilter
        ? (r.productId?.sku || "").toLowerCase().includes(skuFilter.toLowerCase())
        : true
    );
  }, [rules, search, skuFilter]);

  const openCreate = () => {
    setForm(emptyForm);
    setFormError("");
    setShowCreate(true);
  };

  const openEdit = (rule: ThresholdRule) => {
    setSelected(rule);
    setForm({
      productId: rule.productId?._id || "",
      minQuantity: String(rule.minQuantity),
      alertEnabled: rule.alertEnabled,
      isActive: rule.isActive,
      notifyRoles: FIXED_NOTIFY_ROLES,
    });
    setFormError("");
    setShowEdit(true);
  };

  const openDelete = (rule: ThresholdRule) => {
    setSelected(rule);
    setShowDelete(true);
  };

  const parseNotifyRoles = () => FIXED_NOTIFY_ROLES;

  const validateForm = () => {
    if (!form.productId || !form.minQuantity) {
      setFormError("Product and minimum quantity are required");
      return false;
    }
    if (Number(form.minQuantity) < 0) {
      setFormError("Minimum quantity cannot be negative");
      return false;
    }
    if (parseNotifyRoles().length === 0) {
      setFormError("At least one notify role is required");
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      setFormError("");
      await stockThresholdService.create({
        productId: form.productId,
        minQuantity: Number(form.minQuantity),
        alertEnabled: form.alertEnabled,
        isActive: form.isActive,
        notifyRoles: parseNotifyRoles(),
      });
      await fetchAll();
      setShowCreate(false);
      setForm(emptyForm);
    } catch (err: any) {
      setFormError(err.response?.data?.message || "Failed to create threshold rule");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selected || !validateForm()) return;

    try {
      setSubmitting(true);
      setFormError("");
      await stockThresholdService.update(selected._id, {
        minQuantity: Number(form.minQuantity),
        alertEnabled: form.alertEnabled,
        isActive: form.isActive,
        notifyRoles: parseNotifyRoles(),
      });
      await fetchAll();
      setShowEdit(false);
      setSelected(null);
    } catch (err: any) {
      setFormError(err.response?.data?.message || "Failed to update threshold rule");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;

    try {
      setSubmitting(true);
      await stockThresholdService.delete(selected._id);
      await fetchAll();
      setShowDelete(false);
      setSelected(null);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to delete threshold rule");
    } finally {
      setSubmitting(false);
    }
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
              {t("thresholdRules")}{" "}
              <span className="text-slate-400 dark:text-slate-500">Monitoring</span>
            </h1>
          </div>

          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            <Plus size={15} />
            {t("thresholdRules")}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            {
              label: t("thresholdRules"),
              value: String(rules.length),
              sub: "configured rules",
            },
            {
              label: "Enabled",
              value: String(rules.filter((r) => r.alertEnabled).length),
              sub: "alerts enabled",
            },
            {
              label: "Active",
              value: String(rules.filter((r) => r.isActive).length),
              sub: "rules active",
            },
            {
              label: "Products Covered",
              value: String(new Set(rules.map((r) => r.productId?._id)).size),
              sub: "mapped products",
            },
          ].map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`${surface} flex items-center gap-4 px-5 py-5`}
            >
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Bell size={16} />
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
                {t("thresholdRules")}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {filtered.length} {t("ofText")} {rules.length} {t("records")}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-64">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800"
                  placeholder={t("search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                placeholder={t("sku")}
                value={skuFilter}
                onChange={(e) => setSkuFilter(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 size={16} className="animate-spin" />
              Loading...
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
                    <th className="px-6 py-3 font-medium">{t("sku")}</th>
                    <th className="px-6 py-3 font-medium">{t("product")}</th>
                    <th className="px-6 py-3 font-medium">{t("minQuantity")}</th>
                    <th className="px-6 py-3 font-medium">Alert</th>
                    <th className="px-6 py-3 font-medium">{t("status")}</th>
                    <th className="px-6 py-3 font-medium">{t("notifyRoles")}</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filtered.map((rule, i) => (
                    <motion.tr
                      key={rule._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="transition hover:bg-slate-50 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {rule.productId?.sku || "—"}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {rule.productId?.name || "—"}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {rule.minQuantity}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            rule.alertEnabled
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {rule.alertEnabled ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            rule.isActive
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {rule.isActive ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                        {rule.notifyRoles.join(", ")}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(rule)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/20"
                          >
                            <Pencil size={14} />
                          </button>

                          <button
                            onClick={() => openDelete(rule)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/20"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showCreate && (
          <Modal title={t("thresholdRules")} onClose={() => setShowCreate(false)}>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>{t("product")}</label>
                <select
                  className={inputClass}
                  value={form.productId}
                  onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
                >
                  <option value="">— Select Product —</option>
                  {products
                    .filter((p) => !usedProductIds.has(p._id))
                    .map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.sku} · {p.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className={labelClass}>{t("minQuantity")}</label>
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  value={form.minQuantity}
                  onChange={(e) => setForm((f) => ({ ...f, minQuantity: e.target.value }))}
                />
              </div>

              <div>
                <label className={labelClass}>{t("notifyRoles")}</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {NOTIFY_ROLE_OPTIONS.map((role) => {
                    const checked = FIXED_NOTIFY_ROLES.includes(role);

                    return (
                      <label
                        key={role}
                        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                          checked
                            ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300"
                            : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-medium">{role}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.alertEnabled}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, alertEnabled: e.target.checked }))
                    }
                  />
                  Alert enabled
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  Active
                </label>
              </div>

              {formError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
                  {formError}
                </div>
              ) : null}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  Cancel
                </button>

                <button
                  onClick={handleCreate}
                  disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Save
                </button>
              </div>
            </div>
          </Modal>
        )}

        {showEdit && selected && (
          <Modal title={t("thresholdRules")} onClose={() => setShowEdit(false)}>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>{t("product")}</label>
                <input
                  className={inputClass}
                  readOnly
                  value={`${selected.productId?.sku || ""} · ${selected.productId?.name || ""}`}
                />
              </div>

              <div>
                <label className={labelClass}>{t("minQuantity")}</label>
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  value={form.minQuantity}
                  onChange={(e) => setForm((f) => ({ ...f, minQuantity: e.target.value }))}
                />
              </div>

              <div>
                <label className={labelClass}>{t("notifyRoles")}</label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {NOTIFY_ROLE_OPTIONS.map((role) => {
                    const checked = FIXED_NOTIFY_ROLES.includes(role);

                    return (
                      <label
                        key={role}
                        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${
                          checked
                            ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300"
                            : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="font-medium">{role}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.alertEnabled}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, alertEnabled: e.target.checked }))
                    }
                  />
                  Alert enabled
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  Active
                </label>
              </div>

              {formError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
                  {formError}
                </div>
              ) : null}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowEdit(false)}
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  Cancel
                </button>

                <button
                  onClick={handleEdit}
                  disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
                  {t("saveChanges")}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {showDelete && selected && (
          <Modal title="Delete Threshold Rule" onClose={() => setShowDelete(false)}>
            <div className="space-y-4">
              <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                Delete threshold rule for{" "}
                <span className="font-semibold text-slate-950 dark:text-white">
                  {selected.productId?.name}
                </span>
                ?
              </p>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowDelete(false)}
                  className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  Cancel
                </button>

                <button
                  onClick={handleDelete}
                  disabled={submitting}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60 dark:hover:bg-rose-500"
                >
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Delete
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </ProtectedRoute>
  );
}
