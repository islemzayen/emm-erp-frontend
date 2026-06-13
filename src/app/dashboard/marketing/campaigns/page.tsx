"use client";
import { exportBrandedXlsx } from "@/lib/reportExport";


import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, Search, Plus, Download, Users, DollarSign, Play, Pencil, Trash2, X, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { campaignService, Campaign } from "@/services/marketingService";

const STATUS_CONFIG: Record<string, { badge: string; dot: string }> = {
  Active:    { badge: "bg-[#c8202f]/15 text-[#c8202f]", dot: "bg-[#e02d3c]" },
  Paused:    { badge: "bg-amber-500/15 text-amber-400",     dot: "bg-amber-400" },
  Planned:   { badge: "bg-blue-500/15 text-blue-400",       dot: "bg-blue-400" },
  Completed: { badge: "bg-gray-500/15 text-gray-400",       dot: "bg-gray-500" },
};

const CHANNEL_BADGE: Record<string, string> = {
  Email:   "bg-[#c8202f]/10 text-[#c8202f]",
  PPC:     "bg-blue-500/10 text-blue-400",
  Social:  "bg-purple-500/10 text-purple-400",
  Display: "bg-amber-500/10 text-amber-400",
  Video:   "bg-pink-500/10 text-pink-400",
  Other:   "bg-gray-500/10 text-gray-400",
};

const CHANNELS  = ["Email", "PPC", "Social", "Display", "Video", "Other"];
const STATUSES  = ["Planned", "Active", "Paused", "Completed"];

type FormState = {
  name: string; channel: string; status: string;
  leads: string; budget: string; spend: string;
  startDate: string; endDate: string; description: string;
};

const emptyForm: FormState = {
  name: "", channel: "", status: "Planned",
  leads: "", budget: "", spend: "",
  startDate: "", endDate: "", description: "",
};

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

// ── CampaignForm (defined outside page to prevent re-mount on every keystroke) ──
const inputClass = "w-full px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition";
const labelClass = "text-xs text-gray-500 uppercase tracking-widest mb-1 block";

