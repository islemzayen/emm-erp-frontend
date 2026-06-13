"use client";
import { exportBrandedXlsx, exportBrandedPdf } from "@/lib/reportExport";


import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search, CheckCircle, Clock,
  AlertCircle, UserCheck, Loader2, LogIn, LogOut, Zap, X, Save, CalendarOff, Download,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import dailyAttendanceService, { DailyRecord } from "@/services/DailyattendanceService";
import { hrService } from "@/services/hrservice";
import attendanceService from "@/services/attendanceService";

const AVATAR_COLORS = [
  "bg-[#c8202f]/20 text-[#c8202f]","bg-blue-500/20 text-blue-400","bg-purple-500/20 text-purple-400",
  "bg-amber-500/20 text-amber-400","bg-pink-500/20 text-pink-400","bg-teal-500/20 text-teal-400",
  "bg-red-500/20 text-red-400","bg-indigo-500/20 text-indigo-400","bg-cyan-500/20 text-cyan-400",
  "bg-orange-500/20 text-orange-400",
];
const card = "bg-white dark:bg-[#111c35] border border-[#1b2a6b]/15 dark:border-[#1b2a6b]/20 border-t-2 border-t-[#c8202f] rounded-2xl transition-colors duration-300 hover:shadow-[0_0_20px_#c8202f10]";

function todayStr() { return new Date().toISOString().split("T")[0]; }
function monthStr()  { return new Date().toISOString().slice(0, 7); }

function toMinutes(t: string) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function calcWorked(checkIn: string, checkOut: string) {
  const inMin = toMinutes(checkIn);
  const outMin = toMinutes(checkOut);
  if (inMin === null || outMin === null || outMin <= inMin) return 0;
  return (outMin - inMin) / 60;
}

function deriveStatus(checkIn: string, isAbsent: boolean, isOnLeave?: boolean): "Present" | "Late" | "Absent" | "On Leave" {
  if (isOnLeave) return "On Leave";
  if (isAbsent) return "Absent";
  const mins = toMinutes(checkIn);
  if (mins === null) return "Absent";
  if (mins >= 10 * 60) return "Absent";
  if (mins >= 8 * 60)  return "Late";
  return "Present";
}

function calcLateMinutes(checkIn: string): number {
  const mins = toMinutes(checkIn);
  if (mins === null || mins < 8 * 60) return 0;
  return mins - 8 * 60;
}

function isMarkPresentDisabled(): boolean {
  const now = new Date();
  const total = now.getHours() * 60 + now.getMinutes();
  return (total >= 600 && total <= 750) || total >= 870;
}

interface Employee { _id: string; name: string; department: string; position: string; }
interface Draft { checkIn: string; checkOut: string; isAbsent: boolean; note: string; }

interface TimeModalProps {
  emp: Employee; empIndex: number; draft: Draft;
  onSave: (d: Draft) => void; onClose: () => void;
}

