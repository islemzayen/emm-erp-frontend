"use client";
import { exportBrandedXlsx } from "@/lib/reportExport";

import { useLanguage } from "@/context/LanguageContext";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, DollarSign, Users, Target,
  ShoppingCart, AlertTriangle, Download, Loader2,
  BarChart2, Package, Megaphone, Tag,
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

import { campaignService, promotionService, segmentService } from "@/services/marketingService";
import { financeService } from "@/services/finance/financeService";
import { stockAlertService } from "@/services/stock/stockAlertService";
import { stockItemService } from "@/services/stock/stockItemService";
import { stockProductService } from "@/services/stock/stockProductService";
import { customerService } from "@/services/commercial/customerService";
import { salesOrderService } from "@/services/commercial/salesOrderService";
import { salesService } from "@/services/salesService";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt   = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmtK  = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
const fmtTnd = (n: number) => `${fmt(n)} TND`;

const TOOLTIP_STYLE = {
  backgroundColor: "#0d1117",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: "10px",
  fontSize: "11px",
  color: "#fff",
};

const DONUT_COLORS = ["#c8202f", "#60a5fa", "#f59e0b", "#f87171", "#a78bfa"];
const STATUS_COLOR: Record<string, string> = {
  Growing: "text-[#c8202f]",
  Stable:  "text-blue-400",
  Declining:"text-amber-400",
  "At Risk":"text-red-400",
};
const STATUS_DOT: Record<string, string> = {
  Growing: "bg-[#c8202f]",
  Stable:  "bg-blue-400",
  Declining:"bg-amber-400",
  "At Risk":"bg-red-400",
};

