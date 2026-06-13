"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Search, Filter, RefreshCw,
  Users, Pencil, Trash2, KeyRound, Plus, ChevronDown,
  ShoppingCart, Package, DollarSign, Truck, BarChart2,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { adminService } from "@/services/adminService";

interface LogEntry {
  _id: string; userId: string; userName: string; userRole: string;
  action: string; actionLabel: string; target: string; department: string; createdAt: string;
}
interface ActivityStats {
  total: number;
  byDept:   { _id: string; count: number }[];
  byAction: { _id: string; count: number }[];
  byUser:   { _id: { userId: string; userName: string; userRole: string }; count: number; lastAction: string }[];
}

const DEPARTMENTS = [
  "All", "HR", "Marketing", "Online Sales",
  "Commercial", "Stock", "Purchase", "Finance", "Production", "Admin",
];

const ACTION_ICON: Record<string, React.ReactNode> = {
  CREATE_EMPLOYEE:    <Plus size={12} />,
  UPDATE_EMPLOYEE:    <Pencil size={12} />,
  DELETE_EMPLOYEE:    <Trash2 size={12} />,
  RESET_PASSWORD:     <KeyRound size={12} />,
  CREATE_USER:        <Plus size={12} />,
  UPDATE_USER:        <Pencil size={12} />,
  DELETE_USER:        <Trash2 size={12} />,
  CREATE_ORDER:       <Plus size={12} />,
  UPDATE_ORDER:       <Pencil size={12} />,
  DELETE_ORDER:       <Trash2 size={12} />,
  UPDATE_ORDER_STATUS:<Pencil size={12} />,
  CREATE_PRODUCT:     <Plus size={12} />,
  UPDATE_PRODUCT:     <Pencil size={12} />,
  DELETE_PRODUCT:     <Trash2 size={12} />,
  CREATE_SHIPMENT:    <Plus size={12} />,
  UPDATE_SHIPMENT_STATUS: <Pencil size={12} />,
  CREATE_RETURN:      <Plus size={12} />,
  UPDATE_RETURN_STATUS:   <Pencil size={12} />,
  CREATE_RESELLER:    <Plus size={12} />,
  UPDATE_RESELLER:    <Pencil size={12} />,
  DELETE_RESELLER:    <Trash2 size={12} />,
  CREATE_CAMPAIGN:    <Plus size={12} />,
  UPDATE_CAMPAIGN:    <Pencil size={12} />,
  DELETE_CAMPAIGN:    <Trash2 size={12} />,
  CREATE_PROMOTION:   <Plus size={12} />,
  UPDATE_PROMOTION:   <Pencil size={12} />,
  DELETE_PROMOTION:   <Trash2 size={12} />,
  CREATE_SEGMENT:     <Plus size={12} />,
  UPDATE_SEGMENT:     <Pencil size={12} />,
  DELETE_SEGMENT:     <Trash2 size={12} />,
  CREATE_SALES_ORDER: <Plus size={12} />,
  UPDATE_SALES_ORDER: <Pencil size={12} />,
  DELETE_SALES_ORDER: <Trash2 size={12} />,
  CREATE_CUSTOMER:    <Plus size={12} />,
  UPDATE_CUSTOMER:    <Pencil size={12} />,
  DELETE_CUSTOMER:    <Trash2 size={12} />,
  CREATE_STOCK_PRODUCT: <Plus size={12} />,
  UPDATE_STOCK_PRODUCT: <Pencil size={12} />,
  DELETE_STOCK_PRODUCT: <Trash2 size={12} />,
  CREATE_PURCHASE_REQUEST: <Plus size={12} />,
  CREATE_PURCHASE_ORDER:   <Plus size={12} />,
  CREATE_SUPPLIER:    <Plus size={12} />,
  UPDATE_SUPPLIER:    <Pencil size={12} />,
  DELETE_SUPPLIER:    <Trash2 size={12} />,
  CREATE_REFILL:      <Plus size={12} />,
  APPROVE_ACCOUNT:    <KeyRound size={12} />,
  REJECT_ACCOUNT:     <Trash2 size={12} />,
};

