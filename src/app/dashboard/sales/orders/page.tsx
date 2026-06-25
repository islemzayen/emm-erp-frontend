// Orders — Online Sales
"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart, CheckCircle, Clock, TrendingUp,
  Search, Plus, Download, RefreshCw, X, Tag, Loader2, Trash2, ArrowRight, Check,
} from "lucide-react";
import { salesService, type OnlineOrder, type OnlineProduct, type ActiveCampaign } from "@/services/salesService";
import { exportBrandedXlsx } from "@/lib/reportExport";
import PhoneInput from "@/components/PhoneInput";
import AddressInput from "@/components/AddressInput";

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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-TN", { day: "numeric", month: "short" });
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
export default function OrdersPage() {
  const { t } = useLanguage();
  const [orders, setOrders]           = useState<OnlineOrder[]>([]);
  const [total, setTotal]             = useState(0);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [filterStatus, setFilter]     = useState("all");
  const [updatingId, setUpdatingId]   = useState<string | null>(null);
  const [mounted, setMounted]         = useState(false);

  // ── Create Order modal ──────────────────────────────────────────────────────
  const [showCreate, setShowCreate]   = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [products, setProducts]       = useState<OnlineProduct[]>([]);
  const [campaigns, setCampaigns]     = useState<ActiveCampaign[]>([]);
  const [promoValid, setPromoValid]   = useState<any>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [createError, setCreateError] = useState("");

  const emptyOrderForm = {
    customerName: "", customerEmail: "", customerPhone: "", customerAddress: "",
    promotionCode: "",
    campaignId: "",
    lines: [{ productId: "", quantity: 1, unitPrice: 0, productName: "", sku: "" }] as
      { productId: string; quantity: number; unitPrice: number; productName: string; sku: string }[],
  };
  const [orderForm, setOrderForm] = useState(emptyOrderForm);

  const card = "bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/[0.06] border-t-2 border-t-[#c8202f] rounded-2xl transition-colors duration-300 hover:shadow-[0_0_20px_#c8202f10]";

  const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
    completed:  { label: t("completed"),  badge: "bg-emerald-500/15 text-emerald-400", dot: "bg-emerald-400" },
    processing: { label: t("processing"), badge: "bg-blue-500/15 text-blue-400",       dot: "bg-blue-400"    },
    pending:    { label: t("pending"),    badge: "bg-amber-500/15 text-amber-400",     dot: "bg-amber-400"   },
    cancelled:  { label: t("cancelled"),  badge: "bg-red-500/15 text-red-400",         dot: "bg-red-400"     },
  };

  const loadProducts = async () => {
    try { setProducts(await salesService.getProducts()); }
    catch (e) { console.error(e); }
  };

  const loadCampaigns = async () => {
    try { setCampaigns(await salesService.getActiveCampaigns()); }
    catch (e) { console.error(e); }
  };

  const openCreate = () => {
    setOrderForm(emptyOrderForm);
    setPromoValid(null);
    setCreateError("");
    loadProducts();
    loadCampaigns();
    setShowCreate(true);
  };

  const checkPromo = async (code: string) => {
    if (!code.trim()) { setPromoValid(null); return; }
    setPromoChecking(true);
    try {
      const promo = await salesService.validatePromoCode(code);
      setPromoValid(promo);
    } catch {
      setPromoValid(null);
    } finally { setPromoChecking(false); }
  };

  const setLine = (idx: number, field: string, value: any) => {
    setOrderForm(f => {
      const lines = [...f.lines];
      if (field === "productId") {
        const p = products.find(p => p._id === value);
        lines[idx] = { ...lines[idx], productId: value, unitPrice: p?.onlinePrice ?? 0, productName: p?.name ?? "", sku: p?.sku ?? "" };
      } else {
        lines[idx] = { ...lines[idx], [field]: value };
      }
      return { ...f, lines };
    });
  };

  const addLine = () => setOrderForm(f => ({
    ...f, lines: [...f.lines, { productId: "", quantity: 1, unitPrice: 0, productName: "", sku: "" }]
  }));

  const removeLine = (idx: number) => setOrderForm(f => ({
    ...f, lines: f.lines.filter((_, i) => i !== idx)
  }));

  const subtotal = orderForm.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const discountedTotal = promoValid ? subtotal * (1 - promoValid.discount / 100) : subtotal;

  const handleCreateOrder = async () => {
    if (!orderForm.customerName.trim()) { setCreateError("Customer name is required"); return; }
    if (orderForm.lines.some(l => !l.productId)) { setCreateError("Please select a product for each line"); return; }
    setSubmitting(true); setCreateError("");
    try {
      await salesService.createOrder({
        customer: { name: orderForm.customerName, email: orderForm.customerEmail, phone: orderForm.customerPhone, address: orderForm.customerAddress },
        lines: orderForm.lines.map(l => ({ productId: l.productId, quantity: l.quantity, unitPrice: l.unitPrice, productName: l.productName, sku: l.sku })),
        promotionCode: orderForm.promotionCode || undefined,
        campaignId: orderForm.campaignId || undefined,
      } as any);
      setShowCreate(false);
      setOrderForm(emptyOrderForm);
      load();
    } catch (e: any) {
      setCreateError(e.response?.data?.message || "Failed to create order");
    } finally { setSubmitting(false); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await salesService.getOrders({ search, status: filterStatus, limit: 100 });
      setOrders(res.orders);
      setTotal(res.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setMounted(true);
    }
  }, [search, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleSyncTracking = async (id: string) => {
    setUpdatingId(id);
    try {
      const updated = await salesService.syncTracking(id);
      setOrders(prev => prev.map(o => o._id === id ? updated : o));
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusChange = async (id: string, status: OnlineOrder["status"]) => {
    setUpdatingId(id);
    try {
      const updated = await salesService.updateOrderStatus(id, status);
      setOrders(prev => prev.map(o => o._id === id ? updated : o));
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  };
  const handleDeleteOrder = async (id: string, orderNo: string) => {
    if (!confirm(`Delete order ${orderNo}? This cannot be undone.`)) return;
    try {
      await salesService.deleteOrder(id);
      setOrders(prev => prev.filter(o => o._id !== id));
    } catch (e: any) { alert(e.response?.data?.message || "Failed to delete order"); }
  };


  // Derived stats from loaded orders
  const completedCount  = orders.filter(o => o.status === "completed").length;
  const processingCount = orders.filter(o => o.status === "processing").length;
  const pendingCount    = orders.filter(o => o.status === "pending").length;
  const cancelledCount  = orders.filter(o => o.status === "cancelled").length;
  const activeOrders    = orders.filter(o => o.status !== "cancelled");
  const totalRevenue    = activeOrders.reduce((s, o) => s + o.totalAmount, 0);
  const avgOrderVal     = activeOrders.length > 0 ? totalRevenue / activeOrders.length : 0;
  const completionRate  = orders.length > 0 ? Math.round((completedCount / orders.length) * 100) : 0;

  const exportCsv = async () => {
    if (!orders.length) return;
    const headers = ["Order No", "Customer", "Email", "Phone", "Products", "Amount (TND)", "Discount (TND)", "Promo Code", "Status", "Reseller", "Date"];
    const rows = orders.map((o: any) => [
      o.orderNo,
      (o.customer?.name||""),
      o.customer?.email || "—",
      o.customer?.phone || "—",
      (o.lines||[]).map((l:any)=>`${l.productName} ×${l.quantity}`).join(" | "),
      (o.totalAmount||0).toFixed(3),
      o.discountAmount ? o.discountAmount.toFixed(3) : "0.000",
      o.promotionCode || "—",
      o.status,
      o.isResellerOrder ? "Yes" : "No",
      o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-GB") : "—",
    ]);
    await exportBrandedXlsx("Online Orders Report", headers, rows, `Orders_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <>
    <div className="min-h-screen bg-gray-100 dark:bg-[#060a0f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight leading-none">
            {t("orders")} <span className="text-[#c8202f]">{t("onlineOrdersTitle")}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">EMM ERP</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20 px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={exportCsv} disabled={!orders.length} className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-[#c8202f]/40 hover:text-[#c8202f] px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300 disabled:opacity-40">
            <Download size={13} /> {t("exportCsv")}
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 bg-[#c8202f] hover:bg-[#e02d3c] px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-white font-bold">
            <Plus size={13} /> {t("newOrder2")}
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: t("totalOrdersKpi2"),  value: total,          change: t("allTime"),         changeColor: "text-[#c8202f]", valueColor: "text-[#c8202f]", icon: <ShoppingCart size={16} />, iconBg: "bg-[#c8202f]/10 text-[#c8202f]" },
          { label: t("completed"),        value: completedCount, change: `${completionRate}%`,  changeColor: "text-blue-400",    valueColor: "text-blue-400",    icon: <CheckCircle size={16} />,  iconBg: "bg-blue-500/10 text-blue-400"       },
          { label: t("pending"),          value: pendingCount,   change: t("awaitingAction"),   changeColor: "text-amber-400",   valueColor: "text-amber-400",   icon: <Clock size={16} />,        iconBg: "bg-amber-500/10 text-amber-400"     },
          { label: t("avgOrderValue"),    value: avgOrderVal,    change: t("perTransaction"),   changeColor: "text-purple-400",  valueColor: "text-purple-400",  icon: <TrendingUp size={16} />,   iconBg: "bg-purple-500/10 text-purple-400",  isCurrency: true },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className={`${card} p-5 flex flex-col gap-3`}>
            <div className="flex items-start justify-between">
              <div className={`p-2 rounded-xl ${kpi.iconBg}`}>{kpi.icon}</div>
              <span className={`text-xs font-bold ${kpi.changeColor}`}>{kpi.change}</span>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500">{kpi.label}</p>
            {loading ? <Skeleton className="h-9 w-20" /> : (
              <p className={`text-3xl font-bold tracking-tight ${kpi.valueColor}`}>
                {"isCurrency" in kpi && kpi.isCurrency ? fmtTND(kpi.value) : kpi.value.toLocaleString()}
              </p>
            )}
          </motion.div>
        ))}
      </div>

      {/* ── STATUS STRIP ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: t("processing"),  value: processingCount,  sub: t("beingFulfilled") },
          { label: t("cancelled"),   value: cancelledCount,   sub: t("notFulfilled")},
          { label: t("totalRevenue2"), value: fmtTND(totalRevenue), sub: t("excludingCancelled") },
          { label: t("completionRate"), value: `${completionRate}%`, sub: t("completedVsTotal") },
        ].map((s, i) => (
          <div key={i} className={`${card} px-5 py-4`}>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{loading ? "—" : s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── ORDERS TABLE ── */}
      <div className={`${card} overflow-hidden`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-white/[0.05]">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{t("allOrders")}</h2>
            <p className="text-xs text-gray-500">{orders.length} {t("orders")}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                className="pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:border-[#c8202f]/40 transition text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                placeholder={t("searchOrdersPlaceholder")}
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
              <option value="completed">{t("completed")}</option>
              <option value="processing">{t("processing")}</option>
              <option value="pending">{t("pending")}</option>
              <option value="cancelled">{t("cancelled")}</option>
            </select>
          </div>
        </div>

        {/* Table header */}
        <div className="grid px-6 py-3 text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-600 border-b border-gray-100 dark:border-white/[0.04]"
          style={{ gridTemplateColumns: "2fr 2.5fr 1.2fr 1fr 1.5fr 0.8fr" }}>
          <span>{t("order")}</span>
          <span>{t("product")}</span>
          <span>{t("amount")}</span>
          <span>{t("promo")}</span>
          <span>{t("status")}</span>
          <span>{t("date")}</span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500 dark:text-gray-600">{t("noOrdersMatchFilter")}</div>
        ) : (
          orders.map((order, i) => {
            const sc = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
            const productLabel = order.lines.map(l => `${l.productName} ×${l.quantity}`).join(", ");
            const isUpdating = updatingId === order._id;
            return (
              <div key={order._id}
                className={`grid px-6 py-4 items-center hover:bg-gray-50 dark:hover:bg-white/[0.02] transition ${i < orders.length - 1 ? "border-b border-gray-100 dark:border-white/[0.03]" : ""}`}
                style={{ gridTemplateColumns: "2fr 2.5fr 1.2fr 1fr 1.5fr 0.8fr" }}>

                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                    {initials(order.customer.name)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{order.customer.name}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-600">{order.orderNo}</p>
                  </div>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 pr-4 truncate">{productLabel}</p>

                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{fmtTND(order.totalAmount)}</p>
                  {(order.promotionDiscount ?? 0) > 0 && (
                    <p className="text-[10px] text-gray-400 line-through">{fmtTND(order.subtotal ?? order.totalAmount)}</p>
                  )}
                </div>

                <div>
                  {order.promotionCode ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#c8202f]/10 text-[#c8202f]">
                      <Tag size={9} /> {order.promotionCode}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400">—</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-semibold ${sc.badge}`}>
                    {sc.label}
                  </span>
                  {isUpdating ? (
                    <RefreshCw size={12} className="animate-spin text-gray-400" />
                  ) : order.status === "pending" ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleStatusChange(order._id, "processing")}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-600 text-white hover:bg-blue-500 transition">
                        <ArrowRight size={11} /> {t("process")}
                      </button>
                      <button
                        onClick={() => handleStatusChange(order._id, "cancelled")}
                        className="inline-flex items-center justify-center w-[26px] h-[26px] rounded-md text-red-400 border border-red-500/30 hover:bg-red-500/10 transition">
                        <X size={11} />
                      </button>
                    </div>
                  ) : order.status === "processing" ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleStatusChange(order._id, "completed")}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#c8202f] text-white hover:bg-[#e02d3c] transition">
                        <Check size={11} /> {t("complete")}
                      </button>
                      <button
                        onClick={() => handleSyncTracking(order._id)}
                        title="Sync tracking from Commercial"
                        className="inline-flex items-center justify-center w-[26px] h-[26px] rounded-md text-purple-400 border border-purple-500/30 hover:bg-purple-500/10 transition">
                        <RefreshCw size={12} />
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-1">
                  <p className="text-[10px] text-gray-400 dark:text-gray-600">{fmtDate(order.createdAt)}</p>
                  <button
                    onClick={() => handleDeleteOrder(order._id, order.orderNo)}
                    className="p-1 rounded text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition ml-1"
                    title="Delete order permanently">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>


      {/* ── CREATE ORDER MODAL ── */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">{t("newOrder2")}</h3>
                <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition"><X size={18} /></button>
              </div>

              <div className="space-y-4">

                {/* Customer */}
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">{t("customer")}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: t("name"),  field: "customerName",    placeholder: "Ahmed Ben Salah" },
                      { label: t("email"), field: "customerEmail",   placeholder: "client@email.com" },
                    ].map(({ label, field, placeholder }) => (
                      <div key={field}>
                        <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                        <input
                          className="w-full px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition"
                          placeholder={placeholder}
                          value={(orderForm as any)[field]}
                          onChange={e => setOrderForm(f => ({ ...f, [field]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t("phone")}</label>
                      <PhoneInput
                        value={orderForm.customerPhone}
                        onChange={v => setOrderForm(f => ({ ...f, customerPhone: v }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t("address")}</label>
                      <AddressInput
                        value={orderForm.customerAddress}
                        onChange={v => setOrderForm(f => ({ ...f, customerAddress: v }))}
                        placeholder="Sfax, Tunisie"
                      />
                    </div>
                  </div>
                </div>

                {/* Lines */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-widest text-gray-500">{t("product")}</p>
                    <button onClick={addLine} className="text-[10px] text-[#c8202f] hover:text-[#e02d3c] flex items-center gap-1 transition">
                      <Plus size={10} /> Add line
                    </button>
                  </div>
                  <div className="space-y-2">
                    {orderForm.lines.map((line, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <select
                          className="flex-1 px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition"
                          value={line.productId}
                          onChange={e => setLine(idx, "productId", e.target.value)}
                        >
                          <option value="">— Select product —</option>
                          {products.map(p => (
                            <option key={p._id} value={p._id}>{p.name} ({p.sku})</option>
                          ))}
                        </select>
                        <input type="text" inputMode="numeric"
                          className="w-16 px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-center text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition"
                          placeholder="Qty"
                          value={line.quantity}
                          onChange={e => setLine(idx, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                        />
                        <div className="text-xs text-gray-400 w-24 text-right font-mono">
                          {line.unitPrice > 0 ? `${(line.unitPrice * line.quantity).toFixed(3)} TND` : "—"}
                        </div>
                        {orderForm.lines.length > 1 && (
                          <button onClick={() => removeLine(idx)} className="text-red-400 hover:text-red-300 transition flex-shrink-0">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Promo Code */}
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-widest mb-1 block">{t("promo")}</label>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition uppercase"
                      placeholder="e.g. SUMMER10"
                      value={orderForm.promotionCode}
                      onChange={e => { setOrderForm(f => ({ ...f, promotionCode: e.target.value.toUpperCase() })); setPromoValid(null); }}
                    />
                    <button onClick={() => checkPromo(orderForm.promotionCode)}
                      disabled={promoChecking || !orderForm.promotionCode}
                      className="px-3 py-2 rounded-xl bg-gray-200 dark:bg-white/10 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-white/20 transition disabled:opacity-40">
                      {promoChecking ? <Loader2 size={12} className="animate-spin" /> : "Check"}
                    </button>
                  </div>
                  {promoValid && (
                    <p className="text-[10px] text-[#c8202f] mt-1">✓ {promoValid.name} — {promoValid.discount}% off</p>
                  )}
                </div>

                {/* Campaign (optional) */}
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-widest mb-1 block">{t("campaign")}</label>
                  <select
                    className="w-full px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition"
                    value={orderForm.campaignId}
                    onChange={e => setOrderForm(f => ({ ...f, campaignId: e.target.value }))}
                  >
                    <option value="">— No campaign —</option>
                    {campaigns.map(c => (
                      <option key={c._id} value={c._id}>{c.name} ({c.channel})</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Attribute this order to a campaign — updates its leads and conversion rate.
                  </p>
                </div>

                {/* Total */}
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {promoValid ? `${t("subtotal")} → after ${promoValid.discount}% discount` : t("totalAmount")}
                  </span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {promoValid && subtotal !== discountedTotal && (
                      <span className="text-xs text-gray-400 line-through mr-2">{subtotal.toFixed(3)} TND</span>
                    )}
                    {discountedTotal.toFixed(3)} TND
                  </span>
                </div>

                {createError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{createError}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowCreate(false)}
                    className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition">
                    Cancel
                  </button>
                  <button onClick={handleCreateOrder} disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#c8202f] hover:bg-[#e02d3c] text-white font-bold text-xs transition disabled:opacity-60">
                    {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    {t("newOrder2")}
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