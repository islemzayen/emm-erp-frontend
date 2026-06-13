"use client";
import { exportBrandedXlsx, exportBrandedPdf } from "@/lib/reportExport";
import React, { useState, useEffect, useRef } from "react";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Download, BarChart2, Users, DollarSign,
  Calendar, Loader2, CheckCircle, Trash2, TrendingUp, Tag, AlertTriangle,
} from "lucide-react";
import {
  segmentService, campaignService, promotionService,
  Segment, Campaign, Promotion,
} from "@/services/marketingService";

// ── helpers ────────────────────────────────────────────────────────────────────
function monthStr() { return new Date().toISOString().slice(0, 7); }
function yearStr()  { return new Date().getFullYear().toString(); }
function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}
function quarter3Label(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const end   = new Date(y, mo - 1, 1);
  const start = new Date(y, mo - 3, 1);
  const fmt = (d: Date) => d.toLocaleString("en-US", { month: "short", year: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}
async function exportToPDF(title: string, subtitle: string, headers: string[], rows: (string | number)[][], filename: string) {
  await exportBrandedPdf(title, subtitle, headers, rows, filename);
}

// ── history ────────────────────────────────────────────────────────────────────
const HISTORY_KEY = "marketing_report_history";
const MAX_HISTORY = 2;
type PeriodMode = "monthly" | "quarterly" | "annual";
interface SavedPeriod { period: string; mode: PeriodMode; label: string; savedAt: string; }

function loadHistory(): SavedPeriod[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}
function upsertHistory(period: string, mode: PeriodMode, label: string): string | null {
  const history = loadHistory();
  const idx = history.findIndex(r => r.period === period && r.mode === mode);
  if (idx >= 0) { history[idx].savedAt = new Date().toISOString(); localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); return null; }
  let evictedLabel: string | null = null;
  if (history.length >= MAX_HISTORY) {
    const sorted = [...history].sort((a, b) => a.savedAt.localeCompare(b.savedAt));
    evictedLabel = sorted[0].label;
    history.splice(history.findIndex(r => r.period === sorted[0].period && r.mode === sorted[0].mode), 1);
  }
  history.push({ period, mode, label, savedAt: new Date().toISOString() });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  return evictedLabel;
}

// ── row builders ───────────────────────────────────────────────────────────────
function buildSegmentRows(segments: Segment[]): (string | number)[][] {
  return segments.map(s => {
    const estRevenue = Math.round((s.customers ?? 0) * (s.avgSpend ?? 0));
    return [s.name, s.region ?? "—", s.regionType ?? "—", s.customers ?? 0, `${(s.avgSpend ?? 0).toFixed(2)} TND`, `${s.growthPct >= 0 ? "+" : ""}${s.growthPct ?? 0}%`, s.status, `${estRevenue.toLocaleString()} TND`];
  });
}
function buildCampaignRows(campaigns: Campaign[], segments: Segment[]): (string | number)[][] {
  return segments.map(seg => {
    const totalLeads = campaigns.reduce((s, c) => s + (c.leads ?? 0), 0);
    const totalSpend = campaigns.reduce((s, c) => s + (c.spend ?? 0), 0);
    const cpl = totalLeads > 0 ? (totalSpend / totalLeads).toFixed(2) : "—";
    const roi = totalSpend > 0 ? `${(((seg.customers * seg.avgSpend - totalSpend) / totalSpend) * 100).toFixed(1)}%` : "—";
    return [seg.name, seg.region ?? "—", seg.status, seg.customers ?? 0, campaigns.length, totalLeads, `${totalSpend.toFixed(2)} TND`, `${cpl} TND`, roi];
  });
}
function buildPromotionRows(promotions: Promotion[], segments: Segment[]): (string | number)[][] {
  return segments.map(seg => {
    const active    = promotions.filter(p => p.status === "Active").length;
    const scheduled = promotions.filter(p => p.status === "Scheduled").length;
    const avgDiscount = promotions.length > 0 ? (promotions.reduce((s, p) => s + p.discount, 0) / promotions.length).toFixed(1) : "0";
    const best = [...promotions].sort((a, b) => b.discount - a.discount)[0];
    return [seg.name, seg.region ?? "—", seg.status, seg.customers ?? 0, active, scheduled, `${avgDiscount}%`, best ? best.name : "—", best ? best.code : "—", best ? `${best.discount}%` : "—"];
  });
}
function buildLeadsRows(monthly: { month: string; leads: number; spend: number }[], segments: Segment[]): (string | number)[][] {
  const rows: (string | number)[][] = [];
  const totalCustomers = segments.reduce((s, seg) => s + (seg.customers ?? 0), 0) || 1;
  for (const m of monthly) {
    for (const seg of segments) {
      const weight   = (seg.customers ?? 0) / totalCustomers;
      const segLeads = Math.round(m.leads * weight);
      const segSpend = Math.round(m.spend * weight * 100) / 100;
      const cpl      = segLeads > 0 ? (segSpend / segLeads).toFixed(2) : "—";
      rows.push([monthLabel(m.month), seg.name, seg.region ?? "—", seg.status, seg.customers ?? 0, segLeads, `${segSpend.toFixed(2)} TND`, `${cpl} TND`]);
    }
  }
  return rows;
}

// ── component ──────────────────────────────────────────────────────────────────
export default function MarketingReports() {
  const { t } = useLanguage();

  const [reportMode,    setReportMode]   = useState<PeriodMode>("monthly");
  const [selectedMonth, setMonth]        = useState(monthStr());
  const [selectedYear,  setYear]         = useState(yearStr());
  const [loading,       setLoading]      = useState<string | null>(null);
  const [done,          setDone]         = useState<string | null>(null);
  const [evictedToast,  setEvictedToast] = useState<string | null>(null);
  const [exportLog,     setExportLog]    = useState<{ name: string; size: string; date: string; type: string }[]>([]);
  const [history,       setHistory]      = useState<SavedPeriod[]>([]);
  const [reminderOpen,  setReminderOpen] = useState(false);
  const pendingExportRef = useRef<(() => void) | null>(null);

  const [segments,   setSegments]   = useState<Segment[]>([]);
  const [campaigns,  setCampaigns]  = useState<Campaign[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [analytics,  setAnalytics]  = useState<any>(null);
  const [dataReady,  setDataReady]  = useState(false);

  const card = "bg-white dark:bg-[#111c35] border border-[#1b2a6b]/15 dark:border-[#1b2a6b]/20 border-t-2 border-t-[#c8202f] rounded-2xl transition-colors duration-300 hover:shadow-[0_0_20px_#c8202f10]";

  useEffect(() => { setHistory(loadHistory()); }, []);

  useEffect(() => {
    setDataReady(false);
    Promise.all([
      segmentService.getAll(),
      campaignService.getAll(),
      promotionService.getAll(),
      campaignService.getAnalytics(),
    ])
      .then(([segs, camps, promos, anal]) => {
        setSegments(segs); setCampaigns(camps); setPromotions(promos); setAnalytics(anal); setDataReady(true);
      })
      .catch(() => setDataReady(true));
  }, [selectedMonth, selectedYear, reportMode]);

  // ── Period helpers ──────────────────────────────────────────────────────────
  const activePeriod =
    reportMode === "annual" ? selectedYear : selectedMonth;
  const activePeriodLabel =
    reportMode === "annual"    ? `${selectedYear} Annual`
    : reportMode === "quarterly" ? quarter3Label(selectedMonth)
    : monthLabel(selectedMonth);

  function prevMonthOf(month: string): string {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  function prevMonthLabel() { return monthLabel(prevMonthOf(selectedMonth)); }
  function shouldRemind() {
    if (reportMode !== "monthly") return false;
    return !history.some(r => r.period === prevMonthOf(selectedMonth) && r.mode === "monthly");
  }

  function handleSaveFirst() {
    const prev = prevMonthOf(selectedMonth);
    upsertHistory(prev, "monthly", monthLabel(prev));
    setHistory(loadHistory());
    setReminderOpen(false);
    setMonth(prev);
  }

  function handleGenerateAnyway() {
    setReminderOpen(false);
    pendingExportRef.current?.();
    pendingExportRef.current = null;
  }

  function guardedExport(fn: () => void) {
    if (shouldRemind()) { pendingExportRef.current = fn; setReminderOpen(true); }
    else { fn(); }
  }

  function logExport(name: string, sizeKb: number, type: string) {
    const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    setExportLog(prev => [{ name, size: sizeKb > 1000 ? `${(sizeKb / 1000).toFixed(1)} MB` : `${sizeKb} KB`, date, type }, ...prev].slice(0, 8));
    setDone(name); setTimeout(() => setDone(null), 2500);
    const evicted = upsertHistory(activePeriod, reportMode, activePeriodLabel);
    setHistory(loadHistory());
    if (evicted) { setEvictedToast(evicted); setTimeout(() => setEvictedToast(null), 3500); }
  }

  function getPeriodSubtitle(): string {
    if (reportMode === "annual")    return selectedYear;
    if (reportMode === "quarterly") return quarter3Label(selectedMonth);
    return monthLabel(selectedMonth);
  }

  function getMonthlyData() {
    const monthly: { month: string; leads: number; spend: number }[] = analytics?.monthly ?? [];
    if (reportMode === "monthly")   return monthly.filter(m => m.month === selectedMonth);
    if (reportMode === "quarterly") {
      const [y, mo] = selectedMonth.split("-").map(Number);
      const months = Array.from({ length: 3 }, (_, i) => {
        const d = new Date(y, mo - 1 - i, 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      });
      return monthly.filter(m => months.includes(m.month));
    }
    return monthly.filter(m => m.month.startsWith(selectedYear));
  }

  // ── exports ──────────────────────────────────────────────────────────────────
  async function exportSegmentPerformance(fmt: "xlsx" | "pdf") {
    setLoading(`segment-${fmt}`);
    try {
      const headers  = ["Segment", "Region", "Type", "Customers", "Avg Spend", "Growth %", "Status", "Est. Revenue"];
      const rows     = buildSegmentRows(segments);
      const filename = `Segment_Performance_${activePeriod}.${fmt}`;
      if (fmt === "xlsx") await exportBrandedXlsx(`Segment Performance ${activePeriod}`, headers, rows, filename);
      else await exportToPDF("Segment Performance Report", getPeriodSubtitle(), headers, rows, filename);
      logExport(filename, Math.round(rows.length * 0.12 * 10) + 30, "segment");
    } finally { setLoading(null); }
  }

  async function exportCampaignSegment(fmt: "xlsx" | "pdf") {
    setLoading(`campaign-${fmt}`);
    try {
      const headers  = ["Segment", "Region", "Status", "Customers", "Campaigns", "Total Leads", "Total Spend", "CPL", "Est. ROI"];
      const rows     = buildCampaignRows(campaigns, segments);
      const filename = `Campaign_Segment_${activePeriod}.${fmt}`;
      if (fmt === "xlsx") await exportBrandedXlsx(`Campaign Segment ${activePeriod}`, headers, rows, filename);
      else await exportToPDF("Campaign × Segment Report", getPeriodSubtitle(), headers, rows, filename);
      logExport(filename, Math.round(rows.length * 0.15 * 10) + 40, "campaign");
    } finally { setLoading(null); }
  }

  async function exportPromotionSegment(fmt: "xlsx" | "pdf") {
    setLoading(`promotion-${fmt}`);
    try {
      const headers  = ["Segment", "Region", "Status", "Customers", "Active Promos", "Scheduled", "Avg Discount", "Best Promo", "Code", "Discount"];
      const rows     = buildPromotionRows(promotions, segments);
      const filename = `Promotion_Segment_${activePeriod}.${fmt}`;
      if (fmt === "xlsx") await exportBrandedXlsx(`Promotion Segment ${activePeriod}`, headers, rows, filename);
      else await exportToPDF("Promotions × Segment Report", getPeriodSubtitle(), headers, rows, filename);
      logExport(filename, Math.round(rows.length * 0.12 * 10) + 35, "promotion");
    } finally { setLoading(null); }
  }

  async function exportMonthlyLeads(fmt: "xlsx" | "pdf") {
    setLoading(`leads-${fmt}`);
    try {
      const headers  = ["Month", "Segment", "Region", "Status", "Customers", "Est. Leads", "Est. Spend", "CPL"];
      const rows     = buildLeadsRows(getMonthlyData(), segments);
      const filename = `Monthly_Leads_Segment_${activePeriod}.${fmt}`;
      if (fmt === "xlsx") await exportBrandedXlsx(`Monthly Leads Segment ${activePeriod}`, headers, rows, filename);
      else await exportToPDF("Monthly Leads by Segment", getPeriodSubtitle(), headers, rows, filename);
      logExport(filename, Math.round(rows.length * 0.1 * 10) + 40, "leads");
    } finally { setLoading(null); }
  }

  async function exportAll() {
    await exportSegmentPerformance("xlsx");
    await exportCampaignSegment("xlsx");
    await exportPromotionSegment("xlsx");
    await exportMonthlyLeads("xlsx");
  }

  // ── report cards ─────────────────────────────────────────────────────────────
  const modeBadge =
    reportMode === "annual" ? "Annual"
    : reportMode === "quarterly" ? "3 Months"
    : "Monthly";

  const reports = [
    {
      id: "segment", title: "Segment Performance",
      desc: "Customers, avg spend, growth % and estimated revenue per client segment.",
      icon: <Users size={18} />, iconBg: "bg-[#c8202f]/10 text-[#c8202f]", badgeCls: "bg-[#c8202f]/15 text-[#c8202f]",
      actions: [
        { label: "PDF",  fmt: "pdf"  as const, cls: "bg-[#c8202f] hover:bg-[#e02d3c] text-white font-bold",                                     fn: () => guardedExport(() => exportSegmentPerformance("pdf"))  },
        { label: "XLSX", fmt: "xlsx" as const, cls: "border border-[#c8202f]/50 hover:border-[#c8202f] text-[#c8202f] hover:bg-[#c8202f]/10",   fn: () => guardedExport(() => exportSegmentPerformance("xlsx")) },
      ],
    },
    {
      id: "campaign", title: "Campaign × Segment",
      desc: "Campaign performance (leads, spend, CPL, ROI) broken down by client segment.",
      icon: <BarChart2 size={18} />, iconBg: "bg-blue-500/10 text-blue-400", badgeCls: "bg-blue-500/15 text-blue-400",
      actions: [
        { label: "PDF",  fmt: "pdf"  as const, cls: "bg-blue-500 hover:bg-blue-400 text-black font-bold",                                        fn: () => guardedExport(() => exportCampaignSegment("pdf"))  },
        { label: "XLSX", fmt: "xlsx" as const, cls: "border border-blue-500/50 hover:border-blue-400 text-blue-400 hover:bg-blue-500/10",         fn: () => guardedExport(() => exportCampaignSegment("xlsx")) },
      ],
    },
    {
      id: "promotion", title: "Promotions × Segment",
      desc: "Active promotions, discount rates and best-performing offers per client segment.",
      icon: <Tag size={18} />, iconBg: "bg-amber-500/10 text-amber-400", badgeCls: "bg-amber-500/15 text-amber-400",
      actions: [
        { label: "PDF",  fmt: "pdf"  as const, cls: "bg-amber-500 hover:bg-amber-400 text-black font-bold",                                      fn: () => guardedExport(() => exportPromotionSegment("pdf"))  },
        { label: "XLSX", fmt: "xlsx" as const, cls: "border border-amber-500/50 hover:border-amber-400 text-amber-400 hover:bg-amber-500/10",     fn: () => guardedExport(() => exportPromotionSegment("xlsx")) },
      ],
    },
    {
      id: "leads", title: "Monthly Leads by Segment",
      desc: "Monthly lead volume and spend distributed across client segments.",
      icon: <TrendingUp size={18} />, iconBg: "bg-purple-500/10 text-purple-400", badgeCls: "bg-purple-500/15 text-purple-400",
      actions: [
        { label: "PDF",  fmt: "pdf"  as const, cls: "bg-purple-500 hover:bg-purple-400 text-black font-bold",                                    fn: () => guardedExport(() => exportMonthlyLeads("pdf"))  },
        { label: "XLSX", fmt: "xlsx" as const, cls: "border border-purple-500/50 hover:border-purple-400 text-purple-400 hover:bg-purple-500/10", fn: () => guardedExport(() => exportMonthlyLeads("xlsx")) },
      ],
    },
  ];

  const iconMap:  Record<string, React.ReactNode> = { segment: <Users size={13} />, campaign: <BarChart2 size={13} />, promotion: <Tag size={13} />, leads: <TrendingUp size={13} /> };
  const colorMap: Record<string, string>          = { segment: "text-[#c8202f]", campaign: "text-blue-400", promotion: "text-amber-400", leads: "text-purple-400" };

  return (
    <ProtectedRoute allowedRoles={["MARKETING_MANAGER"]}>

      {/* ── toasts ── */}
      <AnimatePresence>
        {done && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed top-6 right-6 z-[9999] bg-[#c8202f] text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
            <CheckCircle size={15} /> {done} ready
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {evictedToast && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] bg-amber-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
            <Trash2 size={14} /> <span className="font-bold">{evictedToast}</span> removed from history
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── reminder modal ── */}
      <AnimatePresence>
        {reminderOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-[9998] flex items-center justify-center p-4"
            onClick={() => setReminderOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.93, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.93, y: 10 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-[#111c35] border border-[#1b2a6b]/15 dark:border-[#1b2a6b]/20 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 flex-shrink-0 mt-0.5">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Previous Report Unsaved</p>
                  <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                    The report for <span className="text-amber-400 font-bold">{prevMonthLabel()}</span> hasn't been saved yet.
                    Save it before generating this one?
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={handleSaveFirst}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-[#c8202f]/50 text-[#c8202f] hover:bg-[#c8202f]/10 transition uppercase tracking-wide">
                  Save First
                </button>
                <button onClick={handleGenerateAnyway}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-gray-300 transition uppercase tracking-wide">
                  Generate Anyway
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen bg-[#f0f4ff] dark:bg-[#060d1f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

        {/* ── header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight leading-none">
              Marketing <span className="text-[#c8202f]">Reports</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">EMM ERP · By Client Segment</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Period mode toggle */}
            <div className="flex gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1">
              {([["monthly", "1 Month"], ["quarterly", "3 Months"], ["annual", "1 Year"]] as const).map(([mode, label]) => (
                <button key={mode} onClick={() => setReportMode(mode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    reportMode === mode ? "bg-[#c8202f] text-white font-bold" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Period picker */}
            {reportMode !== "annual" ? (
              <input type="month" value={selectedMonth} onChange={e => setMonth(e.target.value)}
                style={{ colorScheme: "dark" }}
                className="bg-white dark:bg-[#111c35] border border-[#1b2a6b]/15 dark:border-[#1b2a6b]/20 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition" />
            ) : (
              <select value={selectedYear} onChange={e => setYear(e.target.value)}
                className="bg-white dark:bg-[#111c35] border border-[#1b2a6b]/15 dark:border-[#1b2a6b]/20 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition">
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}

            {/* Active label */}
            <div className="px-3 py-1.5 rounded-xl bg-[#c8202f]/15 border border-[#c8202f]/20 text-[#c8202f] text-xs font-bold">
              {activePeriodLabel}
            </div>

            <button onClick={() => guardedExport(exportAll)} disabled={!dataReady || !!loading}
              className="flex items-center gap-2 bg-[#c8202f] hover:bg-[#e02d3c] disabled:opacity-50 disabled:cursor-wait px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-white font-bold">
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Export All
            </button>
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: "Total Segments",    value: String(segments.length),                                                   sub: "tracked",            icon: <Users size={14} />,      iconBg: "bg-[#c8202f]/10 text-[#c8202f]"   },
            { label: "Total Customers",   value: segments.reduce((s, seg) => s + (seg.customers ?? 0), 0).toLocaleString(), sub: "across all segments", icon: <DollarSign size={14} />, iconBg: "bg-blue-500/10 text-blue-400"      },
            { label: "Active Campaigns",  value: String(campaigns.filter(c => c.status === "Active").length),               sub: "running now",         icon: <BarChart2 size={14} />,  iconBg: "bg-purple-500/10 text-purple-400"  },
            { label: "Active Promotions", value: String(promotions.filter(p => p.status === "Active").length),              sub: "in market",           icon: <Tag size={14} />,        iconBg: "bg-amber-500/10 text-amber-400"    },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className={`${card} px-5 py-4 flex items-center gap-4`}>
              <div className={`p-2 rounded-xl ${s.iconBg}`}>{s.icon}</div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">{s.label}</p>
                <p className="text-2xl font-bold tracking-tight">{dataReady ? s.value : "—"}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── report cards + sidebar ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {reports.map((r, i) => (
              <motion.div key={r.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                className={`${card} p-6 flex flex-col gap-4`}>
                <div className="flex items-start justify-between">
                  <div className={`p-2.5 rounded-xl ${r.iconBg}`}>{r.icon}</div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${r.badgeCls}`}>{modeBadge}</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">{r.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{r.desc}</p>
                </div>
                <p className="text-[10px] text-gray-400 dark:text-gray-600 uppercase tracking-widest">{activePeriodLabel}</p>
                <div className="flex gap-2 mt-auto">
                  {r.actions.map((a, j) => {
                    const k = `${r.id}-${a.fmt}`;
                    return (
                      <button key={j} onClick={a.fn} disabled={!!loading || !dataReady}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50 disabled:cursor-wait ${a.cls}`}>
                        {loading === k ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />} {a.label}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>

          {/* sidebar */}
          <div className={`${card} p-6 flex flex-col`}>
            <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">Recent Exports</h2>
            <p className="text-[10px] text-gray-500 mb-4 uppercase tracking-widest">Last 2 periods kept · Oldest auto-deleted</p>

            {history.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center">
                  <FileText size={20} className="text-gray-400" />
                </div>
                <p className="text-xs text-gray-500">No saved reports yet</p>
                <p className="text-[10px] text-gray-600">Generated files appear here</p>
              </div>
            ) : (
              <div className="space-y-3 flex-1">
                <AnimatePresence>
                  {history.map((h, i) => (
                    <motion.div key={h.period + h.mode}
                      initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12, height: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-[#1b2a6b]/20 rounded-xl p-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          h.mode === "annual" ? "bg-purple-500/15 text-purple-400"
                          : h.mode === "quarterly" ? "bg-blue-500/15 text-blue-400"
                          : "bg-[#c8202f]/15 text-[#c8202f]"
                        }`}>
                          {h.mode === "annual" ? <BarChart2 size={12} /> : <Calendar size={12} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{h.label}</p>
                          <p className="text-[10px] text-gray-400">{new Date(h.savedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                          h.mode === "annual" ? "bg-purple-500/15 text-purple-400"
                          : h.mode === "quarterly" ? "bg-blue-500/15 text-blue-400"
                          : "bg-[#c8202f]/15 text-[#c8202f]"
                        }`}>
                          {h.mode === "annual" ? "Annual" : h.mode === "quarterly" ? "3M" : "Monthly"}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}

            {exportLog.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-[#1b2a6b]/20">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">This Session</p>
                <div className="space-y-1">
                  {exportLog.slice(0, 4).map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center flex-shrink-0 ${colorMap[f.type] || "text-gray-400"}`}>
                        {iconMap[f.type] || <FileText size={11} />}
                      </div>
                      <p className="text-[10px] text-gray-500 truncate flex-1">{f.name}</p>
                      <p className="text-[9px] text-gray-600 flex-shrink-0">{f.size}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </ProtectedRoute>
  );
}