const ACTION_COLOR: Record<string, string> = {
  CREATE_EMPLOYEE:         "bg-emerald-500/15 text-emerald-400",
  UPDATE_EMPLOYEE:         "bg-blue-500/15 text-blue-400",
  DELETE_EMPLOYEE:         "bg-red-500/15 text-red-400",
  RESET_PASSWORD:          "bg-yellow-500/15 text-yellow-400",
  CREATE_ORDER:            "bg-emerald-500/15 text-emerald-400",
  UPDATE_ORDER:            "bg-blue-500/15 text-blue-400",
  DELETE_ORDER:            "bg-red-500/15 text-red-400",
  UPDATE_ORDER_STATUS:     "bg-purple-500/15 text-purple-400",
  CREATE_PRODUCT:          "bg-emerald-500/15 text-emerald-400",
  UPDATE_PRODUCT:          "bg-blue-500/15 text-blue-400",
  DELETE_PRODUCT:          "bg-red-500/15 text-red-400",
  CREATE_SHIPMENT:         "bg-cyan-500/15 text-cyan-400",
  UPDATE_SHIPMENT_STATUS:  "bg-cyan-500/15 text-cyan-400",
  CREATE_RETURN:           "bg-amber-500/15 text-amber-400",
  UPDATE_RETURN_STATUS:    "bg-amber-500/15 text-amber-400",
  CREATE_RESELLER:         "bg-purple-500/15 text-purple-400",
  UPDATE_RESELLER:         "bg-purple-500/15 text-purple-400",
  DELETE_RESELLER:         "bg-red-500/15 text-red-400",
  CREATE_CAMPAIGN:         "bg-emerald-500/15 text-emerald-400",
  UPDATE_CAMPAIGN:         "bg-blue-500/15 text-blue-400",
  DELETE_CAMPAIGN:         "bg-red-500/15 text-red-400",
  CREATE_PROMOTION:        "bg-emerald-500/15 text-emerald-400",
  UPDATE_PROMOTION:        "bg-blue-500/15 text-blue-400",
  DELETE_PROMOTION:        "bg-red-500/15 text-red-400",
  CREATE_SALES_ORDER:      "bg-emerald-500/15 text-emerald-400",
  UPDATE_SALES_ORDER:      "bg-blue-500/15 text-blue-400",
  DELETE_SALES_ORDER:      "bg-red-500/15 text-red-400",
  CREATE_CUSTOMER:         "bg-emerald-500/15 text-emerald-400",
  UPDATE_CUSTOMER:         "bg-blue-500/15 text-blue-400",
  DELETE_CUSTOMER:         "bg-red-500/15 text-red-400",
  CREATE_STOCK_PRODUCT:    "bg-emerald-500/15 text-emerald-400",
  UPDATE_STOCK_PRODUCT:    "bg-blue-500/15 text-blue-400",
  DELETE_STOCK_PRODUCT:    "bg-red-500/15 text-red-400",
  CREATE_PURCHASE_REQUEST: "bg-emerald-500/15 text-emerald-400",
  CREATE_PURCHASE_ORDER:   "bg-emerald-500/15 text-emerald-400",
  CREATE_SUPPLIER:         "bg-emerald-500/15 text-emerald-400",
  UPDATE_SUPPLIER:         "bg-blue-500/15 text-blue-400",
  DELETE_SUPPLIER:         "bg-red-500/15 text-red-400",
  CREATE_REFILL:           "bg-amber-500/15 text-amber-400",
  APPROVE_ACCOUNT:         "bg-emerald-500/15 text-emerald-400",
  REJECT_ACCOUNT:          "bg-red-500/15 text-red-400",
};

