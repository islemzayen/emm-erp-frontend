// Tracking — Online Sales
"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { Truck, Search, Plus, Download, Package, CheckCircle, Clock, RefreshCw, X, Loader2 } from "lucide-react";
import { salesService, type OnlineShipment, type OnlineOrder } from "@/services/salesService";
import { exportBrandedXlsx } from "@/lib/reportExport";

const AVATAR_COLORS = [
  "bg-[#c8202f]/20 text-[#c8202f]", "bg-blue-500/20 text-blue-400",
  "bg-purple-500/20 text-purple-400",   "bg-amber-500/20 text-amber-400",
  "bg-pink-500/20 text-pink-400",       "bg-teal-500/20 text-teal-400",
  "bg-red-500/20 text-red-400",         "bg-indigo-500/20 text-indigo-400",
];

const CARRIER_BADGE: Record<string, string> = {
  DHL:    "bg-amber-500/10 text-amber-400",
  Aramex: "bg-blue-500/10 text-blue-400",
  TNT:    "bg-purple-500/10 text-purple-400",
  Other:  "bg-gray-500/10 text-gray-400",
};

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-TN", { day: "numeric", month: "short" });
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 dark:bg-white/5 rounded ${className}`} />;
}

export default function TrackingPage() {
  const { t } = useLanguage();

  const [shipments, setShipments]   = useState<OnlineShipment[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filterStatus, setFilter]   = useState("all");
  const [searchQuery, setSearch]    = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [mounted, setMounted]       = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders]         = useState<OnlineOrder[]>([]);
  const [formError, setFormError]   = useState("");

  const emptyForm = {
    orderId: "", orderNo: "", customerName: "", customerEmail: "",
    customerPhone: "", productSummary: "",
    carrier: "DHL" as OnlineShipment["carrier"],
    trackingNumber: "", estimatedAt: "", notes: "",
  };
  const [form, setForm] = useState(emptyForm);

  const card     = "bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl transition-colors duration-300";
  const inputCls = "w-full px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition";
  const labelCls = "text-xs text-gray-500 uppercase tracking-widest mb-1 block";

  const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
    delivered:    { label: t("delivered"), badge: "bg-[#c8202f]/15 text-[#c8202f]", dot: "bg-[#c8202f]" },
    "in-transit": { label: t("inTransit"), badge: "bg-blue-500/15 text-blue-400",       dot: "bg-blue-400"    },
    pending:      { label: t("pending"),   badge: "bg-amber-500/15 text-amber-400",     dot: "bg-amber-400"   },
    failed:       { label: t("failedKpi"), badge: "bg-red-500/15 text-red-400",         dot: "bg-red-400"     },
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await salesService.getShipments({ search: searchQuery, status: filterStatus, limit: 100 });
      setShipments(res.shipments);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setMounted(true);
    }
  }, [searchQuery, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const loadOrders = async () => {
    try {
      const res = await salesService.getOrders({ status: "processing", limit: 100 });
      setOrders(res.orders);
    } catch (e) { console.error(e); }
  };

  const openCreate = () => {
    setForm(emptyForm);
    setFormError("");
    loadOrders();
    setShowCreate(true);
  };

  const handleOrderSelect = (orderId: string) => {
    const order = orders.find((o) => o._id === orderId);
    if (!order) return;
    setForm((f) => ({
      ...f,
      orderId:        order._id,
      orderNo:        order.orderNo,
      customerName:   order.customer.name,
      customerEmail:  order.customer.email,
      customerPhone:  order.customer.phone,
      productSummary: order.lines.map((l) => `${l.productName} ×${l.quantity}`).join(", "),
    }));
  };

  const handleCreate = async () => {
    if (!form.orderId) { setFormError("Please select an order"); return; }
    setSubmitting(true);
    setFormError("");
    try {
      await salesService.createShipment({
        orderId:        form.orderId,
        orderNo:        form.orderNo,
        customer:       { name: form.customerName, email: form.customerEmail, phone: form.customerPhone },
        productSummary: form.productSummary,
        carrier:        form.carrier,
        trackingNumber: form.trackingNumber,
        estimatedAt:    form.estimatedAt ? new Date(form.estimatedAt).toISOString() : null,
        notes:          form.notes,
        status:         "pending",
      });
      setShowCreate(false);
      setForm(emptyForm);
      load();
    } catch (e: any) {
      setFormError(e.response?.data?.message || "Failed to create shipment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: OnlineShipment["status"]) => {
    setUpdatingId(id);
    try {
      const updated = await salesService.updateShipmentStatus(id, status);
      setShipments((prev) => prev.map((s) => (s._id === id ? updated : s)));
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  };

  const deliveredCount = shipments.filter((s) => s.status === "delivered").length;
  const inTransitCount = shipments.filter((s) => s.status === "in-transit").length;
  const pendingCount   = shipments.filter((s) => s.status === "pending").length;
  const failedCount    = shipments.filter((s) => s.status === "failed").length;

  const carrierCounts = shipments.reduce((acc, s) => {
    acc[s.carrier] = (acc[s.carrier] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const totalShipments = shipments.length || 1;
  const deliveryRate   = Math.round((deliveredCount / totalShipments) * 100);

  const exportXlsx = async () => {
    if (!shipments.length) return;
    const headers = ["Shipment No", "Order No", "Customer", "Carrier", "Tracking No", "Status", "Shipped Date", "Delivered Date", "ETA"];
    const rows = shipments.map((s: any) => [
      s.shipmentNo,
      s.orderNo,
      (s.customer?.name||""),
      s.carrier || "—",
      s.trackingNumber || "—",
      s.status,
      s.shippedAt    ? new Date(s.shippedAt).toLocaleDateString("en-GB")    : "—",
      s.deliveredAt  ? new Date(s.deliveredAt).toLocaleDateString("en-GB")  : "—",
      s.estimatedAt  ? new Date(s.estimatedAt).toLocaleDateString("en-GB")  : "—",
    ]);
    await exportBrandedXlsx("Shipments Report", headers, rows, `Shipments_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <>
      {/* ── MAIN PAGE ───────────────────────────────────────────────────── */}
      <div className="min-h-screen bg-gray-100 dark:bg-[#060a0f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight leading-none">
              {t("deliveryTracking").split(" ")[0]}{" "}
              <span className="text-[#c8202f]">{t("deliveryTracking").split(" ").slice(1).join(" ")}</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">EMM ERP</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={load} className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20 px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={exportXlsx} disabled={!shipments.length} className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-[#c8202f]/40 hover:text-[#c8202f] px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300 disabled:opacity-40">
              <Download size={13} /> {t("exportXlsx")}
            </button>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-[#c8202f] hover:bg-[#e02d3c] px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-white font-bold"
            >
              <Plus size={13} /> {t("newShipment")}
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {([
            { label: t("totalShipments"), value: shipments.length, change: t("thisMonthSub"),  changeColor: "text-[#c8202f]", valueColor: "text-[#c8202f]", icon: <Truck size={16} />,       iconBg: "bg-[#c8202f]/10 text-[#c8202f]" },
            { label: t("delivered"),      value: deliveredCount,   change: t("completedSub"),  changeColor: "text-blue-400",    valueColor: "text-blue-400",    icon: <CheckCircle size={16} />, iconBg: "bg-blue-500/10 text-blue-400"       },
            { label: t("inTransit"),      value: inTransitCount,   change: t("onTheWay"),       changeColor: "text-amber-400",   valueColor: "text-amber-400",   icon: <Package size={16} />,     iconBg: "bg-amber-500/10 text-amber-400"     },
            { label: t("failedKpi"),      value: failedCount,      change: t("needsActionSub"), changeColor: "text-red-400",     valueColor: "text-red-400",     icon: <Clock size={16} />,       iconBg: "bg-red-500/10 text-red-400"         },
          ] as const).map((kpi, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className={`${card} p-5 flex flex-col gap-3`}>
              <div className="flex items-start justify-between">
                <div className={`p-2 rounded-xl ${kpi.iconBg}`}>{kpi.icon}</div>
                <span className={`text-xs font-bold ${kpi.changeColor}`}>{kpi.change}</span>
              </div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">{kpi.label}</p>
              {loading ? <Skeleton className="h-9 w-16" /> : (
                <p className={`text-3xl font-bold tracking-tight ${kpi.valueColor}`}>{kpi.value}</p>
              )}
            </motion.div>
          ))}
        </div>

        {/* Secondary Strip */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: t("pendingShip"),  value: loading ? "—" : String(pendingCount),                     sub: t("awaitingDispatch") },
            { label: t("deliveryRate"), value: loading ? "—" : `${deliveryRate}%`,                       sub: t("successRate")      },
            { label: t("carriersKpi"),  value: loading ? "—" : String(Object.keys(carrierCounts).length), sub: Object.keys(carrierCounts).join(" · ") || "—" },
            { label: t("failedKpi"),    value: loading ? "—" : String(failedCount),                      sub: t("needsReschedule")  },
          ].map((s, i) => (
            <div key={i} className={`${card} px-5 py-4`}>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Shipments Table */}
        <div className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-white/[0.05]">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{t("shipmentTracker")}</h2>
              <p className="text-xs text-gray-500">{shipments.length} {t("shipments")}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  className="pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:border-[#c8202f]/40 transition text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                  placeholder={t("searchShipments")}
                  value={searchQuery}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="px-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg text-xs text-gray-600 dark:text-gray-300 focus:outline-none focus:border-[#c8202f]/40 transition"
                value={filterStatus}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">{t("allStatus")}</option>
                <option value="delivered">{t("delivered")}</option>
                <option value="in-transit">{t("inTransit")}</option>
                <option value="pending">{t("pending")}</option>
                <option value="failed">{t("failedKpi")}</option>
              </select>
            </div>
          </div>

          <div className="grid px-6 py-3 text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-600 border-b border-gray-100 dark:border-white/[0.04]"
            style={{ gridTemplateColumns: "2fr 2fr 1.5fr 1fr 1fr 1fr 1.5fr" }}>
            <span>{t("customer")}</span>
            <span>{t("product")}</span>
            <span>{t("trackingNo")}</span>
            <span>{t("carrier")}</span>
            <span>{t("shipped")}</span>
            <span>{t("eta")}</span>
            <span>{t("status")}</span>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[1,2,3,4,5,6].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : shipments.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-500 dark:text-gray-600">{t("noShipmentsMatch")}</div>
          ) : (
            shipments.map((s, i) => {
              const sc = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.pending;
              const cc = CARRIER_BADGE[s.carrier] ?? CARRIER_BADGE.Other;
              const isUpdating = updatingId === s._id;
              return (
                <div key={s._id}
                  className={`grid px-6 py-4 items-center hover:bg-gray-50 dark:hover:bg-white/[0.02] transition ${i < shipments.length - 1 ? "border-b border-gray-100 dark:border-white/[0.03]" : ""}`}
                  style={{ gridTemplateColumns: "2fr 2fr 1.5fr 1fr 1fr 1fr 1.5fr" }}>

                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                      {initials(s.customer.name)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{s.customer.name}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-600">{s.shipmentNo} · {s.orderNo}</p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-gray-400 pr-4 truncate">{s.productSummary || "—"}</p>
                  <p className="text-xs text-gray-700 dark:text-gray-300 font-bold tracking-wider">{s.trackingNumber || "—"}</p>

                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold w-fit ${cc}`}>
                    {s.carrier}
                  </span>

                  <p className="text-[10px] text-gray-400 dark:text-gray-600">{fmtDate(s.shippedAt)}</p>

                  <p className={`text-xs font-bold ${s.status === "delivered" ? "text-[#c8202f]" : s.status === "failed" ? "text-red-400" : "text-gray-500 dark:text-gray-400"}`}>
                    {fmtDate(s.estimatedAt)}
                  </p>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${sc.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      {sc.label}
                    </span>
                    {isUpdating ? (
                      <RefreshCw size={12} className="animate-spin text-gray-400" />
                    ) : s.status === "pending" ? (
                      <button onClick={() => handleStatusChange(s._id, "in-transit")}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition">
                        {t("dispatch")}
                      </button>
                    ) : s.status === "in-transit" ? (
                      <button onClick={() => handleStatusChange(s._id, "delivered")}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#c8202f]/10 text-[#c8202f] hover:bg-[#c8202f]/20 transition">
                        {t("markDelivered")}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

          <div className={`${card} p-6`}>
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">{t("shipmentsByCarrier")}</h2>
            <p className="text-xs text-gray-500 mb-5">{t("volumeSplitMonth")}</p>
            {loading ? (
              <div className="space-y-3">{[1,2,3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : Object.keys(carrierCounts).length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No shipments yet</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(carrierCounts).map(([carrier, count], i) => {
                  const pct = Math.round((count / totalShipments) * 100);
                  return (
                    <div key={carrier}>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-xs text-gray-500 dark:text-gray-400">{carrier}</span>
                        <div className="flex gap-3">
                          <span className="text-xs text-gray-400 dark:text-gray-500">{count} {t("shipments")}</span>
                          <span className="text-xs font-bold text-gray-900 dark:text-white">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: mounted ? `${pct}%` : "0%" }}
                          transition={{ delay: 0.3 + i * 0.1, duration: 0.6 }}
                          className={`h-full rounded-full ${i === 0 ? "bg-amber-500" : i === 1 ? "bg-blue-500" : "bg-purple-500"}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`${card} p-6 flex flex-col justify-between`}>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">{t("deliveryGoal")}</h2>
              <p className="text-xs text-gray-500 mb-6">{t("deliveredVsTotal")}</p>
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-xs font-bold text-gray-700 dark:text-white/70">{t("deliveryRate")}</span>
                <span className="text-xs font-bold text-[#c8202f]">{deliveryRate}%</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: mounted ? `${deliveryRate}%` : "0%" }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                  className="h-full rounded-full bg-gradient-to-r from-[#c8202f] to-blue-500"
                />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-gray-400 dark:text-gray-600">
                  {deliveredCount} / {shipments.length} {t("delivered")}
                </span>
                <span className="text-[10px] text-amber-400">
                  {inTransitCount} {t("stillMoving")}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── CREATE SHIPMENT MODAL ────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">{t("newShipment")}</h3>
                <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">

                <div>
                  <label className={labelCls}>Order (Processing)</label>
                  <select className={inputCls} value={form.orderId} onChange={(e) => handleOrderSelect(e.target.value)}>
                    <option value="">— Select an order —</option>
                    {orders.map((o) => (
                      <option key={o._id} value={o._id}>{o.orderNo} · {o.customer.name}</option>
                    ))}
                  </select>
                  {orders.length === 0 && (
                    <p className="text-[10px] text-amber-400 mt-1">No orders in &quot;processing&quot; status yet.</p>
                  )}
                </div>

                {form.orderId && (
                  <div className="p-3 rounded-xl bg-[#c8202f]/5 border border-[#c8202f]/20 space-y-1">
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{form.customerName}</p>
                    <p className="text-[10px] text-gray-400">{form.customerEmail}{form.customerPhone ? ` · ${form.customerPhone}` : ""}</p>
                    <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{form.productSummary}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>{t("carrier")}</label>
                    <select className={inputCls} value={form.carrier}
                      onChange={(e) => setForm((f) => ({ ...f, carrier: e.target.value as OnlineShipment["carrier"] }))}>
                      {["DHL","Aramex","TNT","Other"].map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>{t("trackingNo")}</label>
                    <input className={inputCls} placeholder="e.g. 1234567890"
                      value={form.trackingNumber}
                      onChange={(e) => setForm((f) => ({ ...f, trackingNumber: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>{t("eta")}</label>
                  <input type="date" className={inputCls}
                    value={form.estimatedAt}
                    onChange={(e) => setForm((f) => ({ ...f, estimatedAt: e.target.value }))} />
                </div>

                <div>
                  <label className={labelCls}>Notes</label>
                  <textarea rows={2} className={`${inputCls} resize-none`}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>

                {formError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{formError}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowCreate(false)}
                    className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition">
                    Cancel
                  </button>
                  <button onClick={handleCreate} disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#c8202f] hover:bg-[#e02d3c] text-white font-bold text-xs transition disabled:opacity-60">
                    {submitting ? <Loader2 size={13} className="animate-spin" /> : <Truck size={13} />}
                    {t("newShipment")}
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