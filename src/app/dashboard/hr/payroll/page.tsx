"use client";
import { exportBrandedXlsx } from "@/lib/reportExport";


import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { DollarSign, Search, FileText, Download, TrendingUp, AlertCircle, Loader2, Receipt, X } from "lucide-react";
import { useState, useEffect } from "react";
import { hrService } from "@/services/hrservice";
import { avanceService } from "@/services/avanceService";
import dailyAttendanceService from "@/services/DailyattendanceService";
import { generatePayslip } from "@/lib/payslipDocument";
import { computePayroll, deriveHourlyRate } from "@/lib/payrollCalc";
import api from "@/services/api";

const AVATAR_COLORS = [
  "bg-[#c8202f]/20 text-[#c8202f]","bg-blue-500/20 text-blue-400",
  "bg-purple-500/20 text-purple-400","bg-amber-500/20 text-amber-400",
  "bg-pink-500/20 text-pink-400","bg-teal-500/20 text-teal-400",
  "bg-red-500/20 text-red-400","bg-indigo-500/20 text-indigo-400",
];
const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  Active:     { badge: "bg-[#c8202f]/15 text-[#c8202f]", dot: "bg-[#c8202f]" },
  "On Leave": { badge: "bg-blue-500/15 text-blue-400",       dot: "bg-blue-400"    },
  Inactive:   { badge: "bg-red-500/15 text-red-400",         dot: "bg-red-400"     },
};

interface Employee {
  _id: string; name: string; email: string; position: string;
  department: string; salary: number; joinedDate: string; status: string;
  matricule?: string; cnssNumber?: string; address?: string; qualification?: string;
  category?: string; echelon?: string; situation?: string; familyStatus?: string;
  numChildren?: number; hourlyRate?: number;
}
interface AttSummary {
  presentDays: number; absentDays: number; lateDays: number; totalExtraHours: number;
}
interface PayrollRow {
  emp: Employee;
  base: number; brut: number; cnss: number; cnssEmployee: number; cnssEmployer: number; cnssTotal: number;
  avances: number; overtime: number;
  absenceDays: number; absenceDeduction: number; net: number; netAgreed: number;
}

// ── Payroll row — uses the SAME engine as the bulletin (computePayroll) ──────
// The stored salary is the monthly BASE; this row mirrors the payslip exactly.
function calcRow(emp: Employee, avances: any[], att?: AttSummary): PayrollRow {
  const salary     = emp.salary || 0;
  const hourlyRate = deriveHourlyRate(salary, 208);

  const absenceDays   = att?.absentDays ?? 0;
  const absenceHours  = absenceDays * 8;
  const overtimeHours = att?.totalExtraHours ?? 0;

  const avTotal = avances
    .filter(a => a.employeeId === emp._id && (a.status === "Deducted" || a.status === "approved" || a.approved))
    .reduce((s: number, a: any) => s + (a.amount || 0), 0);

  // Same inputs and engine as the PDF / modal → all three agree
  const p = computePayroll({
    salary,
    hourlyRate,
    monthlyHours: 208,
    familyStatus: (emp as any).familyStatus,
    numChildren: (emp as any).numChildren,
    avancesTotal: avTotal,
    absenceHours,
    overtimeHours,
  });

  return {
    emp,
    base: p.agreedSalary,            // agreed salary
    brut: p.brut,                    // grossed-up gross
    cnss: p.cnssTotal,               // 29.67% total — DISPLAY ONLY
    cnssEmployee: p.cnssEmployee,    // 9.67% (neutralised)
    cnssEmployer: Math.round((p.cnssTotal - p.cnssEmployee) * 1000) / 1000,
    cnssTotal: p.cnssTotal,
    avances: p.avances,
    overtime: p.overtimePay,
    absenceDays,
    absenceDeduction: p.absenceDeduction,
    net: p.netToPay,                 // matches the bulletin NET PAYABLE
    netAgreed: p.agreedSalary,
  };
}

// ── helpers ────────────────────────────────────────────────────────────────
function r2(n: number) { return Math.round(n * 1000) / 1000; }

