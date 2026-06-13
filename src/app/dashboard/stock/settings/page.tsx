"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { skuSettingService } from "@/services/stock/skuSettingService";
import { useEffect, useState } from "react";
import {
  Settings,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  ScanLine,
  Hash,
} from "lucide-react";

type ProductType = "PRODUIT_FINI" | "SOUS_ENSEMBLE" | "COMPOSANT" | "MATIERE_PREMIERE";

const PRODUCT_TYPES: ProductType[] = [
  "PRODUIT_FINI",
  "SOUS_ENSEMBLE",
  "COMPOSANT",
  "MATIERE_PREMIERE",
];

interface SkuSetting {
  _id: string;
  skuName: string;
  skuMax: number;
  productType: ProductType | null;
  createdAt: string;
}

export default function StockSettingsPage() {
  const [settings, setSettings] = useState<SkuSetting[]>([]);
  const [skuName, setSkuName] = useState("");
  const [skuMax, setSkuMax] = useState("");
  const [skuProductType, setSkuProductType] = useState<ProductType | "">("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSkuName, setEditSkuName] = useState("");
  const [editSkuMax, setEditSkuMax] = useState("");
  const [editSkuProductType, setEditSkuProductType] = useState<ProductType | "">("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await skuSettingService.getAll();
      setSettings(data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    if (!skuName.trim() || !skuMax || Number(skuMax) <= 0) {
      setError("SKU name and SKU max are required");
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      await skuSettingService.create({
        skuName: skuName.trim(),
        skuMax: Number(skuMax),
        productType: skuProductType || null,
      });
      setSkuName("");
      setSkuMax("");
      setSkuProductType("");
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create SKU setting");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item: SkuSetting) => {
    setEditingId(item._id);
    setEditSkuName(item.skuName);
    setEditSkuMax(item.skuMax.toString());
    setEditSkuProductType(item.productType ?? "");
    setError("");
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    if (!editSkuName.trim() || !editSkuMax || Number(editSkuMax) <= 0) {
      setError("SKU name and SKU max are required");
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      await skuSettingService.update(editingId, {
        skuName: editSkuName.trim(),
        skuMax: Number(editSkuMax),
        productType: editSkuProductType || null,
      });
      setEditingId(null);
      setEditSkuName("");
      setEditSkuMax("");
      setEditSkuProductType("");
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update SKU setting");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditSkuName("");
    setEditSkuMax("");
    setEditSkuProductType("");
    setError("");
  };

  const handleDelete = async (id: string) => {
    try {
      setSubmitting(true);
      await skuSettingService.delete(id);
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to delete SKU setting");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "STOCK_MANAGER"]}>
      <div className="space-y-8">
        {/* Page Header */}
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Stock Module · ERP
          </p>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <Settings size={18} className="text-slate-600 dark:text-slate-300" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              Settings{" "}
              <span className="text-slate-400 dark:text-slate-500">Stock</span>
            </h1>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-400">
            <X size={15} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Create SKU */}
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                <Plus size={13} className="text-slate-600 dark:text-slate-300" />
              </div>
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                Create SKU Setting
              </h2>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <ScanLine size={11} />
                  SKU Name
                </label>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-slate-400 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 dark:focus:border-slate-600 dark:focus:bg-slate-800"
                  placeholder="e.g. PROD, COMP, MAT"
                  value={skuName}
                  onChange={(e) => setSkuName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <Hash size={11} />
                  SKU Max Digits
                </label>
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 transition focus:border-slate-400 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 dark:focus:border-slate-600 dark:focus:bg-slate-800"
                  type="number"
                  min="1"
                  placeholder="e.g. 4"
                  value={skuMax}
                  onChange={(e) => setSkuMax(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  <ScanLine size={11} />
                  Product Type
                </label>
                <select
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition focus:border-slate-400 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-600 dark:focus:bg-slate-800"
                  value={skuProductType}
                  onChange={(e) => setSkuProductType(e.target.value as ProductType | "")}
                >
                  <option value="">— Any type —</option>
                  {PRODUCT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
              >
                {submitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                Create
              </button>
            </div>
          </div>
        </div>

        {/* SKU Settings List */}
        <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                  <ScanLine size={13} className="text-slate-600 dark:text-slate-300" />
                </div>
                <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  SKU Settings
                </h2>
              </div>
              {!loading && settings.length > 0 && (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                  {settings.length}
                </span>
              )}
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500">
                <Loader2 size={15} className="animate-spin" />
                Loading settings...
              </div>
            ) : settings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                  <ScanLine size={20} className="text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  No SKU settings yet
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Create your first SKU setting above
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="pb-3 pr-6 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                        SKU Name
                      </th>
                      <th className="pb-3 pr-6 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                        Max Digits
                      </th>
                      <th className="pb-3 pr-6 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                        Product Type
                      </th>
                      <th className="pb-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {settings.map((item) => (
                      <tr key={item._id}>
                        {editingId === item._id ? (
                          <>
                            <td className="py-3 pr-6">
                              <input
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                value={editSkuName}
                                onChange={(e) => setEditSkuName(e.target.value)}
                              />
                            </td>
                            <td className="py-3 pr-6">
                              <input
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                type="number"
                                min="1"
                                value={editSkuMax}
                                onChange={(e) => setEditSkuMax(e.target.value)}
                              />
                            </td>
                            <td className="py-3 pr-6">
                              <select
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                value={editSkuProductType}
                                onChange={(e) => setEditSkuProductType(e.target.value as ProductType | "")}
                              >
                                <option value="">— Any type —</option>
                                {PRODUCT_TYPES.map((t) => (
                                  <option key={t} value={t}>{t}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={handleUpdate}
                                  disabled={submitting}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
                                >
                                  {submitting ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Check size={12} />
                                  )}
                                  Save
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  disabled={submitting}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                >
                                  <X size={12} />
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3.5 pr-6">
                              <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                <ScanLine size={11} />
                                {item.skuName}
                              </span>
                            </td>
                            <td className="py-3.5 pr-6 text-sm font-medium text-slate-700 dark:text-slate-300">
                              {item.skuMax}
                            </td>
                            <td className="py-3.5 pr-6">
                              {item.productType ? (
                                <span className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                  {item.productType}
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 dark:text-slate-500">Any</span>
                              )}
                            </td>
                            <td className="py-3.5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleEdit(item)}
                                  disabled={submitting}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                                >
                                  <Pencil size={12} />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(item._id)}
                                  disabled={submitting}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400"
                                >
                                  {submitting ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Trash2 size={12} />
                                  )}
                                  Delete
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
