"use client";
import { exportBrandedXlsx } from "@/lib/reportExport";


import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion } from "framer-motion";
import { DollarSign, Clock, AlertCircle, RefreshCw, Download, Users } from "lucide-react";
import { useState, useEffect } from "react";
import {
  LineChart, Line, BarChart as ReBarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { hrService } from "@/services/hrservice";

function Sparkline({ data, dataKey, color }: { data: any[]; dataKey: string; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={48}>
      <LineChart data={data}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

const AVATAR_COLORS = [
  "bg-[#c8202f]/20 text-[#c8202f]", "bg-blue-500/20 text-blue-400",
  "bg-purple-500/20 text-purple-400",   "bg-amber-500/20 text-amber-400",
  "bg-pink-500/20 text-pink-400",
];

export default function HRDashboardPage() {
  const { t, language } = useLanguage();
  const [activeRange, setActiveRange] = useState<"6m" | "3m" | "1m">("6m");
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  const tooltipStyle = { backgroundColor: "#0d1117", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "10px", fontSize: "11px" };
  const card = "bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/[0.06] border-t-2 border-t-[#c8202f] rounded-2xl transition-colors duration-300 hover:shadow-[0_0_20px_#c8202f10]";

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const emps = await hrService.getAllEmployees(true);
        setEmployees(emps?.data ?? emps ?? []);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  // Derive all stats from the full employees array (not dept-filtered stats)
  const total     = employees.length;
  const onLeave   = employees.filter(e => e.status === "On Leave").length;
  const active    = employees.filter(e => e.status === "Active" || !e.status).length;
  const avgTenure = total === 0 ? 0 : parseFloat(
    (employees.reduce((sum, e) => {
      const diff = (Date.now() - new Date(e.joinedDate || e.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 365);
      return sum + diff;
    }, 0) / total).toFixed(1)
  );

  // Build sparklines from employee joined dates grouped by month (last 6)
  const now = new Date();
  const monthlyHires = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const label = d.toLocaleString(language === "fr" ? "fr-FR" : "en-US", { month: "short" });
    const count = employees.filter(e => {
      const joined = new Date(e.joinedDate || e.createdAt);
      return joined.getFullYear() === d.getFullYear() && joined.getMonth() === d.getMonth();
    }).length;
    return { month: label, hires: count, v: count };
  });

  const salaryData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const label = d.toLocaleString(language === "fr" ? "fr-FR" : "en-US", { month: "short" });
    const empsThisMonth = employees.filter(e => new Date(e.joinedDate || e.createdAt) <= d);
    const totalSalary = empsThisMonth.reduce((sum, e) => sum + (e.salary || 0), 0);
    return { month: label, payroll: totalSalary, v: totalSalary };
  });

  const totalPayroll = employees.reduce((sum, e) => sum + (e.salary || 0), 0);

  // Top employees by salary (until we have real performance data)
  const topEmployees = [...employees]
    .sort((a, b) => (b.salary || 0) - (a.salary || 0))
    .slice(0, 5);
  const maxSalary = topEmployees[0]?.salary || 1;

  const exportXlsx = async () => {
    if (!employees.length) return;
    const headers = ["Name", "Department", "Position", "Salary (TND)", "Status", "Joined"];
    const rows = employees.map(e => [
      e.name || "",
      e.department || "-",
      e.position || "Employee",
      e.salary || 0,
      e.status || "Active",
      e.joinedDate ? new Date(e.joinedDate).toLocaleDateString("en-GB") : "-",
    ]);
    await exportBrandedXlsx("HR Dashboard", headers, rows, `HR_Dashboard_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <ProtectedRoute allowedRoles={["HR_MANAGER"]}>
    
      <div className="min-h-screen bg-gray-100 dark:bg-[#060a0f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight leading-none">
              {language === "fr" ? (
                <>{t("dashboard")} <span className="text-[#c8202f]">{t("hr")}</span></>
              ) : (
                <>{t("hr")} <span className="text-[#c8202f]">{t("dashboard")}</span></>
              )}
            </h1>
            <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">EMM ERP</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={exportXlsx} disabled={!employees.length} className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-[#c8202f]/40 hover:text-[#c8202f] px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300 disabled:opacity-40">
              <Download size={13} /> {t("exportXlsx")}
            </button>
          </div>
        </div>

        {/* KPI sparkline cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            {
              icon: <DollarSign size={16} />, iconBg: "bg-[#c8202f]/10 text-[#c8202f]",
              label: t("totalPayroll"), value: `${totalPayroll.toLocaleString()} TND`,
              valueColor: "text-[#c8202f]", spark: salaryData, sparkColor: "#c8202f",
            },
            {
              icon: <Users size={16} />, iconBg: "bg-blue-500/10 text-blue-400",
              label: t("totalEmployeesKpi"), value: String(total),
              valueColor: "text-blue-400", spark: monthlyHires, sparkColor: "#60a5fa",
            },
            {
              icon: <AlertCircle size={16} />, iconBg: "bg-amber-500/10 text-amber-400",
              label: t("onLeave"), value: String(onLeave),
              valueColor: "text-amber-400", spark: Array(6).fill({ v: 0 }), sparkColor: "#f59e0b",
            },
            {
              icon: <Clock size={16} />, iconBg: "bg-purple-500/10 text-purple-400",
              label: t("avgTenure"), value: `${avgTenure} yr`,
              valueColor: "text-purple-400", spark: Array(6).fill({ v: avgTenure }), sparkColor: "#a78bfa",
            },
          ].map((kpi, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className={`${card} p-5 flex flex-col gap-3`}>
              <div className="flex items-start justify-between">
                <div className={`p-2 rounded-xl ${kpi.iconBg}`}>{kpi.icon}</div>
              </div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">{kpi.label}</p>
              <p className={`text-3xl font-bold tracking-tight ${kpi.valueColor}`}>
                {loading ? "—" : kpi.value}
              </p>
              <div className="-mx-1"><Sparkline data={kpi.spark} dataKey="v" color={kpi.sparkColor} /></div>
            </motion.div>
          ))}
        </div>

        {/* Secondary stats */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: t("totalEmployeesKpi"), value: loading ? "—" : String(total),    sub: t("activeWorkforce") },
            { label: t("activeWorkforce"),   value: loading ? "—" : String(active),   sub: `${onLeave} ${t("onLeave").toLowerCase()}` },
            { label: t("newHires"),          value: loading ? "—" : String(monthlyHires[5]?.hires ?? 0), sub: t("thisMonth") },
            { label: t("avgTenure"),         value: loading ? "—" : `${avgTenure} yr`, sub: t("avgPerEmployee") },
          ].map((s, i) => (
            <div key={i} className={`${card} px-5 py-4`}>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">{s.label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Charts + Top employees */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className={`${card} p-6 xl:col-span-2 space-y-2`}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold">{t("payrollOverview")}</h2>
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
                <p className="text-[10px] uppercase tracking-widest text-gray-500">{t("totalPayroll")}</p>
                <p className="text-2xl font-bold text-[#c8202f]">
                  {loading ? "—" : `${totalPayroll.toLocaleString()} TND`}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500">{t("totalEmployeesKpi")}</p>
                <p className="text-2xl font-bold text-blue-400">{loading ? "—" : total}</p>
              </div>
            </div>

            <div className="pt-2">
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">{t("newHires")} / {t("thisMonth")}</p>
              <ResponsiveContainer width="100%" height={180}>
                <ReBarChart data={monthlyHires}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [v, t("newHires")]} />
<Bar dataKey="hires" fill="#c8202f" radius={[4, 4, 0, 0]} />
                </ReBarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top employees by salary */}
          <div className={`${card} p-6`}>
            <h2 className="text-base font-bold">{t("topPerformers")}</h2>
            <p className="text-xs text-gray-500 mb-5">{t("payroll")}</p>
            {loading ? (
              <div className="flex items-center justify-center h-40 text-gray-400 text-xs">
                <RefreshCw size={14} className="animate-spin mr-2" /> {t("loading") || "Loading..."}
              </div>
            ) : topEmployees.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-8">{t("noEmployeesMatch")}</p>
            ) : (
              <div className="space-y-5">
                {topEmployees.map((emp, i) => (
                  <div key={emp._id}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                          {emp.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{emp.name}</span>
                      </div>
                      <span className="text-[#c8202f] text-xs font-bold">{(emp.salary || 0).toLocaleString()} TND</span>
                    </div>
                    <div className="h-1 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${((emp.salary || 0) / maxSalary) * 100}%` }}
                        transition={{ delay: 0.3 + i * 0.07, duration: 0.6 }}
                        className="h-full bg-[#c8202f] rounded-full" />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{emp.department} · {emp.position}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    
    </ProtectedRoute>
  );
}