"use client";

import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tag, Search, Plus, Download, Percent, Calendar, CheckCircle, Pencil, Trash2, X, Loader2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { promotionService, Promotion } from "@/services/marketingService";

const STATUS_CONFIG: Record<string, { badge: string; dot: string }> = {
  Active:    { badge: "bg-[#c8202f]/15 text-[#c8202f]", dot: "bg-[#e02d3c]" },
  Scheduled: { badge: "bg-blue-500/15 text-blue-400",       dot: "bg-blue-400" },
  Completed: { badge: "bg-gray-500/15 text-gray-400",       dot: "bg-gray-500" },
  Paused:    { badge: "bg-amber-500/15 text-amber-400",     dot: "bg-amber-400" },
};

const TYPE_BADGE: Record<string, string> = {
  Seasonal: "bg-amber-500/10 text-amber-400",
  Loyalty:  "bg-[#c8202f]/10 text-[#c8202f]",
  Referral: "bg-blue-500/10 text-blue-400",
  VIP:      "bg-purple-500/10 text-purple-400",
  Other:    "bg-gray-500/10 text-gray-400",
};

const TYPES    = ["Seasonal", "Loyalty", "Referral", "VIP", "Other"];
const STATUSES = ["Scheduled", "Active", "Paused", "Completed"];

type FormState = { name: string; discount: string; type: string; status: string; code: string; startDate: string; endDate: string; description: string };
const emptyForm: FormState = { name: "", discount: "", type: "", status: "Scheduled", code: "", startDate: "", endDate: "", description: "" };

