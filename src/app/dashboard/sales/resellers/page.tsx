"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Plus, Search, Star, TrendingUp, ShoppingBag,
  Clock, CheckCircle, XCircle, X, Loader2, Eye,
  ChevronRight, ShieldCheck, ShieldOff, RefreshCw,
  Building2, Mail, Phone, MapPin, Tag, CreditCard, Trash2
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import api from "@/services/api";
import PhoneInput from "@/components/PhoneInput";
import AddressInput from "@/components/AddressInput";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Reseller {
  _id: string; name: string; email: string; phone: string;
  company: string; address: string; country: string; taxId: string;
  discountPct: number; creditLimit: number; paymentTerms: string;
  status: "pending" | "active" | "suspended";
  totalOrders: number; totalRevenue: number; lastOrderAt: string | null;
  notes: string; createdAt: string;
}
interface ResellerRequest {
  _id: string; requestNo: string; status: "pending" | "approved" | "rejected" | "fulfilled";
  resellerId: { _id: string; name: string; company: string; email: string; discountPct: number };
  lines: { productId: any; productName: string; sku: string; quantity: number; unitPrice: number; listPrice: number }[];
  subtotal: number; discountPct: number; totalAmount: number;
  notes: string; adminNotes: string; createdAt: string;
}
interface Stats {
  total: number;
  statusMap: { pending: number; active: number; suspended: number };
  topReseller: { name: string; company: string; totalRevenue: number; totalOrders: number } | null;
  totalResellerRevenue: number;
  pendingRequests: number;
}

