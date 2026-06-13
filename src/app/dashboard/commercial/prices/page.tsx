"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { useEffect, useState } from "react";
import { stockProductService, type StockProduct } from "@/services/stock/stockProductService";
import { Tag, Search, X, Check, Loader2, Pencil } from "lucide-react";

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800";

export default function PricesPage() {
  const { t } = useLanguage();
  const [products, setProducts] = useState<StockProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  // editingId → temporary price input value
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const all = await stockProductService.getAll();
      setProducts(all.filter((p) => p.type === "PRODUIT_FINI" && p.status === "ACTIVE"));
    } catch {
      setError("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const startEdit = (p: StockProduct) => {
    setEditing((prev) => ({ ...prev, [p._id]: String(p.salePrice ?? 0) }));
  };

  const cancelEdit = (id: string) => {
    setEditing((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  const savePrice = async (id: string) => {
    const val = Number(editing[id]);
    if (isNaN(val) || val < 0) return;
    try {
      setSavingId(id);
      await stockProductService.updateSalePrice(id, val);
      setProducts((prev) => prev.map((p) => p._id === id ? { ...p, salePrice: val } : p));
      cancelEdit(id);
    } catch {
      setError("Failed to save price");
    } finally {
      setSavingId(null);
    }
  };

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const priced = products.filter((p) => (p.salePrice ?? 0) > 0).length;
  const unpriced = products.length - priced;

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "COMMERCIAL_MANAGER", "STOCK_MANAGER"]}>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              {t("commercialModule") || "Commercial"} · ERP
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <Tag size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  {t("pricesTitle") || "Sale Prices"}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t("pricesSub") || "Set the sale price for each finished product (PF)"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start justify-between rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
            <button onClick={() => setError("")} className="ml-4 hover:opacity-70"><X size={14} /></button>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total PF", value: products.length, color: "text-slate-900 dark:text-white" },
            { label: t("priced") || "Priced", value: priced, color: "text-emerald-600 dark:text-emerald-400" },
            { label: t("unpriced") || "No Price", value: unpriced, color: unpriced > 0 ? "text-amber-500 dark:text-amber-400" : "text-slate-500 dark:text-slate-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className={`${surface} px-6 py-5`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{label}</p>
              <p className={`mt-2 text-3xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className={`${surface} flex items-center gap-3 px-5 py-3.5`}>
          <Search size={15} className="shrink-0 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search") || "Search by name or SKU…"}
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none dark:text-white"
          />
          {search && (
            <button onClick={() => setSearch("")} className="shrink-0 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-slate-400" />
          </div>
        ) : (
          <div className={`${surface} overflow-hidden`}>
            {/* Header */}
            <div className="grid grid-cols-[1fr_80px_180px_140px] items-center gap-4 border-b border-slate-100 px-6 py-3 dark:border-slate-800">
              {["Product", "SKU", t("salePrice") || "Sale Price", ""].map((h, i) => (
                <span key={i} className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{h}</span>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <Tag size={28} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                <p className="text-sm text-slate-500 dark:text-slate-400">{t("noFinishedProductsFound")}</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((p) => {
                  const isEditing = p._id in editing;
                  const hasPrice = (p.salePrice ?? 0) > 0;

                  return (
                    <div key={p._id} className="grid grid-cols-[1fr_80px_180px_140px] items-center gap-4 px-6 py-4 transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      {/* Name */}
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.unit}</p>
                      </div>

                      {/* SKU */}
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-mono font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {p.sku}
                      </span>

                      {/* Price display / edit */}
                      {isEditing ? (
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            autoFocus
                            value={editing[p._id]}
                            onChange={(e) => setEditing((prev) => ({ ...prev, [p._id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") savePrice(p._id); if (e.key === "Escape") cancelEdit(p._id); }}
                            className={inputClass}
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">TND</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {hasPrice ? (
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                              {p.salePrice.toLocaleString("fr-TN", { minimumFractionDigits: 2 })} TND
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:bg-amber-950/30 dark:text-amber-400">
                              {t("noPrice") || "No price set"}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => savePrice(p._id)}
                              disabled={savingId === p._id}
                              className="flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {savingId === p._id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              {t("save") || "Save"}
                            </button>
                            <button
                              onClick={() => cancelEdit(p._id)}
                              className="rounded-2xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
                            >
                              {t("cancel") || "Cancel"}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => startEdit(p)}
                            className="flex items-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <Pencil size={12} /> {t("setPrice") || "Set Price"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