function TimeModal({ emp, empIndex, draft, onSave, onClose }: TimeModalProps) {
  const { t } = useLanguage();
  const [local, setLocal] = useState<Draft>({ ...draft });
  const worked = calcWorked(local.checkIn, local.checkOut);
  const extra  = Math.max(0, worked - 8);
  const status = deriveStatus(local.checkIn, local.isAbsent);
  const lateMin = calcLateMinutes(local.checkIn);
  const presentDisabled = isMarkPresentDisabled();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-[#111c35] border border-gray-200 dark:border-white/10 rounded-2xl w-[340px] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${AVATAR_COLORS[empIndex % AVATAR_COLORS.length]}`}>
              {emp.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-sm text-white leading-tight">{emp.name}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">{emp.department}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-gray-500 hover:text-gray-300 transition"><X size={14} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs font-bold ${
            status === "Present" ? "bg-[#c8202f]/10 border-[#c8202f]/20 text-[#c8202f]" :
            status === "Late"    ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                                   "bg-red-500/10 border-red-500/20 text-red-400"
          }`}>
            <span className="uppercase tracking-widest text-[10px]">Status</span>
            <span>{status}{status === "Late" && lateMin > 0 ? ` · ${lateMin}${t("minLate")}` : ""}</span>
          </div>
          {presentDisabled && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-widest">
              <Clock size={10} /> Mark Present is disabled (10:00–12:30 or after 14:30)
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest font-bold text-[#c8202f] flex items-center gap-1.5"><LogIn size={10} /> {t("checkInTime")}</label>
            <input type="time" value={local.checkIn} disabled={presentDisabled}
              onChange={e => setLocal(p => ({ ...p, checkIn: e.target.value, isAbsent: false }))}
              style={{ colorScheme: "dark" }}
              className="w-full bg-gray-100 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/50 transition disabled:opacity-40 disabled:cursor-not-allowed" />
            <p className="text-[10px] text-gray-500 flex gap-3">
              <span className="text-[#c8202f]">{t("checkInGuidanceBefore8")}</span>
              <span className="text-amber-400">{t("checkInGuidance8to10")}</span>
              <span className="text-red-400">{t("checkInGuidanceAfter10")}</span>
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest font-bold text-rose-400 flex items-center gap-1.5"><LogOut size={10} /> {t("checkOutTime")}</label>
            <input type="time" value={local.checkOut} onChange={e => setLocal(p => ({ ...p, checkOut: e.target.value }))}
              style={{ colorScheme: "dark" }}
              className="w-full bg-gray-100 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-rose-500/50 transition" />
          </div>
          {worked > 0 && (
            <div className="flex items-center justify-between bg-white/[0.04] border border-white/[0.06] rounded-xl px-4 py-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500">{t("hoursWorked")}</p>
                <p className="text-lg font-bold text-white">{worked.toFixed(1)}h</p>
              </div>
              <div className="text-right space-y-1">
                {extra > 0 && <div><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-400"><Zap size={9} /> +{extra.toFixed(1)}h {t("overtime")}</span></div>}
                {status === "Present" && extra === 0 && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#c8202f]/15 text-[#c8202f]"><CheckCircle size={9} /> {t("onTime")}</span>}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest text-gray-500">{t("noteOptional")}</label>
            <input type="text" placeholder={t("notePlaceholder")} value={local.note}
              onChange={e => setLocal(p => ({ ...p, note: e.target.value }))}
              className="w-full bg-gray-100 dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-[#c8202f]/40 dark:focus:border-white/20 transition" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide border border-white/10 text-gray-400 hover:bg-white/[0.04] transition">{t("cancel")}</button>
            <button onClick={() => { onSave(local); onClose(); }}
              disabled={!local.checkIn || !local.checkOut || presentDisabled}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wide bg-[#c8202f] hover:bg-[#e02d3c] disabled:opacity-40 disabled:cursor-not-allowed text-black transition">
              {t("confirm")}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function HRAttendance() {
  const { t } = useLanguage();
  const [employees, setEmployees]         = useState<Employee[]>([]);
  const [records, setRecords]             = useState<DailyRecord[]>([]);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState<string | null>(null);
  const [savingAll, setSavingAll]         = useState(false);
  const [selectedDate, setSelectedDate]   = useState(todayStr());
  const [selectedMonth, setSelectedMonth] = useState(monthStr());
  const [view, setView]                   = useState<"day" | "month">("day");
  const [deptFilter, setDeptFilter]       = useState("All");
  const [search, setSearch]               = useState("");
  const [toast, setToast]                 = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [draft, setDraft]                 = useState<Record<string, Draft>>({});
  const [leaveMap, setLeaveMap]           = useState<Record<string, string>>({});
  const [modalEmp, setModalEmp]           = useState<Employee | null>(null);
  const [modalEmpIndex, setModalEmpIndex] = useState(0);

  const departments = ["All", ...Array.from(new Set(employees.map(e => e.department)))];
  const defaultDraft = (): Draft => ({ checkIn: "", checkOut: "", isAbsent: false, note: "" });

  useEffect(() => {
    hrService.getAllEmployees(true)
      .then((d: any) => {
        const list = Array.isArray(d) ? d : (d?.data ?? []);
        setEmployees(list.filter((e: any) => e.role === "EMPLOYEE" || !e.role));
      }).catch(() => {});
  }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = view === "day" ? { date: selectedDate } : { month: selectedMonth };
      if (deptFilter !== "All") params.department = deptFilter;
      const data = await dailyAttendanceService.list(params);
      const rows: DailyRecord[] = Array.isArray(data) ? data : ((data as any)?.data ?? []);
      setRecords(rows);
      if (view === "day") {
        const d: Record<string, Draft> = {};
        for (const r of rows) {
          d[r.employeeId] = { checkIn: r.checkIn, checkOut: r.checkOut, isAbsent: r.status === "Absent", note: r.note ?? "" };
        }
        setDraft(d);
        try {
          const leaveRes = await (attendanceService.list as any)({ status: "Approved" });
          const leaveRows: any[] = Array.isArray(leaveRes) ? leaveRes : ((leaveRes as any)?.data ?? []);
          const lm: Record<string, string> = {};
          for (const r of leaveRows) {
            if (r.date === selectedDate && ["Annual Leave", "Sick Leave", "Remote Work", "Unpaid Leave"].includes(r.type)) {
              lm[r.employeeId] = r.type;
            }
          }
          setLeaveMap(lm);
        } catch { setLeaveMap({}); }
      }
    } catch { setRecords([]); }
    finally { setLoading(false); }
  }, [view, selectedDate, selectedMonth, deptFilter]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const patchDraft = (id: string, patch: Partial<Draft>) =>
    setDraft(prev => ({ ...prev, [id]: { ...(prev[id] || defaultDraft()), ...patch } }));

  const filteredEmps = employees.filter(e =>
    (deptFilter === "All" || e.department === deptFilter) &&
    (!search || e.name.toLowerCase().includes(search.toLowerCase()))
  );

  function buildPayload(emp: Employee) {
    const d = draft[emp._id] || defaultDraft();
    const isOnLeave = !!leaveMap[emp._id];
    const status = deriveStatus(d.checkIn, d.isAbsent, isOnLeave);
    const autoAbsent = status === "Absent";
    return {
      employeeId: emp._id, date: selectedDate,
      checkIn:  (autoAbsent || isOnLeave) ? "" : d.checkIn,
      checkOut: (autoAbsent || isOnLeave) ? "" : d.checkOut,
      isAbsent: autoAbsent && !isOnLeave,
      note: isOnLeave ? (leaveMap[emp._id] ?? "On Leave") : d.note,
    };
  }

  async function saveRow(emp: Employee) {
    setSaving(emp._id);
    try {
      await dailyAttendanceService.upsert(buildPayload(emp));
      showToast(`✓ Saved — ${emp.name}`, "success");
      loadRecords();
    } catch (e: any) {
      showToast(`✗ ${e.response?.data?.message || e.message || "Error"}`, "error");
    } finally { setSaving(null); }
  }

  async function saveAll() {
    if (filteredEmps.length === 0) return;
    setSavingAll(true);
    let ok = 0; let fail = 0;
    await Promise.all(filteredEmps.map(async emp => {
      try { await dailyAttendanceService.upsert(buildPayload(emp)); ok++; }
      catch { fail++; }
    }));
    setSavingAll(false);
    if (fail === 0) showToast(`✓ All ${ok} records saved`, "success");
    else showToast(`✓ ${ok} saved · ✗ ${fail} failed`, fail > 0 ? "error" : "success");
    loadRecords();
  }

  // ── Export daily attendance CSV ────────────────────────────────────────────
  async function exportDailyCSV() {
    const headers = ["Date","Employee","Department","Position","Status","Check-In","Check-Out","Hours Worked","Late (min)","Extra Hours","Note"];
    const data = filteredEmps.map(emp => {
      const d = draft[emp._id] || defaultDraft();
      const isOnLeave = !!leaveMap[emp._id];
      const status  = deriveStatus(d.checkIn, d.isAbsent, isOnLeave);
      const checkIn = (status === "Absent" || isOnLeave) ? "" : d.checkIn;
      const checkOut= (status === "Absent" || isOnLeave) ? "" : d.checkOut;
      const worked  = checkIn && checkOut ? calcWorked(checkIn, checkOut) : 0;
      const extra   = Math.max(0, worked - 8);
      const lateMin = checkIn ? calcLateMinutes(checkIn) : 0;
      return [selectedDate, emp.name, emp.department || "", emp.position || "",
        isOnLeave ? "On Leave" : status, checkIn || "-", checkOut || "-",
        worked > 0 ? worked.toFixed(2) : "0.00", String(lateMin),
        extra > 0 ? extra.toFixed(2) : "0.00", (isOnLeave ? (leaveMap[emp._id] ?? "On Leave") : d.note) || ""];
    });
    await exportBrandedXlsx(`Daily Attendance ${selectedDate}`, headers, data, `attendance_${selectedDate}.xlsx`);
  }

  // ── Export daily attendance PDF (print dialog) ─────────────────────────────
  async function exportDailyPDF() {
    const headers = ["Employee","Department","Position","Status","Check-In","Check-Out","Worked (h)","Late (min)","Extra (h)","Note"];
    const rows = filteredEmps.map(emp => {
      const d = draft[emp._id] || defaultDraft();
      const isOnLeave = !!leaveMap[emp._id];
      const status  = deriveStatus(d.checkIn, d.isAbsent, isOnLeave);
      const display = isOnLeave ? "On Leave" : status;
      const checkIn = (status === "Absent" || isOnLeave) ? "-" : (d.checkIn  || "-");
      const checkOut= (status === "Absent" || isOnLeave) ? "-" : (d.checkOut || "-");
      const worked  = d.checkIn && d.checkOut && !isOnLeave ? calcWorked(d.checkIn, d.checkOut) : 0;
      const extra   = Math.max(0, worked - 8);
      const lateMin = d.checkIn && !isOnLeave ? calcLateMinutes(d.checkIn) : 0;
      const note    = isOnLeave ? (leaveMap[emp._id] ?? "On Leave") : (d.note || "-");
      return [emp.name, emp.department || "-", emp.position || "-", display,
        checkIn, checkOut, worked > 0 ? worked.toFixed(2) : "-",
        lateMin > 0 ? String(lateMin) : "-", extra > 0 ? extra.toFixed(2) : "-", note];
    });
    await exportBrandedPdf("Daily Attendance", selectedDate, headers, rows, `attendance_${selectedDate}.pdf`);
  }

  function openModal(emp: Employee, idx: number) {
    setModalEmpIndex(idx);
    setModalEmp(emp);
  }

  const { presentTotal, absentTotal, lateTotal, onLeaveTotal } = (() => {
    if (view !== "day") {
      return {
        presentTotal: records.filter(r => r.status === "Present").length,
        absentTotal:  records.filter(r => r.status === "Absent").length,
        lateTotal:    records.filter(r => r.status === "Late").length,
        onLeaveTotal: 0,
      };
    }
    let present = 0, absent = 0, late = 0, onLeave = 0;
    for (const emp of filteredEmps) {
      if (leaveMap[emp._id]) { onLeave++; continue; }
      const d = draft[emp._id] || defaultDraft();
      const s = deriveStatus(d.checkIn, d.isAbsent, false);
      if (s === "Present") present++;
      else if (s === "Late") late++;
      else absent++;
    }
    return { presentTotal: present, absentTotal: absent, lateTotal: late, onLeaveTotal: onLeave };
  })();

  const presentDisabled = isMarkPresentDisabled();

  return (
    <ProtectedRoute allowedRoles={["HR_MANAGER"]}>
      <div className="min-h-screen bg-gray-100 dark:bg-[#060d1f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${toast.type === "error" ? "bg-red-600" : "bg-[#c8202f]"}`}>
              {toast.msg}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {modalEmp && (
            <TimeModal emp={modalEmp} empIndex={modalEmpIndex}
              draft={draft[modalEmp._id] || defaultDraft()}
              onSave={(d) => patchDraft(modalEmp._id, d)}
              onClose={() => setModalEmp(null)} />
          )}
        </AnimatePresence>

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight leading-none">
            <span className="text-[#c8202f]">{t("attendance")}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">EMM ERP</p>
        </div>

        {/* Disabled banner */}
        {presentDisabled && view === "day" && (
          <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-widest">
            <Clock size={14} />
            Mark Present is currently disabled — available before 10:00, between 12:30–14:30, and reopens after restart
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-white/10">
            {(["day", "month"] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-4 py-2 text-xs font-medium transition ${view === v ? "bg-indigo-600 text-white" : "bg-white dark:bg-[#111c35] text-gray-500 hover:text-gray-800 dark:hover:text-white"}`}>
                {v === "day" ? t("dailyEntry") : t("monthlyView")}
              </button>
            ))}
          </div>
          {view === "day"
            ? <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ colorScheme: "dark" }} className="bg-white dark:bg-[#111c35] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white" />
            : <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ colorScheme: "dark" }} className="bg-white dark:bg-[#111c35] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white" />
          }
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
            className="bg-white dark:bg-[#111c35] border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-600 dark:text-gray-300">
            {departments.map(d => <option key={d}>{d}</option>)}
          </select>
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 bg-white dark:bg-[#111c35] border border-gray-200 dark:border-white/10 rounded-xl text-xs w-40 text-gray-900 dark:text-white placeholder-gray-400" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: "Present",  value: String(presentTotal),  iconBg: "bg-[#c8202f]/10 text-[#c8202f]", color: "text-[#c8202f]", icon: <UserCheck size={14} /> },
            { label: "Absent",   value: String(absentTotal),   iconBg: "bg-red-500/10 text-red-400",         color: "text-red-400",     icon: <AlertCircle size={14} /> },
            { label: "On Leave", value: String(onLeaveTotal),  iconBg: "bg-blue-500/10 text-blue-400",       color: "text-blue-400",    icon: <CalendarOff size={14} /> },
            { label: "Late",     value: String(lateTotal),     iconBg: "bg-amber-500/10 text-amber-400",     color: "text-amber-400",   icon: <Clock size={14} /> },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className={`${card} px-5 py-4 flex items-center gap-4`}>
              <div className={`p-2 rounded-xl ${s.iconBg}`}>{s.icon}</div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">{s.label}</p>
                <p className={`text-2xl font-bold tracking-tight ${s.color}`}>{s.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Rule legend */}
        {view === "day" && (
          <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-widest font-bold">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20"><AlertCircle size={10} /> No times → Absent</span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#c8202f]/10 text-[#c8202f] border border-[#c8202f]/20"><CheckCircle size={10} /> Before 08:00 → Present</span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock size={10} /> 08:00–09:59 → Late</span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20"><AlertCircle size={10} /> ≥ 10:00 → Auto Absent</span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock size={10} /> Mark Present disabled 10:00–12:30 &amp; after 14:30</span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"><Zap size={10} /> Overtime after 8h</span>
          </div>
        )}

        {/* Daily Entry Table */}
        {view === "day" && (
          <div className={`${card} overflow-hidden`}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/[0.05] flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Daily Check-in / Check-out</h2>
                <p className="text-xs text-gray-500 mt-0.5">{selectedDate} · Click employee row to set times</p>
              </div>
              {/* ── Action buttons ── */}
              <div className="flex items-center gap-2">
                <button onClick={exportDailyCSV} disabled={loading || filteredEmps.length === 0}
                  title="Export to CSV"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition bg-[#c8202f]/10 text-[#c8202f] border border-[#c8202f]/20 hover:bg-[#c8202f]/20 disabled:opacity-40 disabled:cursor-not-allowed">
                  <Download size={13} /> CSV
                </button>
                <button onClick={exportDailyPDF} disabled={loading || filteredEmps.length === 0}
                  title="Print / Export to PDF"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed">
                  <Download size={13} /> PDF
                </button>
                <button onClick={saveAll} disabled={savingAll || loading || filteredEmps.length === 0}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-xl text-xs uppercase tracking-wide font-bold text-white transition">
                  {savingAll ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {savingAll ? "Saving…" : `Save All (${filteredEmps.length})`}
                </button>
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-gray-400 text-xs"><Loader2 size={16} className="animate-spin" /> Loading…</div>
            ) : filteredEmps.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">No employees found</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-white/[0.04] text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-600">
                    <th className="text-left px-6 py-3">Employee</th>
                    <th className="text-left px-4 py-3">Dept</th>
                    <th className="text-center px-4 py-3">Status</th>
                    <th className="text-center px-4 py-3">Times</th>
                    <th className="text-center px-4 py-3">Hours</th>
                    <th className="text-center px-4 py-3">Late</th>
                    <th className="text-center px-4 py-3 text-indigo-400"><span className="flex items-center justify-center gap-1"><Zap size={11} /> Extra</span></th>
                    <th className="text-left px-4 py-3">Note</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmps.map((emp, i) => {
                    const d = draft[emp._id] || defaultDraft();
                    const isOnLeave = !!leaveMap[emp._id];
                    const status = deriveStatus(d.checkIn, d.isAbsent, isOnLeave);
                    const effectiveAbsent = status === "Absent";
                    const isAutoAbsent = effectiveAbsent && !d.isAbsent;
                    const worked = effectiveAbsent ? 0 : calcWorked(d.checkIn, d.checkOut);
                    const extra  = Math.max(0, worked - 8);
                    const lateMin = status === "Late" ? calcLateMinutes(d.checkIn) : 0;

                    return (
                      <tr key={emp._id} className={`border-b border-gray-100 dark:border-white/[0.03] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition ${i % 2 !== 0 ? "bg-gray-50/40 dark:bg-white/[0.01]" : ""}`}>
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                              {emp.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-xs text-gray-900 dark:text-white">{emp.name}</p>
                              <p className="text-[10px] text-gray-400">{emp.position}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{emp.department}</td>
                        <td className="px-4 py-3 text-center">
                          {isOnLeave ? (
                            <div className="flex items-center justify-center">
                              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide bg-blue-500/15 border border-blue-500/40 text-blue-400">
                                <CalendarOff size={11} /> {leaveMap[emp._id] ?? "On Leave"}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => { if (presentDisabled) return; patchDraft(emp._id, { isAbsent: false }); openModal(emp, i); }}
                                disabled={presentDisabled}
                                title={presentDisabled ? "Mark Present disabled between 10:00–12:30 and after 14:30" : undefined}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition border ${
                                  presentDisabled ? "opacity-40 cursor-not-allowed border-white/10 text-gray-500"
                                  : !effectiveAbsent
                                    ? status === "Late" ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                                                       : "bg-[#c8202f]/15 border-[#c8202f]/40 text-[#c8202f]"
                                    : "bg-transparent border-white/10 text-gray-500 hover:border-[#c8202f]/30 hover:text-[#c8202f]"
                                }`}>
                                <UserCheck size={11} />
                                {!effectiveAbsent ? (status === "Late" ? "Late" : "Present") : "Present"}
                              </button>
                              <button
                                onClick={() => patchDraft(emp._id, { isAbsent: !d.isAbsent, checkIn: "", checkOut: "" })}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide transition border ${
                                  effectiveAbsent ? "bg-red-500/15 border-red-500/40 text-red-400"
                                                  : "bg-transparent border-white/10 text-gray-500 hover:border-red-500/30 hover:text-red-400"
                                }`}>
                                <AlertCircle size={11} />
                                {isAutoAbsent ? "Auto Absent" : "Absent"}
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isOnLeave ? <span className="text-xs text-blue-400/60">—</span>
                          : !effectiveAbsent && d.checkIn ? (
                            <button onClick={() => !presentDisabled && openModal(emp, i)} disabled={presentDisabled}
                              className="text-[11px] text-gray-400 hover:text-white transition flex items-center gap-1 mx-auto disabled:opacity-40 disabled:cursor-not-allowed">
                              <LogIn size={9} className="text-[#c8202f]" />{d.checkIn}
                              <span className="text-gray-600 mx-0.5">→</span>
                              <LogOut size={9} className="text-rose-400" />{d.checkOut || "?"}
                              <span className="text-gray-600 text-[9px] ml-1">✎</span>
                            </button>
                          ) : !effectiveAbsent ? (
                            <button onClick={() => !presentDisabled && openModal(emp, i)} disabled={presentDisabled}
                              className="text-[10px] text-gray-600 hover:text-[#c8202f] transition underline underline-offset-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline">
                              Set times
                            </button>
                          ) : <span className="text-xs text-gray-600">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {effectiveAbsent ? <span className="text-xs text-red-400/60">—</span>
                            : worked > 0 ? <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{worked.toFixed(1)}h</span>
                            : <span className="text-xs text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {lateMin > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400">
                              <Clock size={9} />+{lateMin}min
                            </span>
                          ) : <span className="text-xs text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {extra > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-400"><Zap size={9} />+{extra.toFixed(1)}h</span>
                          ) : <span className="text-xs text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <input type="text" placeholder="optional…" value={d.note}
                            onChange={e => patchDraft(emp._id, { note: e.target.value })}
                            className="w-28 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 text-[11px] text-gray-900 dark:text-white placeholder-gray-400" />
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => saveRow(emp)} disabled={saving === emp._id}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-[10px] font-bold text-white transition uppercase tracking-wide">
                            {saving === emp._id ? <Loader2 size={10} className="animate-spin" /> : "Save"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Monthly View */}
        {view === "month" && (
          <div className={`${card} overflow-hidden`}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/[0.05]">
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Monthly Summary — {selectedMonth}</h2>
              <p className="text-xs text-gray-500 mt-0.5">Overtime = hours beyond 8h/day · Hourly rate = salary ÷ 208h</p>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-gray-400 text-xs"><Loader2 size={16} className="animate-spin" /> Loading…</div>
            ) : records.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">No data for this month yet</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-white/[0.04] text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-600">
                    <th className="text-left px-6 py-3">Employee</th>
                    <th className="text-left px-4 py-3">Dept</th>
                    <th className="text-center px-4 py-3 text-[#c8202f]">Present</th>
                    <th className="text-center px-4 py-3 text-red-400">Absent</th>
                    <th className="text-center px-4 py-3 text-amber-400">Late</th>
                    <th className="text-center px-4 py-3 text-indigo-400">Extra hrs</th>
                    <th className="text-right px-6 py-3">Attendance %</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const map: Record<string, { name: string; dept: string; present: number; absent: number; late: number; extra: number }> = {};
                    for (const r of records) {
                      if (!map[r.employeeId]) map[r.employeeId] = { name: r.employeeName, dept: r.department, present: 0, absent: 0, late: 0, extra: 0 };
                      if (r.status === "Present") map[r.employeeId].present++;
                      if (r.status === "Absent")  map[r.employeeId].absent++;
                      if (r.status === "Late")    { map[r.employeeId].late++; map[r.employeeId].present++; }
                      map[r.employeeId].extra += r.extraHours || 0;
                    }
                    return Object.entries(map)
                      .filter(([, v]) => deptFilter === "All" || v.dept === deptFilter)
                      .filter(([, v]) => !search || v.name.toLowerCase().includes(search.toLowerCase()))
                      .map(([id, s], i) => {
                        const pct = Math.round((s.present / 26) * 100);
                        return (
                          <tr key={id} className={`border-b border-gray-100 dark:border-white/[0.03] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition ${i % 2 !== 0 ? "bg-gray-50/40 dark:bg-white/[0.01]" : ""}`}>
                            <td className="px-6 py-3 font-bold text-xs text-gray-900 dark:text-white">{s.name}</td>
                            <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{s.dept}</td>
                            <td className="px-4 py-3 text-center text-[#c8202f] font-bold text-xs">{s.present}</td>
                            <td className="px-4 py-3 text-center text-red-400 font-bold text-xs">{s.absent}</td>
                            <td className="px-4 py-3 text-center text-amber-400 font-bold text-xs">{s.late}</td>
                            <td className="px-4 py-3 text-center">
                              {s.extra > 0
                                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-400"><Zap size={9} />+{s.extra.toFixed(1)}h</span>
                                : <span className="text-xs text-gray-400">—</span>}
                            </td>
                            <td className="px-6 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-20 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${pct >= 80 ? "bg-[#c8202f]" : pct >= 60 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                </div>
                                <span className={`text-xs font-bold ${pct >= 80 ? "text-[#c8202f]" : pct >= 60 ? "text-amber-400" : "text-red-400"}`}>{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                  })()}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>
    </ProtectedRoute>
  );
}