const ROLE_COLOR: Record<string, string> = {
  ADMIN:              "bg-[#c8202f]/15 text-[#c8202f]",
  HR_MANAGER:         "bg-blue-500/15 text-blue-400",
  MARKETING_MANAGER:  "bg-purple-500/15 text-purple-400",
  SALES_MANAGER:      "bg-amber-500/15 text-amber-400",
  COMMERCIAL_MANAGER: "bg-cyan-500/15 text-cyan-400",
  STOCK_MANAGER:      "bg-emerald-500/15 text-emerald-400",
  PURCHASE_MANAGER:   "bg-orange-500/15 text-orange-400",
  FINANCE_MANAGER:    "bg-green-500/15 text-green-400",
  EMPLOYEE:           "bg-gray-500/15 text-gray-400",
};

const DEPT_COLOR: Record<string, string> = {
  HR:            "bg-blue-500/15 text-blue-400",
  Marketing:     "bg-purple-500/15 text-purple-400",
  "Online Sales":"bg-amber-500/15 text-amber-400",
  Commercial:    "bg-cyan-500/15 text-cyan-400",
  Stock:         "bg-emerald-500/15 text-emerald-400",
  Purchase:      "bg-orange-500/15 text-orange-400",
  Finance:       "bg-green-500/15 text-green-400",
  Production:    "bg-indigo-500/15 text-indigo-400",
  Admin:         "bg-[#c8202f]/15 text-[#c8202f]",
  None:          "bg-gray-500/10 text-gray-500",
};

// KPI cards — one per major department group
const DEPT_KPIS = [
  { label: "HR",           dept: "HR",           color: "text-blue-400",    iconBg: "bg-blue-500/10 text-blue-400",    icon: <Users size={14} /> },
  { label: "Marketing",    dept: "Marketing",    color: "text-purple-400",  iconBg: "bg-purple-500/10 text-purple-400", icon: <BarChart2 size={14} /> },
  { label: "Online Sales", dept: "Online Sales", color: "text-amber-400",   iconBg: "bg-amber-500/10 text-amber-400",  icon: <ShoppingCart size={14} /> },
  { label: "Commercial",   dept: "Commercial",   color: "text-cyan-400",    iconBg: "bg-cyan-500/10 text-cyan-400",    icon: <Truck size={14} /> },
  { label: "Stock",        dept: "Stock",        color: "text-emerald-400", iconBg: "bg-emerald-500/10 text-emerald-400", icon: <Package size={14} /> },
  { label: "Purchase",     dept: "Purchase",     color: "text-orange-400",  iconBg: "bg-orange-500/10 text-orange-400", icon: <DollarSign size={14} /> },
  { label: "Finance",      dept: "Finance",      color: "text-green-400",   iconBg: "bg-green-500/10 text-green-400",  icon: <DollarSign size={14} /> },
];

