// src/app/dashboard/sales/stock/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Search, AlertTriangle, CheckCircle, RefreshCw,
  Plus, X, Loader2, ChevronDown, Filter, Inbox,
  Warehouse, ShoppingCart, TrendingDown, Send,
  BarChart2, Edit2, Save,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { salesService, type OnlineProduct } from "@/services/salesService";
import api from "@/services/api";

// ── Extended product type with dual stock ─────────────────────────────────────
interface EnrichedProduct extends OnlineProduct {
  warehouseQty:        number | null;
  warehouseStatus:     string;
  onlineAllocatedQty:  number;
  onlineSoldQty:       number;
  onlineAvailableQty:  number;
  onlineStatus:        string;
}

// ── Refill types ──────────────────────────────────────────────────────────────
interface RefillLine {
  onlineProductId: string;
  productName: string;
  sku: string;
  currentStock: number;
  minThreshold: number;
  requestedQty: number;
}
interface RefillRequest {
  _id: string;
  requestNo: string;
  lines: RefillLine[];
  status: "pending" | "approved" | "rejected" | "fulfilled";
  priority: "LOW" | "NORMAL" | "URGENT";
  notes: string;
  adminNotes: string;
  requestedBy: string;
  createdAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 dark:bg-white/5 rounded ${className}`} />;
}

const STATUS_ONLINE: Record<string, { label: string; badge: string; dot: string }> = {
  "in-stock":     { label: "In Stock",      badge: "bg-emerald-500/15 text-emerald-400", dot: "bg-emerald-400" },
  "low-stock":    { label: "Low Stock",     badge: "bg-amber-500/15 text-amber-400",     dot: "bg-amber-400"   },
  "out-of-stock": { label: "Out of Stock",  badge: "bg-red-500/15 text-red-400",         dot: "bg-red-400"     },
  "pending":      { label: "Not Allocated", badge: "bg-gray-200/50 dark:bg-white/5 text-gray-400", dot: "bg-gray-400" },
};

const STATUS_REFILL: Record<string, { label: string; badge: string }> = {
  pending:   { label: "Pending",   badge: "bg-amber-500/15 text-amber-400"   },
  approved:  { label: "Approved",  badge: "bg-blue-500/15 text-blue-400"     },
  rejected:  { label: "Rejected",  badge: "bg-red-500/15 text-red-400"       },
  fulfilled: { label: "Fulfilled", badge: "bg-emerald-500/15 text-emerald-400" },
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW:    "bg-gray-500/10 text-gray-400 border-gray-500/20",
  NORMAL: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  URGENT: "bg-red-500/10 text-red-400 border-red-500/20",
};

const refillApi = {
  list:             (params?: any)              => api.get("/online-sales/refill", { params }).then(r => r.data),
  create:           (body: any)                 => api.post("/online-sales/refill", body).then(r => r.data),
  updateStatus:     (id: string, status: string, adminNotes?: string) =>
    api.patch(`/online-sales/refill/${id}/status`, { status, adminNotes }).then(r => r.data),
  checkAvailability:(id: string)                => api.get(`/online-sales/refill/${id}/availability`).then(r => r.data),
};

const allocationApi = {
  update: (id: string, qty: number) =>
    api.patch(`/online-sales/products/${id}/allocation`, { onlineAllocatedQty: qty }).then(r => r.data),
};

// ── Main ───────────────────────────────────────────────────────────────────────
export default function SalesStockPage() {
  const { t } = useLanguage();

  const [products, setProducts]       = useState<EnrichedProduct[]>([]);
  const [loadingStock, setLoadingStock] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab]     = useState<"stock" | "refills">("stock");

  const [refillRequests, setRefillRequests] = useState<RefillRequest[]>([]);
  const [loadingRefills, setLoadingRefills] = useState(false);
  const [refillFilter, setRefillFilter]     = useState("all");

  // Allocation editing
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editingQty, setEditingQty]   = useState<number>(0);
  const [savingId, setSavingId]       = useState<string | null>(null);

  // Refill modal
  const [showRefillModal, setShowRefillModal]     = useState(false);
  const [selectedProducts, setSelectedProducts]   = useState<Record<string, number>>({});
  const [refillPriority, setRefillPriority]       = useState<"LOW" | "NORMAL" | "URGENT">("NORMAL");
  const [refillNotes, setRefillNotes]             = useState("");
  const [submitting, setSubmitting]               = useState(false);
  const [submitError, setSubmitError]             = useState("");

  const card = "bg-white dark:bg-[#111c35] border border-[#1b2a6b]/15 dark:border-[#1b2a6b]/20 border-t-2 border-t-[#c8202f] rounded-2xl transition-colors duration-300";

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadProducts = useCallback(async () => {
    setLoadingStock(true);
    try {
      const prods = await salesService.getProducts() as EnrichedProduct[];
      setProducts(prods);
    } catch (e) { console.error(e); }
    finally { setLoadingStock(false); }
  }, []);

  const loadRefills = useCallback(async () => {
    setLoadingRefills(true);
    try {
      const data = await refillApi.list({ status: refillFilter });
      setRefillRequests(data.requests ?? data);
    } catch (e) { console.error(e); }
    finally { setLoadingRefills(false); }
  }, [refillFilter]);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { if (activeTab === "refills") loadRefills(); }, [activeTab, loadRefills]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const categories = ["all", ...Array.from(new Set(products.map(p => p.category).filter(Boolean)))];

  const filtered = products.filter(p => {
    const ep = p as EnrichedProduct;
    const matchStatus   = filterStatus === "all" || (ep.onlineStatus ?? ep.stockStatus ?? "") === filterStatus;
    const matchCategory = filterCategory === "all" || p.category === filterCategory;
    const matchSearch   =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())  ||
      (p.category ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchCategory && matchSearch;
  });

  const warehouseTotal    = products.reduce((s, p) => s + ((p as EnrichedProduct).warehouseQty ?? 0), 0);
  const allocatedTotal    = products.reduce((s, p) => s + ((p as EnrichedProduct).onlineAllocatedQty ?? 0), 0);
  const soldTotal         = products.reduce((s, p) => s + ((p as EnrichedProduct).onlineSoldQty ?? 0), 0);
  const availableTotal    = products.reduce((s, p) => s + ((p as EnrichedProduct).onlineAvailableQty ?? 0), 0);
  const needsRefillCount  = products.filter(p => ["low-stock", "out-of-stock"].includes((p as EnrichedProduct).onlineStatus ?? (p as EnrichedProduct).stockStatus ?? "")).length;

  const chartData = filtered.slice(0, 15).map(p => ({
    name:      p.name.split(" ").slice(0, 2).join(" "),
    warehouse: (p as EnrichedProduct).warehouseQty ?? 0,
    allocated: (p as EnrichedProduct).onlineAllocatedQty ?? 0,
    available: (p as EnrichedProduct).onlineAvailableQty ?? 0,
  }));

  // ── Allocation editing ────────────────────────────────────────────────────
  function startEdit(p: EnrichedProduct) {
    setEditingId(p._id);
    setEditingQty((p as EnrichedProduct).onlineAllocatedQty ?? 0);
  }

  async function saveAllocation(p: EnrichedProduct) {
    setSavingId(p._id);
    try {
      await allocationApi.update(p._id, editingQty);
      setEditingId(null);
      loadProducts();
    } catch (e) { console.error(e); }
    finally { setSavingId(null); }
  }

  // ── Refill modal ──────────────────────────────────────────────────────────
  function openRefillModal(preselect?: EnrichedProduct[]) {
    const init: Record<string, number> = {};
    if (preselect) {
      for (const p of preselect) {
        const ep = p as EnrichedProduct;
        const needed = Math.max(1, (ep.onlineAllocatedQty || (p.minStockThreshold ?? 5) * 2) - (ep.onlineAvailableQty ?? 0));
        init[p._id] = needed;
      }
    }
    setSelectedProducts(init);
    setRefillPriority("NORMAL");
    setRefillNotes("");
    setSubmitError("");
    setShowRefillModal(true);
  }

  function toggleProduct(p: EnrichedProduct) {
    setSelectedProducts(prev => {
      if (prev[p._id] !== undefined) {
        const next = { ...prev }; delete next[p._id]; return next;
      }
      const ep = p as EnrichedProduct;
      const needed = Math.max(1, (ep.onlineAllocatedQty || (p.minStockThreshold ?? 5) * 2) - (ep.onlineAvailableQty ?? 0));
      return { ...prev, [p._id]: needed };
    });
  }

  async function submitRefill() {
    const productIds = Object.keys(selectedProducts);
    if (productIds.length === 0) { setSubmitError("Select at least one product."); return; }
    setSubmitting(true); setSubmitError("");
    try {
      await refillApi.create({ productIds, quantities: selectedProducts, priority: refillPriority, notes: refillNotes });
      setShowRefillModal(false);
      setSelectedProducts({});
      setActiveTab("refills");
      loadRefills();
    } catch (e: any) {
      setSubmitError(e?.response?.data?.message || "Failed to submit.");
    } finally { setSubmitting(false); }
  }

  const filteredRefills = refillRequests.filter(r => refillFilter === "all" || r.status === refillFilter);

  return (
    <div className="min-h-screen bg-[#f0f4ff] dark:bg-[#060d1f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight leading-none">
            Online Sales <span className="text-[#c8202f]">Stock</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">EMM ERP · Stock Overview</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={loadProducts}
            className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-[#c8202f]/50 px-3 py-2 rounded-xl text-xs transition text-gray-600 dark:text-gray-300">
            <RefreshCw size={13} className={loadingStock ? "animate-spin" : ""} />
          </button>
          {needsRefillCount > 0 && (
            <button
              onClick={() => openRefillModal(products.filter(p => ["low-stock", "out-of-stock"].includes((p as EnrichedProduct).onlineStatus ?? (p as EnrichedProduct).stockStatus ?? "")) as EnrichedProduct[])}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition font-bold">
              <AlertTriangle size={13} /> Request Refill ({needsRefillCount})
            </button>
          )}
          <button onClick={() => openRefillModal()}
            className="flex items-center gap-2 bg-[#c8202f] hover:bg-[#e02d3c] text-white px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition font-bold">
            <Plus size={13} /> New Refill Request
          </button>
        </div>
      </div>

      {/* ── Dual KPI Strip ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Warehouse */}
        <div className={`${card} p-4`}>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#1b2a6b] dark:text-blue-400 mb-2">
            <Warehouse size={13} /> Warehouse Total
          </div>
          <p className="text-2xl font-bold text-[#1b2a6b] dark:text-blue-400">
            {loadingStock ? "—" : warehouseTotal.toLocaleString()}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">units in warehouse</p>
        </div>

        {/* Allocated */}
        <div className={`${card} p-4`}>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-purple-400 mb-2">
            <Package size={13} /> Allocated to Online
          </div>
          <p className="text-2xl font-bold text-purple-400">
            {loadingStock ? "—" : allocatedTotal.toLocaleString()}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">units reserved for online sales</p>
        </div>

        {/* Sold */}
        <div className={`${card} p-4`}>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#c8202f] mb-2">
            <ShoppingCart size={13} /> Sold Online
          </div>
          <p className="text-2xl font-bold text-[#c8202f]">
            {loadingStock ? "—" : soldTotal.toLocaleString()}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">units from completed orders</p>
        </div>

        {/* Available */}
        <div className={`${card} p-4`}>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-emerald-400 mb-2">
            <CheckCircle size={13} /> Available Online
          </div>
          <p className="text-2xl font-bold text-emerald-400">
            {loadingStock ? "—" : availableTotal.toLocaleString()}
          </p>
          <p className="text-[10px] text-gray-500 mt-0.5">allocated − sold</p>
        </div>
      </div>

      {/* ── Chart ── */}
      <div className={`${card} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold">Warehouse vs Online Allocation</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">Per product — first 15 results</p>
          </div>
          <div className="flex items-center gap-4 text-[10px]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#1b2a6b]" /> Warehouse</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-purple-500" /> Allocated</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#c8202f]" /> Available</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,100,100,0.1)" />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} />
            <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} />
            <Tooltip
              contentStyle={{ backgroundColor: "#111c35", border: "1px solid #1b2a6b33", borderRadius: "10px", fontSize: "11px" }}
              labelStyle={{ color: "#c8202f" }}
            />
            <Bar dataKey="warehouse" name="Warehouse"  fill="#1b2a6b"  radius={[3,3,0,0]} />
            <Bar dataKey="allocated" name="Allocated"  fill="#8b5cf6"  radius={[3,3,0,0]} />
            <Bar dataKey="available" name="Available"  fill="#c8202f"  radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1 w-fit">
        {([["stock", "Stock Levels"], ["refills", "Refill Requests"]] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === tab ? "bg-[#c8202f] text-white" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}>
            {label}
            {tab === "refills" && refillRequests.filter(r => r.status === "pending").length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-bold">
                {refillRequests.filter(r => r.status === "pending").length}
              </span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ── STOCK TAB ── */}
        {activeTab === "stock" && (
          <motion.div key="stock" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">

            {/* Filters */}
            <div className={`${card} p-4 flex flex-wrap gap-3 items-center`}>
              <div className="relative flex-1 min-w-[200px]">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="w-full pl-8 pr-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs focus:outline-none focus:border-[#c8202f]/40 transition text-gray-900 dark:text-white placeholder-gray-400"
                  placeholder="Search products…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="relative">
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                  className="pl-3 pr-8 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-600 dark:text-gray-300 focus:outline-none appearance-none transition">
                  <option value="all">All Status</option>
                  <option value="in-stock">In Stock</option>
                  <option value="low-stock">Low Stock</option>
                  <option value="out-of-stock">Out of Stock</option>
                  <option value="pending">Not Allocated</option>
                </select>
                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              <div className="relative">
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                  className="pl-3 pr-8 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-600 dark:text-gray-300 focus:outline-none appearance-none transition">
                  {categories.map(c => <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>)}
                </select>
                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              <span className="text-xs text-gray-500 ml-auto">{filtered.length} products</span>
            </div>

            {/* Table */}
            <div className={`${card} overflow-hidden`}>
              {/* Header */}
              <div className="grid px-6 py-3 text-[10px] uppercase tracking-widest text-gray-500 border-b border-gray-100 dark:border-white/[0.04]"
                style={{ gridTemplateColumns: "2fr 0.8fr 1fr 1fr 1fr 1fr 1.2fr 1.2fr" }}>
                <span>Product</span>
                <span>Category</span>
                <span className="text-[#1b2a6b] dark:text-blue-400">Warehouse</span>
                <span className="text-purple-400">Allocated</span>
                <span className="text-[#c8202f]">Sold Online</span>
                <span className="text-emerald-400">Available</span>
                <span>Status</span>
                <span>Action</span>
              </div>

              {loadingStock ? (
                <div className="p-6 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-500">No products found</div>
              ) : (
                filtered.map((p, i) => {
                  const ep = p as EnrichedProduct;
                  const sc = STATUS_ONLINE[ep.onlineStatus ?? ep.stockStatus ?? "pending"] ?? STATUS_ONLINE["pending"];
                  const isEditing = editingId === p._id;
                  const needsRefill = ["low-stock", "out-of-stock"].includes(ep.onlineStatus ?? ep.stockStatus ?? "");

                  return (
                    <div key={p._id}
                      className={`grid px-6 py-3.5 items-center hover:bg-gray-50 dark:hover:bg-white/[0.02] transition ${i < filtered.length - 1 ? "border-b border-gray-100 dark:border-white/[0.03]" : ""}`}
                      style={{ gridTemplateColumns: "2fr 0.8fr 1fr 1fr 1fr 1fr 1.2fr 1.2fr" }}>

                      {/* Name */}
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{p.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{p.sku}</p>
                      </div>

                      {/* Category */}
                      <p className="text-xs text-gray-500 truncate">{p.category || "—"}</p>

                      {/* Warehouse */}
                      <p className="text-sm font-bold text-[#1b2a6b] dark:text-blue-400">
                        {ep.warehouseQty == null ? <span className="text-gray-400 text-xs">—</span> : (ep.warehouseQty ?? 0).toLocaleString()}
                      </p>

                      {/* Allocated — editable */}
                      <div>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              value={editingQty}
                              onChange={e => setEditingQty(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-16 bg-gray-50 dark:bg-white/10 border border-[#c8202f]/40 rounded-lg px-2 py-1 text-xs text-center text-gray-900 dark:text-white focus:outline-none"
                              autoFocus
                            />
                            <button onClick={() => saveAllocation(ep)} disabled={savingId === p._id}
                              className="text-emerald-400 hover:text-emerald-300 transition">
                              {savingId === p._id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                            </button>
                            <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-white transition">
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(ep)}
                            className="flex items-center gap-1 text-sm font-bold text-purple-400 hover:text-purple-300 transition group">
                            {(ep.onlineAllocatedQty ?? 0) > 0 ? (ep.onlineAllocatedQty ?? 0).toLocaleString() : <span className="text-gray-400 text-xs">Set</span>}
                            <Edit2 size={10} className="opacity-0 group-hover:opacity-100 transition" />
                          </button>
                        )}
                      </div>

                      {/* Sold */}
                      <p className="text-sm font-bold text-[#c8202f]">
                        {(ep.onlineSoldQty ?? 0).toLocaleString()}
                      </p>

                      {/* Available */}
                      <p className={`text-sm font-bold ${
                        (ep.onlineAvailableQty ?? 0) <= 0 ? "text-red-400"
                        : (ep.onlineAvailableQty ?? 0) <= (p.minStockThreshold ?? 0) ? "text-amber-400"
                        : "text-emerald-400"
                      }`}>
                        {(ep.onlineAvailableQty ?? 0).toLocaleString()}
                      </p>

                      {/* Status */}
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${sc.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>

                      {/* Action */}
                      <div className="flex items-center gap-1.5">
                        {needsRefill && (
                          <button onClick={() => openRefillModal([ep])}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#c8202f]/10 hover:bg-[#c8202f]/20 text-[#c8202f] text-[10px] font-bold transition">
                            <Send size={9} /> Refill
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Legend note */}
            <div className={`${card} p-4`}>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                <span className="text-[#1b2a6b] dark:text-blue-400 font-bold">Warehouse</span> — total units physically in stock (read from Stock module) ·{" "}
                <span className="text-purple-400 font-bold">Allocated</span> — units reserved for Online Sales (click to edit) ·{" "}
                <span className="text-[#c8202f] font-bold">Sold Online</span> — units from completed online orders ·{" "}
                <span className="text-emerald-400 font-bold">Available</span> — Allocated − Sold (what's actually sellable online)
              </p>
            </div>
          </motion.div>
        )}

        {/* ── REFILLS TAB ── */}
        {activeTab === "refills" && (
          <motion.div key="refills" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total",     value: refillRequests.length,                                       color: "text-gray-900 dark:text-white" },
                { label: "Pending",   value: refillRequests.filter(r => r.status === "pending").length,   color: "text-amber-400"   },
                { label: "Approved",  value: refillRequests.filter(r => r.status === "approved").length,  color: "text-blue-400"    },
                { label: "Fulfilled", value: refillRequests.filter(r => r.status === "fulfilled").length, color: "text-emerald-400" },
              ].map((k, i) => (
                <div key={i} className={`${card} px-5 py-4`}>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">{k.label}</p>
                  <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                </div>
              ))}
            </div>

            <div className={`${card} p-4 flex gap-3 items-center`}>
              <div className="relative">
                <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select value={refillFilter} onChange={e => setRefillFilter(e.target.value)}
                  className="pl-8 pr-8 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-600 dark:text-gray-300 focus:outline-none appearance-none transition">
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="fulfilled">Fulfilled</option>
                </select>
                <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              <span className="text-xs text-gray-500">{filteredRefills.length} requests</span>
              <button onClick={loadRefills} className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#c8202f] transition">
                <RefreshCw size={12} className={loadingRefills ? "animate-spin" : ""} /> Refresh
              </button>
            </div>

            {loadingRefills ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
            ) : filteredRefills.length === 0 ? (
              <div className={`${card} p-12 flex flex-col items-center justify-center gap-3`}>
                <Inbox size={32} className="text-gray-300 dark:text-gray-700" />
                <p className="text-sm text-gray-500">No refill requests</p>
                <button onClick={() => openRefillModal()}
                  className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#c8202f] hover:bg-[#e02d3c] text-white text-xs font-bold transition">
                  <Plus size={12} /> Create Request
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRefills.map(req => {
                  const sr = STATUS_REFILL[req.status];
                  return (
                    <motion.div key={req._id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className={`${card} p-5`}>
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{req.requestNo}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${sr.badge}`}>{sr.label}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${PRIORITY_COLORS[req.priority]}`}>{req.priority}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {new Date(req.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                            {req.requestedBy ? ` · by ${req.requestedBy}` : ""}
                          </p>
                        </div>
                        {req.status === "pending" && (
                          <button onClick={async () => {
                            try {
                              await refillApi.updateStatus(req._id, "fulfilled");
                              loadRefills(); loadProducts();
                            } catch (e: any) {
                              const msg = e?.response?.data?.message || "Failed";
                              const isStock = e?.response?.status === 409;
                              alert(isStock
                                ? `⚠️ ${msg}`
                                : msg);
                              loadRefills();
                            }
                          }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-bold transition">
                            <CheckCircle size={10} /> Mark Fulfilled
                          </button>
                        )}
                      </div>

                      <div className="mt-3 space-y-2">
                        {req.lines.map((line, i) => (
                          <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-gray-100 dark:border-white/[0.04] last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900 dark:text-white">{line.productName}</span>
                              <span className="text-gray-400 font-mono text-[10px]">{line.sku}</span>
                            </div>
                            <div className="flex items-center gap-4 text-gray-500 text-[11px]">
                              <span>Online Available: <strong className="text-gray-900 dark:text-white">{line.currentStock}</strong></span>
                              <span>Min: <strong className="text-amber-400">{line.minThreshold}</strong></span>
                              <span className="text-[#c8202f] font-bold">+{line.requestedQty} requested</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {(req.notes || req.adminNotes) && (
                        <div className="mt-2 flex gap-4 text-[11px]">
                          {req.notes && <p className="text-gray-500 italic">"{req.notes}"</p>}
                          {req.adminNotes && <p className="text-blue-400 italic">Admin: "{req.adminNotes}"</p>}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Refill Modal ── */}
      <AnimatePresence>
        {showRefillModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-white dark:bg-[#111c35] border border-[#1b2a6b]/20 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">

              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/[0.06]">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Send size={15} className="text-[#c8202f]" /> New Stock Refill Request
                </h2>
                <button onClick={() => setShowRefillModal(false)} className="text-gray-400 hover:text-white transition"><X size={18} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">

                {/* Priority + notes */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 block">Priority</label>
                    <div className="flex gap-2">
                      {(["LOW", "NORMAL", "URGENT"] as const).map(p => (
                        <button key={p} onClick={() => setRefillPriority(p)}
                          className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold border transition ${
                            refillPriority === p ? PRIORITY_COLORS[p] : "border-gray-200 dark:border-white/10 text-gray-400"
                          }`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 block">Notes (optional)</label>
                    <input value={refillNotes} onChange={e => setRefillNotes(e.target.value)}
                      placeholder="e.g. Urgent — stock running out"
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#c8202f]/40 transition placeholder:text-gray-400 text-gray-900 dark:text-white" />
                  </div>
                </div>

                {/* Product selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] uppercase tracking-widest text-gray-500">Select Products</label>
                    <div className="flex gap-2 text-[10px]">
                      <button onClick={() => {
                        const sel: Record<string, number> = {};
                        products.filter(p => ["low-stock", "out-of-stock"].includes((p as EnrichedProduct).onlineStatus ?? (p as EnrichedProduct).stockStatus ?? "")).forEach(p => {
                          const ep = p as EnrichedProduct;
                          sel[p._id] = Math.max(1, (ep.onlineAllocatedQty || (p.minStockThreshold ?? 5) * 2) - ep.onlineAvailableQty);
                        });
                        setSelectedProducts(sel);
                      }} className="text-amber-400 hover:text-amber-300 font-bold transition">Select All Alerts</button>
                      <span className="text-gray-400">·</span>
                      <button onClick={() => setSelectedProducts({})} className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition">Clear</button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {products.map(p => {
                      const ep = p as EnrichedProduct;
                      const selected  = selectedProducts[p._id] !== undefined;
                      const needsAlert = ["low-stock", "out-of-stock"].includes(ep.onlineStatus ?? ep.stockStatus ?? "");
                      return (
                        <div key={p._id} onClick={() => toggleProduct(ep)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition ${
                            selected ? "border-[#c8202f]/40 bg-[#c8202f]/5" : "border-gray-200 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/10"
                          }`}>
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${selected ? "bg-[#c8202f] border-[#c8202f]" : "border-gray-300 dark:border-white/20"}`}>
                            {selected && <CheckCircle size={10} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{p.name}</p>
                              {needsAlert && (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${ep.onlineStatus === "out-of-stock" ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"}`}>
                                  {ep.onlineStatus === "out-of-stock" ? "OUT" : "LOW"}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400">
                              Warehouse: {ep.warehouseQty ?? "—"} · Allocated: {ep.onlineAllocatedQty} · Available: {ep.onlineAvailableQty} · Min: {p.minStockThreshold ?? 0}
                            </p>
                          </div>
                          {selected && (
                            <div className="flex items-center gap-1.5 ml-auto" onClick={e => e.stopPropagation()}>
                              <label className="text-[10px] text-gray-400">Qty:</label>
                              <input type="number" min={1}
                                value={selectedProducts[p._id] || 1}
                                onChange={e => setSelectedProducts(prev => ({ ...prev, [p._id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                                className="w-16 bg-gray-50 dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs text-center text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/40"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {Object.keys(selectedProducts).length > 0 && (
                  <div className="bg-[#c8202f]/5 border border-[#c8202f]/20 rounded-xl px-4 py-3">
                    <p className="text-[10px] text-[#c8202f] uppercase tracking-widest font-bold mb-1">Request Summary</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300">
                      {Object.keys(selectedProducts).length} product{Object.keys(selectedProducts).length !== 1 ? "s" : ""} ·{" "}
                      {Object.values(selectedProducts).reduce((a, b) => a + b, 0)} total units ·{" "}
                      {refillPriority} priority
                    </p>
                  </div>
                )}

                {submitError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{submitError}</p>
                )}
              </div>

              <div className="flex gap-3 px-6 py-4 border-t border-gray-100 dark:border-white/[0.06]">
                <button onClick={() => setShowRefillModal(false)}
                  className="flex-1 py-2 rounded-xl text-xs border border-gray-200 dark:border-white/10 text-gray-400 hover:border-[#c8202f]/40 transition font-bold">
                  Cancel
                </button>
                <button onClick={submitRefill} disabled={submitting || Object.keys(selectedProducts).length === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-[#c8202f] hover:bg-[#e02d3c] text-white text-xs font-bold transition disabled:opacity-50">
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  {submitting ? "Submitting…" : `Submit (${Object.keys(selectedProducts).length} products)`}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}