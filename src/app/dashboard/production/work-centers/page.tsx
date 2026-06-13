"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Loader2, Pencil, Power, ArrowLeft, Factory } from "lucide-react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { workCenterService, type WorkCenter } from "@/services/production/workCenterService";

const WC_TYPE_COLOR: Record<string, string> = {
  MACHINE: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  ASSEMBLY: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  QUALITY_CHECK: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  PACKAGING: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.16 }}
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
          <button onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">
            <X size={18} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

const emptyForm = { name: "", code: "", type: "MACHINE" as WorkCenter["type"], capacityPerDay: "8", notes: "" };

export default function WorkCentersPage() {
  const surface = "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";
  const inputClass = "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:focus:border-slate-600 dark:focus:ring-slate-800";
  const labelClass = "mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400";

  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<WorkCenter | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [formError, setFormError] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setWorkCenters(await workCenterService.getAll());
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openCreate = () => { setForm({ ...emptyForm }); setFormError(""); setShowCreate(true); };
  const openEdit = (wc: WorkCenter) => {
    setEditTarget(wc);
    setForm({ name: wc.name, code: wc.code, type: wc.type, capacityPerDay: String(wc.capacityPerDay), notes: wc.notes || "" });
    setFormError("");
  };

  const handleSave = async () => {
    if (!form.name || !form.code) { setFormError("Name and code are required"); return; }
    try {
      setSubmitting(true); setFormError("");
      const payload = { ...form, capacityPerDay: Number(form.capacityPerDay) || 8 };
      if (editTarget) {
        await workCenterService.update(editTarget._id, payload);
        setEditTarget(null);
      } else {
        await workCenterService.create(payload);
        setShowCreate(false);
      }
      await fetchAll();
      setForm({ ...emptyForm });
    } catch (err: any) {
      setFormError(err.response?.data?.message || "Failed to save");
    } finally { setSubmitting(false); }
  };

  const handleToggle = async (id: string) => {
    setTogglingId(id);
    try { await workCenterService.toggleActive(id); await fetchAll(); }
    catch {} finally { setTogglingId(null); }
  };

  const total = workCenters.length;
  const active = workCenters.filter(w => w.active).length;

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "STOCK_MANAGER", "COMMERCIAL_MANAGER"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <Link href="/dashboard/production" className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
              <ArrowLeft size={14} /> Production Scheduling
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              Work Centers
            </h1>
          </div>
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
            <Plus size={15} /> Add Work Center
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total", value: total, color: "bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
            { label: "Active", value: active, color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
            { label: "Inactive", value: total - active, color: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300" },
          ].map((k, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`${surface} flex items-center gap-4 px-5 py-5`}>
              <div className={`rounded-2xl p-3 ${k.color}`}><Factory size={16} /></div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{k.label}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{k.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* List */}
        <div className={surface}>
          <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-950 dark:text-white">Work Center Directory</h2>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{total} work centers configured</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading...</div>
          ) : workCenters.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400 dark:text-slate-500">No work centers yet. Add one to get started.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr className="text-left text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    <th className="px-6 py-3 font-medium">Name</th>
                    <th className="px-6 py-3 font-medium">Code</th>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Capacity / Day</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {workCenters.map((wc, i) => (
                    <motion.tr key={wc._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                      className="transition hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900 dark:text-white">{wc.name}</p>
                        {wc.notes && <p className="text-xs text-slate-400 truncate max-w-xs">{wc.notes}</p>}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">{wc.code}</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-xl px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${WC_TYPE_COLOR[wc.type]}`}>
                          {wc.type.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{wc.capacityPerDay}h</td>
                      <td className="px-6 py-4">
                        <span className={`rounded-xl px-2.5 py-1 text-[11px] font-semibold ${wc.active ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"}`}>
                          {wc.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(wc)} className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/20">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleToggle(wc._id)} disabled={togglingId === wc._id}
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-2xl transition disabled:opacity-50 ${wc.active ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/20" : "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/20"}`}>
                            {togglingId === wc._id ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {(showCreate || editTarget) && (
          <Modal title={editTarget ? `Edit ${editTarget.name}` : "Add Work Center"} onClose={() => { setShowCreate(false); setEditTarget(null); }}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Name *</label>
                  <input className={inputClass} placeholder="Assembly Line A" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className={labelClass}>Code *</label>
                  <input className={inputClass} placeholder="WC-001" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Type</label>
                  <select className={inputClass} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as WorkCenter["type"] }))}>
                    <option value="MACHINE">Machine</option>
                    <option value="ASSEMBLY">Assembly</option>
                    <option value="QUALITY_CHECK">Quality Check</option>
                    <option value="PACKAGING">Packaging</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Capacity (hrs/day)</label>
                  <input className={inputClass} type="number" min={1} max={24} value={form.capacityPerDay} onChange={e => setForm(f => ({ ...f, capacityPerDay: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Notes</label>
                <textarea className={inputClass} rows={2} placeholder="Optional notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              {formError && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">{formError}</div>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setShowCreate(false); setEditTarget(null); }} className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</button>
                <button onClick={handleSave} disabled={submitting} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950">
                  {submitting ? <Loader2 size={14} className="animate-spin" /> : editTarget ? <Pencil size={14} /> : <Plus size={14} />}
                  {editTarget ? "Save Changes" : "Add"}
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </ProtectedRoute>
  );
}
