"use client";
import { exportBrandedXlsx } from "@/lib/reportExport";


import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion } from "framer-motion";
import { Users, DollarSign, TrendingUp, RefreshCw, Download, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart as ReBarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { campaignService, Campaign, CampaignStats, CampaignAnalytics } from "@/services/marketingService";

function Sparkline({ data, dataKey, color }: { data: any[]; dataKey: string; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={data}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function MarketingDashboard() {
  const { t, language } = useLanguage();
  const [campaigns, setCampaigns]   = useState<Campaign[]>([]);
  const [stats, setStats]           = useState<CampaignStats | null>(null);
  const [analytics, setAnalytics]   = useState<CampaignAnalytics | null>(null);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [activeRange, setActiveRange] = useState<"6m" | "3m" | "1m">("6m");

  const card = "bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/[0.06] border-t-2 border-t-[#c8202f] rounded-2xl transition-colors duration-300 hover:shadow-[0_0_20px_#c8202f10]";
  const tooltipStyle = { backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "10px", fontSize: "11px" };

  useEffect(() => {
    Promise.all([
      campaignService.getAll(),
      campaignService.getStats(),
      campaignService.getAnalytics(),
    ])
      .then(([camps, st, anal]) => { setCampaigns(camps); setStats(st); setAnalytics(anal); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const monthly = analytics?.monthly ?? [];

  const monthlyChartData = monthly.map(m => ({
    month: new Date(m.month + "-01").toLocaleString("en-US", { month: "short" }),
    leads: m.leads,
    spend: m.spend,
  }));
  const rangeSliced = activeRange === "1m"
    ? monthlyChartData.slice(-1)
    : activeRange === "3m"
    ? monthlyChartData.slice(-3)
    : monthlyChartData.slice(-6);

  const sparkData = monthly.slice(-6).map(m => ({ v: m.leads }));

  const topCampaigns = [...campaigns].sort((a, b) => b.leads - a.leads).slice(0, 5);
  const maxLeads = topCampaigns[0]?.leads || 1;

  const totalLeads  = stats?.totalLeads  ?? 0;
  const totalSpend  = stats?.totalSpend  ?? 0;
  const roi         = stats?.roi         ?? 0;
  const cpl         = stats?.cpl         ?? 0;
  const active      = stats?.active      ?? 0;

  const avgConv = campaigns.length > 0
    ? (campaigns.reduce((s, c) => s + c.conversionRate, 0) / campaigns.length).toFixed(1)
    : "0.0";

  const filtered = campaigns.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { Active: t("active"), Paused: t("paused"), Planned: t("planned"), Completed: t("completed") };
    return map[s] ?? s;
  };

  const exportXlsx = async () => {
    if (!campaigns.length) return;
    const headers = ["Name", "Channel", "Status", "Budget (TND)", "Spend (TND)", "Leads", "Conversion %", "Start", "End"];
    const rows = campaigns.map(c => [
      c.name || "",
      c.channel || "-",
      c.status,
      c.budget || 0,
      c.spend || 0,
      c.leads || 0,
      `${(c.conversionRate||0).toFixed(1)}%`,
      c.startDate ? new Date(c.startDate).toLocaleDateString("en-GB") : "-",
      c.endDate   ? new Date(c.endDate).toLocaleDateString("en-GB")   : "-",
    ]);
    await exportBrandedXlsx("Marketing Dashboard", headers, rows, `Marketing_Dashboard_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <ProtectedRoute allowedRoles={["MARKETING_MANAGER"]}>
    
      <div className="min-h-screen bg-gray-100 dark:bg-[#060a0f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

        {/* ── HEADER ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight leading-none">
              {language === "fr" ? (
                <>{t("dashboard")} <span className="text-[#c8202f]">{t("marketing")}</span></>
              ) : (
                <>{t("marketing")} <span className="text-[#c8202f]">{t("dashboard")}</span></>
              )}
            </h1>
            <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">EMM ERP</p>
          </div>
          <button onClick={exportXlsx} disabled={!campaigns.length} className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-[#c8202f]/40 hover:text-[#c8202f] px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300 w-fit disabled:opacity-40">
            <Download size={13} /> {t("exportXlsx")}
          </button>
        </div>

        {/* ── TOP KPI CARDS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { icon: <Users size={16} />,      iconBg: "bg-[#c8202f]/10 text-[#c8202f]", label: t("totalLeads"),   value: totalLeads.toLocaleString(),           valueColor: "text-[#c8202f]", sparkColor: "#c8202f" },
            { icon: <DollarSign size={16} />, iconBg: "bg-blue-500/10 text-blue-400",       label: t("budgetUsed"),  value: `${totalSpend.toLocaleString()} TND`,  valueColor: "text-blue-400",    sparkColor: "#60a5fa" },
            { icon: <TrendingUp size={16} />, iconBg: "bg-amber-500/10 text-amber-400",     label: t("campaignRoi"), value: `${roi.toFixed(1)}x`,                  valueColor: "text-amber-400",   sparkColor: "#f59e0b" },
            { icon: <RefreshCw size={16} />,  iconBg: "bg-red-500/10 text-red-400",         label: t("costPerLead"), value: `${cpl.toFixed(0)} TND`,               valueColor: "text-red-400",     sparkColor: "#f87171" },
          ].map((kpi, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className={`${card} p-5 flex flex-col gap-3`}>
              <div className={`p-2 rounded-xl w-fit ${kpi.iconBg}`}>{kpi.icon}</div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">{kpi.label}</p>
              {loading
                ? <div className="h-9 flex items-center"><Loader2 size={16} className="animate-spin text-gray-400" /></div>
                : <p className={`text-3xl font-bold tracking-tight ${kpi.valueColor}`}>{kpi.value}</p>
              }
              <div className="-mx-1">
                {sparkData.length > 1 && <Sparkline data={sparkData} dataKey="v" color={kpi.sparkColor} />}
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── SECONDARY KPI ROW ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: t("activeCampaigns"), value: loading ? "—" : String(active),   sub: t("currentlyRunning") },
            { label: t("conversionRate"),  value: loading ? "—" : `${avgConv}%`,    sub: t("avgAcrossCampaigns") },
            { label: t("totalCampaigns"),  value: loading ? "—" : String(stats?.total ?? 0), sub: t("allTime") },
            { label: t("totalBudget"),     value: loading ? "—" : `${(stats?.totalBudget ?? 0).toLocaleString()} TND`, sub: t("allocated") },
          ].map((s, i) => (
            <div key={i} className={`${card} px-5 py-4`}>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── BOTTOM: Charts + Top Campaigns ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

          {/* Charts panel (2/3) */}
          <div className={`${card} p-6 xl:col-span-2 space-y-2`}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">{t("campaignOverview")}</h2>
                <p className="text-xs text-gray-500">{t("monthlyPerformance")}</p>
              </div>
              <div className="flex gap-1">
                {(["6m", "3m", "1m"] as const).map((r) => (
                  <button key={r} onClick={() => setActiveRange(r)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${activeRange === r ? "bg-[#c8202f] text-white" : "text-gray-400 hover:text-gray-900 dark:hover:text-white"}`}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-8 py-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500">{t("totalLeads")}</p>
                <p className="text-2xl font-bold text-[#c8202f]">{totalLeads.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500">{t("avgConversion")}</p>
                <p className="text-2xl font-bold text-blue-400">{avgConv}%</p>
              </div>
            </div>

            {loading ? (
              <div className="h-[180px] flex items-center justify-center text-gray-400 gap-2">
                <Loader2 size={16} className="animate-spin" /> Loading...
              </div>
            ) : rangeSliced.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-xs text-gray-400">No data yet</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">{t("leadsPerMonth")}</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <ReBarChart data={rangeSliced}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="leads" fill="#c8202f" radius={[4, 4, 0, 0]} />
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">{t("monthlySpend")}</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={rangeSliced}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${(v as number).toLocaleString()} TND`, t("spend")]} />
                      <Line type="monotone" dataKey="spend" stroke="#60a5fa" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Campaign table */}
            <div className="pt-4">
              <div className="flex justify-between items-center mb-3">
                <p className="text-[10px] uppercase tracking-widest text-gray-500">{t("allCampaigns")}</p>
                <input type="text" placeholder={t("search")} value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:border-[#c8202f]/40 transition text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                />
              </div>
              {loading ? (
                <div className="flex items-center justify-center py-6 text-gray-400 gap-2">
                  <Loader2 size={14} className="animate-spin" /> Loading...
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center text-xs text-gray-400 py-6">
                  {campaigns.length === 0 ? "No campaigns yet." : t("noCampaignsMatch")}
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-600 border-b border-gray-200 dark:border-white/5">
                      <th className="text-left pb-2 pr-4">{t("campaign")}</th>
                      <th className="text-left pb-2 pr-4">{t("channel")}</th>
                      <th className="text-left pb-2 pr-4">{t("leads")}</th>
                      <th className="text-left pb-2">{t("status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c, i) => (
                      <tr key={c._id ?? i} className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition">
                        <td className="py-3 pr-4 font-bold text-gray-900 dark:text-white">{c.name}</td>
                        <td className="pr-4 text-gray-500 dark:text-gray-400">{c.channel}</td>
                        <td className="pr-4 text-gray-900 dark:text-white">{c.leads > 0 ? c.leads.toLocaleString() : "—"}</td>
                        <td>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            c.status === "Active"    ? "bg-[#c8202f]/15 text-[#c8202f]" :
                            c.status === "Paused"    ? "bg-amber-500/15 text-amber-400" :
                            c.status === "Completed" ? "bg-gray-500/15 text-gray-400" :
                            "bg-blue-500/15 text-blue-400"}`}>
                            {statusLabel(c.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Top Campaigns panel (1/3) */}
          <div className={`${card} p-6`}>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{t("topCampaigns")}</h2>
            <p className="text-xs text-gray-500 mb-5">{t("leadsGeneratedThisMonth")}</p>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <Loader2 size={16} className="animate-spin" />
              </div>
            ) : topCampaigns.length === 0 ? (
              <div className="text-center text-xs text-gray-400 py-8">No campaigns yet</div>
            ) : (
              <div className="space-y-5">
                {topCampaigns.map((c, i) => (
                  <div key={c._id ?? i}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <div>
                        <span className="text-gray-400 text-xs mr-2">{String(i + 1).padStart(2, "0")}</span>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{c.name}</span>
                      </div>
                      <span className="text-[#c8202f] text-sm font-bold">{c.leads > 0 ? c.leads.toLocaleString() : "—"}</span>
                    </div>
                    <div className="h-1 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(c.leads / maxLeads) * 100}%` }}
                        transition={{ delay: 0.3 + i * 0.07, duration: 0.6 }}
                        className="h-full bg-[#c8202f] rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Growth Goals */}
            <div className="mt-8">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4">{t("growthGoals")}</h3>
              <div className="space-y-4">
                {[
                  { label: t("conversionRateTarget"), pct: 70 },
                  { label: t("leadAcquisition"),      pct: 55 },
                  { label: t("budgetEfficiency"),     pct: 65 },
                ].map((g, i) => (
                  <div key={i}>
                    <div className="flex justify-between mb-1">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{g.label}</p>
                      <p className="text-xs text-gray-500">{g.pct}%</p>
                    </div>
                    <div className="h-1 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${g.pct}%` }}
                        transition={{ delay: 0.5 + i * 0.1, duration: 0.6 }}
                        className="h-full bg-blue-500 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    
    </ProtectedRoute>
  );
}