const resellerApi = {
  getStats: ()                         => api.get("/online-sales/resellers/stats").then(r => r.data as Stats),
  getAll:   (params?: any)             => api.get("/online-sales/resellers", { params }).then(r => r.data as Reseller[]),
  create:   (body: any)                => api.post("/online-sales/resellers", body).then(r => r.data),
  update:   (id: string, body: any)    => api.patch(`/online-sales/resellers/${id}`, body).then(r => r.data),
  setStatus:(id: string, status: string) => api.patch(`/online-sales/resellers/${id}/status`, { status }).then(r => r.data),
  remove:   (id: string)               => api.delete(`/online-sales/resellers/${id}`),
  resetPassword: (id: string, newPassword: string) =>
    api.patch(`/online-sales/resellers/${id}/reset-password`, { newPassword }).then(r => r.data),
  getRequests: (params?: any)          => api.get("/online-sales/resellers/requests/all", { params }).then(r => r.data as ResellerRequest[]),
  updateRequest: (requestId: string, body: any) =>
    api.patch(`/online-sales/resellers/requests/${requestId}/status`, body).then(r => r.data),
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtTND = (n: number) => {
  const parts = n.toFixed(3).split(".");
  return parseInt(parts[0]).toLocaleString("en-US") + "." + parts[1] + " TND";
};
const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const STATUS_BADGE: Record<string, string> = {
  pending:   "bg-amber-500/15 text-amber-400 border border-amber-500/20",
  active:    "bg-[#c8202f]/15 text-[#c8202f] border border-[#c8202f]/20",
  suspended: "bg-red-500/15 text-red-400 border border-red-500/20",
};
const REQ_BADGE: Record<string, string> = {
  pending:   "bg-amber-500/15 text-amber-400",
  approved:  "bg-blue-500/15 text-blue-400",
  rejected:  "bg-red-500/15 text-red-400",
  fulfilled: "bg-[#c8202f]/15 text-[#c8202f]",
};

const AVATAR_COLORS = [
  "bg-[#c8202f]/20 text-[#c8202f]","bg-blue-500/20 text-blue-400",
  "bg-purple-500/20 text-purple-400","bg-amber-500/20 text-amber-400",
  "bg-pink-500/20 text-pink-400","bg-teal-500/20 text-teal-400",
];

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className={`bg-white dark:bg-[#111c35] border border-gray-200 dark:border-white/10 rounded-2xl ${wide ? "w-full max-w-2xl" : "w-full max-w-lg"} p-6 shadow-2xl max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition"><X size={18} /></button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ResellersPage() {
  const { t } = useLanguage();

  const [tab, setTab]             = useState<"resellers" | "requests">("resellers");
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [requests, setRequests]   = useState<ResellerRequest[]>([]);
  const [stats, setStats]         = useState<Stats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatus] = useState("all");
  const [reqFilter, setReqFilter] = useState("all");
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId]   = useState<string | null>(null);
  const [error, setError]         = useState("");

  // Modals
  const [showCreate, setShowCreate]     = useState(false);
  const [showDetail, setShowDetail]     = useState<Reseller | null>(null);
  const [showReqDetail, setShowReqDetail] = useState<ResellerRequest | null>(null);

  const emptyForm = {
    name: "", phone: "", company: "", address: "",
    country: "", taxId: "", discountPct: 10, creditLimit: 0,
    paymentTerms: "cash", notes: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [generatedPwd, setGeneratedPwd]     = useState("");
  const [generatedEmail, setGeneratedEmail] = useState("");

  const card = "bg-white dark:bg-[#111c35] border border-[#1b2a6b]/15 dark:border-[#1b2a6b]/20 border-t-2 border-t-[#c8202f] rounded-2xl hover:shadow-[0_0_20px_#c8202f10]";
  const inputCls = "w-full px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition";
  const labelCls = "text-xs text-gray-500 uppercase tracking-widest mb-1 block";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, req, s] = await Promise.all([
        resellerApi.getAll({ search, status: statusFilter }),
        resellerApi.getRequests({ status: reqFilter }),
        resellerApi.getStats(),
      ]);
      setResellers(r);
      setRequests(req);
      setStats(s);
    } catch (e: any) { setError(e.response?.data?.message || "Failed to load"); }
    finally { setLoading(false); }
  }, [search, statusFilter, reqFilter]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (form.taxId && !/^\d{7}[A-Z]\/[A-D]\/[MNPT]\d{3}$/.test(form.taxId)) {
      setError("Invalid matricule fiscale — expected format: 1234567A/B/M000");
      return;
    }
    setSubmitting(true); setError("");
    try {
      const res = await resellerApi.create({ ...form });
      // Backend auto-generates email and password — show them once
      setGeneratedPwd(res.plainPassword || "");
      setGeneratedEmail(res.email || "");
      await load();
      setForm(emptyForm);
      setShowCreate(false);
    } catch (e: any) { setError(e.response?.data?.message || "Failed to create"); }
    finally { setSubmitting(false); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    setActingId(id);
    try { await resellerApi.setStatus(id, status); await load(); }
    catch (e: any) { setError(e.response?.data?.message || "Failed"); }
    finally { setActingId(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this reseller and all their requests?")) return;
    setActingId(id);
    try { await resellerApi.remove(id); await load(); }
    catch (e: any) { setError(e.response?.data?.message || "Failed"); }
    finally { setActingId(null); }
  };

  const handleResetPassword = async (reseller: Reseller) => {
    const newPwd = Math.random().toString(36).slice(2, 10).padEnd(8, "x");
    setActingId(reseller._id);
    try {
      await resellerApi.resetPassword(reseller._id, newPwd);
      setGeneratedPwd(newPwd);
      setGeneratedEmail(reseller.email);
      setShowDetail(null);
    } catch (e: any) { setError(e.response?.data?.message || "Failed to reset password"); }
    finally { setActingId(null); }
  };

  const handleRequestAction = async (requestId: string, status: string, adminNotes = "") => {
    setActingId(requestId);
    try { await resellerApi.updateRequest(requestId, { status, adminNotes }); await load(); setShowReqDetail(null); }
    catch (e: any) { setError(e.response?.data?.message || "Failed"); }
    finally { setActingId(null); }
  };

  const filtered = resellers.filter(r => {
    const q = search.toLowerCase();
    return ((r.name || "").toLowerCase().includes(q) || (r.email || "").toLowerCase().includes(q) || (r.company || "").toLowerCase().includes(q))
      && (statusFilter === "all" || r.status === statusFilter);
  });

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "SALES_MANAGER"]}>
      <div className="min-h-screen bg-[#f0f4ff] dark:bg-[#060d1f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight leading-none">
              Resellers <span className="text-[#c8202f]">Portal</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">EMM ERP — Online Sales</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => load()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-white/20 transition disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button onClick={() => { setForm(emptyForm); setGeneratedPwd(""); setError(""); setShowCreate(true); }}
              className="flex items-center gap-2 bg-[#c8202f] hover:bg-[#e02d3c] px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-white font-bold">
              <Plus size={13} /> New Reseller
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
            <button onClick={() => setError("")}><X size={14} /></button>
          </div>
        )}

        {/* KPI Cards */}
        {stats && (
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { label: "Total Resellers",   value: String(stats.total),                  sub: `${stats.statusMap.active} active`,     icon: <Users size={16} />,       iconBg: "bg-[#c8202f]/10 text-[#c8202f]", valueColor: "text-[#c8202f]" },
              { label: "Pending Requests",  value: String(stats.pendingRequests),         sub: "awaiting review",                      icon: <Clock size={16} />,       iconBg: "bg-amber-500/10 text-amber-400",   valueColor: "text-amber-400"   },
              { label: "Reseller Revenue",  value: fmtTND(stats.totalResellerRevenue),   sub: "cumulative",                           icon: <TrendingUp size={16} />,  iconBg: "bg-blue-500/10 text-blue-400",    valueColor: "text-blue-400"    },
              { label: "Top Reseller",
                value: stats.topReseller ? stats.topReseller.name.split(" ")[0] : "—",
                sub: stats.topReseller ? fmtTND(stats.topReseller.totalRevenue) : "No data yet",
                icon: <Star size={16} />, iconBg: "bg-purple-500/10 text-purple-400", valueColor: "text-purple-400" },
            ].map((kpi, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                className={`${card} p-5 flex items-center gap-4`}>
                <div className={`p-3 rounded-xl ${kpi.iconBg}`}>{kpi.icon}</div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-widest text-gray-500">{kpi.label}</p>
                  <p className={`text-2xl font-bold tracking-tight mt-0.5 truncate ${kpi.valueColor}`}>{kpi.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{kpi.sub}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className={`${card} overflow-hidden`}>
          <div className="flex border-b border-gray-100 dark:border-white/[0.05]">
            {(["resellers", "requests"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-6 py-4 text-xs uppercase tracking-widest font-bold transition ${tab === t ? "text-[#c8202f] border-b-2 border-[#c8202f]" : "text-gray-500 hover:text-gray-300"}`}>
                {t === "resellers" ? `Resellers (${resellers.length})` : `Purchase Requests (${requests.filter(r => r.status === "pending").length} pending)`}
              </button>
            ))}
          </div>

          {/* ── RESELLERS TAB ── */}
          {tab === "resellers" && (
            <>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-6 py-4 border-b border-gray-100 dark:border-white/[0.05]">
                <div className="relative">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input className="pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:border-[#c8202f]/40 transition text-gray-900 dark:text-white placeholder-gray-400"
                    placeholder="Search resellers…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="px-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg text-xs text-gray-600 dark:text-gray-300 focus:outline-none focus:border-[#c8202f]/40 transition"
                  value={statusFilter} onChange={e => setStatus(e.target.value)}>
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              {/* Table header */}
              <div className="grid px-6 py-3 text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-600 border-b border-gray-100 dark:border-white/[0.04]"
                style={{ gridTemplateColumns: "2.5fr 2fr 1.2fr 1fr 1fr 1fr 120px" }}>
                <span>Reseller</span><span>Company / Country</span><span>Discount</span>
                <span>Orders</span><span>Revenue</span><span>Status</span><span>Actions</span>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-400"><Loader2 size={16} className="animate-spin" /> Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-500">No resellers found</div>
              ) : (
                filtered.map((r, i) => (
                  <motion.div key={r._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className={`grid px-6 py-4 items-center hover:bg-gray-50 dark:hover:bg-white/[0.02] transition ${i < filtered.length - 1 ? "border-b border-gray-100 dark:border-white/[0.03]" : ""}`}
                    style={{ gridTemplateColumns: "2.5fr 2fr 1.2fr 1fr 1fr 1fr 120px" }}>

                    <button className="flex items-center gap-3 text-left group" onClick={() => setShowDetail(r)}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                        {r.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-[#c8202f] transition flex items-center gap-1">
                          {r.name} <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition" />
                        </p>
                        <p className="text-[10px] text-gray-400">{r.email || "—"}</p>
                      </div>
                    </button>

                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">{r.company || "—"}</p>
                      <p className="text-[10px] text-gray-400">{r.country || "—"}</p>
                    </div>

                    <span className="text-sm font-bold text-[#c8202f]">{r.discountPct}%</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">{r.totalOrders}</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{fmtTND(r.totalRevenue)}</span>

                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold w-fit ${STATUS_BADGE[r.status]}`}>
                      {r.status}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {r.status === "pending" && (
                        <button onClick={() => handleStatusChange(r._id, "active")} disabled={actingId === r._id}
                          className="p-1.5 rounded-lg text-[#c8202f] hover:bg-[#c8202f]/10 transition" title="Approve">
                          {actingId === r._id ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
                        </button>
                      )}
                      {r.status === "active" && (
                        <button onClick={() => handleStatusChange(r._id, "suspended")} disabled={actingId === r._id}
                          className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10 transition" title="Suspend">
                          <ShieldOff size={13} />
                        </button>
                      )}
                      {r.status === "suspended" && (
                        <button onClick={() => handleStatusChange(r._id, "active")} disabled={actingId === r._id}
                          className="p-1.5 rounded-lg text-[#c8202f] hover:bg-[#c8202f]/10 transition" title="Reactivate">
                          <ShieldCheck size={13} />
                        </button>
                      )}
                      <button onClick={() => setShowDetail(r)}
                        className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10 transition" title="View profile">
                        <Eye size={13} />
                      </button>
                      <button onClick={() => handleDelete(r._id)} disabled={actingId === r._id}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </>
          )}

          {/* ── REQUESTS TAB ── */}
          {tab === "requests" && (
            <>
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-100 dark:border-white/[0.05]">
                <p className="text-xs text-gray-500">{requests.length} total requests</p>
                <select className="px-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg text-xs text-gray-600 dark:text-gray-300 focus:outline-none focus:border-[#c8202f]/40 transition"
                  value={reqFilter} onChange={e => setReqFilter(e.target.value)}>
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="fulfilled">Fulfilled</option>
                </select>
              </div>

              <div className="grid px-6 py-3 text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-600 border-b border-gray-100 dark:border-white/[0.04]"
                style={{ gridTemplateColumns: "1fr 2fr 2fr 1fr 1fr 1fr 100px" }}>
                <span>Ref.</span><span>Reseller</span><span>Products</span>
                <span>Discount</span><span>Total</span><span>Status</span><span>Actions</span>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-400"><Loader2 size={16} className="animate-spin" /> Loading…</div>
              ) : requests.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-500">No purchase requests yet</div>
              ) : (
                requests.map((req, i) => (
                  <div key={req._id}
                    className={`grid px-6 py-4 items-center hover:bg-gray-50 dark:hover:bg-white/[0.02] transition ${i < requests.length - 1 ? "border-b border-gray-100 dark:border-white/[0.03]" : ""}`}
                    style={{ gridTemplateColumns: "1fr 2fr 2fr 1fr 1fr 1fr 100px" }}>

                    <p className="text-xs font-bold text-[#c8202f] font-mono">{req.requestNo}</p>

                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">{req.resellerId?.name || "—"}</p>
                      <p className="text-[10px] text-gray-400">{req.resellerId?.company || ""}</p>
                    </div>

                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {req.lines.map(l => `${l.productName} ×${l.quantity}`).join(", ")}
                    </p>

                    <span className="text-sm font-bold text-[#c8202f]">{req.discountPct}%</span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white">{fmtTND(req.totalAmount)}</span>

                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold w-fit ${REQ_BADGE[req.status]}`}>
                      {req.status}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setShowReqDetail(req)}
                        className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10 transition"><Eye size={13} /></button>
                      {req.status === "pending" && (
                        <>
                          <button onClick={() => handleRequestAction(req._id, "approved")} disabled={actingId === req._id}
                            className="p-1.5 rounded-lg text-[#c8202f] hover:bg-[#c8202f]/10 transition" title="Approve">
                            {actingId === req._id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                          </button>
                          <button onClick={() => handleRequestAction(req._id, "rejected")} disabled={actingId === req._id}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition" title="Reject">
                            <XCircle size={13} />
                          </button>
                        </>
                      )}
                      {req.status === "approved" && (
                        <button onClick={() => handleRequestAction(req._id, "fulfilled")} disabled={actingId === req._id}
                          className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#c8202f]/10 text-[#c8202f] hover:bg-[#c8202f]/20 transition">
                          Fulfill
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ── CREATE RESELLER MODAL ── */}
        {showCreate ? (
          <Modal key="modal-create" title="New Reseller Account" onClose={() => setShowCreate(false)} wide>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* Name */}
                <div>
                  <label className={labelCls}>Full Name *</label>
                  <input className={inputCls} placeholder="Ahmed Ben Ali"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>

                {/* Phone with country-code selector */}
                <div>
                  <label className={labelCls}>Phone</label>
                  <PhoneInput
                    value={form.phone}
                    onChange={phone => setForm(f => ({ ...f, phone }))}
                  />
                </div>

                {/* Company */}
                <div>
                  <label className={labelCls}>Company</label>
                  <input className={inputCls} placeholder="Ben Ali SARL"
                    value={form.company}
                    onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
                </div>

                {/* Address with OpenStreetMap autocomplete — auto-extracts country */}
                <div className="col-span-2">
                  <label className={labelCls}>
                    Address
                    {form.country && (
                      <span className="ml-2 normal-case tracking-normal font-normal text-[#c8202f]">
                        · {form.country}
                      </span>
                    )}
                  </label>
                  <AddressInput
                    value={form.address}
                    onChange={address => {
                      // Auto-extract country from the last part of the address string
                      // OpenStreetMap returns addresses like "City, Region, Country"
                      const parts = address.split(",").map((p: string) => p.trim()).filter(Boolean);
                      const country = parts.length > 0 ? parts[parts.length - 1] : "";
                      setForm(f => ({ ...f, address, country }));
                    }}
                  />
                </div>

                {/* Tax ID with format validation */}
                <div>
                  <label className={labelCls}>
                    MF
                    <span className="ml-2 text-gray-600 dark:text-gray-500 normal-case tracking-normal font-normal">
                      e.g. 1234567A/B/M000
                    </span>
                  </label>
                  <input
                    className={`${inputCls} font-mono tracking-wider ${
                      form.taxId && !/^\d{7}[A-Z]\/[A-D]\/[MNPT]\d{3}$/.test(form.taxId)
                        ? "border-red-500/60 focus:border-red-500/80"
                        : form.taxId && /^\d{7}[A-Z]\/[A-D]\/[MNPT]\d{3}$/.test(form.taxId)
                        ? "border-[#c8202f]/60 focus:border-[#c8202f]/80"
                        : ""
                    }`}
                    placeholder="ex: 1234567A/B/M000"
                    value={form.taxId}
                    maxLength={15}
                    onChange={e => {
                      // Strip everything except digits, letters, slashes — uppercase
                      const raw = e.target.value.toUpperCase().replace(/[^0-9A-Z\/]/g, "");
                      // Remove existing slashes to work with raw chars only
                      // Format: 7 digits + 1 letter + 1 category + 1 type + 3 digits = 12 raw chars
                      const chars = raw.replace(/\//g, "").slice(0, 13);
                      let out = chars;
                      if (chars.length > 9) {
                        // Have all 3 sections: DDDDDDDL / C / Tddd
                        out = chars.slice(0, 8) + "/" + chars.slice(8, 9) + "/" + chars.slice(9, 13);
                      } else if (chars.length > 8) {
                        // Have first slash only: DDDDDDDL / C
                        out = chars.slice(0, 8) + "/" + chars.slice(8, 9);
                      }
                      setForm(f => ({ ...f, taxId: out }));
                    }}
                  />
                  {form.taxId && !/^\d{7}[A-Z]\/[A-D]\/[MNPT]\d{3}$/.test(form.taxId) && (
                    <p className="text-[10px] text-red-400 mt-1">
                      Expected: 7 digits, 1 letter, /A–D, /M or N or P or T, 3 digits
                    </p>
                  )}
                  {form.taxId && /^\d{7}[A-Z]\/[A-D]\/[MNPT]\d{3}$/.test(form.taxId) && (
                    <p className="text-[10px] text-[#c8202f] mt-1">Valid matricule fiscale ✓</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Discount %</label>
                  <input type="text" inputMode="numeric" className={inputCls}
                    value={form.discountPct}
                    onChange={e => setForm(f => ({ ...f, discountPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))} />
                </div>
                <div>
                  <label className={labelCls}>Credit Limit (TND)</label>
                  <input type="text" inputMode="numeric" className={inputCls}
                    value={form.creditLimit}
                    onChange={e => setForm(f => ({ ...f, creditLimit: Number(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className={labelCls}>Payment Terms</label>
                  <select className={inputCls} value={form.paymentTerms}
                    onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))}>
                    {["cash", "30j", "60j", "90j"].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Notes</label>
                <textarea rows={2} className={`${inputCls} resize-none`}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition">
                  Cancel
                </button>
                <button onClick={handleCreate} disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#c8202f] hover:bg-[#e02d3c] text-white font-bold text-xs transition disabled:opacity-60">
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Create Reseller
                </button>
              </div>
            </div>
          </Modal>
        ) : null}

        {/* ── GENERATED PASSWORD TOAST ── */}
        {generatedPwd ? (
          <Modal key="modal-credentials" title="Reseller Account Created" onClose={() => { setGeneratedPwd(""); setGeneratedEmail(""); }}>
            <div className="space-y-4">
              <p className="text-xs text-gray-500 text-center">
                Share these credentials with the reseller. They will not be shown again.
              </p>
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Portal Login Email</p>
                  <p className="text-lg font-bold text-blue-400 font-mono">{generatedEmail}</p>
                </div>
                <div className="p-4 rounded-xl bg-[#c8202f]/10 border border-[#c8202f]/20">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Portal Login Password (shown once)</p>
                  <p className="text-2xl font-bold text-[#c8202f] font-mono tracking-widest">{generatedPwd}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => navigator.clipboard.writeText(generatedEmail)}
                  className="flex-1 px-4 py-2 rounded-xl border border-blue-500/30 text-blue-400 text-xs font-bold hover:bg-blue-500/10 transition">
                  Copy Email
                </button>
                <button onClick={() => navigator.clipboard.writeText(`Email: ${generatedEmail}
Password: ${generatedPwd}`)}
                  className="flex-1 px-4 py-2 rounded-xl bg-[#c8202f] hover:bg-[#e02d3c] text-white text-xs font-bold transition">
                  Copy Both
                </button>
              </div>
            </div>
          </Modal>
        ) : null}

        {/* ── RESELLER PROFILE MODAL ── */}
        {showDetail ? (
          <Modal key={`modal-detail-${showDetail._id}`} title="Reseller Profile" onClose={() => setShowDetail(null)} wide>
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#c8202f]/20 text-[#c8202f] flex items-center justify-center text-xl font-bold flex-shrink-0">
                  {showDetail.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white">{showDetail.name}</h4>
                  <p className="text-sm text-gray-500">{showDetail.company || "—"}</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold mt-1 ${STATUS_BADGE[showDetail.status]}`}>
                    {showDetail.status}
                  </span>
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: <Mail size={12} />,     label: "Email",        value: showDetail.email },
                  { icon: <Phone size={12} />,    label: "Phone",        value: showDetail.phone || "—" },
                  { icon: <MapPin size={12} />,   label: "Address",      value: `${showDetail.address || "—"} ${showDetail.country ? `· ${showDetail.country}` : ""}` },
                  { icon: <Building2 size={12} />,label: "Tax ID",       value: showDetail.taxId || "—" },
                  { icon: <Tag size={12} />,      label: "Discount",     value: `${showDetail.discountPct}%` },
                  { icon: <CreditCard size={12}/>,label: "Credit Limit", value: fmtTND(showDetail.creditLimit) },
                  { icon: <ShoppingBag size={12}/>,label:"Orders",       value: String(showDetail.totalOrders) },
                  { icon: <TrendingUp size={12}/>,label: "Revenue",      value: fmtTND(showDetail.totalRevenue) },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
                    <span className="text-gray-400 mt-0.5">{item.icon}</span>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">{item.label}</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-[#c8202f]/5 border border-[#c8202f]/20">
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">Last Order</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{fmtDate(showDetail.lastOrderAt)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">Payment</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{showDetail.paymentTerms}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">Member Since</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{fmtDate(showDetail.createdAt)}</p>
                </div>
              </div>

              {showDetail.notes && (
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] text-xs text-gray-500">{showDetail.notes}</div>
              )}

              {/* Recent requests for this reseller */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Purchase History</p>
                {requests.filter(r => r.resellerId?._id === showDetail._id).slice(0, 5).map(req => (
                  <div key={req._id} className="py-2 border-b border-gray-100 dark:border-white/[0.04]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-[#c8202f] font-mono">{req.requestNo}</p>
                        <p className="text-[10px] text-gray-400">{fmtDate(req.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-gray-900 dark:text-white">{fmtTND(req.totalAmount)}</p>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${REQ_BADGE[req.status]}`}>{req.status}</span>
                      </div>
                    </div>
                    {/* Inline action buttons for pending/approved requests */}
                    {req.status === "pending" && (
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleRequestAction(req._id, "approved")}
                          disabled={actingId === req._id}
                          className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-[#c8202f]/10 text-[#c8202f] border border-[#c8202f]/20 text-[10px] font-bold hover:bg-[#c8202f]/20 transition disabled:opacity-60"
                        >
                          {actingId === req._id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                          Approve
                        </button>
                        <button
                          onClick={() => handleRequestAction(req._id, "rejected")}
                          disabled={actingId === req._id}
                          className="flex-1 flex items-center justify-center gap-1 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold hover:bg-red-500/20 transition disabled:opacity-60"
                        >
                          <XCircle size={10} /> Reject
                        </button>
                      </div>
                    )}
                    {req.status === "approved" && (
                      <div className="mt-2">
                        <button
                          onClick={() => handleRequestAction(req._id, "fulfilled")}
                          disabled={actingId === req._id}
                          className="w-full flex items-center justify-center gap-1 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold hover:bg-blue-500/20 transition disabled:opacity-60"
                        >
                          {actingId === req._id ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle size={10} />}
                          Mark as Fulfilled → creates order
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {requests.filter(r => r.resellerId?._id === showDetail._id).length === 0 && (
                  <p className="text-xs text-gray-400 py-2">No requests yet</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                {showDetail.status === "pending" && (
                  <button onClick={() => { handleStatusChange(showDetail._id, "active"); setShowDetail(null); }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#c8202f] hover:bg-[#e02d3c] text-white font-bold text-xs transition">
                    <ShieldCheck size={13} /> Approve Account
                  </button>
                )}
                {showDetail.status === "active" && (
                  <button onClick={() => { handleStatusChange(showDetail._id, "suspended"); setShowDetail(null); }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs transition">
                    <ShieldOff size={13} /> Suspend
                  </button>
                )}
                {showDetail.status === "suspended" && (
                  <button onClick={() => { handleStatusChange(showDetail._id, "active"); setShowDetail(null); }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#c8202f] hover:bg-[#e02d3c] text-white font-bold text-xs transition">
                    <ShieldCheck size={13} /> Reactivate
                  </button>
                )}
                <button onClick={() => setShowDetail(null)}
                  className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition">
                  Close
                </button>
              </div>
              {/* Reset password — shown separately so it's always visible */}
              <button
                onClick={() => handleResetPassword(showDetail)}
                disabled={actingId === showDetail._id}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition disabled:opacity-60"
              >
                {actingId === showDetail._id
                  ? <Loader2 size={13} className="animate-spin" />
                  : <RefreshCw size={13} />
                }
                Reset Portal Password
              </button>
            </div>
          </Modal>
        ) : null}

        {/* ── REQUEST DETAIL MODAL ── */}
        {showReqDetail ? (
          <Modal key={`modal-req-${showReqDetail._id}`} title={`Request ${showReqDetail.requestNo}`} onClose={() => setShowReqDetail(null)} wide>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03]">
                <div>
                  <p className="text-xs font-bold text-gray-900 dark:text-white">{showReqDetail.resellerId?.name}</p>
                  <p className="text-[10px] text-gray-400">{showReqDetail.resellerId?.company} · {showReqDetail.resellerId?.discountPct}% discount</p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${REQ_BADGE[showReqDetail.status]}`}>
                  {showReqDetail.status}
                </span>
              </div>

              {/* Lines */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Order Lines</p>
                <div className="space-y-2">
                  {showReqDetail.lines.map((l, i) => (
                    <div key={i} className="grid text-xs gap-2 py-2 border-b border-gray-100 dark:border-white/[0.04]"
                      style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr" }}>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{l.productName}</p>
                        <p className="text-gray-400 font-mono">{l.sku}</p>
                      </div>
                      <p className="text-gray-500">Qty: <span className="font-bold text-gray-900 dark:text-white">{l.quantity}</span></p>
                      <p className="text-gray-500">List: <span className="font-bold">{l.listPrice.toFixed(3)}</span></p>
                      <p className="text-[#c8202f] font-bold">{l.unitPrice.toFixed(3)} TND</p>
                      <p className="font-bold text-gray-900 dark:text-white">{(l.unitPrice * l.quantity).toFixed(3)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.03] space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Subtotal (list price)</span>
                  <span className="font-bold">{fmtTND(showReqDetail.subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#c8202f]">Reseller discount ({showReqDetail.discountPct}%)</span>
                  <span className="text-[#c8202f] font-bold">-{fmtTND(showReqDetail.subtotal - showReqDetail.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-1 border-t border-gray-200 dark:border-white/10">
                  <span>Total</span>
                  <span className="text-[#c8202f]">{fmtTND(showReqDetail.totalAmount)}</span>
                </div>
              </div>

              {showReqDetail.notes && (
                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-gray-500">
                  <span className="font-bold text-blue-400">Note: </span>{showReqDetail.notes}
                </div>
              )}

              {showReqDetail.status === "pending" && (
                <div className="flex gap-3">
                  <button onClick={() => handleRequestAction(showReqDetail._id, "rejected")}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 text-xs transition">
                    <XCircle size={13} /> Reject
                  </button>
                  <button onClick={() => handleRequestAction(showReqDetail._id, "approved")}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#c8202f] hover:bg-[#e02d3c] text-white font-bold text-xs transition">
                    <CheckCircle size={13} /> Approve
                  </button>
                </div>
              )}
              {showReqDetail.status === "approved" && (
                <button onClick={() => handleRequestAction(showReqDetail._id, "fulfilled")}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#c8202f] hover:bg-[#e02d3c] text-white font-bold text-xs transition">
                  Mark as Fulfilled
                </button>
              )}
            </div>
          </Modal>
        ) : null}
      </AnimatePresence>
    </ProtectedRoute>
  );
}