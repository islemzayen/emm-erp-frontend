"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useEffect, useMemo, useState } from "react";
import {
  purchaseProductCategoryService,
  type PurchaseProductCategoryEntry,
} from "@/services/purchase/purchaseProductCategoryService";
import {
  supplementaryCategoryService,
  type SupplementaryCategory,
} from "@/services/purchase/supplementaryCategoryService";
import { stockProductService, type StockProduct } from "@/services/stock/stockProductService";
import {
  Package, Plus, Loader2, Trash2, X, Search, Tag,
} from "lucide-react";

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400";

function categoryColor(key?: string) {
  const map: Record<string, string> = {
    slate:   "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    blue:    "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    violet:  "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber:   "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    rose:    "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    cyan:    "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
    orange:  "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  };
  return map[key ?? "slate"] ?? map.slate;
}

export default function PurchaseProductsPage() {
  const [entries, setEntries]     = useState<PurchaseProductCategoryEntry[]>([]);
  const [products, setProducts]   = useState<StockProduct[]>([]);
  const [categories, setCategories] = useState<SupplementaryCategory[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [search, setSearch]       = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [selectedProduct, setSelectedProduct]   = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [saving, setSaving]   = useState(false);
  const [formError, setFormError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [e, p, c] = await Promise.all([
        purchaseProductCategoryService.getAll(),
        stockProductService.getAll(),
        supplementaryCategoryService.getActive(),
      ]);
      setEntries(e);
      setProducts(p.filter((x) => x.status === "ACTIVE" && x.type === "MATIERE_PREMIERE"));
      setCategories(c);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const assignedIds = useMemo(
    () => new Set(entries.map((e) => e.productId?._id).filter(Boolean)),
    [entries]
  );

  const availableProducts = useMemo(
    () => products.filter((p) => !assignedIds.has(p._id)),
    [products, assignedIds]
  );

  const mpEntries = useMemo(
    () => entries.filter((e) => e.productId?.type === "MATIERE_PREMIERE"),
    [entries]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return mpEntries;
    return mpEntries.filter((e) => {
      const product  = e.productId?.name?.toLowerCase() ?? "";
      const sku      = e.productId?.sku?.toLowerCase() ?? "";
      const category = e.categoryId?.label?.toLowerCase() ?? "";
      return product.includes(q) || sku.includes(q) || category.includes(q);
    });
  }, [mpEntries, search]);

  const handleCreate = async () => {
    if (!selectedProduct || !selectedCategory) {
      setFormError("Veuillez sélectionner un produit et une catégorie"); return;
    }
    setSaving(true); setFormError("");
    try {
      await purchaseProductCategoryService.create({
        productId: selectedProduct,
        categoryId: selectedCategory,
      });
      setSelectedProduct("");
      setSelectedCategory("");
      setShowCreate(false);
      await load();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || "Échec de la création");
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await purchaseProductCategoryService.delete(id);
      setEntries((prev) => prev.filter((e) => e._id !== id));
    } catch { /* ignore */ }
    finally { setDeletingId(null); }
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "PURCHASE_MANAGER"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              Produits <span className="text-teal-500">Catégorisés</span>
            </h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              EMM ERP · ACHAT
            </p>
          </div>
          <button
            onClick={() => { setSelectedProduct(""); setSelectedCategory(""); setFormError(""); setShowCreate(true); }}
            className="inline-flex items-center gap-2 rounded-2xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            <Plus size={15} /> Créer
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* Stat row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className={`${surface} px-5 py-5 flex items-center gap-4`}>
            <div className="rounded-2xl p-3 bg-teal-100 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
              <Package size={18} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">MP classées</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{mpEntries.length}</p>
            </div>
          </div>
          <div className={`${surface} px-5 py-5 flex items-center gap-4`}>
            <div className="rounded-2xl p-3 bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <Tag size={18} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Catégories actives</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{categories.length}</p>
            </div>
          </div>
          <div className={`${surface} px-5 py-5 flex items-center gap-4`}>
            <div className="rounded-2xl p-3 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <Package size={18} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">MP non classées</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{availableProducts.length}</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className={`${surface} overflow-hidden`}>
          <div className="flex flex-col justify-between gap-4 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center dark:border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Produits classés</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {filtered.length} {filtered.length !== 1 ? "produits" : "produit"}
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher produit ou catégorie..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Chargement...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <Package size={20} className="text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-400 dark:text-slate-500">Aucun produit catégorisé</p>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-600">Cliquez sur Créer pour ajouter une association</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    <th className="px-6 py-3 font-medium">Réf.</th>
                    <th className="px-6 py-3 font-medium">Produit</th>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Catégorie</th>
                    <th className="px-6 py-3 font-medium">Ajouté par</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((e) => (
                    <tr key={e._id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {e.productId?.sku || "—"}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                        {e.productId?.name || "—"}
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                        {e.productId?.type || "—"}
                      </td>
                      <td className="px-6 py-4">
                        {e.categoryId ? (
                          <span className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium ${categoryColor(e.categoryId.color)}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                            {e.categoryId.label}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                        {e.createdBy?.name || "—"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDelete(e._id)}
                          disabled={deletingId === e._id}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50 dark:hover:bg-rose-950/20 dark:hover:text-rose-400"
                        >
                          {deletingId === e._id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950/30 dark:text-teal-400">
                  <Package size={18} />
                </div>
                <p className="font-bold text-slate-950 dark:text-white">Catégoriser un produit</p>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelClass}>Produit</label>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Sélectionner un produit —</option>
                  {availableProducts.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.sku} · {p.name}
                    </option>
                  ))}
                </select>
                {availableProducts.length === 0 && (
                  <p className="mt-1.5 text-[11px] italic text-slate-400">
                    Tous les produits actifs sont déjà classés
                  </p>
                )}
              </div>

              <div>
                <label className={labelClass}>Catégorie</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Sélectionner une catégorie —</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c._id}>{c.label}</option>
                  ))}
                </select>
              </div>

              {formError && (
                <p className="rounded-2xl bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-600 dark:bg-rose-950/20 dark:text-rose-400">
                  {formError}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving || !selectedProduct || !selectedCategory}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-teal-600 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Créer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
