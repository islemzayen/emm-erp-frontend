"use client";
import React from "react";


import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Download, BarChart2, Users, DollarSign, Calendar, Loader2, CheckCircle, AlertTriangle, Trash2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { hrService } from "@/services/hrservice";
import { avanceService } from "@/services/avanceService";
import dailyAttendanceService from "@/services/DailyattendanceService";
import { exportBrandedXlsx, exportBrandedPdf } from "@/lib/reportExport";

// ── helpers ──────────────────────────────────────────────────────────────────
function monthStr()  { return new Date().toISOString().slice(0, 7); }
function yearStr()   { return new Date().getFullYear().toString(); }
function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}
function prevMonthOf(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function allMonthsOfYear(year: string): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}
function csvBlob(rows: (string | number)[][], headers: string[]) {
  const lines = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  return new Blob([lines], { type: "text/csv;charset=utf-8;" });
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Branded PDF (logo + themed colors, shared with the Sales module) ─────────
async function exportToPDF(title: string, subtitle: string, headers: string[], rows: (string | number)[][], filename: string) {
  await exportBrandedPdf(title, subtitle, headers, rows, filename);
}

// ── localStorage history (max 2 periods) ─────────────────────────────────────
const HISTORY_KEY = "hr_report_history";
const MAX_HISTORY = 2;

interface SavedPeriod {
  period: string;            // "YYYY-MM" or "YYYY"
  mode: "monthly" | "annual";
  label: string;
  savedAt: string;           // ISO
}

function loadHistory(): SavedPeriod[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
  catch { return []; }
}

/** Upsert a period into history. Returns evicted label if oldest was removed. */
function upsertHistory(period: string, mode: "monthly" | "annual", label: string): string | null {
  const history = loadHistory();
  const idx = history.findIndex(r => r.period === period && r.mode === mode);
  if (idx >= 0) {
    history[idx].savedAt = new Date().toISOString();
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    return null;
  }
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

// ── Component ─────────────────────────────────────────────────────────────────
export default function HRReports() {
  const { t } = useLanguage();
  const [reportMode, setReportMode]   = useState<"monthly" | "annual">("monthly");
  const [selectedMonth, setMonth]     = useState(monthStr());
  const [selectedYear, setYear]       = useState(yearStr());
  const [loading, setLoading]         = useState<string | null>(null);
  const [done, setDone]               = useState<string | null>(null);
  const [evictedToast, setEvictedToast] = useState<string | null>(null);
  const [exportLog, setExportLog]     = useState<{ name: string; size: string; date: string; type: string }[]>([]);
  const [history, setHistory]         = useState<SavedPeriod[]>([]);

  // Reminder modal
  const [reminderOpen, setReminderOpen]     = useState(false);
  const pendingExportRef = useRef<(() => void) | null>(null);

  useEffect(() => { setHistory(loadHistory()); }, []);

  const card = "bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/[0.06] rounded-2xl transition-colors duration-300";

  // ── Period helpers ──────────────────────────────────────────────────────────
  const activePeriod = reportMode === "annual" ? selectedYear : selectedMonth;
  const activePeriodLabel = reportMode === "annual" ? `${selectedYear} Annual` : monthLabel(selectedMonth);

  function shouldRemind(): boolean {
    if (reportMode !== "monthly") return false;
    const prev = prevMonthOf(selectedMonth);
    return !history.some(r => r.period === prev && r.mode === "monthly");
  }

  function prevMonthLabel(): string { return monthLabel(prevMonthOf(selectedMonth)); }

  // ── Log + history ───────────────────────────────────────────────────────────
  function logExport(name: string, sizeKb: number, type: string) {
    const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    setExportLog(prev => [{ name, size: sizeKb > 1000 ? `${(sizeKb / 1000).toFixed(1)} MB` : `${sizeKb} KB`, date, type }, ...prev].slice(0, 8));
    setDone(name);
    setTimeout(() => setDone(null), 2500);

    const evicted = upsertHistory(activePeriod, reportMode, activePeriodLabel);
    const updated = loadHistory();
    setHistory(updated);
    if (evicted) {
      setEvictedToast(evicted);
      setTimeout(() => setEvictedToast(null), 3500);
    }
  }

  // Gate all exports through reminder check
  function guardedExport(fn: () => void) {
    if (shouldRemind()) {
      pendingExportRef.current = fn;
      setReminderOpen(true);
    } else {
      fn();
    }
  }

  function handleSaveFirst() {
    // Mark previous month as saved (without exporting it) and switch to it
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

  // ── MONTHLY EXPORTS ────────────────────────────────────────────────────────
  async function exportPayroll(fmt: "csv" | "pdf") {
    setLoading(`payroll-${fmt}`);
    try {
      const [empsRes, avancesRes, attRes] = await Promise.all([
        hrService.getAllEmployees(true),
        avanceService.list(),
        dailyAttendanceService.summary(selectedMonth).catch(() => []),
      ]);
      const emps    = (Array.isArray(empsRes) ? empsRes : empsRes?.data ?? []).filter((e: any) => e.role !== "ADMIN");
      const avances = Array.isArray(avancesRes) ? avancesRes : (avancesRes?.data ?? []);
      const attArr  = Array.isArray(attRes) ? attRes : (attRes as any)?.data ?? [];
      const attMap: Record<string, any> = {};
      for (const a of attArr) attMap[a.employeeId] = a;

      const headers = ["Name", "Department", "Position", "Brut (TND)", "Overtime", "CNSS 9.67%", "CNSS Emp. 20%", "Avance", "Net (TND)", "Status"];
      const rows = emps.map((e: any) => {
        const att = attMap[e._id];
        const agreedNet  = e.salary || 0;
        const brut       = Math.round(agreedNet / (1 - 0.0967));
        const daily = brut / 26; const hourly = brut / 208;
        const absent = att ? att.absentDays : 0;
        const effectiveDays = Math.max(0, 26 - absent);
        const effectiveBase = Math.round(daily * effectiveDays);
        const overtime = att ? Math.round(hourly * (att.totalExtraHours || 0)) : 0;
        const grossSalary = effectiveBase + overtime;
        const cnssEmployee = Math.round(grossSalary * 0.0967);
        const cnssEmployer = Math.round(grossSalary * 0.2000);
        const avTotal = avances.filter((a: any) => a.employeeId === e._id && a.status === "Deducted").reduce((s: number, a: any) => s + a.amount, 0);
        const net = agreedNet - avTotal;
        return [e.name, e.department, e.position || "Employee", grossSalary, overtime > 0 ? `+${overtime}` : 0, cnssEmployee, cnssEmployer, avTotal > 0 ? `-${avTotal}` : 0, net, e.status || "Active"];
      });

      const filename = `Payroll_${selectedMonth}.${fmt}`;
      if (fmt === "csv") await exportBrandedXlsx(filename.replace(/\.csv$/, "").replace(/_/g, " "), headers, rows, filename.replace(/\.csv$/, ".xlsx"));
      else await exportToPDF("Payroll Report", monthLabel(selectedMonth), headers, rows, filename);
      logExport(filename, Math.round(rows.length * 0.15 * 10) + 50, "payroll");
    } finally { setLoading(null); }
  }

  async function exportAbsence(fmt: "csv" | "pdf") {
    setLoading(`absence-${fmt}`);
    try {
      const attRes = await dailyAttendanceService.summary(selectedMonth).catch(() => []);
      const attArr = Array.isArray(attRes) ? attRes : (attRes as any)?.data ?? [];
      const headers = ["Employee", "Department", "Present Days", "Absent Days", "Late Days", "Extra Hours", "Attendance %"];
      const rows = attArr.map((a: any) => [a.employeeName, a.department, a.presentDays, a.absentDays, a.lateDays, (a.totalExtraHours || 0).toFixed(1), `${Math.round((a.presentDays / 26) * 100)}%`]);
      const filename = `Absence_${selectedMonth}.${fmt}`;
      if (fmt === "csv") await exportBrandedXlsx(filename.replace(/\.csv$/, "").replace(/_/g, " "), headers, rows, filename.replace(/\.csv$/, ".xlsx"));
      else await exportToPDF("Absence & Leave Report", monthLabel(selectedMonth), headers, rows, filename);
      logExport(filename, Math.round(rows.length * 0.08 * 10) + 20, "absence");
    } finally { setLoading(null); }
  }

  async function exportEmployees(fmt: "csv" | "pdf") {
    setLoading(`employees-${fmt}`);
    try {
      const empsRes = await hrService.getAllEmployees(true);
      const emps = (Array.isArray(empsRes) ? empsRes : empsRes?.data ?? []).filter((e: any) => e.role !== "ADMIN");
      const headers = ["Name", "Email", "Department", "Position", "Phone", "Salary (TND)", "Status", "Joined"];
      const rows = emps.map((e: any) => [e.name, e.email, e.department, e.position || "Employee", e.phone || "—", e.salary || 0, e.status || "Active", e.joinedDate ? new Date(e.joinedDate).toLocaleDateString("en-GB") : "—"]);
      const filename = `Employees_${selectedMonth}.${fmt}`;
      if (fmt === "csv") await exportBrandedXlsx(filename.replace(/\.csv$/, "").replace(/_/g, " "), headers, rows, filename.replace(/\.csv$/, ".xlsx"));
      else await exportToPDF("Employee Directory", `All staff · ${monthLabel(selectedMonth)}`, headers, rows, filename);
      logExport(filename, Math.round(rows.length * 0.1 * 10) + 30, "employees");
    } finally { setLoading(null); }
  }

  async function exportPerformance(fmt: "csv" | "pdf") {
    setLoading(`performance-${fmt}`);
    try {
      const [empsRes, attRes] = await Promise.all([hrService.getAllEmployees(true), dailyAttendanceService.summary(selectedMonth).catch(() => [])]);
      const emps = (Array.isArray(empsRes) ? empsRes : empsRes?.data ?? []).filter((e: any) => e.role !== "ADMIN");
      const attArr = Array.isArray(attRes) ? attRes : (attRes as any)?.data ?? [];
      const attMap: Record<string, any> = {};
      for (const a of attArr) attMap[a.employeeId] = a;
      const headers = ["Employee", "Department", "Hours Worked", "Present Days", "Absent Days", "Extra Hours", "Score %", "Rating"];
      const rows = emps.map((e: any) => {
        const att = attMap[e._id];
        if (!att) return [e.name, e.department, 0, 0, 0, 0, 0, "No Data"];
        const extraHrs = att.totalExtraHours || 0;
        const hoursWorked = (att.totalHoursWorked && att.totalHoursWorked > 0) ? att.totalHoursWorked : (att.presentDays * 8) + extraHrs;
        const daysRecorded = (att.presentDays || 0) + (att.absentDays || 0);
        const score = daysRecorded > 0 ? Math.round((hoursWorked / Math.max(daysRecorded * 8, 1)) * 100) : 0;
        const rating = score >= 95 ? "Excellent" : score >= 85 ? "Good" : score >= 70 ? "Average" : "Poor";
        return [e.name, e.department, hoursWorked.toFixed(1), att.presentDays, att.absentDays, extraHrs.toFixed(1), `${score}%`, rating];
      });
      const filename = `Performance_${selectedMonth}.${fmt}`;
      if (fmt === "csv") await exportBrandedXlsx(filename.replace(/\.csv$/, "").replace(/_/g, " "), headers, rows, filename.replace(/\.csv$/, ".xlsx"));
      else await exportToPDF("Performance Report", monthLabel(selectedMonth), headers, rows, filename);
      logExport(filename, Math.round(rows.length * 0.1 * 10) + 40, "performance");
    } finally { setLoading(null); }
  }

  // ── ANNUAL EXPORTS ─────────────────────────────────────────────────────────
  async function fetchAllMonthsAttendance(year: string) {
    const months = allMonthsOfYear(year);
    const results = await Promise.allSettled(months.map(m => dailyAttendanceService.summary(m).catch(() => [])));
    return months.map((m, i) => ({
      month: m,
      label: monthLabel(m),
      data: results[i].status === "fulfilled" ? (Array.isArray((results[i] as any).value) ? (results[i] as any).value : (results[i] as any).value?.data ?? []) : [],
    }));
  }

  async function exportPayrollAnnual(fmt: "csv" | "pdf") {
    setLoading(`payroll-annual-${fmt}`);
    try {
      const [empsRes, avancesRes, monthlyAtt] = await Promise.all([
        hrService.getAllEmployees(true),
        avanceService.list(),
        fetchAllMonthsAttendance(selectedYear),
      ]);
      const emps    = (Array.isArray(empsRes) ? empsRes : empsRes?.data ?? []).filter((e: any) => e.role !== "ADMIN");
      const avances = Array.isArray(avancesRes) ? avancesRes : (avancesRes?.data ?? []);

      const headers = ["Month", "Name", "Department", "Position", "Base (TND)", "Overtime", "CNSS", "Avance", "Net (TND)"];
      const rows: (string | number)[][] = [];

      for (const { label, data } of monthlyAtt) {
        const attMap: Record<string, any> = {};
        for (const a of data) attMap[a.employeeId] = a;
        for (const e of emps) {
          const att = attMap[e._id];
          const agreedNet  = e.salary || 0;
          const brut       = Math.round(agreedNet / (1 - 0.0967));
          const daily = brut / 26; const hourly = brut / 208;
          const absent = att ? att.absentDays : 0;
          const effectiveDays = Math.max(0, 26 - absent);
          const effectiveBase = Math.round(daily * effectiveDays);
          const overtime = att ? Math.round(hourly * (att.totalExtraHours || 0)) : 0;
          const grossSalary = effectiveBase + overtime;
          const cnssEmployee = Math.round(grossSalary * 0.0967);
          const cnssEmployer = Math.round(grossSalary * 0.2000);
          const avTotal = avances.filter((a: any) => a.employeeId === e._id && a.status === "Deducted").reduce((s: number, a: any) => s + a.amount, 0);
          const net = agreedNet - avTotal;
          rows.push([label, e.name, e.department, e.position || "Employee", grossSalary, overtime > 0 ? `+${overtime}` : 0, cnssEmployee, cnssEmployer, avTotal > 0 ? `-${avTotal}` : 0, net]);
        }
      }

      const filename = `Payroll_${selectedYear}_Annual.${fmt}`;
      if (fmt === "csv") await exportBrandedXlsx(filename.replace(/\.csv$/, "").replace(/_/g, " "), headers, rows, filename.replace(/\.csv$/, ".xlsx"));
      else await exportToPDF(`Payroll Report — ${selectedYear}`, `Annual Summary`, headers, rows, filename);
      logExport(filename, Math.round(rows.length * 0.15 * 10) + 80, "payroll");
    } finally { setLoading(null); }
  }

  async function exportAbsenceAnnual(fmt: "csv" | "pdf") {
    setLoading(`absence-annual-${fmt}`);
    try {
      const monthlyAtt = await fetchAllMonthsAttendance(selectedYear);
      const headers = ["Month", "Employee", "Department", "Present Days", "Absent Days", "Late Days", "Extra Hours", "Attendance %"];
      const rows: (string | number)[][] = [];
      for (const { label, data } of monthlyAtt) {
        for (const a of data) {
          rows.push([label, a.employeeName, a.department, a.presentDays, a.absentDays, a.lateDays, (a.totalExtraHours || 0).toFixed(1), `${Math.round((a.presentDays / 26) * 100)}%`]);
        }
      }
      const filename = `Absence_${selectedYear}_Annual.${fmt}`;
      if (fmt === "csv") await exportBrandedXlsx(filename.replace(/\.csv$/, "").replace(/_/g, " "), headers, rows, filename.replace(/\.csv$/, ".xlsx"));
      else await exportToPDF(`Absence Report — ${selectedYear}`, `Annual Summary`, headers, rows, filename);
      logExport(filename, Math.round(rows.length * 0.08 * 10) + 40, "absence");
    } finally { setLoading(null); }
  }

  async function exportEmployeesAnnual(fmt: "csv" | "pdf") {
    // Employee list is a snapshot — same as monthly but labelled with year
    setLoading(`employees-annual-${fmt}`);
    try {
      const empsRes = await hrService.getAllEmployees(true);
      const emps = (Array.isArray(empsRes) ? empsRes : empsRes?.data ?? []).filter((e: any) => e.role !== "ADMIN");
      const headers = ["Name", "Email", "Department", "Position", "Phone", "Salary (TND)", "Status", "Joined"];
      const rows = emps.map((e: any) => [e.name, e.email, e.department, e.position || "Employee", e.phone || "—", e.salary || 0, e.status || "Active", e.joinedDate ? new Date(e.joinedDate).toLocaleDateString("en-GB") : "—"]);
      const filename = `Employees_${selectedYear}_Annual.${fmt}`;
      if (fmt === "csv") await exportBrandedXlsx(filename.replace(/\.csv$/, "").replace(/_/g, " "), headers, rows, filename.replace(/\.csv$/, ".xlsx"));
      else await exportToPDF("Employee Directory", `All staff · ${selectedYear}`, headers, rows, filename);
      logExport(filename, Math.round(rows.length * 0.1 * 10) + 30, "employees");
    } finally { setLoading(null); }
  }

  async function exportPerformanceAnnual(fmt: "csv" | "pdf") {
    setLoading(`performance-annual-${fmt}`);
    try {
      const [empsRes, monthlyAtt] = await Promise.all([hrService.getAllEmployees(true), fetchAllMonthsAttendance(selectedYear)]);
      const emps = (Array.isArray(empsRes) ? empsRes : empsRes?.data ?? []).filter((e: any) => e.role !== "ADMIN");
      const headers = ["Month", "Employee", "Department", "Hours Worked", "Present Days", "Absent Days", "Extra Hours", "Score %", "Rating"];
      const rows: (string | number)[][] = [];
      for (const { label, data } of monthlyAtt) {
        const attMap: Record<string, any> = {};
        for (const a of data) attMap[a.employeeId] = a;
        for (const e of emps) {
          const att = attMap[e._id];
          if (!att) { rows.push([label, e.name, e.department, 0, 0, 0, 0, 0, "No Data"]); continue; }
          const extraHrs = att.totalExtraHours || 0;
          const hoursWorked = (att.totalHoursWorked && att.totalHoursWorked > 0) ? att.totalHoursWorked : (att.presentDays * 8) + extraHrs;
          const daysRecorded = (att.presentDays || 0) + (att.absentDays || 0);
          const score = daysRecorded > 0 ? Math.round((hoursWorked / Math.max(daysRecorded * 8, 1)) * 100) : 0;
          const rating = score >= 95 ? "Excellent" : score >= 85 ? "Good" : score >= 70 ? "Average" : "Poor";
          rows.push([label, e.name, e.department, hoursWorked.toFixed(1), att.presentDays, att.absentDays, extraHrs.toFixed(1), `${score}%`, rating]);
        }
      }
      const filename = `Performance_${selectedYear}_Annual.${fmt}`;
      if (fmt === "csv") await exportBrandedXlsx(filename.replace(/\.csv$/, "").replace(/_/g, " "), headers, rows, filename.replace(/\.csv$/, ".xlsx"));
      else await exportToPDF(`Performance Report — ${selectedYear}`, `Annual Summary`, headers, rows, filename);
      logExport(filename, Math.round(rows.length * 0.1 * 10) + 60, "performance");
    } finally { setLoading(null); }
  }

  async function exportAll() {
    if (reportMode === "annual") {
      await exportPayrollAnnual("csv"); await exportAbsenceAnnual("csv");
      await exportEmployeesAnnual("csv"); await exportPerformanceAnnual("csv");
    } else {
      await exportPayroll("csv"); await exportAbsence("csv");
      await exportEmployees("csv"); await exportPerformance("csv");
    }
  }

  // ── Report card definitions ────────────────────────────────────────────────
  const reports = [
    {
      id: "payroll", title: t("payrollReport"), desc: t("payrollReportDesc"),
      icon: <DollarSign size={18} />, iconBg: "bg-[#c8202f]/10 text-[#c8202f]",
      badge: reportMode === "annual" ? t("annual") : t("monthly"), badgeCls: "bg-[#c8202f]/15 text-[#c8202f]",
      actions: [
        { label: t("exportPdf"), fmt: "pdf" as const, cls: "bg-[#c8202f] hover:bg-[#c8202f] text-black font-bold", fn: () => guardedExport(() => reportMode === "annual" ? exportPayrollAnnual("pdf") : exportPayroll("pdf")) },
        { label: t("exportExcel"), fmt: "csv" as const, cls: "border border-[#c8202f]/50 hover:border-[#c8202f] text-[#c8202f] hover:bg-[#c8202f]/10", fn: () => guardedExport(() => reportMode === "annual" ? exportPayrollAnnual("csv") : exportPayroll("csv")) },
      ],
    },
    {
      id: "absence", title: t("absenceReport"), desc: t("absenceReportDesc"),
      icon: <Calendar size={18} />, iconBg: "bg-amber-500/10 text-amber-400",
      badge: reportMode === "annual" ? t("annual") : t("monthly"), badgeCls: "bg-amber-500/15 text-amber-400",
      actions: [
        { label: t("exportPdf"), fmt: "pdf" as const, cls: "bg-amber-500 hover:bg-amber-400 text-black font-bold", fn: () => guardedExport(() => reportMode === "annual" ? exportAbsenceAnnual("pdf") : exportAbsence("pdf")) },
        { label: t("exportExcel"), fmt: "csv" as const, cls: "border border-amber-500/50 hover:border-amber-400 text-amber-400 hover:bg-amber-500/10", fn: () => guardedExport(() => reportMode === "annual" ? exportAbsenceAnnual("csv") : exportAbsence("csv")) },
      ],
    },
    {
      id: "employees", title: t("employeeList"), desc: t("employeeListDesc"),
      icon: <Users size={18} />, iconBg: "bg-blue-500/10 text-blue-400",
      badge: t("onDemand"), badgeCls: "bg-blue-500/15 text-blue-400",
      actions: [
        { label: t("exportPdf"), fmt: "pdf" as const, cls: "bg-blue-500 hover:bg-blue-400 text-black font-bold", fn: () => guardedExport(() => reportMode === "annual" ? exportEmployeesAnnual("pdf") : exportEmployees("pdf")) },
        { label: t("exportExcel"), fmt: "csv" as const, cls: "border border-blue-500/50 hover:border-blue-400 text-blue-400 hover:bg-blue-500/10", fn: () => guardedExport(() => reportMode === "annual" ? exportEmployeesAnnual("csv") : exportEmployees("csv")) },
      ],
    },
    {
      id: "performance", title: t("performanceReport"), desc: t("performanceReportDesc"),
      icon: <BarChart2 size={18} />, iconBg: "bg-purple-500/10 text-purple-400",
      badge: reportMode === "annual" ? t("annual") : t("monthly"), badgeCls: "bg-purple-500/15 text-purple-400",
      actions: [
        { label: t("exportPdf"), fmt: "pdf" as const, cls: "bg-purple-500 hover:bg-purple-400 text-black font-bold", fn: () => guardedExport(() => reportMode === "annual" ? exportPerformanceAnnual("pdf") : exportPerformance("pdf")) },
        { label: t("exportExcel"), fmt: "csv" as const, cls: "border border-purple-500/50 hover:border-purple-400 text-purple-400 hover:bg-purple-500/10", fn: () => guardedExport(() => reportMode === "annual" ? exportPerformanceAnnual("csv") : exportPerformance("csv")) },
      ],
    },
  ];

  const iconMap: Record<string, React.ReactNode> = { payroll: <DollarSign size={13} />, absence: <Calendar size={13} />, employees: <Users size={13} />, performance: <BarChart2 size={13} /> };
  const colorMap: Record<string, string> = { payroll: "text-[#c8202f]", absence: "text-amber-400", employees: "text-blue-400", performance: "text-purple-400" };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ProtectedRoute allowedRoles={["HR_MANAGER"]}>

      {/* ── Toasts ── */}
      <AnimatePresence>
        {done && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed top-6 right-6 z-[9999] bg-[#a51a26] text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
            <CheckCircle size={15} /> {done} ready
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {evictedToast && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] bg-amber-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
            <Trash2 size={14} /> <span className="font-bold">{evictedToast}</span> {t("reportRemoved")}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Reminder Modal ── */}
      <AnimatePresence>
        {reminderOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-[9998] flex items-center justify-center p-4"
            onClick={() => setReminderOpen(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.93, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.93, y: 10 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/[0.08] rounded-2xl p-6 w-full max-w-sm shadow-2xl">

              <div className="flex items-start gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 flex-shrink-0 mt-0.5">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{t("reminderTitle")}</p>
                  <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                    {t("reminderBodyPre")} <span className="text-amber-400 font-bold">{prevMonthLabel()}</span> {t("reminderBodyPost")}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-5">
                <button onClick={handleSaveFirst}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-[#c8202f]/50 text-[#c8202f] hover:bg-[#c8202f]/10 transition uppercase tracking-wide">
                  {t("saveFirst")}
                </button>
                <button onClick={handleGenerateAnyway}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-gray-300 transition uppercase tracking-wide">
                  {t("generateAnyway")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      
        <div className="min-h-screen bg-gray-100 dark:bg-[#060a0f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

          {/* ── Header ── */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight leading-none">
                HR <span className="text-[#c8202f]">{t("reports")}</span>
              </h1>
              <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">EMM ERP</p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">

              {/* Report mode toggle */}
              <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 text-xs font-bold uppercase tracking-wide">
                {(["monthly", "annual"] as const).map(mode => (
                  <button key={mode} onClick={() => setReportMode(mode)}
                    className={`px-4 py-2 transition ${reportMode === mode ? "bg-[#c8202f] text-black" : "bg-white dark:bg-[#0d1117] text-gray-500 hover:text-gray-900 dark:hover:text-white"}`}>
                    {mode === "monthly" ? t("reportModeMonthly") : t("reportModeAnnual")}
                  </button>
                ))}
              </div>

              {/* Period picker */}
              {reportMode === "monthly" ? (
                <input type="month" value={selectedMonth} onChange={e => setMonth(e.target.value)}
                  style={{ colorScheme: "dark" }}
                  className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none transition" />
              ) : (
                <input type="text" inputMode="numeric" value={selectedYear} onChange={e => setYear(e.target.value.replace(/\D/g, ""))}
                  style={{ colorScheme: "dark" }}
                  className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none transition w-24" />
              )}

              <button onClick={() => guardedExport(exportAll)}
                className="flex items-center gap-2 bg-[#c8202f] hover:bg-[#c8202f] px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-black font-bold">
                <Download size={13} /> {t("exportAll")}
              </button>
            </div>
          </div>

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: t("totalReports"),   value: "4",  sub: t("available"),       icon: <FileText size={14} />,  iconBg: "bg-[#c8202f]/10 text-[#c8202f]" },
              { label: t("generatedToday"), value: String(exportLog.length), sub: t("thisSession"), icon: <Download size={14} />, iconBg: "bg-blue-500/10 text-blue-400" },
              { label: t("monthlyExports"), value: "4",  sub: t("thisMonth"),       icon: <Calendar size={14} />,  iconBg: "bg-purple-500/10 text-purple-400" },
              { label: t("pendingReports"), value: "0",  sub: t("notYetGenerated"), icon: <BarChart2 size={14} />, iconBg: "bg-amber-500/10 text-amber-400" },
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

          {/* ── Report cards + sidebar ── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              {reports.map((r, i) => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                  className={`${card} p-6 flex flex-col gap-4`}>
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-xl ${r.iconBg}`}>{r.icon}</div>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${r.badgeCls}`}>{r.badge}</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">{r.title}</h3>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{r.desc}</p>
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-gray-600 uppercase tracking-widest">
                    {reportMode === "annual" ? selectedYear : monthLabel(selectedMonth)}
                  </p>
                  <div className="flex gap-2 mt-auto">
                    {r.actions.map((a, j) => {
                      const k = `${r.id}-${reportMode === "annual" ? "annual-" : ""}${a.fmt}`;
                      return (
                        <button key={j} onClick={a.fn} disabled={!!loading}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50 disabled:cursor-wait ${a.cls}`}>
                          {loading === k ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                          {a.label}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* ── Saved reports sidebar ── */}
            <div className={`${card} p-6 flex flex-col`}>
              <div className="flex items-start justify-between mb-1">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">{t("recentExports")}</h2>
              </div>
              <p className="text-[10px] text-gray-500 mb-4 uppercase tracking-widest">{t("last2PeriodsKept")}</p>

              {/* Rolling history slots */}
              {history.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-8 space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center">
                    <FileText size={20} className="text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-500">{t("noSavedReports")}</p>
                  <p className="text-[10px] text-gray-600">{t("latestFiles")}</p>
                </div>
              ) : (
                <div className="space-y-3 flex-1">
                  <AnimatePresence>
                    {history.map((h, i) => (
                      <motion.div key={h.period + h.mode}
                        initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12, height: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-gray-100 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.06] rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${h.mode === "annual" ? "bg-purple-500/15 text-purple-400" : "bg-[#c8202f]/15 text-[#c8202f]"}`}>
                            {h.mode === "annual" ? <BarChart2 size={12} /> : <Calendar size={12} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{h.label}</p>
                            <p className="text-[10px] text-gray-400">{new Date(h.savedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                          </div>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${h.mode === "annual" ? "bg-purple-500/15 text-purple-400" : "bg-[#c8202f]/15 text-[#c8202f]"}`}>
                            {h.mode === "annual" ? t("annual") : t("reportModeMonthly")}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Session export log */}
              {exportLog.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/[0.06]">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-3">{t("thisSession")}</p>
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