function formatTime(dateStr: string) {
  const diffMs  = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH   = Math.floor(diffMs / 3600000);
  const diffD   = Math.floor(diffMs / 86400000);
  if (diffMin < 1)  return "just now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffH   < 24) return `${diffH}h`;
  if (diffD   < 7)  return `${diffD}d`;
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-[#c8202f]/20 text-[#c8202f]", "bg-blue-500/20 text-blue-400",
  "bg-purple-500/20 text-purple-400", "bg-amber-500/20 text-amber-400",
  "bg-cyan-500/20 text-cyan-400",
];

function avatarColor(name: string) {
  let hash = 0;
  for (const c of name) hash += c.charCodeAt(0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export default function ActivityPage() {
  const { t } = useLanguage();

  const [logs, setLogs]             = useState<LogEntry[]>([]);
  const [stats, setStats]           = useState<ActivityStats | null>(null);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [showFilter, setShowFilter] = useState(false);

  const ROLE_LABEL: Record<string, string> = {
    ADMIN:              "Admin",
    HR_MANAGER:         "HR Manager",
    MARKETING_MANAGER:  "Marketing Manager",
    SALES_MANAGER:      "Sales Manager",
    COMMERCIAL_MANAGER: "Commercial Manager",
    STOCK_MANAGER:      "Stock Manager",
    PURCHASE_MANAGER:   "Purchase Manager",
    FINANCE_MANAGER:    "Finance Manager",
    EMPLOYEE:           "Employee",
  };

  const card = "bg-white dark:bg-[#111c35] border border-[#1b2a6b]/15 dark:border-[#1b2a6b]/20 border-t-2 border-t-[#c8202f] rounded-2xl transition-colors duration-300";

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { limit: 200 };
      if (deptFilter !== "All") params.department = deptFilter;
      const [logsData, statsData] = await Promise.all([
        adminService.getActivityLogs(params),
        adminService.getActivityStats(),
      ]);
      setLogs(logsData);
      setStats(statsData);
    } catch {} finally { setLoading(false); }
  }, [deptFilter]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = logs.filter(l =>
    l.userName.toLowerCase().includes(search.toLowerCase()) ||
    l.actionLabel.toLowerCase().includes(search.toLowerCase()) ||
    l.target.toLowerCase().includes(search.toLowerCase()) ||
    l.department.toLowerCase().includes(search.toLowerCase())
  );

  const topUsers = stats?.byUser?.slice(0, 5) ?? [];
  const totalActions = stats?.total ?? 0;

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <div className="min-h-screen bg-[#f0f4ff] dark:bg-[#060d1f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight leading-none">
              Manager <span className="text-[#c8202f]">Activity</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">Actions Log · EMM ERP</p>
          </div>
          <button onClick={fetchAll}
            className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-[#c8202f]/50 px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* Total KPI */}
        <div className={`${card} px-6 py-4 flex items-center gap-4`}>
          <div className="p-2 rounded-xl bg-[#c8202f]/10 text-[#c8202f]"><Activity size={18} /></div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500">Total Actions</p>
            <p className="text-3xl font-bold text-[#c8202f]">{totalActions}</p>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {DEPT_KPIS.map(k => {
              const count = stats?.byDept?.find(d => d._id === k.dept)?.count ?? 0;
              return (
                <div key={k.dept} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/[0.06]">
                  <span className={`text-[10px] font-bold ${k.color}`}>{k.label}</span>
                  <span className={`text-sm font-bold ${k.color}`}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">

          {/* Log table */}
          <div className={`${card} overflow-hidden xl:col-span-3`}>
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 border-b border-gray-200 dark:border-[#1b2a6b]/20">
              <div>
                <h2 className="text-base font-bold">Actions Log</h2>
                <p className="text-xs text-gray-500">{filtered.length} entries</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    className="pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-[#060d1f] border border-gray-200 dark:border-[#1b2a6b]/20 rounded-lg text-xs focus:outline-none focus:border-[#c8202f]/40 transition text-gray-900 dark:text-white placeholder-gray-400"
                    placeholder="Search actions..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="relative">
                  <button onClick={() => setShowFilter(v => !v)}
                    className="flex items-center gap-1.5 border border-gray-200 dark:border-[#1b2a6b]/20 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-[#c8202f] hover:border-[#c8202f]/40 transition">
                    <Filter size={11} /> {deptFilter === "All" ? "all departments" : deptFilter} <ChevronDown size={11} />
                  </button>
                  <AnimatePresence>
                    {showFilter && (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                        className="absolute right-0 top-full mt-1 z-20 bg-white dark:bg-[#111c35] border border-[#1b2a6b]/20 rounded-xl shadow-xl overflow-hidden min-w-[180px]">
                        {DEPARTMENTS.map(d => (
                          <button key={d} onClick={() => { setDeptFilter(d); setShowFilter(false); }}
                            className={`w-full text-left px-4 py-2 text-xs transition hover:bg-gray-50 dark:hover:bg-[#1b2a6b]/10 ${deptFilter === d ? "text-[#c8202f] font-bold" : "text-gray-600 dark:text-gray-300"}`}>
                            {d === "All" ? "All Departments" : d}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Table header */}
            <div className="grid px-6 py-3 text-[10px] uppercase tracking-widest text-gray-500 border-b border-gray-100 dark:border-[#1b2a6b]/10"
              style={{ gridTemplateColumns: "2fr 2fr 1.5fr 1.5fr 1fr" }}>
              <span>User</span><span>Action</span>
              <span>Target</span><span>Department</span><span>When</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-400 gap-2 text-xs">
                <RefreshCw size={14} className="animate-spin" /> Loading activity…
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-xs text-gray-400">No actions recorded yet</div>
            ) : (
              <div className="max-h-[560px] overflow-y-auto">
                {filtered.map((log, i) => (
                  <motion.div key={log._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                    className={`grid px-6 py-3.5 items-center hover:bg-gray-50 dark:hover:bg-[#1b2a6b]/5 transition ${i < filtered.length - 1 ? "border-b border-gray-100 dark:border-[#1b2a6b]/10" : ""}`}
                    style={{ gridTemplateColumns: "2fr 2fr 1.5fr 1.5fr 1fr" }}>

                    {/* User */}
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${avatarColor(log.userName)}`}>
                        {getInitials(log.userName)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white leading-tight">{log.userName}</p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${ROLE_COLOR[log.userRole] || "bg-gray-500/15 text-gray-400"}`}>
                          {ROLE_LABEL[log.userRole] || log.userRole}
                        </span>
                      </div>
                    </div>

                    {/* Action */}
                    <div>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${ACTION_COLOR[log.action] || "bg-gray-500/15 text-gray-400"}`}>
                        {ACTION_ICON[log.action]} {log.actionLabel}
                      </span>
                    </div>

                    {/* Target */}
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{log.target || "—"}</p>

                    {/* Department */}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${DEPT_COLOR[log.department] || "bg-gray-500/10 text-gray-500"}`}>
                      {log.department}
                    </span>

                    {/* When */}
                    <p className="text-[10px] text-gray-400">{formatTime(log.createdAt)}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">

            {/* Most active */}
            <div className={`${card} p-5`}>
              <h3 className="text-sm font-bold mb-1">Most Active</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">By action count</p>
              {topUsers.length === 0 ? (
                <p className="text-xs text-gray-400">No data yet</p>
              ) : (
                <div className="space-y-4">
                  {topUsers.map((u) => (
                    <div key={u._id.userId} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${avatarColor(u._id.userName)}`}>
                        {getInitials(u._id.userName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{u._id.userName}</p>
                        <p className="text-[10px] text-gray-500">{ROLE_LABEL[u._id.userRole] || u._id.userRole}</p>
                      </div>
                      <span className="text-sm font-bold text-[#c8202f]">{u.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* By action type */}
            <div className={`${card} p-5`}>
              <h3 className="text-sm font-bold mb-1">By Action Type</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">Breakdown</p>
              {(stats?.byAction ?? []).length === 0 ? (
                <p className="text-xs text-gray-400">No data yet</p>
              ) : (
                <div className="space-y-3">
                  {stats!.byAction.sort((a, b) => b.count - a.count).slice(0, 8).map((a) => {
                    const max = Math.max(...stats!.byAction.map(x => x.count));
                    return (
                      <div key={a._id}>
                        <div className="flex justify-between items-center mb-1">
                          <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${ACTION_COLOR[a._id] || "bg-gray-500/15 text-gray-400"}`}>
                            {ACTION_ICON[a._id]}{a._id.replace(/_/g, " ")}
                          </span>
                          <span className="text-xs text-gray-400 font-bold">{a.count}</span>
                        </div>
                        <div className="h-1 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${(a.count / max) * 100}%` }}
                            transition={{ duration: 0.6 }} className="h-full bg-[#c8202f] rounded-full" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* By department */}
            <div className={`${card} p-5`}>
              <h3 className="text-sm font-bold mb-1">By Department</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">Distribution</p>
              <div className="space-y-2">
                {(stats?.byDept ?? []).sort((a, b) => b.count - a.count).map(d => (
                  <div key={d._id} className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${DEPT_COLOR[d._id] || "bg-gray-500/10 text-gray-500"}`}>
                      {d._id}
                    </span>
                    <span className="text-xs text-gray-500 font-bold">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}