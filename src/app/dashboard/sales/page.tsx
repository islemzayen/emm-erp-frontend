// Dashboard — Online Sales
"use client";

import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion } from "framer-motion";
import {
  DollarSign, ShoppingCart, Truck, RefreshCw,
  Download, Plus, Search, ArrowDownToLine, Tag, Megaphone,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { salesService, type OnlineOrder, type DashboardStats } from "@/services/salesService";
import { exportBrandedXlsx } from "@/lib/reportExport";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-[#c8202f]/20 text-[#c8202f]", "bg-blue-500/20 text-blue-400",
  "bg-purple-500/20 text-purple-400",   "bg-amber-500/20 text-amber-400",
  "bg-pink-500/20 text-pink-400",       "bg-teal-500/20 text-teal-400",
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

// ─── Sparkline ───────────────────────────────────────────────────────────────
function Sparkline({ data, dataKey, color }: { data: any[]; dataKey: string; color: string }) {
  // Need at least 2 points for a line; if only 1, hide sparkline rather than show empty box
  if (data.length < 2) return null;
  
  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={data}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Animated Counter ────────────────────────────────────────────────────────
function Counter({ value, prefix = "" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / 1200, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.floor(e * value));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value]);
  return <>{prefix}{display.toLocaleString()}</>;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 dark:bg-white/5 rounded ${className}`} />;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SalesDashboard() {
  const { t } = useLanguage();
  const [stats, setStats]         = useState<DashboardStats | null>(null);
  const [orders, setOrders]       = useState<OnlineOrder[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<"6m" | "3m" | "1m">("6m");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery]   = useState("");
  const [mounted, setMounted]           = useState(false);

  const card = "bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/[0.06] border-t-2 border-t-[#c8202f] rounded-2xl transition-colors duration-300 hover:shadow-[0_0_20px_#c8202f10]";
  const tooltipStyle = { backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "10px", fontSize: "11px" };

  const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
    completed:  { label: t("completed"),  badge: "bg-[#c8202f]/15 text-[#c8202f]", dot: "bg-[#c8202f]" },
    processing: { label: t("processing"), badge: "bg-blue-500/15 text-blue-400",       dot: "bg-blue-400"    },
    pending:    { label: t("pending"),    badge: "bg-amber-500/15 text-amber-400",     dot: "bg-amber-400"   },
    cancelled:  { label: t("cancelled"),  badge: "bg-red-500/15 text-red-400",         dot: "bg-red-400"     },
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashStats, ordersRes] = await Promise.all([
        salesService.getStats(),
        salesService.getOrders({ limit: 8 }),
      ]);
      setStats(dashStats);
      setOrders(ordersRes.orders);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setMounted(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filter chart data by tab
  const chartData = stats?.chartData ?? [];
  const slicedChart = activeTab === "1m" ? chartData.slice(-1)
    : activeTab === "3m" ? chartData.slice(-3)
    : chartData;

  const filteredOrders = orders.filter(o => {
    const matchStatus = filterStatus === "all" || o.status === filterStatus;
    const matchSearch = o.customer.name.toLowerCase().includes(searchQuery.toLowerCase())
      || o.orderNo.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  const totalRevenue = stats?.totalRevenue ?? 0;

  // ── Compute real month-over-month deltas from chartData ───────────────────
  const monthDelta = (key: "revenue" | "orders") => {
    if (slicedChart.length < 2) return null;
    const curr = slicedChart[slicedChart.length - 1]?.[key] ?? 0;
    const prev = slicedChart[slicedChart.length - 2]?.[key] ?? 0;
    if (prev === 0) return null;
    const pct = ((curr - prev) / prev) * 100;
    return pct;
  };

  const formatDelta = (pct: number | null) => {
    if (pct === null) return t("thisMonth");
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}%`;
  };

  const revDelta   = monthDelta("revenue");
  const ordDelta   = monthDelta("orders");

  const kpis = [
    {
      label: t("totalRevenue2"), value: totalRevenue, prefix: "",
      change: formatDelta(revDelta),
      changeColor: revDelta === null ? "text-gray-500" : revDelta >= 0 ? "text-[#c8202f]" : "text-red-400",
      valueColor: "text-[#c8202f]",
      sparkColor: "#c8202f", icon: <DollarSign size={16} />, iconBg: "bg-[#c8202f]/10 text-[#c8202f]",
      spark: slicedChart.map(d => ({ v: d.revenue })), fmt: fmtTND,
    },
    {
      label: t("totalOrdersKpi2"), value: stats?.totalOrders ?? 0, prefix: "",
      change: formatDelta(ordDelta),
      changeColor: ordDelta === null ? "text-gray-500" : ordDelta >= 0 ? "text-blue-400" : "text-red-400",
      valueColor: "text-blue-400",
      sparkColor: "#60a5fa", icon: <ShoppingCart size={16} />, iconBg: "bg-blue-500/10 text-blue-400",
      spark: slicedChart.map(d => ({ v: d.orders })),
    },
    {
      label: t("pendingShipments"), value: stats?.pendingShipments ?? 0, prefix: "",
      change: t("thisMonth"),
      changeColor: "text-amber-400", valueColor: "text-amber-400",
      sparkColor: "#f59e0b", icon: <Truck size={16} />, iconBg: "bg-amber-500/10 text-amber-400",
      spark: [],
    },
    {
      label: t("returns"), value: stats?.totalReturns ?? 0, prefix: "",
      change: t("thisMonth"),
      changeColor: "text-red-400", valueColor: "text-red-400",
      sparkColor: "#f87171", icon: <RefreshCw size={16} />, iconBg: "bg-red-500/10 text-red-400",
      spark: [],
    },
  ];

  const exportCsv = async () => {
    if (!orders.length) return;
    const headers = ["Order No", "Customer", "Products", "Amount (TND)", "Status", "Date"];
    const rows = orders.map((o: any) => [
      o.orderNo,
      (o.customer?.name||""),
      (o.lines||[]).map((l:any)=>`${l.productName} ×${l.quantity}`).join(" | "),
      (o.totalAmount||0).toFixed(3),
      o.status,
      o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-GB") : "—",
    ]);
    await exportBrandedXlsx("Sales Dashboard Report", headers, rows, `Sales_Dashboard_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <ProtectedRoute allowedRoles={["SALES_MANAGER"]}>
      <div className="min-h-screen bg-gray-100 dark:bg-[#060a0f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

        {/* ── HEADER ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight leading-none">
              {t("dashboard")}{" "}
              <span className="text-[#c8202f]">{t("onlineSales")}</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">EMM ERP</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={load} className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20 px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> {t("refresh")}
            </button>
            <button onClick={exportCsv} disabled={!orders.length} className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-[#c8202f]/40 hover:text-[#c8202f] px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300 disabled:opacity-40">
              <Download size={13} /> {t("exportCsv")}
            </button>
          </div>
        </div>

        {/* ── TOP KPI CARDS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {kpis.map((kpi, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className={`${card} p-5 flex flex-col gap-3`}>
              <div className="flex items-start justify-between">
                <div className={`p-2 rounded-xl ${kpi.iconBg}`}>{kpi.icon}</div>
                <span className={`text-xs font-bold ${kpi.changeColor}`}>{kpi.change}</span>
              </div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">{kpi.label}</p>
              {loading ? <Skeleton className="h-9 w-24" /> : (
                <p className={`text-3xl font-bold tracking-tight ${kpi.valueColor}`}>
                  {mounted ? (
                    kpi.fmt ? kpi.fmt(kpi.value) : <Counter value={kpi.value} prefix={kpi.prefix} />
                  ) : `${kpi.prefix}${kpi.value}`}
                </p>
              )}
              {kpi.spark.length > 1 && (
                <div className="-mx-1">
                  <Sparkline data={kpi.spark} dataKey="v" color={kpi.sparkColor} />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* ── SECONDARY KPI STRIP ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: t("avgOrderValue"),  value: loading ? "—" : fmtTND(stats?.avgOrderValue ?? 0), sub: t("perTransaction") },
            { label: t("newCustomers"),   value: loading ? "—" : String(stats?.newCustomers ?? 0),  sub: t("thisMonth") },
            { label: t("activePromos"),   value: loading ? "—" : String(stats?.activePromotions?.length ?? 0), sub: t("promotionsRunning") },
            { label: t("activeCampaigns"), value: loading ? "—" : String(stats?.activeCampaigns?.length ?? 0), sub: t("campaignsRunning") },
          ].map((s, i) => (
            <div key={i} className={`${card} px-5 py-4`}>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── CHARTS ROW ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Revenue Overview (2/3) */}
          <div className={`${card} p-6 xl:col-span-2 space-y-2`}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">{t("revenueOverview")}</h2>
                <p className="text-xs text-gray-500">{t("monthlyPerf")}</p>
              </div>
              <div className="flex gap-1">
                {(["6m", "3m", "1m"] as const).map((r) => (
                  <button key={r} onClick={() => setActiveTab(r)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${activeTab === r ? "bg-[#c8202f] text-white" : "text-gray-400 hover:text-gray-900 dark:hover:text-white"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-8 py-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500">{t("totalRevenue2")}</p>
                {loading ? <Skeleton className="h-8 w-32 mt-1" /> : (
                  <p className="text-2xl font-bold text-[#c8202f]">{fmtTND(totalRevenue)}</p>
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500">{t("totalOrdersKpi2")}</p>
                {loading ? <Skeleton className="h-8 w-16 mt-1" /> : (
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{(stats?.totalOrders ?? 0).toLocaleString()}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">{t("revenueTND")}</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={slicedChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:[stroke:#1a2030]" />
                    <XAxis dataKey="label" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="revenue" fill="#c8202f" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">{t("ordersPerMonth")}</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={slicedChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:[stroke:#1a2030]" />
                    <XAxis dataKey="label" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="orders" stroke="#60a5fa" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Marketing Panel (1/3) */}
          <div className="flex flex-col gap-4">
            {/* Active Promotions */}
            <div className={`${card} p-5 flex-1`}>
              <div className="flex items-center gap-2 mb-4">
                <Tag size={14} className="text-[#c8202f]" />
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">{t("activePromos")}</h2>
              </div>
              {loading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (stats?.activePromotions ?? []).length === 0 ? (
                <p className="text-xs text-gray-500">{t("noActivePromos")}</p>
              ) : (
                <div className="space-y-2">
                  {(stats?.activePromotions ?? []).slice(0, 4).map((p: any) => (
                    <div key={p._id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-white/[0.04] last:border-0">
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white">{p.code}</p>
                        <p className="text-[10px] text-gray-500">{p.name}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#c8202f]/15 text-[#c8202f]">
                        -{p.discount}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Campaigns */}
            <div className={`${card} p-5 flex-1`}>
              <div className="flex items-center gap-2 mb-4">
                <Megaphone size={14} className="text-blue-400" />
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">{t("activeCampaigns")}</h2>
              </div>
              {loading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (stats?.activeCampaigns ?? []).length === 0 ? (
                <p className="text-xs text-gray-500">{t("noActiveCampaigns")}</p>
              ) : (
                <div className="space-y-2">
                  {(stats?.activeCampaigns ?? []).slice(0, 3).map((c: any) => (
                    <div key={c._id} className="py-2 border-b border-gray-100 dark:border-white/[0.04] last:border-0">
                      <div className="flex justify-between mb-1">
                        <p className="text-xs font-bold text-gray-900 dark:text-white">{c.name}</p>
                        <span className="text-[10px] text-blue-400 font-bold">{c.conversionRate?.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500">
                        <span>{c.channel} · {c.leads} {t("leads")}</span>
                        <span>{fmtTND(c.spend)} / {fmtTND(c.budget)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── ORDERS TABLE ── */}
        <div className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-white/[0.05]">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{t("recentOrders")}</h2>
              <p className="text-xs text-gray-500">{filteredOrders.length} {t("orders")}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  className="pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:border-[#c8202f]/40 transition text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                  placeholder={t("searchOrdersPlaceholder")}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <select
                className="px-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg text-xs text-gray-600 dark:text-gray-300 focus:outline-none focus:border-[#c8202f]/40 transition"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
              >
                <option value="all">{t("allStatus")}</option>
                <option value="completed">{t("completed")}</option>
                <option value="processing">{t("processing")}</option>
                <option value="pending">{t("pending")}</option>
                <option value="cancelled">{t("cancelled")}</option>
              </select>
              <button onClick={exportCsv} disabled={!orders.length} className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-[#c8202f]/40 hover:text-[#c8202f] px-3 py-1.5 rounded-lg text-xs text-gray-500 dark:text-gray-400 transition disabled:opacity-40">
                <ArrowDownToLine size={12} /> {t("export")}
              </button>
            </div>
          </div>

          <div className="grid px-6 py-3 text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-600 border-b border-gray-100 dark:border-white/[0.04]"
            style={{ gridTemplateColumns: "2fr 2.5fr 1.2fr 1.2fr 0.7fr" }}>
            <span>{t("order")}</span>
            <span>{t("product")}</span>
            <span>{t("amount")}</span>
            <span>{t("status")}</span>
            <span>{t("date")}</span>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-500 dark:text-gray-600">{t("noOrdersMatchFilter")}</div>
          ) : (
            filteredOrders.map((order, i) => {
              const sc = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
              const productLabel = order.lines.map(l => `${l.productName} ×${l.quantity}`).join(", ");
              return (
                <div key={order._id}
                  className={`grid px-6 py-4 items-center hover:bg-gray-50 dark:hover:bg-white/[0.02] transition ${i < filteredOrders.length - 1 ? "border-b border-gray-100 dark:border-white/[0.03]" : ""}`}
                  style={{ gridTemplateColumns: "2fr 2.5fr 1.2fr 1.2fr 0.7fr" }}>
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
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{fmtTND(order.totalAmount)}</p>
                  <div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${sc.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      {sc.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-600">{fmtDate(order.createdAt)}</p>
                </div>
              );
            })
          )}
        </div>

        {/* ── BOTTOM ROW ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* Order status breakdown */}
          <div className={`${card} p-6`}>
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">{t("ordersByStatus")}</h2>
            <p className="text-xs text-gray-500 mb-5">{t("currentBreakdown")}</p>
            <div className="space-y-4">
              {([
                { key: "completed",  label: t("completed"),  color: "bg-[#c8202f]" },
                { key: "processing", label: t("processing"), color: "bg-blue-500"    },
                { key: "pending",    label: t("pending"),    color: "bg-amber-500"   },
                { key: "cancelled",  label: t("cancelled"),  color: "bg-red-500"     },
              ] as const).map((s, i) => {
                const count = stats?.ordersByStatus?.[s.key] ?? 0;
                const total = stats?.totalOrders ?? 1;
                const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={s.key}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{s.label}</span>
                      <div className="flex gap-3">
                        <span className="text-xs text-gray-400 dark:text-gray-500">{count}</span>
                        <span className="text-xs font-bold text-gray-900 dark:text-white">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-1 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: mounted ? `${pct}%` : "0%" }}
                        transition={{ delay: 0.3 + i * 0.1, duration: 0.6 }}
                        className={`h-full ${s.color} rounded-full`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top promo codes */}
          <div className={`${card} p-6`}>
            <div className="flex items-center gap-2 mb-1">
              <Tag size={14} className="text-[#c8202f]" />
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{t("topPromoCodes")}</h2>
            </div>
            <p className="text-xs text-gray-500 mb-5">{t("mostUsedThisPeriod")}</p>
            {loading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (stats?.topPromoCodes ?? []).length === 0 ? (
              <p className="text-xs text-gray-500 py-4 text-center">{t("noPromoUsageYet")}</p>
            ) : (
              <div className="space-y-3">
                {(stats?.topPromoCodes ?? []).map((p: any, i: number) => (
                  <div key={p._id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 text-xs">{String(i + 1).padStart(2, "0")}</span>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white">{p._id}</p>
                        <p className="text-[10px] text-gray-500">{p.count} {t("uses")}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#c8202f]">{fmtTND(p.saved)} {t("saved")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Monthly Goal */}
          <div className={`${card} p-6 flex flex-col gap-6`}>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">{t("quickActions")}</h2>
              <p className="text-xs text-gray-500 mb-4">{t("shortcuts")}</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: t("newOrder2"),  icon: "📋", cls: "bg-[#c8202f]/10 border-[#c8202f]/20 text-[#c8202f]" },
                  { label: t("addProduct"), icon: "📦", cls: "bg-blue-500/10 border-blue-500/20 text-blue-400" },
                  { label: t("invoice"),    icon: "🧾", cls: "bg-purple-500/10 border-purple-500/20 text-purple-400" },
                  { label: t("report"),     icon: "📊", cls: "bg-amber-500/10 border-amber-500/20 text-amber-400" },
                  { label: t("shipment"),   icon: "🚚", cls: "bg-teal-500/10 border-teal-500/20 text-teal-400" },
                  { label: t("returns"),    icon: "↩️", cls: "bg-red-500/10 border-red-500/20 text-red-400" },
                ].map((a, i) => (
                  <button key={i} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold border transition hover:brightness-125 ${a.cls}`}>
                    <span>{a.icon}</span>
                    <span className="text-gray-900 dark:text-white/80">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#c8202f]/5 border border-[#c8202f]/15">
              <div className="flex justify-between mb-2">
                <span className="text-xs font-bold text-gray-700 dark:text-white/70">{t("monthlyGoal")}</span>
                <span className="text-xs font-bold text-[#c8202f]">
                  {totalRevenue > 0 ? Math.min(Math.round((totalRevenue / 60000) * 100), 100) : 0}%
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: mounted ? `${Math.min(Math.round((totalRevenue / 60000) * 100), 100)}%` : "0%" }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                  className="h-full rounded-full bg-gradient-to-r from-[#c8202f] to-blue-500"
                />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-gray-400 dark:text-gray-600">{fmtTND(totalRevenue)} / 60,000 TND</span>
                <span className="text-[10px] text-amber-400">{t("daysLeft")}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </ProtectedRoute>
  );
}