function CampaignForm({ form, setForm, formError, submitting, onSubmit, onCancel, submitLabel, submitCls }: {
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
        <label className={labelClass}>Campaign Name</label>
        <input className={inputClass} placeholder="e.g. Spring Launch" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Channel</label>
          <select className={inputClass} value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
            <option value="">— Select —</option>
            {CHANNELS.map(ch => <option key={ch} value={ch}>{ch}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select className={inputClass} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Leads</label>
          <input className={inputClass} type="text" inputMode="numeric" placeholder="0" value={form.leads}
            onChange={e => setForm(f => ({ ...f, leads: e.target.value.replace(/\D/g, "") }))} />
        </div>
        <div>
          <label className={labelClass}>Budget</label>
          <input className={inputClass} type="text" inputMode="numeric" placeholder="0" value={form.budget}
            onChange={e => setForm(f => ({ ...f, budget: e.target.value.replace(/\D/g, "") }))} />
        </div>
        <div>
          <label className={labelClass}>Spend</label>
          <input className={inputClass} type="text" inputMode="numeric" placeholder="0" value={form.spend}
            onChange={e => setForm(f => ({ ...f, spend: e.target.value.replace(/\D/g, "") }))} />
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

export default function CampaignsPage() {
  const { t } = useLanguage();
  const [campaigns, setCampaigns]     = useState<Campaign[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [filterStatus, setFilter]     = useState("all");
  const [showCreate, setShowCreate]   = useState(false);
  const [showEdit, setShowEdit]       = useState(false);
  const [showDelete, setShowDelete]   = useState(false);
  const [selected, setSelected]       = useState<Campaign | null>(null);
  const [form, setForm]               = useState<FormState>(emptyForm);
  const [submitting, setSubmitting]   = useState(false);
  const [formError, setFormError]     = useState("");

  const card       = "bg-white dark:bg-[#111c35] border border-gray-200 dark:border-[#1b2a6b]/20 rounded-2xl transition-colors duration-300";

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setCampaigns(await campaignService.getAll());
    } catch {} finally { setLoading(false); }
  };

  const filtered = campaigns.filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.channel.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || c.status.toLowerCase() === filterStatus;
    return matchSearch && matchStatus;
  });

  const activeCount    = campaigns.filter(c => c.status === "Active").length;
  const totalLeads     = campaigns.reduce((s, c) => s + (c.leads || 0), 0);
  const totalBudget    = campaigns.reduce((s, c) => s + (c.budget || 0), 0);

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { Active: t("active"), Paused: t("paused"), Planned: t("planned"), Completed: t("completed") };
    return map[s] ?? s;
  };

  const handleCreate = async () => {
    if (!form.name || !form.channel) { setFormError("Name and channel are required"); return; }
    try {
      setSubmitting(true); setFormError("");
      await campaignService.create({
        name: form.name, channel: form.channel as Campaign["channel"],
        status: form.status as Campaign["status"],
        leads: Number(form.leads) || 0, budget: Number(form.budget) || 0, spend: Number(form.spend) || 0,
        startDate: form.startDate, endDate: form.endDate, description: form.description,
      });
      await fetchAll(); setShowCreate(false); setForm(emptyForm);
    } catch (err: any) { setFormError(err.response?.data?.message || "Failed to create"); }
    finally { setSubmitting(false); }
  };

  const openEdit = (c: Campaign) => {
    setSelected(c);
    setForm({ name: c.name, channel: c.channel, status: c.status, leads: String(c.leads || 0),
      budget: String(c.budget || 0), spend: String(c.spend || 0),
      startDate: c.startDate || "", endDate: c.endDate || "", description: c.description || "" });
    setFormError(""); setShowEdit(true);
  };

  const handleEdit = async () => {
    if (!form.name || !form.channel) { setFormError("Name and channel are required"); return; }
    try {
      setSubmitting(true); setFormError("");
      await campaignService.update(selected!._id, {
        name: form.name, channel: form.channel as Campaign["channel"],
        status: form.status as Campaign["status"],
        leads: Number(form.leads) || 0, budget: Number(form.budget) || 0, spend: Number(form.spend) || 0,
        startDate: form.startDate, endDate: form.endDate, description: form.description,
      });
      await fetchAll(); setShowEdit(false);
    } catch (err: any) { setFormError(err.response?.data?.message || "Failed to update"); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    try {
      setSubmitting(true);
      await campaignService.remove(selected!._id);
      await fetchAll(); setShowDelete(false);
    } catch {} finally { setSubmitting(false); }
  };

  const handleExport = async () => {
    if (!campaigns.length) return;
    const headers = ["Name", "Channel", "Status", "Leads", "Budget (TND)", "Spend (TND)", "Start Date", "End Date"];
    const rows = campaigns.map(c => [c.name, c.channel, c.status, c.leads, c.budget, c.spend, c.startDate, c.endDate]);
    await exportBrandedXlsx("Campaigns", headers, rows, `campaigns-${new Date().toISOString().slice(0,10)}.xlsx`);
  };


  return (
    <>
      <div className="min-h-screen bg-gray-100 dark:bg-[#060d1f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight leading-none">
              {t("campaignManagement").split(" ")[0]} <span className="text-[#c8202f]">{t("campaignManagement").split(" ").slice(1).join(" ")}</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">{t("campaignSubtitle")}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleExport} disabled={!campaigns.length}
              className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20 px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed">
              <Download size={13} /> {t("export")}
            </button>
            <button onClick={() => { setForm(emptyForm); setFormError(""); setShowCreate(true); }}
              className="flex items-center gap-2 bg-[#c8202f] hover:bg-[#e02d3c] px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-black font-bold">
              <Plus size={13} /> {t("newCampaign")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: t("totalCampaigns"), value: String(campaigns.length), sub: t("allTime"),   icon: <Megaphone size={14} />,  iconBg: "bg-[#c8202f]/10 text-[#c8202f]" },
            { label: t("activeNow"),      value: String(activeCount),      sub: t("running"),   icon: <Play size={14} />,       iconBg: "bg-blue-500/10 text-blue-400" },
            { label: t("totalLeads"),     value: totalLeads.toLocaleString(),sub: t("generated"), icon: <Users size={14} />,      iconBg: "bg-amber-500/10 text-amber-400" },
            { label: t("totalBudget"),    value: `${totalBudget.toLocaleString()} TND`, sub: t("allocated"), icon: <DollarSign size={14} />, iconBg: "bg-purple-500/10 text-purple-400" },
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
              <h2 className="text-base font-bold text-gray-900 dark:text-white">{t("allCampaigns")}</h2>
              <p className="text-xs text-gray-500">{filtered.length} {t("ofText")} {campaigns.length} {t("campaigns").toLowerCase()}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input className="pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:border-[#c8202f]/40 transition text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                  placeholder={t("searchCampaign")} value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="px-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-600 dark:text-gray-300 focus:outline-none focus:border-[#c8202f]/40 transition"
                value={filterStatus} onChange={e => setFilter(e.target.value)}>
                <option value="all">{t("allStatus")}</option>
                <option value="active">{t("active")}</option>
                <option value="paused">{t("paused")}</option>
                <option value="planned">{t("planned")}</option>
                <option value="completed">{t("completed")}</option>
              </select>
            </div>
          </div>

          <div className="grid px-6 py-3 text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-600 border-b border-gray-100 dark:border-white/[0.04]"
            style={{ gridTemplateColumns: "2fr 1fr 1fr 1.4fr 1fr 1.2fr 90px" }}>
            <span>{t("campaign")}</span><span>{t("channel")}</span><span>{t("leads")}</span>
            <span>{t("budgetCol")}</span><span>{t("spent")}</span><span>{t("status")}</span><span>Actions</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 gap-2"><Loader2 size={16} className="animate-spin" /> Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400 dark:text-gray-600">{t("noCampaignsMatch")}</div>
          ) : (
            filtered.map((c, i) => {
              const sc = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.Planned;
              const ch = CHANNEL_BADGE[c.channel] ?? "bg-gray-500/10 text-gray-400";
              return (
                <motion.div key={c._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                  className={`grid px-6 py-4 items-center hover:bg-gray-50 dark:hover:bg-white/[0.02] transition ${i < filtered.length - 1 ? "border-b border-gray-100 dark:border-white/[0.03]" : ""}`}
                  style={{ gridTemplateColumns: "2fr 1fr 1fr 1.4fr 1fr 1.2fr 90px" }}>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{c.name}</p>
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold w-fit ${ch}`}>{c.channel}</span>
                  <p className="text-xs text-gray-900 dark:text-white font-bold">{c.leads > 0 ? c.leads.toLocaleString() : "—"}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300">{c.budget > 0 ? `${c.budget.toLocaleString()} TND` : "—"}</p>
                  <p className="text-xs text-blue-400 font-bold">{c.spend > 0 ? `${c.spend.toLocaleString()} TND` : "—"}</p>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold w-fit ${sc.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{statusLabel(c.status)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10 transition"><Pencil size={13} /></button>
                    <button onClick={() => { setSelected(c); setShowDelete(true); }} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition"><Trash2 size={13} /></button>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      <AnimatePresence>
        {showCreate && (
          <Modal title={t("newCampaign")} onClose={() => setShowCreate(false)}>
            <CampaignForm form={form} setForm={setForm} formError={formError} submitting={submitting}
              onSubmit={handleCreate} onCancel={() => setShowCreate(false)}
              submitLabel="Create Campaign" submitCls="bg-[#c8202f] hover:bg-[#e02d3c] text-black" />
          </Modal>
        )}
        {showEdit && selected && (
          <Modal title="Edit Campaign" onClose={() => setShowEdit(false)}>
            <CampaignForm form={form} setForm={setForm} formError={formError} submitting={submitting}
              onSubmit={handleEdit} onCancel={() => setShowEdit(false)}
              submitLabel="Save Changes" submitCls="bg-blue-500 hover:bg-blue-400 text-white" />
          </Modal>
        )}
        {showDelete && selected && (
          <Modal title="Delete Campaign" onClose={() => setShowDelete(false)}>
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