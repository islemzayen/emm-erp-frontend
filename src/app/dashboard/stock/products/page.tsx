"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Boxes,
  ScanLine,
  Tag,
} from "lucide-react";
import { useEffect, useState } from "react";
import { stockProductService } from "@/services/stock/stockProductService";
import { skuSettingService } from "@/services/stock/skuSettingService";

interface Product {
  _id: string;
  sku: string;
  name: string;
  type: "PRODUIT_FINI" | "SOUS_ENSEMBLE" | "COMPOSANT" | "MATIERE_PREMIERE";
  unit: "pcs" | "kg" | "l" | "m";
  isLotTracked: boolean;
  status: "ACTIVE" | "INACTIVE";
  purchasePrice?: number;
  createdAt?: string;
}

interface SkuSetting {
  _id: string;
  skuName: string;
  skuMax: number;
  lastCounter: number;
  productType: Product["type"] | null;
}

interface ProductFormState {
  skuPrefix: string;
  name: string;
  type: Product["type"];
  unit: Product["unit"];
  isLotTracked: boolean;
  status: Product["status"];
}

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

export default function StockProductsPage() {
  const { t } = useLanguage();

  const PRODUCT_TYPES: Product["type"][] = [
    "PRODUIT_FINI",
    "SOUS_ENSEMBLE",
    "COMPOSANT",
    "MATIERE_PREMIERE",
  ];

  const PRODUCT_UNITS: Product["unit"][] = ["pcs", "kg", "l", "m"];

  const [skuSettings, setSkuSettings] = useState<SkuSetting[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<Product["type"] | "ALL">("ALL");
  const [unitFilter, setUnitFilter] = useState<Product["unit"] | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const [selected, setSelected] = useState<Product | null>(null);
  const [formError, setFormError] = useState("");

  const emptyForm: ProductFormState = {
    skuPrefix: "",
    name: "",
    type: "PRODUIT_FINI",
    unit: "pcs",
    isLotTracked: false,
    status: "ACTIVE",
  };

  // Find the next auto-increment number for a given prefix (scans existing products)
  const getNextNumber = (prefix: string): string => {
    const setting = skuSettings.find((s) => s.skuName === prefix);
    if (!setting) return "";
    // Start from the persisted lastCounter so changing length never resets the sequence
    let maxNum = setting.lastCounter ?? 0;
    for (const p of products) {
      if (p.sku.startsWith(prefix + "-")) {
        const numPart = p.sku.slice(prefix.length + 1);
        if (/^\d+$/.test(numPart)) maxNum = Math.max(maxNum, Number(numPart));
      }
    }
    const digits = Math.max(1, Number(setting.skuMax));
    return String(maxNum + 1).padStart(digits, "0");
  };

  // Compose the full SKU string: PREFIX-001
  const composeSku = (prefix: string): string => {
    if (!prefix) return "";
    const next = getNextNumber(prefix);
    if (!next) return "";
    return `${prefix}-${next}`;
  };

  const [form, setForm] = useState<ProductFormState>(emptyForm);

  // SKU settings compatible with the currently selected product type.
  // Show only type-specific ones if any exist; otherwise fall back to untyped ("Any") ones.
  const typeSpecific = skuSettings.filter((s) => s.productType === form.type);
  const compatibleSkuSettings = typeSpecific.length > 0
    ? typeSpecific
    : skuSettings.filter((s) => !s.productType);

  const surface =
    "rounded-3xl border border-slate-200 bg-white shadow-sm transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900";

  const inputClass =
    "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800";

  const labelClass =
    "mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400";

  useEffect(() => {
    fetchSkuSettings();
    fetchProducts();
  }, []);

  const fetchSkuSettings = async () => {
    try {
      const data = await skuSettingService.getAll();
      setSkuSettings(data);
    } catch {
      // non-blocking
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await stockProductService.getAll();
      setProducts(data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    const defaultType = emptyForm.type;
    const specific = skuSettings.filter((s) => s.productType === defaultType);
    const firstCompatible = specific.length > 0
      ? specific[0]
      : skuSettings.find((s) => !s.productType);
    setForm({ ...emptyForm, skuPrefix: firstCompatible?.skuName ?? "" });
    setFormError("");
    setShowCreate(true);
  };

  const openEdit = (product: Product) => {
    setSelected(product);
    setForm({
      skuPrefix: "",
      name: product.name,
      type: product.type,
      unit: product.unit,
      isLotTracked: product.isLotTracked,
      status: product.status,
    });
    setFormError("");
    setShowEdit(true);
  };

  const openDelete = (product: Product) => {
    setSelected(product);
    setShowDelete(true);
  };

  const validateForm = (isEdit = false) => {
    if (!isEdit && !form.skuPrefix) {
      setFormError("Select a SKU prefix");
      return false;
    }
    if (!form.name.trim()) {
      setFormError("Product name is required");
      return false;
    }
    if (!PRODUCT_TYPES.includes(form.type)) {
      setFormError("Product type is required");
      return false;
    }
    if (!PRODUCT_UNITS.includes(form.unit)) {
      setFormError("Unit is required");
      return false;
    }
    return true;
  };

  const handleCreate = async () => {
    if (!validateForm(false)) return;

    try {
      setSubmitting(true);
      setFormError("");

      const generatedSku = composeSku(form.skuPrefix);
      await stockProductService.create({
        sku: generatedSku,
        name: form.name.trim(),
        type: form.type,
        unit: form.unit,
        isLotTracked: form.isLotTracked,
        status: form.status,
      });

      // Persist the counter so changing length never resets the sequence
      const setting = skuSettings.find((s) => s.skuName === form.skuPrefix);
      if (setting && generatedSku) {
        const numPart = generatedSku.slice(form.skuPrefix.length + 1);
        const counterValue = Number(numPart) || 0;
        if (counterValue > 0) {
          skuSettingService.updateCounter(setting._id, counterValue).catch(() => {});
        }
      }

      await fetchProducts();
      await fetchSkuSettings();
      setShowCreate(false);
      setForm(emptyForm);
    } catch (err: any) {
      setFormError(err.response?.data?.message || "Failed to create product");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selected) return;
    if (!validateForm(true)) return;

    try {
      setSubmitting(true);
      setFormError("");

      await stockProductService.update(selected._id, {
        sku: selected.sku,
        name: form.name.trim(),
        type: form.type,
        unit: form.unit,
        isLotTracked: form.isLotTracked,
        status: form.status,
      });

      await fetchProducts();
      setShowEdit(false);
      setSelected(null);
    } catch (err: any) {
      setFormError(err.response?.data?.message || "Failed to update product");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;

    try {
      setSubmitting(true);
      await stockProductService.delete(selected._id);
      await fetchProducts();
      setShowDelete(false);
      setSelected(null);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to delete product");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q) ||
      p.unit.toLowerCase().includes(q);

    const matchesType = typeFilter === "ALL" ? true : p.type === typeFilter;
    const matchesUnit = unitFilter === "ALL" ? true : p.unit === unitFilter;

    return matchesSearch && matchesType && matchesUnit;
  });

  const activeCount = products.filter((p) => p.status === "ACTIVE").length;
  const lotTrackedCount = products.filter((p) => p.isLotTracked).length;
  const typesCount = new Set(products.map((p) => p.type)).size;

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "STOCK_MANAGER"]}>
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Stock Module · ERP
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              {t("products")} <span className="text-slate-400 dark:text-slate-500">Stock</span>
            </h1>
          </div>

          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            <Plus size={15} />
            {t("addProduct")}
          </button>
        </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              label: t("totalProducts"),
              value: String(products.length),
              sub: "registered products",
              icon: <Boxes size={16} />,
              iconBg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
            },
            {
              label: t("categories"),
              value: String(typesCount),
              sub: "unique product types",
              icon: <Tag size={16} />,
              iconBg: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300",
            },
            {
              label: t("lotTracking"),
              value: String(lotTrackedCount),
              sub: `${activeCount} active products`,
              icon: <ScanLine size={16} />,
              iconBg: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
            },
          ].map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`${surface} flex items-center gap-4 px-5 py-5`}
            >
              <div className={`rounded-2xl p-3 ${card.iconBg}`}>{card.icon}</div>
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
                {t("products")}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {filtered.length} {t("ofText")} {products.length} {t("records")}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-60">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800"
                  placeholder={t("searchProducts")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as Product["type"] | "ALL")}
              >
                <option value="ALL">{t("allTypes")}</option>
                {PRODUCT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              <select
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value as Product["unit"] | "ALL")}
              >
                <option value="ALL">{t("unit")}</option>
                {PRODUCT_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
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
              {t("noProductsMatch")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    <th className="px-6 py-3 font-medium">{t("sku")}</th>
                    <th className="px-6 py-3 font-medium">{t("product")}</th>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">{t("unit")}</th>
                    <th className="px-6 py-3 font-medium">{t("lotTracking")}</th>
                    <th className="px-6 py-3 font-medium">{t("status")}</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filtered.map((product, i) => (
                    <motion.tr
                      key={product._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="transition hover:bg-slate-50 dark:hover:bg-slate-800/30"
                    >
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {product.sku}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            <Package size={16} />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {product.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {product.type} · {product.unit}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {product.type}
                      </td>

                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {product.unit}
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            product.isLotTracked
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {product.isLotTracked ? "Yes" : "No"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            product.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {product.status}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(product)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/20"
                          >
                            <Pencil size={14} />
                          </button>

                          <button
                            onClick={() => openDelete(product)}
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
          <Modal title={t("addProduct")} onClose={() => setShowCreate(false)}>
            <div className="space-y-4">
              {/* SKU composer */}
              {compatibleSkuSettings.length === 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-400">
                  {skuSettings.length === 0
                    ? "No SKU prefixes configured. Go to Settings → Stock to create one."
                    : `No SKU prefix is configured for ${form.type}. Go to Settings → Stock to create one.`}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
                  <p className={labelClass}>SKU</p>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="mb-1.5 block text-[11px] text-slate-400 dark:text-slate-500">Prefix</label>
                      <select
                        className={inputClass}
                        value={form.skuPrefix}
                        onChange={(e) => setForm((f) => ({ ...f, skuPrefix: e.target.value }))}
                      >
                        {compatibleSkuSettings.map((s) => (
                          <option key={s._id} value={s.skuName}>
                            {s.skuName}
                          </option>
                        ))}
                      </select>
                    </div>
                    {composeSku(form.skuPrefix) && (
                      <div className="flex-shrink-0 pb-0.5">
                        <div className="mb-1.5 text-[11px] text-slate-400 dark:text-slate-500">Generated SKU</div>
                        <div className="flex h-[38px] items-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 font-mono text-sm font-semibold tracking-wider text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                          {composeSku(form.skuPrefix)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className={labelClass}>{t("product")}</label>
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Type</label>
                  <select
                    className={inputClass}
                    value={form.type}
                    onChange={(e) => {
                      const newType = e.target.value as Product["type"];
                      const specific = skuSettings.filter((s) => s.productType === newType);
                      const firstCompatible = specific.length > 0
                        ? specific[0]
                        : skuSettings.find((s) => !s.productType);
                      setForm((f) => ({
                        ...f,
                        type: newType,
                        skuPrefix: firstCompatible?.skuName ?? "",
                      }));
                    }}
                  >
                    {PRODUCT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>{t("unit")}</label>
                  <select
                    className={inputClass}
                    value={form.unit}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, unit: e.target.value as Product["unit"] }))
                    }
                  >
                    {PRODUCT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>{t("status")}</label>
                  <select
                    className={inputClass}
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value as "ACTIVE" | "INACTIVE" }))
                    }
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>{t("lotTracking")}</label>
                  <select
                    className={inputClass}
                    value={form.isLotTracked ? "true" : "false"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isLotTracked: e.target.value === "true" }))
                    }
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </div>
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
                  {t("addProduct")}
                </button>
              </div>
            </div>
          </Modal>
        )}

        {showEdit && selected && (
          <Modal title={t("editProduct")} onClose={() => setShowEdit(false)}>
            <div className="space-y-4">
              {/* SKU — read-only in edit */}
              <div>
                <label className={labelClass}>{t("sku")}</label>
                <div className="flex h-[42px] items-center rounded-2xl border border-slate-200 bg-slate-100 px-4 font-mono text-sm font-semibold tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {selected.sku}
                </div>
              </div>

              <div>
                <label className={labelClass}>{t("product")}</label>
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Type</label>
                  <select
                    className={inputClass}
                    value={form.type}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, type: e.target.value as Product["type"] }))
                    }
                  >
                    {PRODUCT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>{t("unit")}</label>
                  <select
                    className={inputClass}
                    value={form.unit}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, unit: e.target.value as Product["unit"] }))
                    }
                  >
                    {PRODUCT_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>{t("status")}</label>
                  <select
                    className={inputClass}
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value as "ACTIVE" | "INACTIVE" }))
                    }
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>{t("lotTracking")}</label>
                  <select
                    className={inputClass}
                    value={form.isLotTracked ? "true" : "false"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isLotTracked: e.target.value === "true" }))
                    }
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </div>
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
          <Modal title="Delete Product" onClose={() => setShowDelete(false)}>
            <div className="space-y-4">
              <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-slate-950 dark:text-white">
                  {selected.name}
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