function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function HRPayroll() {
  const { t, language } = useLanguage();
  const [rows, setRows]           = useState<PayrollRow[]>([]);
  const [allAvances, setAllAvances] = useState<any[]>([]);
  const [attMap, setAttMap]       = useState<Record<string, AttSummary>>({});
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [filterDept, setFilter]   = useState("all");

  // Payslip modal state
  const [showPayslip, setShowPayslip]         = useState(false);
  const [payslipRow, setPayslipRow]           = useState<PayrollRow | null>(null);
  const [payslipLoading, setPayslipLoading]   = useState(false);
  const [psFromMonth, setPsFromMonth]         = useState(new Date().toISOString().slice(0, 7));
  const [psToMonth, setPsToMonth]             = useState(new Date().toISOString().slice(0, 7));
  const [dailyRecords, setDailyRecords]       = useState<any[]>([]);
  const [dailyFetching, setDailyFetching]     = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // Company config (CNSS / establishment) used on the bulletin de paie header
  const [companyCfg, setCompanyCfg] = useState<any>({});
  useEffect(() => {
    api.get("/company-config").then(r => setCompanyCfg((r.data as any)?.data ?? r.data)).catch(() => {});
  }, []);

  const card = "bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl transition-colors duration-300";
  const gridCols = "2fr 1fr 0.85fr 0.95fr 0.8fr 0.8fr 1fr 0.85fr";

  useEffect(() => { fetchData(); }, [selectedMonth]);

  async function fetchData() {
    setLoading(true);
    try {
      const [empsRes, avancesRes, attSummary] = await Promise.all([
        hrService.getAllEmployees(true),
        avanceService.list(),
        dailyAttendanceService.summary(selectedMonth).catch(() => []),
      ]);
      const emps    = (Array.isArray(empsRes) ? empsRes : empsRes?.data ?? []).filter((e: any) => e.role === "EMPLOYEE");
      const avances = Array.isArray(avancesRes) ? avancesRes : (avancesRes?.data ?? []);
      const map: Record<string, AttSummary> = {};
      for (const s of (attSummary || [])) map[s.employeeId] = s;
      setAllAvances(avances);
      setAttMap(map);
      setRows(emps.map((e: any) => calcRow(e, avances, map[e._id])));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function exportCSV() {
    const headers = ["Name","Department","Position","Brut (TND)","Overtime","Absent Days","Absence Deduction","CNSS","Avances","Net (TND)","Status","Month"];
    const data = rows.map(r => [
      r.emp.name, r.emp.department, r.emp.position, r.brut, r.overtime,
      r.absenceDays, -r.absenceDeduction, r.cnss, -r.avances,
      r.net, r.emp.status || "Active", monthLabel(selectedMonth),
    ]);
    await exportBrandedXlsx(`Payroll ${monthLabel(selectedMonth)}`, headers, data, `payroll_${selectedMonth}.xlsx`);
  }

  // Fetch daily records for employee across a month range
  async function fetchDailyRecords(empId: string, from: string, to: string) {
    setDailyFetching(true);
    try {
      const months: string[] = [];
      const [fy, fm] = from.split("-").map(Number);
      const [ty, tm] = to.split("-").map(Number);
      let y = fy, m = fm;
      while (y < ty || (y === ty && m <= tm)) {
        months.push(`${y}-${String(m).padStart(2,"0")}`);
        m++; if (m > 12) { m = 1; y++; }
      }
      const results = await Promise.all(
        months.map(month => dailyAttendanceService.list({ month, employeeId: empId }).catch(() => []))
      );
      setDailyRecords(results.flat().sort((a, b) => a.date.localeCompare(b.date)));
    } finally { setDailyFetching(false); }
  }

  function openPayslip(row: PayrollRow) {
    setPayslipRow(row);
    const m = new Date().toISOString().slice(0,7);
    setPsFromMonth(m); setPsToMonth(m);
    setDailyRecords([]);
    setShowPayslip(true);
    fetchDailyRecords(row.emp._id, m, m);
  }

  function handleRangeChange(from: string, to: string) {
    if (!payslipRow) return;
    setPsFromMonth(from); setPsToMonth(to);
    fetchDailyRecords(payslipRow.emp._id, from, to);
  }

  async function handleDownloadPayslip() {
    if (!payslipRow) return;
    setPayslipLoading(true);
    try {
      const empAvances = allAvances.filter((a: any) =>
        a.employeeId === payslipRow.emp._id &&
        (a.status === "Deducted" || a.status === "approved" || a.approved)
      );
      const avancesTotal = empAvances.reduce((s: number, a: any) => s + (a.amount || 0), 0);
      // Derive absence + overtime hours from the loaded daily attendance records
      let absenceHours = 0, overtimeHours = 0;
      for (const r of dailyRecords) {
        const hw = r.hoursWorked ?? 0;
        if (r.status === "Absent") absenceHours += 8;
        else absenceHours += Math.max(0, 8 - hw);
        overtimeHours += r.extraHours ?? 0;
      }
      await generatePayslip({
        employee: payslipRow.emp as any,
        company: companyCfg,
        period: psFromMonth,
        avancesTotal,
        absenceHours,
        overtimeHours,
        language: language === "fr" ? "fr" : "en",
      });
    } finally { setPayslipLoading(false); }
  }

  const departments = ["all", ...Array.from(new Set(rows.map(r => r.emp.department).filter(Boolean)))];
  const filtered    = rows.filter(r => {
    const matchSearch = r.emp.name.toLowerCase().includes(search.toLowerCase());
    const matchDept   = filterDept === "all" || r.emp.department === filterDept;
    return matchSearch && matchDept;
  });

  const totalNet     = rows.reduce((s, r) => s + r.net,     0);
  const totalBase    = rows.reduce((s, r) => s + r.base,    0);
  const totalAvances = rows.reduce((s, r) => s + r.avances, 0);
  const onLeave      = rows.filter(r => r.emp.status === "On Leave").length;

  return (
    <ProtectedRoute allowedRoles={["HR_MANAGER"]}>

      {/* Pay Slip Modal — outside DashboardLayout */}
      <AnimatePresence>
        {showPayslip && payslipRow && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6"
            onClick={() => setShowPayslip(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-[#c8202f]/10 flex items-center justify-center">
                    <Receipt size={15} className="text-[#c8202f]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">{payslipRow.emp.name} — Pay Slip</h2>
                    <p className="text-[10px] text-gray-400">{payslipRow.emp.position} · {payslipRow.emp.department}</p>
                  </div>
                </div>
                <button onClick={() => setShowPayslip(false)} className="text-gray-500 hover:text-white transition"><X size={18} /></button>
              </div>

              {/* Date range picker */}
              <div className="flex items-center gap-4 px-6 py-3 border-b border-white/[0.06] flex-shrink-0 bg-white/[0.02]">
                <span className="text-[10px] uppercase tracking-widest text-gray-500">Period</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">From</span>
                  <input type="month" value={psFromMonth}
                    style={{ colorScheme: "dark" }}
                    onChange={e => handleRangeChange(e.target.value, psToMonth)}
                    className="bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/50 transition" />
                  <span className="text-xs text-gray-400">To</span>
                  <input type="month" value={psToMonth}
                    style={{ colorScheme: "dark" }}
                    onChange={e => handleRangeChange(psFromMonth, e.target.value)}
                    className="bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/50 transition" />
                </div>
                {/* Quick presets */}
                <div className="flex items-center gap-1.5 ml-auto">
                  {[
                    { label: "This month", fn: () => { const m = new Date().toISOString().slice(0,7); handleRangeChange(m,m); }},
                    { label: "Last 3M",    fn: () => { const now=new Date(); const to=now.toISOString().slice(0,7); now.setMonth(now.getMonth()-2); handleRangeChange(now.toISOString().slice(0,7),to); }},
                    { label: "This year",  fn: () => { const y=new Date().getFullYear(); handleRangeChange(`${y}-01`,`${y}-12`); }},
                  ].map((p,i) => (
                    <button key={i} onClick={p.fn}
                      className="px-2 py-1 rounded-lg text-[10px] border border-white/10 text-gray-400 hover:border-[#c8202f]/40 hover:text-[#c8202f] transition">
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable daily records table */}
              <div className="overflow-y-auto flex-1 p-4 font-mono text-xs">
                {/* Salary missing warning */}
                {payslipRow.emp.salary === 0 && (
                  <div className="mx-4 mt-3 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-400 flex items-center gap-2">
                    <span className="text-base">⚠️</span>
                    <span><strong>{payslipRow.emp.name}</strong> has no salary set. Go to Employees → Edit to set their salary first.</span>
                  </div>
                )}
                {dailyFetching ? (
                  <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
                    <Loader2 size={16} className="animate-spin" /> Loading records…
                  </div>
                ) : dailyRecords.length === 0 ? (
                  <div className="py-12 text-center text-gray-500">
                    <p>No attendance records for this period.</p>
                    <p className="text-[10px] mt-1 text-gray-600">Make sure attendance is recorded for the selected months.</p>
                  </div>
                ) : (() => {
                  const salary = payslipRow.emp.salary || 0;
                  const hourlyRate = deriveHourlyRate(salary, 208);   // same rounded rate as the PDF
                  const empAvances = allAvances.filter((a: any) =>
                    a.employeeId === payslipRow.emp._id &&
                    (a.status === "Deducted" || a.status === "approved" || a.approved)
                  );
                  const avTotal = empAvances.reduce((s: number, a: any) => s + (a.amount || 0), 0);

                  // Derive absence + overtime hours exactly like handleDownloadPayslip / the PDF
                  let absenceHours = 0, overtimeHours = 0;
                  for (const r of dailyRecords) {
                    const hw = r.hoursWorked ?? 0;
                    if (r.status === "Absent") absenceHours += 8;
                    else absenceHours += Math.max(0, 8 - hw);
                    overtimeHours += r.extraHours ?? 0;
                  }

                  // SAME engine as the bulletin → the figures below match the PDF exactly
                  const p = computePayroll({
                    salary,
                    hourlyRate,
                    monthlyHours: 208,
                    familyStatus: (payslipRow.emp as any).familyStatus,
                    numChildren: (payslipRow.emp as any).numChildren,
                    avancesTotal: avTotal,
                    absenceHours,
                    overtimeHours,
                  });

                  const th = "px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-left border border-white/[0.08] bg-white/[0.06] text-gray-400";
                  const td = "px-3 py-2 text-xs border border-white/[0.06]";
                  const f = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
                  const sumRow = (label: string, val: string, kind?: "bold" | "deduct") => (
                    <div className={`flex justify-between px-3 py-1.5 ${kind === "bold" ? "font-bold text-white border-t border-white/10" : "text-gray-300"}`}>
                      <span>{label}</span>
                      <span className={kind === "deduct" ? "text-red-400" : kind === "bold" ? "text-[#c8202f]" : ""}>{val}</span>
                    </div>
                  );

                  return (
                    <div className="space-y-4">
                      {/* Daily attendance breakdown */}
                      <table className="w-full border-collapse">
                        <thead><tr>
                          <th className={th}>Date</th>
                          <th className={`${th} text-right`}>Rate/h</th>
                          <th className={`${th} text-right`}>Hrs Worked</th>
                          <th className={th}>Status</th>
                          <th className={`${th} text-right`}>Overtime</th>
                          <th className={`${th} text-right`}>Absence</th>
                        </tr></thead>
                        <tbody>
                          {dailyRecords.map((r, i) => {
                            const hw = r.hoursWorked ?? 0;
                            const ex = r.extraHours ?? 0;
                            const dayAbs = r.status === "Absent" ? 8 : Math.max(0, 8 - hw);
                            const dayRed = r2(dayAbs * hourlyRate);
                            const statusColor = r.status === "Present" ? "text-[#c8202f]" : r.status === "Absent" ? "text-red-400" : "text-amber-400";
                            return (
                              <tr key={r._id} className={i % 2 === 0 ? "bg-white/[0.02]" : ""}>
                                <td className={`${td} text-gray-300`}>{r.date}</td>
                                <td className={`${td} text-right text-gray-400`}>{hourlyRate.toFixed(3)}</td>
                                <td className={`${td} text-right text-white font-bold`}>{hw.toFixed(1)}</td>
                                <td className={`${td} ${statusColor} font-bold`}>{r.status}</td>
                                <td className={`${td} text-right ${ex > 0 ? "text-indigo-400" : "text-gray-600"}`}>{ex > 0 ? `+${ex.toFixed(1)}h` : "\u2014"}</td>
                                <td className={`${td} text-right ${dayRed > 0 ? "text-red-400" : "text-gray-600"}`}>{dayRed > 0 ? `-${f(dayRed)}` : "\u2014"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {/* Payslip summary — identical to the downloaded PDF */}
                      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
                        <div className="px-3 py-2 bg-white/[0.06] text-[10px] font-bold uppercase tracking-wider text-gray-400">Payslip summary (matches PDF)</div>
                        {sumRow("Agreed salary", f(p.agreedSalary))}
                        {sumRow("Gross salary (grossed-up)", f(p.brut), "bold")}
                        {sumRow("CNSS", `-${f(p.cnssEmployee)}`, "deduct")}
                        {sumRow("Taxable salary", f(p.imposable))}
                        {sumRow("Income tax (IRPP)", `-${f(p.irpp)}`, "deduct")}
                        {sumRow("Social solidarity (CSS)", `-${f(p.css)}`, "deduct")}
                        {sumRow("Net salary", f(p.net), "bold")}
                        {p.overtimePay > 0 ? sumRow(`Overtime (${p.overtimeHours}h)`, `+${f(p.overtimePay)}`) : null}
                        {p.absenceDeduction > 0 ? sumRow(`Absence (${p.absenceHours}h)`, `-${f(p.absenceDeduction)}`, "deduct") : null}
                        {p.avances > 0 ? sumRow(`Advances (${empAvances.length})`, `-${f(p.avances)}`, "deduct") : null}
                        {sumRow("CNSS total — info only", f(p.cnssTotal))}
                        {sumRow("NET PAYABLE", `${f(p.netToPay)} TND`, "bold")}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Footer buttons */}
              <div className="flex gap-3 px-6 py-4 border-t border-white/[0.08] flex-shrink-0">
                <button onClick={handleDownloadPayslip} disabled={payslipLoading || dailyFetching}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs bg-[#c8202f] hover:bg-[#c8202f] text-black font-bold transition disabled:opacity-50">
                  {payslipLoading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  Download PDF
                </button>
                <button onClick={() => setShowPayslip(false)}
                  className="flex-1 py-2 rounded-xl text-xs border border-white/10 text-gray-400 hover:border-white/20 hover:text-white transition">
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      
        <div className="min-h-screen bg-gray-100 dark:bg-[#060a0f] text-gray-900 dark:text-white font-mono p-6 space-y-6">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight leading-none">
                Payroll <span className="text-[#c8202f]">Management</span>
              </h1>
              <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">EMM ERP · {monthLabel(selectedMonth)}</p>
            </div>
            <div className="flex items-center gap-3">
              <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                style={{ colorScheme: "dark" }}
                className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none transition" />
              <button onClick={fetchData} className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20 px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300">
                <Loader2 size={13} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
              <button onClick={exportCSV} className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20 px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300">
                <Download size={13} /> {t("export")}
              </button>
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: "Total Net Payroll", value: loading ? "—" : `${totalNet.toLocaleString()} TND`,    sub: monthLabel(selectedMonth),                  icon: <DollarSign size={14} />, iconBg: "bg-[#c8202f]/10 text-[#c8202f]" },
              { label: "Total Base Salary", value: loading ? "—" : `${totalBase.toLocaleString()} TND`,   sub: "Before deductions",           icon: <TrendingUp size={14} />, iconBg: "bg-blue-500/10 text-blue-400" },
              { label: "Avance Deductions", value: loading ? "—" : `${totalAvances.toLocaleString()} TND`,sub: "This month",                  icon: <FileText size={14} />,   iconBg: "bg-amber-500/10 text-amber-400" },
              { label: "On Leave",          value: loading ? "—" : String(onLeave),                       sub: `of ${rows.length} employees`, icon: <AlertCircle size={14} />,iconBg: "bg-purple-500/10 text-purple-400" },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className={`${card} px-5 py-4 flex items-center gap-4`}>
                <div className={`p-2 rounded-xl ${s.iconBg}`}>{s.icon}</div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">{s.label}</p>
                  <p className="text-xl font-bold tracking-tight">{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Table */}
          <div className={`${card} overflow-hidden`}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-white/[0.05]">
              <div>
                <h2 className="text-base font-bold">{t("payrollRecords")}</h2>
                <p className="text-xs text-gray-500">{filtered.length} {t("ofText")} {rows.length} employees · click a row to view pay slip</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    className="pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:border-[#c8202f]/40 transition text-gray-900 dark:text-white placeholder-gray-400"
                    placeholder={t("searchEmployee")} value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select
                  className="px-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-600 dark:text-gray-300 focus:outline-none transition"
                  value={filterDept} onChange={e => setFilter(e.target.value)}>
                  {departments.map(d => <option key={d} value={d}>{d === "all" ? "All Departments" : d}</option>)}
                </select>
              </div>
            </div>

            {/* Col headers */}
            <div className="grid px-6 py-3 text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-600 border-b border-gray-100 dark:border-white/[0.04]"
              style={{ gridTemplateColumns: gridCols }}>
              <span>Employee</span>
              <span>Brut (TND)</span>
              <span className="text-indigo-400">Overtime</span>
              <span className="text-red-400">Absence</span>
              <span>CNSS</span>
              <span>Avance</span>
              <span>Net (TND)</span>
              <span>Status</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
                <Loader2 size={16} className="animate-spin" /> Loading payroll...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">{t("noPayrollMatch")}</div>
            ) : filtered.map((row, i) => {
              const sc = STATUS_STYLES[row.emp.status] ?? STATUS_STYLES["Active"];
              return (
                <motion.div key={row.emp._id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  onClick={() => openPayslip(row)}
                  className={`grid px-6 py-4 items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.03] transition ${i < filtered.length - 1 ? "border-b border-gray-100 dark:border-white/[0.03]" : ""}`}
                  style={{ gridTemplateColumns: gridCols }}>

                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                      {row.emp.name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{row.emp.name}</p>
                      <p className="text-[10px] text-gray-400">{row.emp.department}</p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600 dark:text-gray-300">{row.brut.toLocaleString()}</p>

                  <p className={`text-xs font-bold ${row.overtime > 0 ? "text-indigo-400" : "text-gray-500 dark:text-gray-600"}`}>
                    {row.overtime > 0 ? `+${row.overtime.toLocaleString()}` : "—"}
                  </p>

                  <div>
                    {row.absenceDays > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 w-fit">{row.absenceDays}d</span>
                        <span className="text-[10px] text-red-400/70">-{row.absenceDeduction.toLocaleString()} TND</span>
                      </div>
                    ) : <span className="text-xs text-gray-500 dark:text-gray-600">—</span>}
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{row.cnss.toLocaleString()}</p>
                  </div>

                  <p className={`text-xs font-bold ${row.avances > 0 ? "text-amber-400" : "text-gray-500 dark:text-gray-600"}`}>
                    {row.avances > 0 ? `-${row.avances.toLocaleString()}` : "—"}
                  </p>

                  <p className={`text-sm font-bold ${row.net >= 0 ? "text-[#c8202f]" : "text-red-400"}`}>
                    {row.net.toLocaleString()} TND
                  </p>

                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold w-fit ${sc.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{row.emp.status}
                  </span>
                </motion.div>
              );
            })}
          </div>

        </div>
      
    </ProtectedRoute>
  );
}