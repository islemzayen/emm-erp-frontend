"use client";
import { exportBrandedXlsx } from "@/lib/reportExport";

import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign, Search, Download, TrendingUp, AlertCircle, PieChart,
  Loader2, CalendarDays, X, CheckCircle, ChevronRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import { BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { campaignService, Campaign, CampaignAnalytics } from "@/services/marketingService";
import { budgetService, MarketingBudget } from "@/services/calendarService";

function budgetStatus(allocated: number, used: number): string {
  if (allocated === 0) return "Not Started";
  const pct = used / allocated;
  if (pct >= 0.9) return "Critical";
  return "On Track";
}

const STATUS_CONFIG: Record<string, { badge: string; dot: string }> = {
  "On Track":    { badge: "bg-[#c8202f]/15 text-[#c8202f]", dot: "bg-[#c8202f]" },
  "Critical":    { badge: "bg-red-500/15 text-red-400",         dot: "bg-red-400" },
  "Not Started": { badge: "bg-gray-500/15 text-gray-400",       dot: "bg-gray-500" },
};

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function BudgetPage() {
  const { t } = useLanguage();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");

  // Planification
  const [showPlan,      setShowPlan]      = useState(false);
  const [planYear,      setPlanYear]      = useState(new Date().getFullYear());
  const [mktBudget,     setMktBudget]     = useState<MarketingBudget | null>(null);
  const [currentBudget, setCurrentBudget] = useState<MarketingBudget | null>(null);
  const [planLoading,   setPlanLoading]   = useState(false);
  const [planSaving,    setPlanSaving]    = useState(false);
  const [planDraft,     setPlanDraft]     = useState<Record<string, number>>({}); // month → allocated
  const [planSaved,     setPlanSaved]     = useState(false);

  const card = "bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl transition-colors duration-300";
  const tooltipStyle = { backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "10px", fontSize: "11px" };
  const inp  = "w-full px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/50 transition";

  useEffect(() => {
    const year = new Date().getFullYear();
    Promise.all([
      campaignService.getAll(),
      campaignService.getAnalytics(),
      budgetService.get(year),
    ])
      .then(([camps, anal, bud]) => {
        setCampaigns(camps); setAnalytics(anal);
        setCurrentBudget(bud);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Load marketing budget when plan opens
  const openPlan = async () => {
    setShowPlan(true); setPlanSaved(false);
    setPlanLoading(true);
    try {
      const b = await budgetService.get(planYear);
      setMktBudget(b);
      const draft: Record<string, number> = {};
      for (const m of b.monthlyAllocations) draft[m.month] = m.allocated;
      setPlanDraft(draft);
    } catch {} finally { setPlanLoading(false); }
  };

  const handlePlanYearChange = async (y: number) => {
    setPlanYear(y); setPlanLoading(true);
    try {
      const b = await budgetService.get(y);
      setMktBudget(b);
      const draft: Record<string, number> = {};
      for (const m of b.monthlyAllocations) draft[m.month] = m.allocated;
      setPlanDraft(draft);
    } catch {} finally { setPlanLoading(false); }
  };

  const totalDraft     = Object.values(planDraft).reduce((s, v) => s + (v || 0), 0);
  const annualBudget   = mktBudget?.annualBudget ?? 0;
  const unallocated    = annualBudget - totalDraft;

  const savePlan = async () => {
    setPlanSaving(true);
    try {
      const allocations = Object.entries(planDraft).map(([month, allocated]) => ({ month, allocated: allocated || 0 }));
      const updated = await budgetService.allocate(planYear, allocations);
      setMktBudget(updated);
      setPlanSaved(true);
      setTimeout(() => setPlanSaved(false), 2000);
    } catch {} finally { setPlanSaving(false); }
  };

  const budgets = campaigns.map(c => ({
    _id: c._id, campaign: c.name,
    allocated: c.budget, used: c.spend,
    remaining: Math.max(0, c.budget - c.spend),
    status: budgetStatus(c.budget, c.spend),
  }));
  const filtered       = budgets.filter(b => b.campaign.toLowerCase().includes(search.toLowerCase()));
  const totalAllocated = budgets.reduce((s, b) => s + b.allocated, 0);
  const totalUsed      = budgets.reduce((s, b) => s + b.used, 0);
  const totalRemaining = totalAllocated - totalUsed;
  const usedPct        = totalAllocated > 0 ? Math.round((totalUsed / totalAllocated) * 100) : 0;
  const criticalCount  = budgets.filter(b => b.status === "Critical").length;
  const monthlySpend   = (analytics?.monthly ?? []).map(m => ({
    month: new Date(m.month + "-01").toLocaleString("en-US", { month: "short" }),
    spend: m.spend,
  }));

  const handleExport = async () => {
    if (!budgets.length) return;
    const headers = ["Campaign", "Allocated (TND)", "Used (TND)", "Remaining (TND)", "Usage %", "Status"];
    const rows = budgets.map(b => {
      const pct = b.allocated > 0 ? Math.round((b.used / b.allocated) * 100) : 0;
      return [b.campaign, b.allocated, b.used, b.remaining, `${pct}%`, b.status];
    });
    await exportBrandedXlsx("Marketing Budget", headers, rows, `budget-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <>
      <div className="min-h-screen bg-gray-100 dark:bg-[#060a0f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight leading-none">
              {t("marketingBudgetTitle").split(" ")[0]}{" "}
              <span className="text-[#c8202f]">{t("marketingBudgetTitle").split(" ").slice(1).join(" ")}</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">EMM ERP</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={openPlan}
              className="flex items-center gap-2 bg-[#c8202f] hover:bg-[#e02d3c] px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-black font-bold">
              <CalendarDays size={13} /> Planification
            </button>
            <button onClick={handleExport} disabled={!budgets.length}
              className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20 px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed">
              <Download size={13} /> {t("export")}
            </button>
          </div>
        </div>

        {/* ── Annual Budget Banner ── */}
        {currentBudget && (
          <div className={`${card} px-6 py-4`}>
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="p-2.5 rounded-xl bg-[#c8202f]/10"><DollarSign size={16} className="text-[#c8202f]" /></div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">Annual Marketing Budget {new Date().getFullYear()}</p>
                  <p className="text-2xl font-bold text-[#c8202f]">{currentBudget.annualBudget.toLocaleString()} TND</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">Allocated to months</p>
                  <p className="font-bold text-white">{currentBudget.totalAllocated.toLocaleString()} TND</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">Unallocated</p>
                  <p className={`font-bold ${currentBudget.annualBudget - currentBudget.totalAllocated < 0 ? "text-red-400" : "text-amber-400"}`}>
                    {(currentBudget.annualBudget - currentBudget.totalAllocated).toLocaleString()} TND
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">Spent on events</p>
                  <p className="font-bold text-blue-400">{currentBudget.totalSpent.toLocaleString()} TND</p>
                </div>
              </div>
              <div className="flex-1 max-w-xs">
                <div className="h-2 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#c8202f] transition-all"
                    style={{ width: `${currentBudget.annualBudget > 0 ? Math.min(100, Math.round((currentBudget.totalAllocated / currentBudget.annualBudget) * 100)) : 0}%` }} />
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  {currentBudget.annualBudget > 0 ? Math.round((currentBudget.totalAllocated / currentBudget.annualBudget) * 100) : 0}% allocated
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: t("totalAllocated"), value: `${totalAllocated.toLocaleString()} TND`, sub: t("thisPeriod"),     icon: <DollarSign size={14} />,  iconBg: "bg-[#c8202f]/10 text-[#c8202f]" },
            { label: t("totalSpent"),     value: `${totalUsed.toLocaleString()} TND`,      sub: `${usedPct}% used`,  icon: <TrendingUp size={14} />,  iconBg: "bg-blue-500/10 text-blue-400" },
            { label: t("remaining"),      value: `${totalRemaining.toLocaleString()} TND`, sub: t("available"),      icon: <PieChart size={14} />,    iconBg: "bg-purple-500/10 text-purple-400" },
            { label: t("critical"),       value: String(criticalCount),                    sub: t("overBudgetRisk"), icon: <AlertCircle size={14} />, iconBg: "bg-red-500/10 text-red-400" },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className={`${card} px-5 py-4 flex items-center gap-4`}>
              <div className={`p-2 rounded-xl ${s.iconBg}`}>{s.icon}</div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">{s.label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Table + Chart ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className={`${card} overflow-hidden xl:col-span-2`}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-white/[0.05]">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">{t("budgetAllocation")}</h2>
                <p className="text-xs text-gray-500">{filtered.length} of {budgets.length} {t("campaigns")}</p>
              </div>
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input className="pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:border-[#c8202f]/40 transition text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                  placeholder={t("searchCampaign")} value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            <div className="grid px-6 py-3 text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-600 border-b border-gray-200 dark:border-white/[0.04]"
              style={{ gridTemplateColumns: "2fr 1.2fr 1.2fr 1.2fr 1.5fr 1.5fr" }}>
              <span>{t("campaign")}</span><span>{t("allocated")}</span><span>{t("used")}</span>
              <span>{t("remaining")}</span><span>{t("usage")}</span><span>{t("status")}</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-400 gap-2"><Loader2 size={16} className="animate-spin" /> Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">{budgets.length === 0 ? "No campaigns with budget data yet." : t("noCampaignsMatch")}</div>
            ) : (
              filtered.map((b, i) => {
                const sc  = STATUS_CONFIG[b.status] ?? STATUS_CONFIG["On Track"];
                const pct = b.allocated > 0 ? Math.round((b.used / b.allocated) * 100) : 0;
                return (
                  <motion.div key={b._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                    className={`grid px-6 py-4 items-center hover:bg-gray-50 dark:hover:bg-white/[0.02] transition ${i < filtered.length - 1 ? "border-b border-gray-100 dark:border-white/[0.03]" : ""}`}
                    style={{ gridTemplateColumns: "2fr 1.2fr 1.2fr 1.2fr 1.5fr 1.5fr" }}>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{b.campaign}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300">{b.allocated.toLocaleString()}</p>
                    <p className="text-xs text-blue-400 font-bold">{b.used.toLocaleString()}</p>
                    <p className={`text-xs font-bold ${b.remaining < 1000 && b.remaining > 0 ? "text-amber-400" : "text-gray-600 dark:text-gray-300"}`}>{b.remaining.toLocaleString()}</p>
                    <div className="pr-4">
                      <div className="flex justify-between mb-1"><span className="text-[10px] text-gray-500 dark:text-gray-600">{pct}%</span></div>
                      <div className="h-1 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ delay: 0.3 + i * 0.05, duration: 0.5 }}
                          className={`h-full rounded-full ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-[#c8202f]"}`} />
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold w-fit ${sc.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{b.status}
                    </span>
                  </motion.div>
                );
              })
            )}
          </div>

          <div className={`${card} p-6`}>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{t("monthlySpend")}</h2>
            <p className="text-xs text-gray-500 mb-4">{t("totalSpendPerMonth")}</p>
            {monthlySpend.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-xs text-gray-400">No spend data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <ReBarChart data={monthlySpend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${(v as number).toLocaleString()} TND`, t("spend")]} />
                  <Bar dataKey="spend" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                </ReBarChart>
              </ResponsiveContainer>
            )}
            <div className="mt-6 p-4 rounded-xl bg-[#c8202f]/5 border border-[#c8202f]/15">
              <div className="flex justify-between mb-2">
                <span className="text-xs font-bold text-gray-700 dark:text-white/70">{t("budgetUtilisation")}</span>
                <span className="text-xs font-bold text-[#c8202f]">{usedPct}%</span>
              </div>
              <div className="h-1.5 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${usedPct}%` }} transition={{ delay: 0.5, duration: 0.8 }}
                  className="h-full rounded-full bg-gradient-to-r from-[#c8202f] to-blue-500" />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-gray-500 dark:text-gray-600">{totalUsed.toLocaleString()} / {totalAllocated.toLocaleString()} TND</span>
                <span className="text-[10px] text-amber-400">{totalRemaining.toLocaleString()} {t("left")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Planification Panel ── */}
      <AnimatePresence>
        {showPlan && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40" onClick={() => setShowPlan(false)} />
            <motion.div
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 h-full w-full max-w-xl bg-white dark:bg-[#0d1117] border-l border-gray-200 dark:border-white/10 z-50 flex flex-col shadow-2xl">

              {/* Panel header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#c8202f]/10"><CalendarDays size={16} className="text-[#c8202f]" /></div>
                  <div>
                    <h2 className="text-base font-bold">Budget Planification</h2>
                    <p className="text-xs text-gray-500">Allocate monthly budgets for the year</p>
                  </div>
                </div>
                <button onClick={() => setShowPlan(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 transition">
                  <X size={16} />
                </button>
              </div>

              {/* Year selector */}
              <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-white/[0.06]">
                <span className="text-xs text-gray-500 uppercase tracking-widest">Year</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => handlePlanYearChange(planYear - 1)} className="p-1 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 transition text-gray-400">
                    <ChevronRight size={14} className="rotate-180" />
                  </button>
                  <span className="text-sm font-bold w-12 text-center">{planYear}</span>
                  <button onClick={() => handlePlanYearChange(planYear + 1)} className="p-1 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 transition text-gray-400">
                    <ChevronRight size={14} />
                  </button>
                </div>
                {annualBudget > 0 && (
                  <div className="ml-auto text-right">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Annual Budget</p>
                    <p className="text-sm font-bold text-[#c8202f]">{annualBudget.toLocaleString()} TND</p>
                  </div>
                )}
              </div>

              {/* Budget summary bar */}
              {annualBudget > 0 && (
                <div className="px-6 py-3 border-b border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.02]">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-gray-500">Allocated: <span className="font-bold text-white">{totalDraft.toLocaleString()} TND</span></span>
                    <span className={`font-bold ${unallocated < 0 ? "text-red-400" : "text-[#c8202f]"}`}>
                      {unallocated < 0 ? "Over by " : "Remaining: "}{Math.abs(unallocated).toLocaleString()} TND
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${unallocated < 0 ? "bg-red-500" : "bg-[#c8202f]"}`}
                      style={{ width: `${Math.min(100, (totalDraft / annualBudget) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {annualBudget === 0 && (
                <div className="mx-6 mt-4 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400">
                  No annual budget set yet. Ask the Admin to set the annual budget first.
                </div>
              )}

              {/* Monthly inputs */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {planLoading ? (
                  <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
                    <Loader2 size={16} className="animate-spin" /> Loading...
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {MONTH_NAMES.map((name, idx) => {
                      const mk = `${planYear}-${String(idx + 1).padStart(2, "0")}`;
                      const val     = planDraft[mk] ?? 0;
                      const mAlloc  = mktBudget?.monthlyAllocations.find(m => m.month === mk);
                      const spent   = mAlloc?.spent ?? 0;
                      const isOver  = val < spent;
                      return (
                        <div key={mk} className="p-3 bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-xl">
                          <p className="text-xs font-bold text-gray-700 dark:text-white mb-2">{name}</p>
                          <input
                            type="text" inputMode="numeric" pattern="[0-9]*"
                            className={`w-full px-2 py-1.5 bg-white dark:bg-black/30 border rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none transition ${isOver ? "border-red-500/50 focus:border-red-500" : "border-gray-200 dark:border-white/10 focus:border-[#c8202f]/50"}`}
                            value={val || ""}
                            onChange={e => setPlanDraft(d => ({ ...d, [mk]: Number(e.target.value.replace(/\D/g, "")) }))}
                            placeholder="0"
                            disabled={annualBudget === 0}
                          />
                          {spent > 0 && (
                            <p className={`text-[10px] mt-1 ${isOver ? "text-red-400" : "text-gray-500"}`}>
                              {spent.toLocaleString()} TND spent
                              {isOver ? " — over allocated!" : ""}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Save button */}
              <div className="px-6 py-4 border-t border-gray-200 dark:border-white/[0.06]">
                <button onClick={savePlan} disabled={planSaving || annualBudget === 0}
                  className="w-full py-3 rounded-xl bg-[#c8202f] hover:bg-[#e02d3c] disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-sm transition flex items-center justify-center gap-2">
                  {planSaving ? <Loader2 size={14} className="animate-spin" /> : planSaved ? <CheckCircle size={14} /> : <CalendarDays size={14} />}
                  {planSaved ? "Saved!" : "Save Planification"}
                </button>
                {unallocated < 0 && (
                  <p className="text-[10px] text-red-400 text-center mt-2">⚠ Total exceeds annual budget by {Math.abs(unallocated).toLocaleString()} TND</p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}