const inputClass = "w-full px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition";
const labelClass = "text-xs text-gray-500 uppercase tracking-widest mb-1 block";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-[#111c35] border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition"><X size={18} /></button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

function PromoForm({ form, setForm, formError, submitting, onSubmit, onCancel, submitLabel, submitCls }: {
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  formError: string;
  submitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  submitCls: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Promotion Name</label>
        <input className={inputClass} placeholder="e.g. Black Friday Sale" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Type</label>
          <select className={inputClass} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="">— Select —</option>
            {TYPES.map(tp => <option key={tp} value={tp}>{tp}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select className={inputClass} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Discount (%)</label>
          <input className={inputClass} type="text" inputMode="numeric" placeholder="e.g. 20" value={form.discount}
            onChange={e => setForm(f => ({ ...f, discount: e.target.value.replace(/[^\d.]/g, "") }))} />
        </div>
        <div>
          <label className={labelClass}>Promo Code (optional)</label>
          <input className={inputClass} placeholder="e.g. BF2025" value={form.code}
            onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Start Date</label>
          <input className={inputClass} type="date" value={form.startDate}
            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={{ colorScheme: "dark" }} />
        </div>
        <div>
          <label className={labelClass}>End Date</label>
          <input className={inputClass} type="date" value={form.endDate}
            onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} style={{ colorScheme: "dark" }} />
        </div>
      </div>
      {formError && <p className="text-red-400 text-xs">{formError}</p>}
      <div className="flex gap-3 pt-2">
        <button onClick={onCancel}
          className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition">
          Cancel
        </button>
        <button onClick={onSubmit} disabled={submitting}
          className={`flex-1 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${submitCls}`}>
          {submitting ? <Loader2 size={13} className="animate-spin" /> : null} {submitLabel}
        </button>
      </div>
    </div>
  );
}

export default function PromotionsPage() {
  const { t } = useLanguage();
  const [promotions, setPromotions]   = useState<Promotion[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [filterStatus, setFilter]     = useState("all");
  const [showCreate, setShowCreate]   = useState(false);
  const [showEdit, setShowEdit]       = useState(false);
  const [showDelete, setShowDelete]   = useState(false);
  const [selected, setSelected]       = useState<Promotion | null>(null);
  const [form, setForm]               = useState<FormState>(emptyForm);
  const [submitting, setSubmitting]   = useState(false);
  const [formError, setFormError]     = useState("");

  const card = "bg-white dark:bg-[#111c35] border border-[#1b2a6b]/15 dark:border-[#1b2a6b]/20 border-t-2 border-t-[#c8202f] rounded-2xl transition-colors duration-300 hover:shadow-[0_0_20px_#c8202f10]";

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try { setLoading(true); setPromotions(await promotionService.getAll()); }
    catch {} finally { setLoading(false); }
  };

  const filtered = promotions.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || p.status.toLowerCase() === filterStatus;
    return matchSearch && matchStatus;
  });

  const activeCount    = promotions.filter(p => p.status === "Active").length;
  const scheduledCount = promotions.filter(p => p.status === "Scheduled").length;
  const discounts      = promotions.map(p => p.discount);
  const avgDiscount    = discounts.length ? Math.round(discounts.reduce((s, d) => s + d, 0) / discounts.length * 10) / 10 : 0;

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { Active: t("active"), Scheduled: t("scheduled"), Completed: t("completed"), Paused: t("paused") };
    return map[s] ?? s;
  };

  const handleCreate = async () => {
    if (!form.name || !form.discount || !form.type || !form.startDate) {
      setFormError("Name, discount, type and start date are required"); return;
    }
    try {
      setSubmitting(true); setFormError("");
      await promotionService.create({
        name: form.name, discount: Number(form.discount),
        type: form.type as Promotion["type"], status: form.status as Promotion["status"],
        code: form.code.toUpperCase(), startDate: form.startDate,
        endDate: form.endDate, description: form.description,
      });
      await fetchAll(); setShowCreate(false); setForm(emptyForm);
    } catch (err: any) { setFormError(err.response?.data?.message || "Failed to create"); }
    finally { setSubmitting(false); }
  };

  const openEdit = (p: Promotion) => {
    setSelected(p);
    setForm({ name: p.name, discount: String(p.discount), type: p.type, status: p.status,
      code: p.code, startDate: p.startDate || "", endDate: p.endDate || "", description: p.description || "" });
    setFormError(""); setShowEdit(true);
  };

  const handleEdit = async () => {
    if (!form.name || !form.discount || !form.type || !form.startDate) {
      setFormError("Name, discount, type and start date are required"); return;
    }
    try {
      setSubmitting(true); setFormError("");
      await promotionService.update(selected!._id, {
        name: form.name, discount: Number(form.discount),
        type: form.type as Promotion["type"], status: form.status as Promotion["status"],
        code: form.code.toUpperCase(), startDate: form.startDate,
        endDate: form.endDate, description: form.description,
      });
      await fetchAll(); setShowEdit(false);
    } catch (err: any) { setFormError(err.response?.data?.message || "Failed to update"); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    try { setSubmitting(true); await promotionService.remove(selected!._id); await fetchAll(); setShowDelete(false); }
    catch {} finally { setSubmitting(false); }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-100 dark:bg-[#060d1f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight leading-none">
              {t("promotionsTitle").split(" ")[0]}{" "}
              <span className="text-[#c8202f]">{t("promotionsTitle").split(" ").slice(1).join(" ")}</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">EMM ERP</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setForm(emptyForm); setFormError(""); setShowCreate(true); }}
              className="flex items-center gap-2 bg-[#c8202f] hover:bg-[#e02d3c] px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-black font-bold">
              <Plus size={13} /> {t("newPromotion")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: t("totalPromos"),  value: String(promotions.length), sub: t("allTime"),         icon: <Tag size={14} />,         iconBg: "bg-[#c8202f]/10 text-[#c8202f]" },
            { label: t("active"),       value: String(activeCount),       sub: t("runningNow"),      icon: <CheckCircle size={14} />, iconBg: "bg-blue-500/10 text-blue-400" },
            { label: t("scheduled"),    value: String(scheduledCount),    sub: t("upcoming"),        icon: <Calendar size={14} />,   iconBg: "bg-amber-500/10 text-amber-400" },
            { label: t("avgDiscount"),  value: `${avgDiscount}%`,         sub: t("acrossAllPromos"), icon: <Percent size={14} />,    iconBg: "bg-purple-500/10 text-purple-400" },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className={`${card} px-5 py-4 flex items-center gap-4`}>
              <div className={`p-2 rounded-xl ${s.iconBg}`}>{s.icon}</div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">{s.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className={`${card} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 border-b border-gray-200 dark:border-white/[0.05]">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{t("allPromotions")}</h2>
              <p className="text-xs text-gray-500">{filtered.length} {t("ofText")} {promotions.length} {t("promotions")}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input className="pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:border-[#c8202f]/40 transition text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                  placeholder={t("searchPromotion")} value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="px-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:border-[#c8202f]/40 transition"
                value={filterStatus} onChange={e => setFilter(e.target.value)}>
                <option value="all">{t("allStatus")}</option>
                <option value="active">{t("active")}</option>
                <option value="scheduled">{t("scheduled")}</option>
                <option value="completed">{t("completed")}</option>
              </select>
            </div>
          </div>

          <div className="grid px-6 py-3 text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-600 border-b border-gray-200 dark:border-white/[0.04]"
            style={{ gridTemplateColumns: "2fr 0.8fr 1fr 1fr 1.2fr 1.2fr 1fr 80px" }}>
            <span>{t("promotion")}</span><span>{t("discount")}</span><span>{t("type")}</span>
            <span>{t("code")}</span><span>{t("start")}</span><span>{t("end")}</span><span>{t("status")}</span><span>Actions</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 gap-2"><Loader2 size={16} className="animate-spin" /> Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400 dark:text-gray-600">{t("noPromotionsMatch")}</div>
          ) : (
            filtered.map((p, i) => {
              const sc = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.Scheduled;
              const tc = TYPE_BADGE[p.type] ?? "bg-gray-500/10 text-gray-400";
              const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Ongoing";
              return (
                <motion.div key={p._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                  className={`grid px-6 py-4 items-center hover:bg-gray-50 dark:hover:bg-white/[0.02] transition ${i < filtered.length - 1 ? "border-b border-gray-100 dark:border-white/[0.03]" : ""}`}
                  style={{ gridTemplateColumns: "2fr 0.8fr 1fr 1fr 1.2fr 1.2fr 1fr 80px" }}>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{p.name}</p>
                  <p className="text-sm font-bold text-[#c8202f]">{p.discount}%</p>
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold w-fit ${tc}`}>{p.type}</span>
                  <p className="text-xs font-bold text-gray-500 dark:text-gray-400 tracking-wider">{p.code}</p>
                  <p className="text-xs text-gray-500">{fmtDate(p.startDate)}</p>
                  <p className="text-xs text-gray-500">{p.endDate ? fmtDate(p.endDate) : "Ongoing"}</p>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold w-fit ${sc.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{statusLabel(p.status)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10 transition"><Pencil size={13} /></button>
                    <button onClick={() => { setSelected(p); setShowDelete(true); }} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition"><Trash2 size={13} /></button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      <AnimatePresence>
        {showCreate && (
          <Modal title={t("newPromotion")} onClose={() => setShowCreate(false)}>
            <PromoForm form={form} setForm={setForm} formError={formError} submitting={submitting}
              onSubmit={handleCreate} onCancel={() => setShowCreate(false)}
              submitLabel="Create Promotion" submitCls="bg-[#c8202f] hover:bg-[#e02d3c] text-black" />
          </Modal>
        )}
        {showEdit && selected && (
          <Modal title="Edit Promotion" onClose={() => setShowEdit(false)}>
            <PromoForm form={form} setForm={setForm} formError={formError} submitting={submitting}
              onSubmit={handleEdit} onCancel={() => setShowEdit(false)}
              submitLabel="Save Changes" submitCls="bg-blue-500 hover:bg-blue-400 text-white" />
          </Modal>
        )}
        {showDelete && selected && (
          <Modal title="Delete Promotion" onClose={() => setShowDelete(false)}>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Delete <span className="text-white font-bold">{selected.name}</span>? This cannot be undone.</p>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowDelete(false)} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition">Cancel</button>
                <button onClick={handleDelete} disabled={submitting}
                  className="flex-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-xs transition flex items-center justify-center gap-2">
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}