// ── Mini sparkline ────────────────────────────────────────────────────────────
function Spark({ data, color }: { data: number[]; color: string }) {
  const pts = data.map((v, i) => ({ v }));
  
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={pts}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon, iconBg, valueColor, spark, sparkColor, delay = 0,
}: {
  label: string; value: string; sub?: string; icon: React.ReactNode;
  iconBg: string; valueColor: string; spark?: number[]; sparkColor?: string; delay?: number;
}) {
  const card = "bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/[0.06] border-t-2 border-t-[#c8202f] rounded-2xl p-5 flex flex-col gap-2";
  return (
    <motion.div className={card} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <div className={`p-2 rounded-xl w-fit ${iconBg}`}>{icon}</div>
      <p className="text-[10px] uppercase tracking-widest text-gray-500">{label}</p>
      <p className={`text-3xl font-bold tracking-tight ${valueColor}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
      {spark && spark.length > 1 && sparkColor && (
        <div className="-mx-1 mt-1"><Spark data={spark} color={sparkColor} /></div>
      )}
    </motion.div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, sub, children, cols = "xl:col-span-1" }: {
  title: string; sub?: string; children: React.ReactNode; cols?: string;
}) {
  const card = "bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/[0.06] border-t-2 border-t-[#c8202f] rounded-2xl p-6";
  return (
    <div className={`${card} ${cols}`}>
      <h2 className="text-base font-bold text-gray-900 dark:text-white">{title}</h2>
      {sub && <p className="text-xs text-gray-500 mb-4">{sub}</p>}
      {children}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { t } = useLanguage();

  // ── State ──
  const [loading, setLoading] = useState(true);
  const [range, setRange]     = useState<"3m"|"6m"|"12m">("6m");
  const [chartMonth, setChartMonth] = useState<string>("all"); // "all" or "YYYY-MM"

  // Finance
  const [financeDash, setFinanceDash]     = useState<any>(null);
  const [financeReports, setFinanceReports] = useState<any>(null);
  const [financeEntries, setFinanceEntries] = useState<any[]>([]);

  // Marketing
  const [campaignAnalytics, setCampaignAnalytics] = useState<any>(null);
  const [campaignStats, setCampaignStats]         = useState<any>(null);
  const [campaigns, setCampaigns]                 = useState<any[]>([]);
  const [promoStats, setPromoStats]               = useState<any>(null);
  const [segmentStats, setSegmentStats]           = useState<any>(null);
  const [segments, setSegments]                   = useState<any[]>([]);

  // Stock
  const [stockAlerts, setStockAlerts]   = useState<any[]>([]);
  const [stockProducts, setStockProducts] = useState<any[]>([]);
  const [stockItems, setStockItems]     = useState<any[]>([]);

  // Customers
  const [customers, setCustomers]   = useState<any[]>([]);
  const [salesOrders, setSalesOrders] = useState<any[]>([]);
  // Online sales
  const [onlineOrders, setOnlineOrders] = useState<any[]>([]);
  const [onlineStats, setOnlineStats]   = useState<any>(null);

  useEffect(() => {
    const safe = <T,>(promise: Promise<T>, setter: (v: T) => void, label: string) =>
      promise.then(setter).catch(e => console.warn(`[Analytics] ${label} failed:`, e?.message ?? e));

    Promise.all([
      safe(financeService.getDashboard(),     setFinanceDash,         "finance/dashboard"),
      safe(financeService.getReports(),       setFinanceReports,      "finance/reports"),
      safe(financeService.getEntries(),       setFinanceEntries,      "finance/entries"),
      safe(campaignService.getAnalytics(),    setCampaignAnalytics,   "campaigns/analytics"),
      safe(campaignService.getStats(),        setCampaignStats,       "campaigns/stats"),
      safe(campaignService.getAll(),          setCampaigns,           "campaigns/all"),
      safe(promotionService.getStats(),       setPromoStats,          "promotions/stats"),
      safe(segmentService.getStats(),         setSegmentStats,        "segments/stats"),
      safe(segmentService.getAll(),           setSegments,            "segments/all"),
      safe(stockAlertService.getOpen(),       setStockAlerts,         "stock/alerts/open"),
      safe(stockProductService.getAll(),      setStockProducts,       "stock/products"),
      safe(stockItemService.getAll(),         setStockItems,          "stock/items"),
      safe(customerService.getAll(),          setCustomers,           "commercial/customers"),
      safe(salesOrderService.getAll(),        setSalesOrders,         "commercial/orders"),
      safe(salesService.getOrders({ limit: 500 }).then(r => r.orders), setOnlineOrders, "online-sales/orders"),
      safe(salesService.getStats(),                                          setOnlineStats,  "online-sales/stats"),
    ]).finally(() => setLoading(false));
  }, []);

  // ── Derived: revenue by month from finance entries ──
  const revenueByMonth = (() => {
    const map: Record<string, number> = {};
    for (const e of financeEntries) {
      if (e.direction !== "INFLOW") continue;
      const d = e.occurredAt ? new Date(e.occurredAt) : null;
      if (!d) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[key] = (map[key] ?? 0) + (e.amount ?? 0);
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({
        month: new Date(month + "-01").toLocaleString("en-US", { month: "short", year: "2-digit" }),
        revenue,
      }));
  })();

  const rangeN   = range === "3m" ? 3 : range === "6m" ? 6 : 12;
  const revSlice = revenueByMonth.slice(-rangeN);
  const revSpark = revSlice.map(r => r.revenue);

  // ── Derived: campaign monthly leads/spend ──
  const campMonthly = (campaignAnalytics?.monthly ?? []).map((m: any) => ({
    month: new Date(m.month + "-01").toLocaleString("en-US", { month: "short" }),
    leads: m.leads,
    spend: m.spend,
  })).slice(-rangeN);

  // ── Derived: segment donut ──
  const segDonut = [
    { name: "Growing",   value: segments.filter(s => s.status === "Growing").length },
    { name: "Stable",    value: segments.filter(s => s.status === "Stable").length },
    { name: "Declining", value: segments.filter(s => s.status === "Declining").length },
    { name: "At Risk",   value: segments.filter(s => s.status === "At Risk").length },
  ].filter(d => d.value > 0);

  // ── Derived: top campaigns by leads ──
  const topCampaigns = [...campaigns]
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 5);

  // ── Derived: top customers by totalOrderAmount ──
  const topCustomers = [...customers]
    .filter(c => (c.totalOrderAmount ?? 0) > 0)
    .sort((a, b) => (b.totalOrderAmount ?? 0) - (a.totalOrderAmount ?? 0))
    .slice(0, 5);

  // ── Derived: products needing promotion (low movement from alerts) ──
  const alertProductIds = new Set(stockAlerts.map((a: any) => a.productId?._id ?? a.productId));
  const productsToPromote = stockProducts
    .filter(p => alertProductIds.has(p._id))
    .slice(0, 5);

  // ── Derived: customers by country (bar chart) ──
  const customersByCountry = (() => {
    const map: Record<string, number> = {};
    for (const c of customers) {
      if (!c.country) continue;
      map[c.country] = (map[c.country] ?? 0) + 1;
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([country, count]) => ({ country, count }));
  })();

  // ── Derived: revenue by country (from customer totalOrderAmount) ──
  const revenueByCountry = (() => {
    const map: Record<string, number> = {};
    for (const c of customers) {
      if (!c.country || !(c.totalOrderAmount ?? 0)) continue;
      map[c.country] = (map[c.country] ?? 0) + (c.totalOrderAmount ?? 0);
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([country, revenue]) => ({ country, revenue }));
  })();

  // ── Derived: customer growth by month (from createdAt) ──
  const customerGrowth = (() => {
    const map: Record<string, number> = {};
    for (const c of customers) {
      const d = c.createdAt ? new Date(c.createdAt) : null;
      if (!d) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[key] = (map[key] ?? 0) + 1;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-rangeN)
      .map(([month, count]) => ({
        month: new Date(month + "-01").toLocaleString("en-US", { month: "short", year: "2-digit" }),
        count,
      }));
  })();

  // ── Derived: least represented countries (potential markets) ──
  const leastCustomers = [...customersByCountry].sort((a, b) => a.count - b.count).slice(0, 3);

  // ── Derived: commercial sales by month ──
  const calcOrderRevenue = (order: any) =>
    (order.lines ?? []).reduce((sum: number, l: any) => {
      const qty      = Number(l.quantity  ?? 0);
      const price    = Number(l.unitPrice ?? 0);
      const discount = Number(l.discount  ?? 0);
      return sum + qty * price * (1 - discount / 100);
    }, 0);

  const commercialByMonth = (() => {
    const map: Record<string, { revenue: number; orders: number }> = {};
    for (const o of salesOrders) {
      if (["CANCELLED", "RETURNED", "DRAFT"].includes(o.status)) continue;
      const d = o.createdAt ? new Date(o.createdAt) : null;
      if (!d) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map[key]) map[key] = { revenue: 0, orders: 0 };
      map[key].revenue += calcOrderRevenue(o);
      map[key].orders++;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-rangeN)
      .map(([month, v]) => ({
        month: new Date(month + "-01").toLocaleString("en-US", { month: "short", year: "2-digit" }),
        commercial: Math.round(v.revenue),
        online: 0, // filled below after merging
        orders: v.orders,
      }));
  })();

  // Use customer.totalOrderAmount — this is always populated by the Commercial backend
  // salesOrder lines may lack unitPrice if not fully populated in the API response
  const totalCommercialRevenue = customers
    .filter((c: any) => c.active !== false)
    .reduce((s: number, c: any) => s + (Number(c.totalOrderAmount) || 0), 0);

  const totalCommercialOrders = salesOrders
    .filter(o => !["CANCELLED","RETURNED","DRAFT"].includes(o.status)).length;

  // ── Merge online + commercial into a unified month array ──
  // Built from ALL months present in either dataset — so online-only months show up too
  const mergedByMonth = (() => {
    // Map commercial data by key
    // Use calcOrderRevenue (line-based) first; if all orders have 0 revenue (unitPrice not set),
    // fall back to distributing totalCommercialRevenue equally across months with orders
    const commercialMap: Record<string, { revenue: number; orders: number }> = {};
    for (const o of salesOrders) {
      if (["CANCELLED", "RETURNED", "DRAFT"].includes(o.status)) continue;
      const d = o.createdAt ? new Date(o.createdAt) : null;
      if (!d) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!commercialMap[key]) commercialMap[key] = { revenue: 0, orders: 0 };
      const lineRevenue = calcOrderRevenue(o);
      // Use line revenue if available; otherwise spread customer revenue proportionally
      commercialMap[key].revenue += lineRevenue;
      commercialMap[key].orders++;
    }
    // Fallback: if line-based revenue is 0 but real revenue exists from customers
    const totalLineRevenue = Object.values(commercialMap).reduce((s, v) => s + v.revenue, 0);
    if (totalLineRevenue === 0 && totalCommercialRevenue > 0) {
      const totalOrderCount = Object.values(commercialMap).reduce((s, v) => s + v.orders, 0);
      if (totalOrderCount > 0) {
        // Orders have dates — distribute proportionally by order count per month
        for (const key of Object.keys(commercialMap)) {
          commercialMap[key].revenue = Math.round(
            (commercialMap[key].orders / totalOrderCount) * totalCommercialRevenue
          );
        }
      } else {
        // Orders have no createdAt — put total into current month so chart shows data
        const now = new Date();
        const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        commercialMap[currentKey] = {
          revenue: Math.round(totalCommercialRevenue),
          orders:  salesOrders.filter(o => !["CANCELLED","RETURNED","DRAFT"].includes(o.status)).length,
        };
      }
    }
    // Map online data by key
    const onlineMap: Record<string, number> = {};
    for (const o of onlineOrders) {
      if (o.status === "cancelled") continue;
      const d = o.createdAt ? new Date(o.createdAt) : null;
      if (!d) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      onlineMap[key] = (onlineMap[key] ?? 0) + (o.totalAmount ?? 0);
    }
    // Union of all month keys from both sources
    const allKeys = Array.from(new Set([...Object.keys(commercialMap), ...Object.keys(onlineMap)]))
      .sort()
      .slice(-rangeN);

    const rows = allKeys.map(key => ({
      month:      new Date(key + "-01").toLocaleString("en-US", { month: "short", year: "2-digit" }),
      commercial: Math.round(commercialMap[key]?.revenue ?? 0),
      online:     Math.round(onlineMap[key] ?? 0),
      orders:     (commercialMap[key]?.orders ?? 0),
    }));

    // Final safety: if all commercial values are 0 but revenue exists,
    // spread it across months proportionally (or equally if no order count info)
    const totalChartCommercial = rows.reduce((s, r) => s + r.commercial, 0);
    if (totalChartCommercial === 0 && totalCommercialRevenue > 0 && rows.length > 0) {
      const totalChartOrders = rows.reduce((s, r) => s + r.orders, 0);
      rows.forEach(r => {
        r.commercial = totalChartOrders > 0
          ? Math.round((r.orders / totalChartOrders) * totalCommercialRevenue)
          : Math.round(totalCommercialRevenue / rows.length);
      });
    }

    return rows;
  })();

  const totalOnlineRevenue  = onlineStats?.totalRevenue  ?? onlineOrders
    .filter(o => o.status !== "cancelled")
    .reduce((s: number, o: any) => s + (o.totalAmount ?? 0), 0);
  const totalOnlineOrders   = onlineStats?.totalOrders   ?? onlineOrders.filter(o => o.status !== "cancelled").length;

  const avgOrderValue = (totalCommercialOrders + totalOnlineOrders) > 0
    ? Math.round((totalCommercialRevenue + totalOnlineRevenue) / (totalCommercialOrders + totalOnlineOrders)) : 0;

  // Status breakdown for commercial orders
  const ordersByStatus = ["CONFIRMED","DELIVERED","SHIPPED","PREPARED","CLOSED"].map(s => ({
    status: s,
    count: salesOrders.filter(o => o.status === s).length,
  })).filter(s => s.count > 0);


  // ── KPI values ──
  const totalRevenue   = financeDash?.totals?.recognizedRevenue ?? financeReports?.profitAndLoss?.revenue?.total ?? 0;
  const netResult      = financeReports?.profitAndLoss?.netResult ?? 0;
  const totalCustomers = customers.length;
  const openAlerts     = stockAlerts.length;

  const exportXlsx = async () => {
    const headers = ["Metric", "Value"];
    const rows: (string | number)[][] = [
      ["Total Revenue (TND)", (financeDash?.totals?.recognizedRevenue ?? financeReports?.profitAndLoss?.revenue?.total ?? 0).toFixed(3)],
      ["Active Campaigns", String(campaignStats?.active ?? 0)],
      ["Total Customers", String(customers.length)],
      ["Stock Alerts", String(stockAlerts.length)],
      ["Campaign Total Leads", String(campaignStats?.totalLeads ?? 0)],
      ["Campaign Total Spend (TND)", String(campaignStats?.totalSpend ?? 0)],
      ["Campaign ROI", `${(campaignStats?.roi ?? 0).toFixed(2)}x`],
      ["Commercial Revenue (TND)", totalCommercialRevenue.toFixed(3)],
      ["Online Revenue (TND)", totalOnlineRevenue.toFixed(3)],
      ["Total Commercial Orders", String(totalCommercialOrders)],
      ["Total Online Orders", String(totalOnlineOrders)],
      ["Avg Order Value (TND)", avgOrderValue.toFixed(3)],
    ];
    await exportBrandedXlsx("Marketing Analytics", headers, rows, `Analytics_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-[#060a0f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight leading-none">
            {t("marketing")} <span className="text-[#c8202f]">{t("analytics")}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">EMM ERP · Cross-module overview</p>
        </div>
        <div className="flex items-center gap-2">
          {(["3m","6m","12m"] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${range === r ? "bg-[#c8202f] text-white" : "border border-gray-300 dark:border-white/10 text-gray-500 hover:text-gray-900 dark:hover:text-white"}`}>
              {r}
            </button>
          ))}
          <button onClick={exportXlsx} disabled={loading} className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-[#c8202f]/40 hover:text-[#c8202f] px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300 disabled:opacity-40">
            <Download size={13} /> {t("export")}
          </button>
        </div>
      </div>

      {/* ── KPI STRIP ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard delay={0.00} label={t("totalRevenue")}     value={loading ? "—" : fmtTnd(totalRevenue)}
          sub={netResult >= 0 ? `+${fmtTnd(netResult)} net result` : `${fmtTnd(netResult)} net result`}
          icon={<DollarSign size={16}/>} iconBg="bg-[#c8202f]/10 text-[#c8202f]"
          valueColor="text-[#c8202f]" spark={revSpark} sparkColor="#c8202f" />
        <KpiCard delay={0.05} label={t("activeCampaigns")} value={loading ? "—" : String(campaignStats?.active ?? 0)}
          sub={`${campaignStats?.total ?? 0} total · ${fmtTnd(campaignStats?.totalSpend ?? 0)} spent`}
          icon={<Megaphone size={16}/>} iconBg="bg-blue-500/10 text-blue-400" valueColor="text-blue-400" />
        <KpiCard delay={0.10} label={t("totalCustomers")}   value={loading ? "—" : fmt(totalCustomers)}
          sub={`${segments.filter(s=>s.status==="Growing").length} growing segments`}
          icon={<Users size={16}/>} iconBg="bg-purple-500/10 text-purple-400" valueColor="text-purple-400" />
        <KpiCard delay={0.15} label={t("stockAlerts")}      value={loading ? "—" : String(openAlerts)}
          sub={openAlerts > 0 ? "products need promotion push" : "all stock healthy"}
          icon={<AlertTriangle size={16}/>} iconBg="bg-amber-500/10 text-amber-400" valueColor={openAlerts > 0 ? "text-amber-400" : "text-[#c8202f]"} />
      </div>

      {/* ── ROW 2: Revenue trend + Campaign leads/spend ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Revenue trend */}
        <Section title={t("monthlyRevenue")} sub="From finance inflow entries" cols="">
          {loading ? (
            <div className="h-48 flex items-center justify-center text-gray-400 gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading…
            </div>
          ) : revSlice.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-gray-400">No revenue entries yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={revSlice}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb20" />
                <XAxis dataKey="month" stroke="#6b7280" tick={{ fontSize: 10 }} />
                <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} tickFormatter={fmtK} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [fmtTnd(v), "Revenue"]} />
                <Line type="monotone" dataKey="revenue" stroke="#c8202f" strokeWidth={2.5} dot={{ r: 3, fill: "#c8202f" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
          {/* P&L summary row */}
          {!loading && financeReports && (
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.05]">
              {[
                { label: "Sales Revenue",  value: financeReports.profitAndLoss?.revenue?.salesRevenue ?? 0, color: "text-[#c8202f]" },
                { label: "Expenses",       value: financeReports.profitAndLoss?.expenses?.total ?? 0,       color: "text-red-400" },
                { label: "Net Result",     value: financeReports.profitAndLoss?.netResult ?? 0,             color: netResult >= 0 ? "text-[#c8202f]" : "text-red-400" },
              ].map((item, i) => (
                <div key={i}>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500">{item.label}</p>
                  <p className={`text-sm font-bold ${item.color}`}>{fmtTnd(item.value)}</p>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Campaign leads + spend */}
        <Section title={t("performanceTrends")} sub="Monthly leads & spend" cols="">
          {loading ? (
            <div className="h-48 flex items-center justify-center text-gray-400 gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading…
            </div>
          ) : campMonthly.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-gray-400">No campaign data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={campMonthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb20" />
                <XAxis dataKey="month" stroke="#6b7280" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="left"  stroke="#6b7280" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" stroke="#6b7280" tick={{ fontSize: 10 }} tickFormatter={fmtK} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar yAxisId="left"  dataKey="leads" fill="#c8202f" radius={[3,3,0,0]} name="Leads" />
                <Bar yAxisId="right" dataKey="spend" fill="#60a5fa" radius={[3,3,0,0]} name="Spend (TND)" />
              </BarChart>
            </ResponsiveContainer>
          )}
          {/* Campaign KPI row */}
          {!loading && campaignAnalytics && (
            <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.05]">
              {[
                { label: "Open Rate",   value: `${(campaignAnalytics.kpis?.openRate ?? 0).toFixed(1)}%`,       color: "text-[#c8202f]" },
                { label: "CTR",         value: `${(campaignAnalytics.kpis?.ctr ?? 0).toFixed(1)}%`,            color: "text-blue-400" },
                { label: "Conversion",  value: `${(campaignAnalytics.kpis?.conversionRate ?? 0).toFixed(1)}%`, color: "text-amber-400" },
                { label: "Impressions", value: fmtK(campaignAnalytics.kpis?.impressions ?? 0),                  color: "text-purple-400" },
              ].map((item, i) => (
                <div key={i}>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500">{item.label}</p>
                  <p className={`text-sm font-bold ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* ── SALES COMPARISON: Commercial vs Online ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Commercial vs Online chart */}
        <Section title="Sales Comparison" sub="Commercial orders vs Online sales" cols="xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3 mt-1">
            {/* Legend */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-3 h-3 rounded-full bg-[#c8202f] inline-block" /> Commercial
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-3 h-3 rounded-full bg-blue-400 inline-block" /> Online Sales
              </div>
            </div>
            {/* Controls */}
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={chartMonth === "all" ? "" : chartMonth}
                onChange={e => setChartMonth(e.target.value || "all")}
                style={{ colorScheme: "dark" }}
                className="px-2 py-1 bg-black/30 border border-white/10 rounded-lg text-[10px] text-gray-300 focus:outline-none focus:border-[#c8202f]/40 transition"
              />
              {chartMonth !== "all" && (
                <button
                  onClick={() => setChartMonth("all")}
                  className="px-2 py-1 rounded-lg text-[10px] text-gray-500 hover:text-white border border-white/10 hover:border-white/20 transition"
                >
                  All
                </button>
              )}
              {(["3m","6m","12m"] as const).map(r => (
                <button key={r} onClick={() => { setRange(r); setChartMonth("all"); }}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${range === r && chartMonth === "all" ? "bg-[#c8202f]/20 text-[#c8202f] border border-[#c8202f]/30" : "text-gray-500 border border-white/10 hover:text-white"}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="h-48 flex items-center justify-center text-gray-400 gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading…
            </div>
          ) : mergedByMonth.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-gray-400">No sales data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartMonth === "all" ? mergedByMonth : mergedByMonth.filter(r => {
                // r.month is like "May 26" — match against "YYYY-MM"
                const [yr, mo] = chartMonth.split("-").map(Number);
                const label = new Date(yr, mo - 1, 1).toLocaleString("en-US", { month: "short", year: "2-digit" });
                return r.month === label;
              })}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb20" />
                <XAxis dataKey="month" stroke="#6b7280" tick={{ fontSize: 10 }} />
                {/* Left axis: commercial (large values) */}
                <YAxis yAxisId="left"  stroke="#c8202f" tick={{ fontSize: 10 }} tickFormatter={fmtK} width={55} />
                {/* Right axis: online (small values) — independent scale so bars are always visible */}
                <YAxis yAxisId="right" orientation="right" stroke="#60a5fa" tick={{ fontSize: 10 }} tickFormatter={fmtK} width={55} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: any, name?: string) => [fmtTnd(Number(v)), name === "commercial" ? "Commercial" : "Online Sales"]}
                />
                <Bar yAxisId="left"  dataKey="commercial" fill="#c8202f" radius={[3,3,0,0]} name="commercial" />
                <Bar yAxisId="right" dataKey="online"     fill="#60a5fa" radius={[3,3,0,0]} name="online" />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.05]">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Commercial Revenue</p>
              <p className="text-lg font-bold text-[#c8202f]">{loading ? "—" : fmtTnd(totalCommercialRevenue)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Online Revenue</p>
              <p className="text-lg font-bold text-blue-400">{loading ? "—" : fmtTnd(totalOnlineRevenue)}</p>
              <p className="text-[10px] text-gray-500">{totalOnlineOrders} {t("orders")}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Avg Order Value</p>
              <p className="text-lg font-bold text-purple-400">{loading ? "—" : fmtTnd(avgOrderValue)}</p>
            </div>
          </div>
        </Section>

        {/* Order status breakdown */}
        <Section title="Order Pipeline" sub="Commercial orders by status">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : totalCommercialOrders === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-gray-400">
              <ShoppingCart size={24} className="opacity-20" />
              <p className="text-xs">No orders yet</p>
            </div>
          ) : (
            <div className="space-y-3 mt-2">
              {[
                { status: "CONFIRMED",  label: "Confirmed",  color: "bg-blue-500",    text: "text-blue-400" },
                { status: "PREPARED",   label: "Prepared",   color: "bg-amber-500",   text: "text-amber-400" },
                { status: "SHIPPED",    label: "Shipped",    color: "bg-purple-500",  text: "text-purple-400" },
                { status: "DELIVERED",  label: "Delivered",  color: "bg-[#c8202f]", text: "text-[#c8202f]" },
                { status: "CLOSED",     label: "Closed",     color: "bg-gray-500",    text: "text-gray-400" },
              ].map(({ status, label, color, text }) => {
                const count = salesOrders.filter(o => o.status === status).length;
                const pct   = totalCommercialOrders > 0 ? Math.round((count / totalCommercialOrders) * 100) : 0;
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-gray-500">{label}</span>
                      <span className={`text-xs font-bold ${text}`}>{count}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-white/[0.06] rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5 }}
                        className={`h-full rounded-full ${color}`} />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-gray-100 dark:border-white/[0.05] flex justify-between">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest">Total Orders</span>
                <span className="text-xs font-bold text-gray-900 dark:text-white">{totalCommercialOrders}</span>
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* ── ROW 3: Segment health + Customers by country + Revenue by country + Promotions ── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">

        {/* Segment health donut */}
        <Section title={t("segmentation")} sub="Status breakdown across all segments">
          {loading ? (
            <div className="h-40 flex items-center justify-center text-gray-400 gap-2">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : segDonut.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-gray-400">No segments yet</div>
          ) : (
            <div className="flex items-center gap-4">
              {/* Donut with total count in center */}
              <div className="relative flex-shrink-0" style={{ width: 120, height: 120 }}>
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={segDonut} cx="50%" cy="50%" innerRadius={35} outerRadius={55}
                      dataKey="value" paddingAngle={3}>
                      {segDonut.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Total count overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-bold text-gray-900 dark:text-white leading-none">
                    {segmentStats?.total ?? segDonut.reduce((s, d) => s + d.value, 0)}
                  </span>
                  <span className="text-[9px] text-gray-500 uppercase tracking-wide">segs</span>
                </div>
              </div>
              <div className="space-y-2 flex-1">
                {segDonut.map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                      <span className="text-xs text-gray-500">{d.name}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!loading && segmentStats && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.05] grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500">{t("totalCustomers")}</p>
                <p className="text-lg font-bold text-[#c8202f]">{fmt(customers.length)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500">Growing</p>
                <p className="text-lg font-bold text-[#c8202f]">{segmentStats.growing ?? 0}</p>
              </div>
            </div>
          )}
        </Section>

        {/* Customers by country */}
        <Section title="Customers by Country" sub="Distribution across markets">
          {loading ? (
            <div className="h-40 flex items-center justify-center text-gray-400 gap-2">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : customersByCountry.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-gray-400">No customer data yet</div>
          ) : (
            <div className="space-y-2 mt-1">
              {customersByCountry.map((item, i) => {
                const max = customersByCountry[0].count || 1;
                const pct = Math.round((item.count / max) * 100);
                const colors = ["bg-[#c8202f]","bg-blue-500","bg-purple-500","bg-amber-500","bg-pink-500","bg-cyan-500","bg-red-500","bg-indigo-500"];
                return (
                  <div key={item.country}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[140px]">{item.country}</span>
                      <span className="text-xs font-bold text-gray-500 ml-2 flex-shrink-0">{item.count} {item.count === 1 ? "client" : "clients"}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-white/[0.06] rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ delay: i * 0.05, duration: 0.5 }}
                        className={`h-full rounded-full ${colors[i % colors.length]}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Revenue by Country */}
        <Section title="Revenue by Country" sub="Total order amount per market">
          {loading ? (
            <div className="h-40 flex items-center justify-center text-gray-400 gap-2">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : revenueByCountry.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-xs text-gray-400">No revenue data yet</div>
          ) : (
            <div className="space-y-2 mt-1">
              {revenueByCountry.map((item, i) => {
                const max = revenueByCountry[0].revenue || 1;
                const pct = Math.round((item.revenue / max) * 100);
                const colors = ["bg-[#c8202f]","bg-blue-500","bg-purple-500","bg-amber-500","bg-pink-500","bg-cyan-500","bg-red-500","bg-indigo-500"];
                return (
                  <div key={item.country}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-[140px]">{item.country}</span>
                      <span className="text-xs font-bold text-[#c8202f] ml-2 flex-shrink-0">{fmtTnd(item.revenue)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-white/[0.06] rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ delay: i * 0.05, duration: 0.5 }}
                        className={`h-full rounded-full ${colors[i % colors.length]}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Promotions */}
        <Section title={t("promotions")} sub="Active promotions overview">
          {loading ? (
            <div className="h-40 flex items-center justify-center text-gray-400 gap-2">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : !promoStats ? (
            <div className="h-40 flex items-center justify-center text-xs text-gray-400">No promotion data</div>
          ) : (
            <div className="space-y-4 mt-2">
              {[
                { label: "Total Promotions", value: String(promoStats.total ?? 0),                  color: "text-white",        icon: <Tag size={14}/>,        bg: "bg-white/5" },
                { label: "Active",           value: String(promoStats.active ?? 0),                 color: "text-[#c8202f]",  icon: <TrendingUp size={14}/>, bg: "bg-[#c8202f]/10" },
                { label: "Scheduled",        value: String(promoStats.scheduled ?? 0),              color: "text-blue-400",     icon: <BarChart2 size={14}/>,  bg: "bg-blue-500/10" },
                { label: "Avg Discount",     value: `${(promoStats.avgDiscount ?? 0).toFixed(1)}%`, color: "text-amber-400",    icon: <ShoppingCart size={14}/>,bg: "bg-amber-500/10" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${item.bg} text-gray-400`}>{item.icon}</div>
                    <span className="text-xs text-gray-500">{item.label}</span>
                  </div>
                  <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* ── ROW 4: Customer growth + Top customers + Top campaigns ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Customer growth chart */}
        <Section title="Customer Growth" sub="New customers per month">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : customerGrowth.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-gray-400">
              <Users size={24} className="opacity-20" />
              <p className="text-xs">No customer history yet</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={customerGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb20" />
                  <XAxis dataKey="month" stroke="#6b7280" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#6b7280" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [v, "New customers"]} />
                  <Bar dataKey="count" fill="#a78bfa" radius={[3,3,0,0]} name="New customers" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.05] flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500">Total</p>
                  <p className="text-lg font-bold text-purple-400">{fmt(customers.length)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500">Active</p>
                  <p className="text-lg font-bold text-[#c8202f]">{fmt(customers.filter(c => c.active).length)}</p>
                </div>
              </div>
            </>
          )}
        </Section>

        {/* Top customers */}
        <Section title={t("topSpenders")} sub="By total order amount">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : topCustomers.length === 0 ? (
            <div className="text-center text-xs text-gray-400 py-8">No customer orders yet</div>
          ) : (
            <div className="space-y-3 mt-2">
              {topCustomers.map((c, i) => {
                const maxAmt = topCustomers[0]?.totalOrderAmount || 1;
                const pct = Math.round(((c.totalOrderAmount ?? 0) / maxAmt) * 100);
                return (
                  <div key={c._id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold text-gray-400 w-4 flex-shrink-0">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate text-gray-900 dark:text-white">{c.name}</p>
                          <p className="text-[10px] text-gray-500">{c.country ?? c.city ?? "—"}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-blue-400 flex-shrink-0 ml-2">{fmtTnd(c.totalOrderAmount ?? 0)}</span>
                    </div>
                    <div className="w-full h-1 bg-gray-200 dark:bg-white/[0.06] rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ delay: i * 0.06, duration: 0.5 }}
                        className="h-full bg-blue-500 rounded-full" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Top campaigns */}
        <Section title={t("topCampaigns")} sub="By leads generated">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : topCampaigns.length === 0 ? (
            <div className="text-center text-xs text-gray-400 py-8">No campaigns yet</div>
          ) : (
            <div className="space-y-3 mt-2">
              {topCampaigns.map((c, i) => {
                const maxLeads = topCampaigns[0]?.leads || 1;
                const pct = Math.round((c.leads / maxLeads) * 100);
                return (
                  <div key={c._id}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold text-gray-400 w-4 flex-shrink-0">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate text-gray-900 dark:text-white">{c.name}</p>
                          <p className="text-[10px] text-gray-500">{c.channel}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-[#c8202f] flex-shrink-0 ml-2">{c.leads} leads</span>
                    </div>
                    <div className="w-full h-1 bg-gray-200 dark:bg-white/[0.06] rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ delay: i * 0.06, duration: 0.5 }}
                        className="h-full bg-[#c8202f] rounded-full" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      </div>

      {/* ── ROW 5: Stock to promote + Markets to discover ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* Stock to promote */}
        <Section title="Stock to Promote" sub="Products with open stock alerts" cols="">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-gray-400 gap-2">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : productsToPromote.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2 text-gray-400">
              <Package size={24} className="opacity-20" />
              <p className="text-xs">No stock alerts — all products healthy</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 mt-2">
              {productsToPromote.map((p) => (
                <div key={p._id} className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Package size={14} className="text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate text-gray-900 dark:text-white">{p.name}</p>
                    <p className="text-[10px] text-amber-400">{p.sku}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Markets to discover (low customer count countries) */}
        <Section title="Markets to Discover" sub="Countries with fewest customers — potential growth" cols="">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-gray-400 gap-2">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : leastCustomers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2 text-gray-400">
              <Target size={24} className="opacity-20" />
              <p className="text-xs">No customer data yet</p>
            </div>
          ) : (
            <div className="space-y-3 mt-2">
              {leastCustomers.map((item, i) => (
                <div key={item.country} className="flex items-center gap-4 p-3 rounded-xl bg-violet-500/5 border border-violet-500/15">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                    <Target size={14} className="text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{item.country}</p>
                    <p className="text-[10px] text-gray-500">Only {item.count} {item.count === 1 ? "customer" : "customers"} — low penetration</p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 flex-shrink-0">
                    Opportunity
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

    </div>
  );
}