"use client";
import { exportBrandedXlsx } from "@/lib/reportExport";


import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion } from "framer-motion";
import { BarChart2, Search, Download, Star, TrendingUp, Clock, Loader2, RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import dailyAttendanceService from "@/services/DailyattendanceService";
import { hrService } from "@/services/hrservice";

// ── Constants ────────────────────────────────────────────────────────────────
const EXPECTED_HOURS = 208; // 26 working days × 8h
const EXPECTED_DAYS  = 26;

const AVATAR_COLORS = [
  "bg-[#c8202f]/20 text-[#c8202f]","bg-blue-500/20 text-blue-400",
  "bg-purple-500/20 text-purple-400","bg-amber-500/20 text-amber-400",
  "bg-pink-500/20 text-pink-400","bg-teal-500/20 text-teal-400",
  "bg-red-500/20 text-red-400","bg-indigo-500/20 text-indigo-400",
  "bg-cyan-500/20 text-cyan-400","bg-orange-500/20 text-orange-400",
];

// ── Rating logic ─────────────────────────────────────────────────────────────
// 100% = exactly meeting expectations (normal / on target)
// > 100% = exceeded expectations (overtime pushes score above 100)
// < 100% = below expectations
//
// > 110% → Excellent   (significantly above target)
// 100–110% → Good      (on target or slightly above)
// 85–99%  → Average    (slightly below target)
// < 85%   → Poor       (significantly below target)
function deriveRating(score: number): "Excellent" | "Good" | "Average" | "Poor" {
  if (score > 110) return "Excellent";
  if (score >= 100) return "Good";
  if (score >= 85)  return "Average";
  return "Poor";
}

const RATING_CONFIG = {
  Excellent: { badge: "bg-[#c8202f]/15 text-[#c8202f]", dot: "bg-[#e02d3c]", bar: "bg-[#c8202f]", glow: "shadow-emerald-500/20" },
  Good:      { badge: "bg-blue-500/15 text-blue-400",       dot: "bg-blue-400",    bar: "bg-blue-500",    glow: "shadow-blue-500/20"    },
  Average:   { badge: "bg-amber-500/15 text-amber-400",     dot: "bg-amber-400",   bar: "bg-amber-500",   glow: "shadow-amber-500/20"   },
  Poor:      { badge: "bg-red-500/15 text-red-400",         dot: "bg-red-400",     bar: "bg-red-500",     glow: "shadow-red-500/20"     },
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────
interface Employee { _id: string; name: string; department: string; position: string; }
interface AttSummary {
  employeeId: string; employeeName: string; department: string;
  presentDays: number; absentDays: number; lateDays: number;
  totalExtraHours: number; totalHoursWorked?: number;
}
interface PerfRow {
  employeeId: string; name: string; department: string; position: string;
  hoursWorked: number; presentDays: number; absentDays: number; lateDays: number; extraHours: number;
  score: number; rating: "Excellent" | "Good" | "Average" | "Poor";
  hasData: boolean;
}

function monthStr() { return new Date().toISOString().slice(0, 7); }

// ── Main component ─────────────────────────────────────────────────────────────
export default function HRPerformance() {
  const { t, language } = useLanguage();
  const [rows, setRows]             = useState<PerfRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [filterRating, setFilter]   = useState("all");
  const [filterDept, setFilterDept] = useState("All");
  const [selectedMonth, setMonth]   = useState(monthStr());

  const card = "bg-white dark:bg-[#111c35] border border-[#1b2a6b]/15 dark:border-[#1b2a6b]/20 border-t-2 border-t-[#c8202f] rounded-2xl transition-colors duration-300 hover:shadow-[0_0_20px_#c8202f10]";

  useEffect(() => { load(); }, [selectedMonth]);

  async function load() {
    setLoading(true);
    try {
      const [empsRes, attRes] = await Promise.all([
        hrService.getAllEmployees(true),
        dailyAttendanceService.summary(selectedMonth).catch(() => []),
      ]);

      const emps: Employee[] = (Array.isArray(empsRes) ? empsRes : empsRes?.data ?? [])
        .filter((e: any) => e.role === "EMPLOYEE" || !e.role);

      const attArr: AttSummary[] = Array.isArray(attRes) ? attRes : (attRes as any)?.data ?? [];
      const attMap: Record<string, AttSummary> = {};
      for (const a of attArr) attMap[a.employeeId] = a;

      const built: PerfRow[] = emps.map((emp) => {
        const att = attMap[emp._id];
        if (!att) {
          return {
            employeeId: emp._id, name: emp.name, department: emp.department, position: emp.position,
            hoursWorked: 0, presentDays: 0, absentDays: 0, lateDays: 0, extraHours: 0,
            score: 0, rating: "Poor" as const, hasData: false,
          };
        }

        const extraHrs    = att.totalExtraHours || 0;
        const hoursWorked = (att.totalHoursWorked && att.totalHoursWorked > 0)
          ? att.totalHoursWorked
          : (att.presentDays * 8) + extraHrs;

        // Score = (actual hours worked / expected hours for days recorded) * 100
        // 100% means the employee worked exactly the expected hours — on target.
        // Overtime pushes the score above 100%, absence pulls it below.
        const daysRecorded  = (att.presentDays || 0) + (att.absentDays || 0);
        const expectedSoFar = Math.max(daysRecorded * 8, 1);
        const score         = daysRecorded > 0
          ? Math.round((hoursWorked / expectedSoFar) * 100)
          : 0;

        return {
          employeeId: emp._id, name: emp.name, department: emp.department, position: emp.position,
          hoursWorked, presentDays: att.presentDays, absentDays: att.absentDays,
          lateDays: att.lateDays, extraHours: extraHrs,
          score, rating: deriveRating(score), hasData: true,
        };
      });

      built.sort((a, b) => {
        if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;
        return b.score - a.score;
      });

      setRows(built);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function exportCSV() {
    const headers = ["Employee","Department","Position","Hours Worked","Expected Hours","Score %","Rating","Present Days","Absent Days","Late Days","Extra Hours","Month"];
    const data = rows.filter(r => r.hasData).map(r => [
      r.name, r.department, r.position, r.hoursWorked, EXPECTED_HOURS,
      r.score, r.rating, r.presentDays, r.absentDays, r.lateDays, r.extraHours, selectedMonth,
    ]);
    await exportBrandedXlsx(`Performance ${selectedMonth}`, headers, data, `performance_${selectedMonth}.xlsx`);
  }

  // ── Derived stats ─────────────────────────────────────────────────────────
  const withData    = rows.filter(r => r.hasData);
  const avgScore    = withData.length ? Math.round(withData.reduce((s, r) => s + r.score, 0) / withData.length) : 0;
  const excellentCt = withData.filter(r => r.rating === "Excellent").length;
  const needsReview = withData.filter(r => r.rating === "Poor" || r.rating === "Average").length;
  const topRows     = [...withData].sort((a, b) => b.score - a.score).slice(0, 5);
  const maxScore    = topRows[0]?.score || 100;
  const departments = ["All", ...Array.from(new Set(rows.map(r => r.department)))];

  const filtered = rows.filter(r => {
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.department.toLowerCase().includes(search.toLowerCase());
    const matchRating = filterRating === "all" || r.rating.toLowerCase() === filterRating;
    const matchDept   = filterDept === "All" || r.department === filterDept;
    return matchSearch && matchRating && matchDept;
  });

  const ratingLabel = (r: string) =>
    ({ Excellent: t("excellent"), Good: t("good"), Average: t("average"), Poor: t("poor") }[r] ?? r);

  return (
    <ProtectedRoute allowedRoles={["HR_MANAGER"]}>
      
        <div className="min-h-screen bg-gray-100 dark:bg-[#060d1f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

          {/* ── HEADER ── */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight leading-none">
                {language === "fr"
                  ? <>{t("tracking")}<span className="text-[#c8202f]"> {t("performance")}</span></>
                  : <>{t("performance")} <span className="text-[#c8202f]">{t("tracking")}</span></>}
              </h1>
              <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">EMM ERP · 100% = on target · above = overtime · below = absence</p>
            </div>
            <div className="flex items-center gap-3">
              <input type="month" value={selectedMonth} onChange={e => setMonth(e.target.value)}
                className="bg-white dark:bg-[#111c35] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none transition" />
              <button onClick={load}
                className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20 px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300">
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
              <button onClick={exportCSV} disabled={withData.length === 0}
                className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20 disabled:opacity-40 px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300">
                <Download size={13} /> {t("export")}
              </button>
            </div>
          </div>

          {/* ── Legend strip ── */}
          <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-widest text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#c8202f]" /> Excellent — &gt;110%</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />    Good — 100–110% (on target)</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />   Average — 85–99%</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" />     Poor — &lt;85%</span>
            <span className="text-gray-600 ml-2">100% = {EXPECTED_HOURS}h / month ({EXPECTED_DAYS} days × 8h)</span>
          </div>

          {/* ── KPI Strip ── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: t("avgScore"),    value: withData.length ? `${avgScore}%` : "—", sub: t("teamAverage"),   icon: <BarChart2 size={14} />, iconBg: "bg-[#c8202f]/10 text-[#c8202f]" },
              { label: t("excellent"),   value: String(excellentCt),                     sub: t("topPerformers"), icon: <Star size={14} />,     iconBg: "bg-blue-500/10 text-blue-400" },
              { label: t("evaluations"), value: String(withData.length),                 sub: `${selectedMonth}`, icon: <TrendingUp size={14} />,iconBg: "bg-purple-500/10 text-purple-400" },
              { label: t("needsReview"), value: String(needsReview),                     sub: t("belowTarget"),   icon: <Clock size={14} />,    iconBg: "bg-amber-500/10 text-amber-400" },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className={`${card} px-5 py-4 flex items-center gap-4`}>
                <div className={`p-2 rounded-xl ${s.iconBg}`}>{s.icon}</div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">{s.label}</p>
                  <p className="text-2xl font-bold tracking-tight">{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* ── Table + Sidebar ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

            {/* Table (2/3) */}
            <div className={`${card} overflow-hidden xl:col-span-2`}>
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-white/[0.05]">
                <div>
                  <h2 className="text-base font-bold">{t("evaluations")}</h2>
                  <p className="text-xs text-gray-500">{filtered.length} {t("ofText")} {rows.length} {t("records")}</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="relative">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      className="pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:border-[#c8202f]/40 transition text-gray-900 dark:text-white placeholder-gray-400"
                      placeholder={t("searchEmployee")} value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <select
                    className="px-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-600 dark:text-gray-300 focus:outline-none transition"
                    value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                    {departments.map(d => <option key={d}>{d}</option>)}
                  </select>
                  <select
                    className="px-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-600 dark:text-gray-300 focus:outline-none transition"
                    value={filterRating} onChange={e => setFilter(e.target.value)}>
                    <option value="all">{t("allRatings")}</option>
                    <option value="excellent">{t("excellent")}</option>
                    <option value="good">{t("good")}</option>
                    <option value="average">{t("average")}</option>
                    <option value="poor">{t("poor")}</option>
                  </select>
                </div>
              </div>

              {/* Column headers */}
              <div className="grid px-6 py-3 text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-600 border-b border-gray-100 dark:border-white/[0.04]"
                style={{ gridTemplateColumns: "2fr 1fr 1.6fr 1fr 1fr 1fr" }}>
                <span>{t("employee")}</span>
                <span>{t("dept")}</span>
                <span>Hours / {EXPECTED_HOURS}h</span>
                <span>Present</span>
                <span>Absent</span>
                <span>{t("rating")}</span>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16 gap-2 text-gray-400 text-xs">
                  <Loader2 size={16} className="animate-spin" /> Loading…
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-400">
                  {rows.length === 0 ? "No employees found." : t("noRecordsMatch")}
                </div>
              ) : filtered.map((row, i) => {
                const rc = RATING_CONFIG[row.rating];
                // Progress bar: 100% of bar = 100% score (on target).
                // Scores above 100 are capped at 100 visually but shown numerically.
                const barPct = Math.min(row.score, 100);

                return (
                  <motion.div key={row.employeeId}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className={`grid px-6 py-4 items-center hover:bg-gray-50 dark:hover:bg-white/[0.02] transition ${i < filtered.length - 1 ? "border-b border-gray-100 dark:border-white/[0.03]" : ""} ${!row.hasData ? "opacity-40" : ""}`}
                    style={{ gridTemplateColumns: "2fr 1fr 1.6fr 1fr 1fr 1fr" }}>

                    {/* Employee */}
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                        {row.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{row.name}</p>
                        <p className="text-[10px] text-gray-400">{row.position || "Employee"}</p>
                      </div>
                    </div>

                    {/* Dept */}
                    <p className="text-xs text-gray-500 dark:text-gray-400">{row.department}</p>

                    {/* Hours + progress bar */}
                    <div className="pr-4">
                      {row.hasData ? (
                        <>
                          <div className="flex items-baseline justify-between mb-1.5">
                            <span className={`text-sm font-bold ${rc.dot.replace("bg-", "text-")}`}>
                              {row.hoursWorked.toFixed(1)}h
                            </span>
                            <span className={`text-[10px] font-bold ${
                              row.score > 110 ? "text-[#c8202f]" :
                              row.score >= 100 ? "text-blue-400" :
                              row.score >= 85  ? "text-amber-400" : "text-red-400"
                            }`}>
                              {row.score}%{row.score > 100 && " ↑"}
                            </span>
                          </div>
                          <div className="h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${barPct}%` }}
                              transition={{ delay: 0.2 + i * 0.04, duration: 0.7, ease: "easeOut" }}
                              className={`h-full rounded-full ${rc.bar}`}
                            />
                          </div>
                          {row.extraHours > 0 && (
                            <p className="text-[10px] text-indigo-400 mt-0.5">+{row.extraHours.toFixed(1)}h overtime</p>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-gray-500">No data</span>
                      )}
                    </div>

                    {/* Present days */}
                    <div className="text-center">
                      {row.hasData
                        ? <span className="text-xs font-bold text-[#c8202f]">{row.presentDays}<span className="text-gray-500 font-normal">/{EXPECTED_DAYS}</span></span>
                        : <span className="text-xs text-gray-600">—</span>}
                    </div>

                    {/* Absent days */}
                    <div className="text-center">
                      {row.hasData
                        ? <span className={`text-xs font-bold ${row.absentDays > 0 ? "text-red-400" : "text-gray-500"}`}>
                            {row.absentDays > 0 ? row.absentDays : "—"}
                          </span>
                        : <span className="text-xs text-gray-600">—</span>}
                    </div>

                    {/* Rating badge */}
                    {row.hasData ? (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold w-fit ${rc.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${rc.dot}`} />
                        {ratingLabel(row.rating)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-500 italic">No attendance</span>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* ── Sidebar ── */}
            <div className={`${card} p-6`}>

              {/* Top Performers */}
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{t("topPerformers")}</h2>
              <p className="text-xs text-gray-500 mt-0.5 mb-6">{t("performanceScoreThisCycle")}</p>

              {topRows.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">No data for {selectedMonth}</p>
              ) : (
                <div className="space-y-5">
                  {topRows.map((emp, i) => (
                    <div key={emp.employeeId}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-xs font-mono w-5 shrink-0">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span className="text-sm font-bold text-gray-900 dark:text-white">{emp.name}</span>
                        </div>
                        <span className={`text-sm font-bold tabular-nums ${
                          emp.score > 110 ? "text-[#c8202f]" :
                          emp.score >= 100 ? "text-blue-400" :
                          emp.score >= 85  ? "text-amber-400" : "text-red-400"
                        }`}>{emp.score}%</span>
                      </div>
                      <div className="h-[3px] bg-gray-200 dark:bg-white/[0.06] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min((emp.score / Math.max(maxScore, 110)) * 100, 100)}%` }}
                          transition={{ delay: 0.2 + i * 0.07, duration: 0.7, ease: "easeOut" }}
                          className={`h-full rounded-full ${RATING_CONFIG[emp.rating].bar}`}
                        />
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest">{emp.department}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Rating Breakdown */}
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-[#1b2a6b]/20">
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-5">
                  {t("ratingBreakdown")}
                </p>
                {withData.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center py-4">No evaluations yet</p>
                ) : (
                  <div className="space-y-4">
                    {(["Excellent", "Good", "Average", "Poor"] as const).map((rating, i) => {
                      const count = withData.filter(r => r.rating === rating).length;
                      const pct   = withData.length ? Math.round((count / withData.length) * 100) : 0;
                      const rc    = RATING_CONFIG[rating];
                      return (
                        <div key={rating}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{ratingLabel(rating)}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-500">{count} {t("employees")}</span>
                              <span className="text-xs font-bold text-gray-900 dark:text-white w-8 text-right">{pct}%</span>
                            </div>
                          </div>
                          <div className="h-[3px] bg-gray-200 dark:bg-white/[0.06] rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ delay: 0.3 + i * 0.1, duration: 0.7, ease: "easeOut" }}
                              className={`h-full ${rc.bar} rounded-full`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Target reference line note */}
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/[0.04]">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-relaxed">
                    <span className="text-blue-400 font-bold">100%</span> = on target ({EXPECTED_HOURS}h).
                    Scores above 100% reflect overtime worked.
                    Scores below indicate absences or late arrivals.
                  </p>
                </div>
              </div>

            </div>
          </div>

        </div>
      
    </ProtectedRoute>
  );
}