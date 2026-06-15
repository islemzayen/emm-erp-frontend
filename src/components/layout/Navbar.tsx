"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun, Moon, User, Settings, LogOut, HelpCircle, ChevronUp,
  Bell, Trash2, Check, X, Clock, UserCheck, UserX, Users, Banknote,
} from "lucide-react";
import deleteRequestService, { DeleteRequest } from "@/services/deleteRequestService";
import api from "@/services/api";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PendingManager {
  _id: string; name: string; email: string;
  role: string; department: string; position: string; createdAt: string;
}
interface SystemNotif {
  _id: string;
  type: "ACCOUNT_APPROVED" | "ACCOUNT_REJECTED" | "PAYROLL_READY";
  message: string; targetName: string; actorName: string;
  read: boolean; createdAt: string;
}

const MANAGER_ROLES = [
  "HR_MANAGER","MARKETING_MANAGER","SALES_MANAGER",
  "COMMERCIAL_MANAGER","FINANCE_MANAGER","STOCK_MANAGER",
  "PURCHASE_MANAGER","DEPOT_MANAGER","WAREHOUSE_OPERATOR",
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const router = useRouter();
  const [open, setOpen]     = useState(false);
  const [isDark, setIsDark] = useState(true);
  const dropdownRef         = useRef<HTMLDivElement>(null);

  // ── Admin bell (delete requests + pending manager approvals) ──────────────
  const [bellOpen, setBellOpen]                 = useState(false);
  const [pendingRequests, setPendingRequests]   = useState<DeleteRequest[]>([]);
  const [pendingCount, setPendingCount]         = useState(0);
  const [pendingManagers, setPendingManagers]   = useState<PendingManager[]>([]);
  const [managersCount, setManagersCount]       = useState(0);
  const [approving, setApproving]               = useState<string | null>(null);
  const [adminTab, setAdminTab]                 = useState<"delete" | "managers">("managers");
  const bellRef = useRef<HTMLDivElement>(null);

  // ── HR / Manager bell (delete codes + account status notifications) ────────
  const [hrBellOpen, setHrBellOpen]     = useState(false);
  const [hrApproved, setHrApproved]     = useState<DeleteRequest[]>([]);
  const [sysNotifs, setSysNotifs]       = useState<SystemNotif[]>([]);
  const hrBellRef = useRef<HTMLDivElement>(null);
  const [seenManagerCount, setSeenManagerCount] = useState(0);

  const isAdmin   = user?.role === "ADMIN";
  const isManager = user?.role ? MANAGER_ROLES.includes(user.role) : false;

  // ── Theme ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light") { document.documentElement.classList.remove("dark"); setIsDark(false); }
    else { document.documentElement.classList.add("dark"); setIsDark(true); }
  }, []);

  // ── Admin: poll delete requests count every 30s ───────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    const fetch = async () => {
      try { setPendingCount(await deleteRequestService.getPendingCount()); } catch {}
    };
    fetch();
    const id = setInterval(fetch, 30000);
    return () => clearInterval(id);
  }, [isAdmin]);

  // ── Admin: poll pending manager accounts every 30s ────────────────────────
  useEffect(() => {
    if (!isAdmin) return;
    const fetch = async () => {
      try {
        const { data } = await api.get("/notifications/pending-managers");
        const list = Array.isArray(data) ? data : (data?.data ?? []);
        setManagersCount(list.length);
        setPendingManagers(list);
      } catch {}
    };
    fetch();
    const id = setInterval(fetch, 30000);
    return () => clearInterval(id);
  }, [isAdmin]);

  // ── Admin: load full delete requests when bell opens ─────────────────────
  useEffect(() => {
    if (!bellOpen || !isAdmin) return;
    deleteRequestService.getPending().then(setPendingRequests).catch(() => {});
  }, [bellOpen, isAdmin]);

  // ── Manager: poll delete codes every 15s ─────────────────────────────────
  useEffect(() => {
    if (!isManager) return;
    const fetch = async () => {
      try { setHrApproved(await deleteRequestService.getMyApproved()); } catch {}
    };
    fetch();
    const id = setInterval(fetch, 15000);
    return () => clearInterval(id);
  }, [isManager]);

  // ── Manager: poll account status notifications every 20s ──────────────────
  useEffect(() => {
    if (!isManager) return;
    const fetch = async () => {
      try {
        const { data } = await api.get("/notifications/my");
        const list = Array.isArray(data) ? data : (data?.data ?? []);
        setSysNotifs(list);
      } catch {}
    };
    fetch();
    const id = setInterval(fetch, 20000);
    return () => clearInterval(id);
  }, [isManager]);

  // ── Outside click ─────────────────────────────────────────────────────────
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
      if (hrBellRef.current && !hrBellRef.current.contains(e.target as Node)) setHrBellOpen(false);
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const toggleTheme = () => {
    if (isDark) { document.documentElement.classList.remove("dark"); localStorage.setItem("theme","light"); setIsDark(false); }
    else { document.documentElement.classList.add("dark"); localStorage.setItem("theme","dark"); setIsDark(true); }
  };

  const handleLogout = () => { logout(); router.replace("/login"); };

  // ── Admin: approve/reject delete requests ────────────────────────────────
  async function handleApprove(id: string) {
    setApproving(id);
    try {
      await deleteRequestService.approve(id);
      setPendingRequests(prev => prev.filter(r => r._id !== id));
      setPendingCount(c => Math.max(0, c - 1));
    } catch {} finally { setApproving(null); }
  }

  async function handleReject(id: string) {
    setApproving(id);
    try {
      await deleteRequestService.reject(id);
      setPendingRequests(prev => prev.filter(r => r._id !== id));
      setPendingCount(c => Math.max(0, c - 1));
    } catch {} finally { setApproving(null); }
  }

  // ── Admin: approve manager account from bell ──────────────────────────────
  async function handleApproveManager(id: string) {
    setApproving(id);
    try {
      await api.post(`/hr/employees/${id}/approve`);
      setPendingManagers(prev => prev.filter(m => m._id !== id));
      setManagersCount(c => Math.max(0, c - 1));
    } catch (e: any) {
      alert(e?.response?.data?.message || "Failed to approve account");
    } finally { setApproving(null); }
  }

  async function handleRejectManager(id: string) {
    setApproving(id);
    try {
      await api.delete(`/hr/employees/${id}/reject`);
      setPendingManagers(prev => prev.filter(m => m._id !== id));
      setManagersCount(c => Math.max(0, c - 1));
    } catch {} finally { setApproving(null); }
  }

  // ── Manager: dismiss delete code ─────────────────────────────────────────
  async function handleDismissCode(id: string) {
    try {
      await deleteRequestService.markSeen(id);
      setHrApproved(prev => prev.filter(r => r._id !== id));
    } catch {}
  }

  // ── Manager: dismiss account status notification ──────────────────────────
  async function handleDismissNotif(id: string) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setSysNotifs(prev => prev.filter(n => n._id !== id));
      setSeenManagerCount(prev => Math.max(0, prev - 1));
    } catch {}
  }

  const totalAdminBadge  = pendingCount + managersCount;
  const totalManagerBadge = hrApproved.length + sysNotifs.length;

  const getInitials = (name?: string) => name ? name.split(" ").map(p => p[0]).join("").toUpperCase() : "";
  const roleName = user?.role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) ?? "";

  const formatRole = (role: string) =>
    role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="flex justify-between items-center bg-white dark:bg-[#161616] border border-gray-200 dark:border-[#2a2a2a] p-4 rounded-2xl relative transition-colors duration-300">

      {/* Left */}
      <div>
        <p className="text-[10px] tracking-[0.2em] uppercase text-gray-500 font-mono mb-0.5">{t("erpSubtitle")}</p>
        <h1 className="text-sm font-semibold capitalize text-gray-900 dark:text-white tracking-wide font-mono">
          {user?.role.replace("_", " ").toLowerCase()}
        </h1>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">

        {/* Language */}
        <button onClick={() => setLanguage(language === "en" ? "fr" : "en")}
          className="w-8 h-8 rounded-lg border border-gray-200 dark:border-[#2a2a2a] bg-gray-100 dark:bg-[#0d0d0d] flex items-center justify-center text-xs font-bold font-mono text-gray-600 dark:text-gray-400 hover:border-[#c8202f]/40 hover:text-[#c8202f] transition-all duration-200">
          {language === "en" ? "EN" : "FR"}
        </button>

        {/* Theme */}
        <button onClick={toggleTheme}
          className="w-8 h-8 rounded-lg border border-gray-200 dark:border-[#2a2a2a] bg-gray-100 dark:bg-[#0d0d0d] flex items-center justify-center text-gray-400 hover:text-[#c8202f] hover:border-[#c8202f]/40 transition-all duration-200">
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* ── 🔔 MANAGER BELL — delete codes + account status ── */}
        {isManager && (
          <div className="relative" ref={hrBellRef}>
            <button onClick={() => { setHrBellOpen(o => { if (!o) setSeenManagerCount(hrApproved.length + sysNotifs.length); return !o; }); }}
              className={`relative w-8 h-8 rounded-lg border flex items-center justify-center transition-all duration-200 ${
                hrBellOpen
                  ? "border-[#c8202f]/40 bg-[#c8202f]/10 text-[#c8202f]"
                  : "border-gray-200 dark:border-[#2a2a2a] bg-gray-100 dark:bg-[#0d0d0d] text-gray-400 hover:border-[#c8202f]/40 hover:text-[#c8202f]"
              }`}>
              <Bell size={14} />
              {totalManagerBadge > seenManagerCount && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#c8202f] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {(totalManagerBadge - seenManagerCount) > 9 ? "9+" : (totalManagerBadge - seenManagerCount)}
                </span>
              )}
            </button>

            <AnimatePresence>
              {hrBellOpen && (
                <motion.div initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }} transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden z-50">

                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-[#2a2a2a]">
                    <div className="flex items-center gap-2">
                      <Bell size={13} className="text-[#c8202f]" />
                      <span className="text-xs font-bold text-gray-900 dark:text-white font-mono">Notifications</span>
                    </div>
                    {totalManagerBadge > 0 && (
                      <span className="text-[10px] bg-[#c8202f]/15 text-[#c8202f] px-2 py-0.5 rounded-full font-bold">
                        {totalManagerBadge}
                      </span>
                    )}
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {/* ── Account status notifications ── */}
                    {sysNotifs.map(notif => (
                      <div key={notif._id} className={`px-4 py-3 border-b border-gray-100 dark:border-[#222] last:border-0 ${
                        notif.type === "PAYROLL_READY" ? "bg-emerald-500/5"
                        : notif.type === "ACCOUNT_APPROVED" ? "bg-[#c8202f]/5" : "bg-red-500/5"
                      }`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <div className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${
                              notif.type === "PAYROLL_READY"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : notif.type === "ACCOUNT_APPROVED"
                                ? "bg-[#c8202f]/10 text-[#c8202f]"
                                : "bg-red-500/10 text-red-400"
                            }`}>
                              {notif.type === "PAYROLL_READY"
                                ? <Banknote size={11} />
                                : notif.type === "ACCOUNT_APPROVED"
                                ? <UserCheck size={11} />
                                : <UserX size={11} />
                              }
                            </div>
                            <div className="min-w-0">
                              <p className={`text-xs font-bold ${
                                notif.type === "PAYROLL_READY" ? "text-emerald-600"
                                : notif.type === "ACCOUNT_APPROVED" ? "text-[#c8202f]" : "text-red-400"
                              }`}>
                                {notif.type === "PAYROLL_READY" ? "Payroll Ready"
                                : notif.type === "ACCOUNT_APPROVED" ? "Account Approved" : "Account Declined"}
                              </p>
                              <p className="text-[10px] text-gray-500 mt-0.5 leading-relaxed">{notif.message}</p>
                              <p className="text-[10px] text-gray-600 mt-1">
                                By <span className="text-gray-400">{notif.actorName}</span> ·{" "}
                                {new Date(notif.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                              </p>
                            </div>
                          </div>
                          <button onClick={() => handleDismissNotif(notif._id)}
                            className="text-gray-500 hover:text-white transition flex-shrink-0 mt-0.5">
                            <X size={11} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* ── Delete approval codes ── */}
                    {hrApproved.map(req => (
                      <div key={req._id} className="px-4 py-4 border-b border-gray-100 dark:border-[#222] last:border-0">
                        <div className="flex items-start justify-between mb-1">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[#c8202f]">{t("authorizationCode")}</p>
                          <button onClick={() => handleDismissCode(req._id)} className="text-gray-500 hover:text-white transition">
                            <X size={11} />
                          </button>
                        </div>
                        <p className="text-[10px] text-gray-400 truncate mb-3">{req.documentName}</p>
                        <div className="flex gap-1.5 justify-center mb-3">
                          {(req.code ?? "").split("").map((d, i) => (
                            <span key={i} className="w-8 h-10 bg-[#0d1117] border border-[#c8202f]/40 rounded-lg flex items-center justify-center text-lg font-bold font-mono text-[#c8202f]">
                              {d}
                            </span>
                          ))}
                        </div>
                        <button onClick={() => navigator.clipboard.writeText(req.code ?? "")}
                          className="w-full py-1.5 rounded-lg text-[10px] font-bold border border-[#c8202f]/30 text-[#c8202f] hover:bg-[#c8202f]/10 transition mb-2">
                          {t("copyCode")}
                        </button>
                        {req.codeExpiresAt && (
                          <p className="text-[10px] text-amber-400 text-center flex items-center justify-center gap-1">
                            <Clock size={9} /> {t("expires")} {new Date(req.codeExpiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        )}
                        <p className="text-[10px] text-gray-500 text-center mt-1">
                          {t("approvedBy")} <span className="text-gray-300">{req.approvedBy}</span>
                        </p>
                      </div>
                    ))}

                    {totalManagerBadge === 0 && (
                      <div className="py-8 text-center text-xs text-gray-400 font-mono">No notifications</div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ── 🔔 ADMIN BELL — delete requests + pending manager accounts ── */}
        {isAdmin && (
          <div className="relative" ref={bellRef}>
            <button onClick={() => setBellOpen(o => !o)}
              className={`relative w-8 h-8 rounded-lg border flex items-center justify-center transition-all duration-200 ${
                bellOpen
                  ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
                  : "border-gray-200 dark:border-[#2a2a2a] bg-gray-100 dark:bg-[#0d0d0d] text-gray-400 hover:border-amber-400/40 hover:text-amber-400"
              }`}>
              <Bell size={14} />
              {totalAdminBadge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#c8202f] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {totalAdminBadge > 9 ? "9+" : totalAdminBadge}
                </span>
              )}
            </button>

            <AnimatePresence>
              {bellOpen && (
                <motion.div initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }} transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden z-50">

                  {/* Tab header */}
                  <div className="flex border-b border-gray-100 dark:border-[#2a2a2a]">
                    <button onClick={() => setAdminTab("managers")}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[10px] font-bold transition ${
                        adminTab === "managers"
                          ? "text-[#c8202f] border-b-2 border-[#c8202f]"
                          : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      }`}>
                      <Users size={11} />
                      Pending Accounts
                      {managersCount > 0 && (
                        <span className="bg-[#c8202f] text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                          {managersCount}
                        </span>
                      )}
                    </button>
                    <button onClick={() => setAdminTab("delete")}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[10px] font-bold transition ${
                        adminTab === "delete"
                          ? "text-amber-400 border-b-2 border-amber-400"
                          : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      }`}>
                      <Trash2 size={11} />
                      {t("deleteRequests")}
                      {pendingCount > 0 && (
                        <span className="bg-amber-500 text-black text-[9px] px-1.5 py-0.5 rounded-full font-bold">
                          {pendingCount}
                        </span>
                      )}
                    </button>
                  </div>

                  <div className="max-h-96 overflow-y-auto">

                    {/* ── Pending Manager Accounts tab ── */}
                    {adminTab === "managers" && (
                      pendingManagers.length === 0 ? (
                        <div className="py-8 text-center space-y-2">
                          <UserCheck size={24} className="mx-auto text-gray-600" />
                          <p className="text-xs text-gray-400 font-mono">No pending approvals</p>
                        </div>
                      ) : (
                        pendingManagers.map(mgr => (
                          <div key={mgr._id} className="px-4 py-3 border-b border-gray-100 dark:border-[#222] last:border-0">
                            <div className="flex items-start gap-2.5 mb-2.5">
                              <div className="w-8 h-8 rounded-full bg-[#c8202f]/15 flex items-center justify-center text-[#c8202f] text-xs font-bold font-mono flex-shrink-0">
                                {mgr.name.split(" ").map(p => p[0]).join("").slice(0,2).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{mgr.name}</p>
                                <p className="text-[10px] text-gray-400">{formatRole(mgr.role)} · {mgr.department}</p>
                                <p className="text-[10px] text-gray-500 mt-0.5">
                                  {new Date(mgr.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleApproveManager(mgr._id)} disabled={approving === mgr._id}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold bg-[#c8202f]/15 text-[#c8202f] hover:bg-[#c8202f]/25 transition disabled:opacity-50">
                                {approving === mgr._id
                                  ? <span className="w-3 h-3 border border-[#c8202f] border-t-transparent rounded-full animate-spin" />
                                  : <Check size={10} />
                                }
                                Approve
                              </button>
                              <button onClick={() => handleRejectManager(mgr._id)} disabled={approving === mgr._id}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold bg-red-500/15 text-red-400 hover:bg-red-500/25 transition disabled:opacity-50">
                                <X size={10} /> Decline
                              </button>
                            </div>
                          </div>
                        ))
                      )
                    )}

                    {/* ── Delete Requests tab ── */}
                    {adminTab === "delete" && (
                      pendingRequests.length === 0 ? (
                        <div className="py-8 text-center text-xs text-gray-400 font-mono">{t("noPendingRequests")}</div>
                      ) : (
                        pendingRequests.map(req => (
                          <div key={req._id} className="px-4 py-3 border-b border-gray-100 dark:border-[#222] last:border-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-900 dark:text-white truncate font-mono">{req.documentName}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{req.employeeName} · {req.department}</p>
                                <p className="text-[10px] text-gray-500 mt-0.5">
                                  {t("requestedBy")} <span className="text-amber-400">{req.requestedBy}</span>
                                </p>
                              </div>
                              <span className="text-[9px] text-gray-500 flex-shrink-0 mt-0.5">
                                {new Date(req.createdAt).toLocaleDateString("en-GB")}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleApprove(req._id)} disabled={approving === req._id}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold bg-[#c8202f]/15 text-[#c8202f] hover:bg-[#c8202f]/25 transition disabled:opacity-50">
                                <Check size={10} /> {t("approve")}
                              </button>
                              <button onClick={() => handleReject(req._id)} disabled={approving === req._id}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold bg-red-500/15 text-red-400 hover:bg-red-500/25 transition disabled:opacity-50">
                                <X size={10} /> {t("reject")}
                              </button>
                            </div>
                          </div>
                        ))
                      )
                    )}

                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button onClick={() => setOpen(!open)}
            className={`flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-xl border transition-all duration-200 ${
              open ? "border-[#c8202f]/40 bg-gray-50 dark:bg-[#1f1f1f]"
                   : "border-gray-200 dark:border-[#2a2a2a] hover:border-gray-300 dark:hover:border-[#3a3a3a]"
            }`}>
            <div className="w-7 h-7 rounded-full bg-[#c8202f]/20 border border-[#c8202f]/40 flex items-center justify-center text-[#c8202f] font-bold text-xs font-mono flex-shrink-0">
              {getInitials(user?.name)}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-bold text-gray-900 dark:text-white font-mono leading-tight">{user?.name}</p>
              <p className="text-[10px] text-gray-400 font-mono leading-tight">{roleName}</p>
            </div>
            <ChevronUp size={12} className={`text-gray-400 transition-transform duration-200 ${open ? "rotate-0" : "rotate-180"}`} />
          </button>

          <AnimatePresence>
            {open && (
              <motion.div initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.97 }} transition={{ duration: 0.15 }}
                className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#2a2a2a] rounded-2xl shadow-2xl overflow-hidden z-50">
                <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-[#2a2a2a]">
                  <div className="w-9 h-9 rounded-full bg-[#c8202f]/20 border border-[#c8202f]/40 flex items-center justify-center text-[#c8202f] font-bold text-sm font-mono flex-shrink-0">
                    {getInitials(user?.name)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white font-mono leading-tight">{user?.name}</p>
                    <p className="text-[11px] text-gray-400 font-mono leading-tight">{user?.email ?? roleName}</p>
                  </div>
                </div>
                <div className="p-2">
                  <Link href="/dashboard/profile" onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-mono text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#242424] hover:text-gray-900 dark:hover:text-white transition-all duration-150">
                    <User size={14} className="text-gray-400" />{t("profile")}
                  </Link>
                  <Link href="/dashboard/settings" onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-mono text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#242424] hover:text-gray-900 dark:hover:text-white transition-all duration-150">
                    <Settings size={14} className="text-gray-400" />{t("settings")}
                  </Link>
                  <Link href="/dashboard/support" onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-mono text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#242424] hover:text-gray-900 dark:hover:text-white transition-all duration-150">
                    <HelpCircle size={14} className="text-gray-400" />{t("support")}
                  </Link>
                </div>
                <div className="p-2 border-t border-gray-100 dark:border-[#2a2a2a]">
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-mono text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-150">
                    <LogOut size={14} />{t("logout")}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}