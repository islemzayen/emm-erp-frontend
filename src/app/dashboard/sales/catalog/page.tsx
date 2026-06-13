// Catalog — Online Sales
"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Search, Plus, Download, Tag, AlertTriangle, TrendingUp, Eye, EyeOff, RefreshCw, X, Loader2 } from "lucide-react";
import { salesService, type OnlineProduct } from "@/services/salesService";
import { exportBrandedXlsx } from "@/lib/reportExport";
import { stockProductService, type StockProduct } from "@/services/stock/stockProductService";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-[#c8202f]/20 text-[#c8202f]", "bg-blue-500/20 text-blue-400",
  "bg-purple-500/20 text-purple-400",   "bg-amber-500/20 text-amber-400",
  "bg-pink-500/20 text-pink-400",       "bg-teal-500/20 text-teal-400",
  "bg-red-500/20 text-red-400",         "bg-indigo-500/20 text-indigo-400",
];

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function fmtTND(n: number) {
  const parts = n.toFixed(3).split(".");
  const intPart = parseInt(parts[0]).toLocaleString("en-US");
  return intPart + "." + parts[1] + " TND";
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 dark:bg-white/5 rounded ${className}`} />;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CatalogPage() {
  const { t } = useLanguage();
  const [products, setProducts]           = useState<OnlineProduct[]>([]);
  const [catalogStats, setCatalogStats]   = useState<any>(null);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [filterStatus, setFilter]         = useState("all");
  const [togglingId, setTogglingId]       = useState<string | null>(null);
  const [mounted, setMounted]             = useState(false);
  const [showCreate, setShowCreate]       = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [stockProducts, setStockProducts] = useState<StockProduct[]>([]);
  const [createError, setCreateError]     = useState("");
  const emptyProductForm = {
    stockProductId: "", name: "", sku: "", category: "",
    description: "", onlinePrice: 0, minStockThreshold: 10, isVisible: true,
  };
  const [productForm, setProductForm] = useState(emptyProductForm);

  const card = "bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl transition-colors duration-300";

  const STATUS_CONFIG = {
    "in-stock":     { label: t("inStockLabel"),      badge: "bg-[#c8202f]/15 text-[#c8202f]", dot: "bg-[#c8202f]" },
    "low-stock":    { label: t("lowStockLabel"),     badge: "bg-amber-500/15 text-amber-400",     dot: "bg-amber-400"   },
    "out-of-stock": { label: t("outOfStockLabel"),   badge: "bg-red-500/15 text-red-400",         dot: "bg-red-400"     },
    "pending":      { label: t("stockPending"),      badge: "bg-gray-200/50 dark:bg-white/5 text-gray-400", dot: "bg-gray-400" },
  };

  const openCreate = async () => {
    setProductForm(emptyProductForm);
    setCreateError("");
    try { setStockProducts(await stockProductService.getAll()); } catch (e) { console.error(e); }
    setShowCreate(true);
  };

  const handleStockSelect = (id: string) => {
    const sp = stockProducts.find(p => p._id === id);
    if (!sp) return;
    setProductForm(f => ({
      ...f,
      stockProductId: sp._id,
      name:           sp.name,
      sku:            sp.sku,
      onlinePrice:    sp.salePrice ?? 0,
    }));
  };

  const handleCreateProduct = async () => {
    if (!productForm.stockProductId) { setCreateError("Please select a stock product"); return; }
    if (!productForm.name.trim())    { setCreateError("Product name is required"); return; }
    if (productForm.onlinePrice <= 0){ setCreateError("Online price must be greater than 0"); return; }
    setSubmitting(true); setCreateError("");
    try {
      await salesService.createProduct(productForm);
      setShowCreate(false);
      setProductForm(emptyProductForm);
      load();
    } catch (e: any) {
      setCreateError(e.response?.data?.message || "Failed to create product");
    } finally { setSubmitting(false); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prods, stats] = await Promise.all([
        salesService.getProducts({ search, status: filterStatus === "all" ? undefined : filterStatus }),
        salesService.getStats(),
      ]);
      setProducts(prods);
      setCatalogStats(stats.catalogStats);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setMounted(true);
    }
  }, [search, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const exportXlsx = async () => {
    if (products.length === 0) return;
    const headers = ["Name", "SKU", "Category", "Online Price (TND)", "Stock", "Min Threshold", "Status", "Visible"];
    const rows = products.map(p => [
      p.name,
      p.sku,
      (p.category || ""),
      p.onlinePrice.toFixed(3),
      p.stock ?? 0,
      p.minStockThreshold ?? 0,
      p.stockStatus,
      p.isVisible ? "Yes" : "No",
    ]);
    await exportBrandedXlsx("Product Catalog Report", headers, rows, `Catalog_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleToggleVisibility = async (id: string) => {
    setTogglingId(id);
    try {
      const updated = await salesService.toggleProductVisibility(id);
      setProducts(prev => prev.map(p => p._id === id ? { ...p, isVisible: updated.isVisible } : p));
    } catch (e) {
      console.error(e);
    } finally {
      setTogglingId(null);
    }
  };

  const inStockCount  = products.filter(p => p.stockStatus === "in-stock").length;
  const lowStockCount = products.filter(p => p.stockStatus === "low-stock").length;
const outCount = products.filter(p => p.stockStatus === "out-of-stock" || (p.stock ?? 0) === 0).length;
  const totalValue    = catalogStats?.totalValue ?? 0;
  const avgPrice      = catalogStats?.avgPrice   ?? 0;

  return (
    <>
    <div className="min-h-screen bg-gray-100 dark:bg-[#060a0f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight leading-none">
            {t("productCatalog").split(" ")[0]}{" "}
            <span className="text-[#c8202f]">{t("productCatalog").split(" ").slice(1).join(" ")}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">EMM ERP</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20 px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={exportXlsx} disabled={products.length === 0} className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-[#c8202f]/40 hover:text-[#c8202f] px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300 disabled:opacity-40">
            <Download size={13} /> {t("exportXlsx")}
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 bg-[#c8202f] hover:bg-[#e02d3c] px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-white font-bold">
            <Plus size={13} /> {t("addProduct")}
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: t("totalSkusKpi"),  value: products.length, display: products.length.toString(),         change: t("listedOnline"),  changeColor: "text-[#c8202f]", valueColor: "text-[#c8202f]", icon: <Package size={16} />,       iconBg: "bg-[#c8202f]/10 text-[#c8202f]" },
          { label: t("inStockKpi"),    value: inStockCount,    display: inStockCount.toString(),             change: t("available"),                        changeColor: "text-blue-400",    valueColor: "text-blue-400",    icon: <Tag size={16} />,           iconBg: "bg-blue-500/10 text-blue-400"       },
          { label: t("alertsKpi"),     value: lowStockCount,   display: lowStockCount.toString(),            change: t("needsAction"),                       changeColor: "text-amber-400",   valueColor: "text-amber-400",   icon: <AlertTriangle size={16} />, iconBg: "bg-amber-500/10 text-amber-400"     },
          { label: t("catalogValue"),  value: totalValue,      display: fmtTND(totalValue),                  change: t("stockValue"),       changeColor: "text-purple-400",  valueColor: "text-purple-400",  icon: <TrendingUp size={16} />,   iconBg: "bg-purple-500/10 text-purple-400"   },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className={`${card} p-5 flex flex-col gap-3`}>
            <div className="flex items-start justify-between">
              <div className={`p-2 rounded-xl ${kpi.iconBg}`}>{kpi.icon}</div>
              <span className={`text-xs font-bold ${kpi.changeColor}`}>{kpi.change}</span>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500">{kpi.label}</p>
            {loading ? <Skeleton className="h-9 w-24" /> : (
              <p className={`text-3xl font-bold tracking-tight ${kpi.valueColor}`}>{kpi.display}</p>
            )}
          </motion.div>
        ))}
      </div>

      {/* ── SECONDARY STRIP ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: t("outOfStockKpi"),  value: loading ? "—" : outCount.toString(),                   sub: t("reorderNow")            },
          { label: t("avgPrice"),       value: loading ? "—" : fmtTND(avgPrice),                      sub: t("averageOnlinePrice") },
          { label: t("visibleItems"),   value: loading ? "—" : products.filter(p => p.isVisible).length.toString(),  sub: t("shownInStore") },
          { label: t("hiddenItems"),    value: loading ? "—" : products.filter(p => !p.isVisible).length.toString(), sub: t("hiddenFromStore") },
        ].map((s, i) => (
          <div key={i} className={`${card} px-5 py-4`}>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── PRODUCTS TABLE ── */}
      <div className={`${card} overflow-hidden`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-white/[0.05]">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{t("onlineCatalog")}</h2>
            <p className="text-xs text-gray-500">{products.length} {t("products")}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                className="pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:border-[#c8202f]/40 transition text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                placeholder={t("searchProducts")}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg text-xs text-gray-600 dark:text-gray-300 focus:outline-none focus:border-[#c8202f]/40 transition"
              value={filterStatus}
              onChange={e => setFilter(e.target.value)}
            >
              <option value="all">{t("allStatus")}</option>
              <option value="in-stock">{t("inStockLabel")}</option>
              <option value="low-stock">{t("lowStockLabel")}</option>
              <option value="out-of-stock">{t("outOfStockLabel")}</option>
            </select>
          </div>
        </div>

        {/* Table header */}
        <div className="grid px-6 py-3 text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-600 border-b border-gray-100 dark:border-white/[0.04]"
          style={{ gridTemplateColumns: "2.2fr 1.2fr 1.1fr 1fr 1fr 1.2fr 1.2fr" }}>
          <span>{t("product")}</span>
          <span>{t("category")}</span>
          <span>{t("onlinePrice")}</span>
          <span>{t("stock")}</span>
          <span>SKU</span>
          <span>{t("status")}</span>
          <span>{t("visibility")}</span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500 dark:text-gray-600">{t("noProductsMatch")}</div>
        ) : (
          products.map((p, i) => {
            const sc  = STATUS_CONFIG[p.stockStatus] ?? STATUS_CONFIG["in-stock"];
            const pct = Math.min(Math.round(((p.stock ?? 0) / Math.max(p.minStockThreshold ?? 1, 1)) * 100), 100);
            return (
              <div key={p._id}
                className={`grid px-6 py-4 items-center hover:bg-gray-50 dark:hover:bg-white/[0.02] transition ${i < products.length - 1 ? "border-b border-gray-100 dark:border-white/[0.03]" : ""}`}
                style={{ gridTemplateColumns: "2.2fr 1.2fr 1.1fr 1fr 1fr 1.2fr 1.2fr" }}>

                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                    {initials(p.name)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{p.name}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-600">{p._id.slice(-6)}</p>
                  </div>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400">{p.category || "—"}</p>

                <p className="text-sm font-bold text-gray-900 dark:text-white">{fmtTND(p.onlinePrice)}</p>

                <div>
                  <p className={`text-sm font-bold ${p.stock === 0 ? "text-red-400" : (p.stock ?? 0) <= (p.minStockThreshold ?? 0) ? "text-amber-400" : "text-gray-900 dark:text-white"}`}>
                    {(p.stock ?? 0).toLocaleString()}
                  </p>
                  {mounted && (
                    <div className="mt-1 h-1 w-14 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.2 + i * 0.05, duration: 0.5 }}
                        className={`h-full rounded-full ${p.stock === 0 ? "bg-red-500" : (p.stock ?? 0) <= (p.minStockThreshold ?? 0) ? "bg-amber-500" : "bg-[#c8202f]"}`}
                      />
                    </div>
                  )}
                </div>

                <p className="text-xs text-gray-400 dark:text-gray-500 tracking-wider">{p.sku}</p>

                <div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${sc.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                    {sc.label}
                  </span>
                </div>

                <div>
                  <button
                    onClick={() => handleToggleVisibility(p._id)}
                    disabled={togglingId === p._id}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${p.isVisible
                      ? "bg-[#c8202f]/10 text-[#c8202f] hover:bg-[#c8202f]/20"
                      : "bg-gray-200 dark:bg-white/5 text-gray-500 hover:bg-gray-300 dark:hover:bg-white/10"
                    }`}>
                    {togglingId === p._id
                      ? <RefreshCw size={10} className="animate-spin" />
                      : p.isVisible ? <Eye size={10} /> : <EyeOff size={10} />
                    }
                    {p.isVisible ? t("visible") : t("hidden")}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>

      {/* ── ADD PRODUCT MODAL ── */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">{t("addProduct")}</h3>
                <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition"><X size={18} /></button>
              </div>
              <div className="space-y-4">

                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-widest mb-1 block">Stock Product</label>
                  <select className="w-full px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition"
                    value={productForm.stockProductId} onChange={e => handleStockSelect(e.target.value)}>
                    <option value="">— Select from stock catalogue —</option>
                    {stockProducts.map(sp => (
                      <option key={sp._id} value={sp._id}>{sp.name} ({sp.sku})</option>
                    ))}
                  </select>
                </div>

                {productForm.stockProductId && (
                  <div className="p-3 rounded-xl bg-[#c8202f]/5 border border-[#c8202f]/20 grid grid-cols-2 gap-2 text-xs">
                    <span className="text-gray-400">SKU</span><span className="font-mono text-[#c8202f]">{productForm.sku}</span>
                  </div>
                )}

                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-widest mb-1 block">{t("product")} Name</label>
                  <input className="w-full px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition"
                    value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-widest mb-1 block">{t("category")}</label>
                    <input className="w-full px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition"
                      placeholder="e.g. Équerres Standard"
                      value={productForm.category} onChange={e => setProductForm(f => ({ ...f, category: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-widest mb-1 block">{t("onlinePrice")} (TND)</label>
                    <input type="text" inputMode="decimal" className="w-full px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition"
                      value={productForm.onlinePrice}
                      onChange={e => setProductForm(f => ({ ...f, onlinePrice: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-widest mb-1 block">Description</label>
                  <textarea rows={2} className="w-full px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition resize-none"
                    value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-widest mb-1 block">Min Stock Threshold</label>
                    <input type="text" inputMode="numeric" className="w-full px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition"
                      value={productForm.minStockThreshold}
                      onChange={e => setProductForm(f => ({ ...f, minStockThreshold: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <div onClick={() => setProductForm(f => ({ ...f, isVisible: !f.isVisible }))}
                        className={`w-10 h-5 rounded-full transition-colors ${productForm.isVisible ? "bg-[#c8202f]" : "bg-gray-300 dark:bg-white/20"} relative`}>
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${productForm.isVisible ? "translate-x-5" : "translate-x-0.5"}`} />
                      </div>
                      <span className="text-xs text-gray-500">{t("visibility")}</span>
                    </label>
                  </div>
                </div>

                {createError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{createError}</p>}

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition">Cancel</button>
                  <button onClick={handleCreateProduct} disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#c8202f] hover:bg-[#e02d3c] text-white font-bold text-xs transition disabled:opacity-60">
                    {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    {t("addProduct")}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}