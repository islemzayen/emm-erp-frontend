"use client";
import { useState, useEffect } from "react";

import ProtectedRoute from "@/components/ProtectedRoute";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Plus, X, Loader2, Calendar,
  DollarSign, AlertTriangle, CheckCircle, Tag, Trash2, Edit2, ArrowRightLeft,
} from "lucide-react";
import { budgetService, eventService, MarketingBudget, MarketingEvent, EVENT_TYPES } from "@/services/calendarService";

// ── helpers ────────────────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, "0"); }
function monthKey(y: number, m: number) { return `${y}-${pad(m)}`; }
function daysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); }
function firstDayOfMonth(y: number, m: number) { return new Date(y, m - 1, 1).getDay(); }
function monthName(m: number) {
  return new Date(2000, m - 1, 1).toLocaleString("en-US", { month: "long" });
}
function fmtMoney(n: number) { return `${n.toLocaleString()} TND`; }

const TYPE_COLORS: Record<string, string> = {
  "Campaign Launch":  "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Trade Fair":       "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Press Conference": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Product Launch":   "bg-[#c8202f]/20 text-[#c8202f] border-[#c8202f]/30",
  "Promotion":        "bg-pink-500/20 text-pink-400 border-pink-500/30",
  "Social Media":     "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "Workshop":         "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "Networking":       "bg-teal-500/20 text-teal-400 border-teal-500/30",
  "Sponsorship":      "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  "Other":            "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const EMPTY_FORM: { title: string; type: string; description: string; budget: number; status: "Planned" | "Done" | "Cancelled" } = {
  title: "", type: "Other", description: "", budget: 0, status: "Planned",
};

export default function MarketingCalendarPage() {
  const now   = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [budget,      setBudget]      = useState<MarketingBudget | null>(null);
  const [events,      setEvents]      = useState<MarketingEvent[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);

  // modals
  const [showAdd,     setShowAdd]     = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [editTarget,  setEditTarget]  = useState<MarketingEvent | null>(null);
  const [deleteTarget,setDeleteTarget]= useState<MarketingEvent | null>(null);
  const [overflowEvent, setOverflowEvent] = useState<MarketingEvent | null>(null);
  const [showTransfer,  setShowTransfer]  = useState(false);
  const [transferFrom,  setTransferFrom]  = useState("");
  const [transferAmt,   setTransferAmt]   = useState(0);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState("");

  const mk  = monthKey(year, month);
  const alloc = budget?.monthlyAllocations.find(m => m.month === mk);
  const remaining = alloc ? alloc.remaining : 0;
  const allocated = alloc ? alloc.allocated : 0;
  const spent     = alloc ? alloc.spent     : 0;

  // fetch data
  const fetchAll = async () => {
    try {
      const [b, evs] = await Promise.all([
        budgetService.get(year),
        eventService.list(mk),
      ]);
      setBudget(b); setEvents(evs);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { setLoading(true); fetchAll(); }, [year, month]);

  // calendar grid
  const days     = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  function eventsOnDay(day: number) {
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
    return events.filter(e => e.date === dateStr);
  }

  function openAdd(day: number) {
    setSelectedDay(day);
    setForm({ ...EMPTY_FORM });
    setFormError("");
    setShowAdd(true);
  }

  async function handleSave() {
    if (!form.title.trim()) { setFormError("Title is required"); return; }
    if (form.budget < 0)    { setFormError("Budget must be 0 or more"); return; }

    // Check budget overflow
    const isEdit       = !!editTarget;
    const prevBudget   = isEdit ? editTarget!.budget : 0;
    const delta        = form.budget - prevBudget;
    const wouldExceed  = delta > remaining;

    if (wouldExceed && !isEdit) {
      // Show overflow modal
      const tempEvent = {
        ...form,
        date:     `${year}-${pad(month)}-${pad(selectedDay!)}`,
        monthKey: mk,
      } as MarketingEvent;
      setOverflowEvent(tempEvent);
      setShowAdd(false);
      return;
    }

    setSaving(true); setFormError("");
    try {
      if (isEdit) {
        await eventService.update(editTarget!._id, form);
        setEditTarget(null);
      } else {
        const dateStr = `${year}-${pad(month)}-${pad(selectedDay!)}`;
        await eventService.create({ ...form, date: dateStr, monthKey: mk });
        setShowAdd(false);
      }
      await fetchAll();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || "Failed to save event");
    } finally { setSaving(false); }
  }

  async function handleRequestExtra() {
    if (!overflowEvent) return;
    setSaving(true);
    try {
      // Create event and request extra budget
      const created = await eventService.create({
        ...overflowEvent,
        date: overflowEvent.date,
        monthKey: mk,
      });
      await eventService.requestBudget(created._id, "Budget exceeded — extra funds requested");
      setOverflowEvent(null);
      await fetchAll();
    } catch {} finally { setSaving(false); }
  }

  async function handleTransferAndSave() {
    if (!overflowEvent || !transferFrom || transferAmt <= 0) return;
    setSaving(true);
    try {
      await budgetService.transfer(year, transferFrom, mk, transferAmt);
      const created = await eventService.create({
        ...overflowEvent,
        date: overflowEvent.date,
        monthKey: mk,
      });
      setOverflowEvent(null);
      setShowTransfer(false);
      await fetchAll();
    } catch {} finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await eventService.remove(deleteTarget._id);
      setDeleteTarget(null);
      await fetchAll();
    } catch {} finally { setSaving(false); }
  }

  function prevMonth() { if (month === 1) { setYear(y => y - 1); setMonth(12); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 12) { setYear(y => y + 1); setMonth(1);  } else setMonth(m => m + 1); }

  const card     = "bg-white dark:bg-[#111c35] border border-gray-200 dark:border-[#1b2a6b]/20 rounded-2xl transition-colors duration-300";
  const inp      = "w-full px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/50 transition";
  const labelCls = "text-[10px] uppercase tracking-widest text-gray-500 mb-1 block";
  const modalBase= "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4";
  const modalCard= "bg-white dark:bg-[#111c35] border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl";

  const futureMonths = budget?.monthlyAllocations
    .filter(m => m.month > mk && m.allocated > 0) ?? [];

  return (
    <ProtectedRoute allowedRoles={["MARKETING_MANAGER", "ADMIN"]}>
      
        <div className="min-h-screen bg-gray-100 dark:bg-[#060d1f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

          {/* ── Header ── */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight leading-none">
                Events <span className="text-[#c8202f]">Calendar</span>
              </h1>
              <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">EMM ERP · Marketing</p>
            </div>

            {/* Month navigation */}
            <div className="flex items-center gap-3">
              <button onClick={prevMonth} className="p-2 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 transition">
                <ChevronLeft size={16} />
              </button>
              <div className="text-center min-w-[160px]">
                <p className="font-bold text-lg">{monthName(month)}</p>
                <p className="text-xs text-gray-500">{year}</p>
              </div>
              <button onClick={nextMonth} className="p-2 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 transition">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* ── Budget bar ── */}
          <div className={`${card} px-6 py-4`}>
            {loading ? (
              <div className="flex items-center gap-2 text-gray-400 text-xs"><Loader2 size={14} className="animate-spin" /> Loading budget...</div>
            ) : allocated === 0 ? (
              <div className="flex items-center gap-2 text-amber-400 text-xs">
                <AlertTriangle size={14} /> No budget allocated for {monthName(month)} {year}. Go to the Budget page → Planification to allocate.
              </div>
            ) : (
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 rounded-xl bg-[#c8202f]/10"><DollarSign size={14} className="text-[#c8202f]" /></div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-500">{monthName(month)} Budget</p>
                    <p className="text-base font-bold">{fmtMoney(allocated)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Spent</p>
                    <p className="font-bold text-blue-400">{fmtMoney(spent)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Remaining</p>
                    <p className={`font-bold ${remaining <= 0 ? "text-red-400" : remaining < allocated * 0.2 ? "text-amber-400" : "text-[#c8202f]"}`}>
                      {fmtMoney(remaining)}
                    </p>
                  </div>
                </div>
                <div className="flex-1 max-w-xs">
                  <div className="h-2 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${spent / allocated >= 0.9 ? "bg-red-500" : spent / allocated >= 0.7 ? "bg-amber-500" : "bg-[#c8202f]"}`}
                      style={{ width: `${Math.min(100, Math.round((spent / allocated) * 100))}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">{Math.round((spent / allocated) * 100)}% used</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Calendar grid ── */}
          <div className={`${card} overflow-hidden`}>
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-[#1b2a6b]/20">
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                <div key={d} className="py-3 text-center text-[10px] uppercase tracking-widest text-gray-500 font-bold">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {cells.map((day, i) => {
                const dayEvents = day ? eventsOnDay(day) : [];
                const isToday   = day === now.getDate() && month === now.getMonth() + 1 && year === now.getFullYear();
                return (
                  <div key={i}
                    className={`min-h-[110px] border-b border-r border-gray-100 dark:border-white/[0.03] p-2 ${!day ? "bg-gray-50 dark:bg-black/10" : "hover:bg-gray-50 dark:hover:bg-white/[0.02] transition"}`}>
                    {day && (
                      <>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-[#c8202f] text-black" : "text-gray-700 dark:text-gray-300"}`}>
                            {day}
                          </span>
                          <button onClick={() => openAdd(day)}
                            className="w-5 h-5 rounded-full bg-gray-200 dark:bg-white/10 hover:bg-[#c8202f]/20 hover:text-[#c8202f] text-gray-400 flex items-center justify-center transition opacity-0 group-hover:opacity-100">
                            <Plus size={11} />
                          </button>
                        </div>
                        <div className="space-y-1">
                          {dayEvents.map(ev => (
                            <div key={ev._id}
                              className={`text-[10px] px-1.5 py-0.5 rounded border truncate cursor-pointer ${TYPE_COLORS[ev.type] || TYPE_COLORS["Other"]} ${ev.budgetRequestStatus === "requested" ? "ring-1 ring-amber-400/50" : ""}`}
                              onClick={() => { setEditTarget(ev); setForm({ title: ev.title, type: ev.type, description: ev.description, budget: ev.budget, status: ev.status }); setFormError(""); }}>
                              <span className="font-bold">{ev.title}</span>
                              <span className="ml-1 opacity-70">{fmtMoney(ev.budget)}</span>
                              {ev.budgetRequestStatus === "requested" && <span className="ml-1">⚡</span>}
                            </div>
                          ))}
                          {day && (
                            <button onClick={() => openAdd(day)}
                              className="w-full text-[9px] text-gray-400 hover:text-[#c8202f] transition flex items-center gap-1 mt-1">
                              <Plus size={9} /> Add event
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Event list ── */}
          {events.length > 0 && (
            <div className={`${card} overflow-hidden`}>
              <div className="px-6 py-4 border-b border-gray-200 dark:border-[#1b2a6b]/20">
                <h2 className="text-base font-bold">Events this month</h2>
                <p className="text-xs text-gray-500">{events.length} event{events.length !== 1 ? "s" : ""} · {fmtMoney(spent)} total budget</p>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
                {events.map(ev => (
                  <div key={ev._id} className="flex items-center gap-4 px-6 py-3">
                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${TYPE_COLORS[ev.type] || TYPE_COLORS["Other"]}`}>
                      {ev.type}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{ev.title}</p>
                      <p className="text-[10px] text-gray-500">{ev.date}{ev.description ? ` · ${ev.description}` : ""}</p>
                    </div>
                    {ev.budgetRequestStatus === "requested" && (
                      <span className="text-[10px] text-amber-400 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 rounded-full">Extra Requested</span>
                    )}
                    <p className="text-sm font-bold text-[#c8202f] flex-shrink-0">{fmtMoney(ev.budget)}</p>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => { setEditTarget(ev); setForm({ title: ev.title, type: ev.type, description: ev.description, budget: ev.budget, status: ev.status }); setFormError(""); }}
                        className="p-1.5 rounded-lg hover:bg-blue-500/10 text-gray-400 hover:text-blue-400 transition"><Edit2 size={13} /></button>
                      <button onClick={() => setDeleteTarget(ev)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Add Event Modal ── */}
        <AnimatePresence>
          {showAdd && (
            <motion.div className={modalBase} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className={modalCard} initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-base font-bold">New Event</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{monthName(month)} {selectedDay}, {year}</p>
                  </div>
                  <button onClick={() => setShowAdd(false)}><X size={16} className="text-gray-400" /></button>
                </div>

                {/* Remaining budget reminder */}
                <div className={`mb-4 px-3 py-2 rounded-xl text-xs flex items-center gap-2 ${remaining <= 0 ? "bg-red-500/10 border border-red-500/20 text-red-400" : "bg-[#c8202f]/10 border border-[#c8202f]/20 text-[#c8202f]"}`}>
                  <DollarSign size={12} />
                  Remaining budget: <span className="font-bold">{fmtMoney(remaining)}</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Event Title *</label>
                    <input className={inp} placeholder="e.g. Summer Campaign Launch" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Type</label>
                    <select className={inp} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                      {EVENT_TYPES.map((t: string) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Description</label>
                    <textarea className={`${inp} resize-none`} rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Budget (TND)</label>
                    <input type="text" inputMode="numeric" className={inp} value={form.budget || ""} onChange={e => setForm(f => ({ ...f, budget: Number(e.target.value.replace(/\D/g, "")) }))} />
                    {form.budget > remaining && remaining > 0 && (
                      <p className="text-[10px] text-amber-400 mt-1">⚠ Exceeds remaining budget by {fmtMoney(form.budget - remaining)}</p>
                    )}
                  </div>
                </div>
                {formError && <p className="text-red-400 text-xs mt-3">{formError}</p>}
                <div className="flex gap-3 mt-5">
                  <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition">Cancel</button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-[#c8202f] hover:bg-[#e02d3c] text-black font-bold text-xs transition flex items-center justify-center gap-2">
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add Event
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Edit Event Modal ── */}
        <AnimatePresence>
          {editTarget && (
            <motion.div className={modalBase} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className={modalCard} initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-bold">Edit Event</h3>
                  <button onClick={() => setEditTarget(null)}><X size={16} className="text-gray-400" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Event Title *</label>
                    <input className={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Type</label>
                    <select className={inp} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                      {EVENT_TYPES.map((t: string) => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Description</label>
                    <textarea className={`${inp} resize-none`} rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Budget (TND)</label>
                    <input type="text" inputMode="numeric" className={inp} value={form.budget || ""} onChange={e => setForm(f => ({ ...f, budget: Number(e.target.value.replace(/\D/g, "")) }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Status</label>
                    <select className={inp} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                      <option>Planned</option><option>Done</option><option>Cancelled</option>
                    </select>
                  </div>
                </div>
                {formError && <p className="text-red-400 text-xs mt-3">{formError}</p>}
                <div className="flex gap-3 mt-5">
                  <button onClick={() => setEditTarget(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition">Cancel</button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs transition flex items-center justify-center gap-2">
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Edit2 size={12} />} Save Changes
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Budget Overflow Modal ── */}
        <AnimatePresence>
          {overflowEvent && !showTransfer && (
            <motion.div className={modalBase} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className={`${modalCard} max-w-sm`} initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400"><AlertTriangle size={18} /></div>
                  <div>
                    <p className="text-sm font-bold">Budget Exceeded</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      This event needs <span className="text-white font-bold">{fmtMoney(overflowEvent.budget)}</span> but only <span className="text-amber-400 font-bold">{fmtMoney(remaining)}</span> remains.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-5">How would you like to proceed?</p>
                <div className="space-y-2">
                  <button onClick={handleRequestExtra} disabled={saving}
                    className="w-full py-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition flex items-center justify-center gap-2">
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <DollarSign size={13} />}
                    Request Extra Budget
                  </button>
                  <button onClick={() => { setShowTransfer(true); setTransferAmt(overflowEvent.budget - remaining); }}
                    disabled={futureMonths.length === 0}
                    className="w-full py-3 rounded-xl border border-blue-500/40 bg-blue-500/10 text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                    <ArrowRightLeft size={13} /> Reduce from Another Month
                  </button>
                  {futureMonths.length === 0 && (
                    <p className="text-[10px] text-gray-500 text-center">No future months with budget available</p>
                  )}
                  <button onClick={() => setOverflowEvent(null)}
                    className="w-full py-2.5 rounded-xl text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition">
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Transfer Budget Modal ── */}
        <AnimatePresence>
          {showTransfer && overflowEvent && (
            <motion.div className={modalBase} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className={modalCard} initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-bold flex items-center gap-2"><ArrowRightLeft size={15} className="text-blue-400" /> Transfer Budget</h3>
                  <button onClick={() => setShowTransfer(false)}><X size={16} className="text-gray-400" /></button>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  Transfer budget from a future month to cover <span className="text-white font-bold">{overflowEvent.title}</span>.
                  You need at least <span className="text-amber-400 font-bold">{fmtMoney(overflowEvent.budget - remaining)}</span>.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Take from month</label>
                    <select className={inp} value={transferFrom} onChange={e => setTransferFrom(e.target.value)}>
                      <option value="">— Select month —</option>
                      {futureMonths.map(m => (
                        <option key={m.month} value={m.month}>
                          {new Date(m.month + "-01").toLocaleString("en-US", { month: "long", year: "numeric" })} — {fmtMoney(m.allocated)} available
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Amount to transfer (TND)</label>
                    <input type="text" inputMode="numeric" className={inp} min={overflowEvent.budget - remaining} value={transferAmt || ""}
                      onChange={e => setTransferAmt(Number(e.target.value.replace(/\D/g, "")))} />
                  </div>
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={() => setShowTransfer(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition">Back</button>
                  <button onClick={handleTransferAndSave} disabled={saving || !transferFrom || transferAmt <= 0}
                    className="flex-1 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-bold text-xs transition flex items-center justify-center gap-2 disabled:opacity-40">
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} Transfer & Save Event
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Delete Confirm Modal ── */}
        <AnimatePresence>
          {deleteTarget && (
            <motion.div className={modalBase} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div className={`${modalCard} max-w-sm`} initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-xl bg-red-500/10"><Trash2 size={16} className="text-red-400" /></div>
                  <div>
                    <p className="text-sm font-bold">Delete Event</p>
                    <p className="text-xs text-gray-500 mt-0.5">This will free up <span className="text-[#c8202f] font-bold">{fmtMoney(deleteTarget.budget)}</span> from this month's budget.</p>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mb-5">Delete <span className="text-white font-bold">{deleteTarget.title}</span>? This cannot be undone.</p>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition">Cancel</button>
                  <button onClick={handleDelete} disabled={saving}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-xs transition flex items-center justify-center gap-2">
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      
    </ProtectedRoute>
  );
}
