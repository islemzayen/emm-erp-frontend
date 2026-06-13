// Returns — Online Sales
"use client";

import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Search, Plus, Download, CheckCircle, Clock, DollarSign, Link, X, Loader2 } from "lucide-react";
import { salesService, type OnlineReturn, type OnlineOrder } from "@/services/salesService";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-[#c8202f]/20 text-[#c8202f]", "bg-blue-500/20 text-blue-400",
  "bg-purple-500/20 text-purple-400",   "bg-amber-500/20 text-amber-400",
  "bg-pink-500/20 text-pink-400",       "bg-teal-500/20 text-teal-400",
];

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-TN", { day: "numeric", month: "short" });
}

function fmtTND(n: number) {
  const parts = n.toFixed(3).split(".");
  const intPart = parseInt(parts[0]).toLocaleString("en-US");
  return intPart + "." + parts[1] + " TND";
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 dark:bg-white/5 rounded ${className}`} />;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ReturnsPage() {
  const { t } = useLanguage();
  const [returns, setReturns]         = useState<OnlineReturn[]>([]);
  const [stats, setStats]             = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [filterStatus, setFilter]     = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingId, setUpdatingId]   = useState<string | null>(null);
  const [mounted, setMounted]         = useState(false);
  const [showCreate, setShowCreate]   = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [orders, setOrders]           = useState<OnlineOrder[]>([]);
  const [createError, setCreateError] = useState("");
  const emptyReturnForm = {
    orderId: "", orderNo: "", customerName: "", customerEmail: "",
    productSummary: "", amount: 0,
    reason: "Defective" as OnlineReturn["reason"],
  };
  const [returnForm, setReturnForm] = useState(emptyReturnForm);

  const card = "bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/[0.06] border-t-2 border-t-[#c8202f] rounded-2xl transition-colors duration-300 hover:shadow-[0_0_20px_#c8202f10]";

  const STATUS_CONFIG: Record<string, { label: string; badge: string; dot: string }> = {
    approved: { label: t("approved"), badge: "bg-blue-500/15 text-blue-400",       dot: "bg-blue-400"     },
    pending:  { label: t("pending"),  badge: "bg-amber-500/15 text-amber-400",     dot: "bg-amber-400"    },
    rejected: { label: t("rejected"), badge: "bg-red-500/15 text-red-400",         dot: "bg-red-400"      },
    refunded: { label: t("refunded"), badge: "bg-[#c8202f]/15 text-[#c8202f]", dot: "bg-[#c8202f]"  },
  };

  const openCreate = async () => {
    setReturnForm(emptyReturnForm);
    setCreateError("");
    try {
      const res = await salesService.getOrders({ status: "completed", limit: 100 });
      setOrders(res.orders);
    } catch (e) { console.error(e); }
    setShowCreate(true);
  };

  const handleOrderSelect = (orderId: string) => {
    const order = orders.find(o => o._id === orderId);
    if (!order) return;
    setReturnForm(f => ({
      ...f,
      orderId:        order._id,
      orderNo:        order.orderNo,
      customerName:   order.customer.name,
      customerEmail:  order.customer.email,
      productSummary: order.lines.map(l => `${l.productName} ×${l.quantity}`).join(", "),
      amount:         order.totalAmount,
    }));
  };

  const handleCreateReturn = async () => {
    if (!returnForm.orderId)           { setCreateError("Please select an order"); return; }
    if (!returnForm.productSummary.trim()) { setCreateError("Product summary is required"); return; }
    if (returnForm.amount <= 0)        { setCreateError("Amount must be greater than 0"); return; }
    setSubmitting(true); setCreateError("");
    try {
      await salesService.createReturn({
        orderId:        returnForm.orderId,
        orderNo:        returnForm.orderNo,
        customer:       { name: returnForm.customerName, email: returnForm.customerEmail },
        productSummary: returnForm.productSummary,
        amount:         returnForm.amount,
        reason:         returnForm.reason,
      });
      setShowCreate(false);
      setReturnForm(emptyReturnForm);
      load();
    } catch (e: any) {
      setCreateError(e.response?.data?.message || "Failed to create return");
    } finally { setSubmitting(false); }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [res, statsRes] = await Promise.all([
        salesService.getReturns({ search: searchQuery, status: filterStatus, limit: 100 }),
        salesService.getReturns({ limit: 1000 }),
      ]);
      setReturns(res.returns);
      // Compute stats client-side from full list
      const all = statsRes.returns;
      const byStatus = { pending: 0, approved: 0, rejected: 0, refunded: 0 } as Record<string, number>;
      let totalRefunded = 0;
      for (const r of all) {
        byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
        if (r.status === "refunded") totalRefunded += r.amount;
      }
      setStats({ total: all.length, byStatus, totalRefunded });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setMounted(true);
    }
  }, [searchQuery, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id: string, status: OnlineReturn["status"], adminNotes = "") => {
    setUpdatingId(id);
    try {
      const updated = await salesService.updateReturnStatus(id, status, adminNotes);
      setReturns(prev => prev.map(r => r._id === id ? updated : r));
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  };

  const pendingCount  = stats?.byStatus?.pending  ?? 0;
  const refundedCount = stats?.byStatus?.refunded  ?? 0;
  const totalRefunded = stats?.totalRefunded ?? 0;
  const totalReturns  = returns.reduce((s, r) => s + r.amount, 0);

  const exportXlsx = async () => {
    if (!returns.length) return;
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = "EMM Hardware ERP";
    const ws = wb.addWorksheet("Returns");
    const headers = ["Return No", "Order No", "Customer", "Reason", "Amount (TND)", "Status", "RMA No", "Date"];
    const colCount = headers.length;

    // Title row
    ws.mergeCells(1, 1, 1, colCount);
    const titleCell = ws.getCell("A1");
    titleCell.value = `EMM Hardware ERP — Returns Report  |  ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}`;
    titleCell.font  = { bold: true, size: 13, color: { argb: "FFC8202F" } };
    titleCell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 32;

    // Logo top-left over the title bar
    try {
      const _lr = await fetch("/logo.png");
      if (_lr.ok) {
        const _lbuf = await _lr.arrayBuffer();
        const _bytes = new Uint8Array(_lbuf);
        let _bin = "";
        for (let _i = 0; _i < _bytes.length; _i++) _bin += String.fromCharCode(_bytes[_i]);
        const _limg = wb.addImage({ base64: btoa(_bin), extension: "png" });
        let _lw = 60, _lh = 40;
        try { const _dv = new DataView(_lbuf); _lh = 40; _lw = Math.round(_lh * (_dv.getUint32(16) / _dv.getUint32(20))); } catch {}
        ws.addImage(_limg, { tl: { col: 0, row: 0 }, ext: { width: _lw, height: _lh } });
      }
    } catch { /* logo optional */ }

    // Header row
    const headerRow = ws.addRow(headers);
    headerRow.eachCell(cell => {
      cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC8202F" } };
      cell.font      = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    headerRow.height = 20;

    // Data rows
    returns.forEach((r: any, i: number) => {
      const row = ws.addRow([
        r.returnNo, r.orderNo, r.customer?.name || "—",
        r.reason || "—", (r.amount || 0).toFixed(3), r.status,
        r.commercialRmaNo || "—",
        r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-GB") : "—",
      ]);
      const bg = i % 2 === 0 ? "FFF9FAFB" : "FFFFFFFF";
      row.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.font = { size: 9 };
      });
    });

    ws.columns.forEach(col => { col.width = 18; });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `Returns_${new Date().toISOString().slice(0,10)}.xlsx`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
    <div className="min-h-screen bg-gray-100 dark:bg-[#060a0f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight leading-none">
            {t("returns")} <span className="text-[#c8202f]">{t("management")}</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">EMM ERP</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={load} className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-gray-400 dark:hover:border-white/20 px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={exportXlsx} disabled={!returns.length} className="flex items-center gap-2 border border-gray-300 dark:border-white/10 hover:border-[#c8202f]/40 hover:text-[#c8202f] px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-gray-600 dark:text-gray-300 disabled:opacity-40">
            <Download size={13} /> Export XLSX
          </button>
          <button onClick={openCreate} className="flex items-center gap-2 bg-[#c8202f] hover:bg-[#e02d3c] px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-white font-bold">
            <Plus size={13} /> {t("newReturn")}
          </button>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: t("totalReturns"), value: loading ? "—" : String(stats?.total ?? 0),         change: t("submitted"),              changeColor: "text-[#c8202f]", valueColor: "text-[#c8202f]", icon: <RefreshCw size={16} />,  iconBg: "bg-[#c8202f]/10 text-[#c8202f]" },
          { label: t("pending"),                         value: loading ? "—" : String(pendingCount),               change: t("awaitingReview"),          changeColor: "text-amber-400",   valueColor: "text-amber-400",   icon: <Clock size={16} />,      iconBg: "bg-amber-500/10 text-amber-400"     },
          { label: t("refunded"),                        value: loading ? "—" : String(refundedCount),              change: t("completed"),               changeColor: "text-blue-400",    valueColor: "text-blue-400",    icon: <CheckCircle size={16} />, iconBg: "bg-blue-500/10 text-blue-400"       },
          { label: t("totalRefunded"), value: loading ? "—" : fmtTND(totalRefunded),           change: t("paidOut"),   changeColor: "text-red-400",     valueColor: "text-red-400",     icon: <DollarSign size={16} />, iconBg: "bg-red-500/10 text-red-400"         },
        ].map((kpi, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className={`${card} p-5 flex flex-col gap-3`}>
            <div className="flex items-start justify-between">
              <div className={`p-2 rounded-xl ${kpi.iconBg}`}>{kpi.icon}</div>
              <span className={`text-xs font-bold ${kpi.changeColor}`}>{kpi.change}</span>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500">{kpi.label}</p>
            {loading ? <Skeleton className="h-9 w-20" /> : (
              <p className={`text-3xl font-bold tracking-tight ${kpi.valueColor}`}>{kpi.value}</p>
            )}
          </motion.div>
        ))}
      </div>

      {/* ── SECONDARY STRIP ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: t("approved"),          value: loading ? "—" : String(stats?.byStatus?.approved ?? 0),  sub: "Processing refund" },
          { label: t("rejected"),          value: loading ? "—" : String(stats?.byStatus?.rejected ?? 0),  sub: "Return denied"      },
          { label: t("totalReturnValue"),  value: loading ? "—" : fmtTND(totalReturns),                    sub: t("totalRequested")    },
          { label: t("refundRate"),        value: loading ? "—" : (stats?.total > 0 ? `${Math.round((refundedCount / stats.total) * 100)}%` : "0%"), sub: t("ofAllReturns") },
        ].map((s, i) => (
          <div key={i} className={`${card} px-5 py-4`}>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── RETURNS TABLE ── */}
      <div className={`${card} overflow-hidden`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-white/[0.05]">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">{t("returnRequests")}</h2>
            <p className="text-xs text-gray-500">{returns.length} {t("returns")}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                className="pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:border-[#c8202f]/40 transition text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600"
                placeholder={t("searchReturns")}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="px-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-300 dark:border-white/10 rounded-lg text-xs text-gray-600 dark:text-gray-300 focus:outline-none focus:border-[#c8202f]/40 transition"
              value={filterStatus}
              onChange={e => setFilter(e.target.value)}
            >
              <option value="all">{t("allStatus")}</option>
              <option value="pending">{t("pending")}</option>
              <option value="approved">{t("approved")}</option>
              <option value="rejected">{t("rejected")}</option>
              <option value="refunded">{t("refunded")}</option>
            </select>
          </div>
        </div>

        {/* Table header */}
        <div className="grid px-6 py-3 text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-600 border-b border-gray-100 dark:border-white/[0.04]"
          style={{ gridTemplateColumns: "2fr 2fr 1fr 1.2fr 1fr 1.5fr 0.8fr" }}>
          <span>{t("customer")}</span>
          <span>{t("product")}</span>
          <span>{t("amount")}</span>
          <span>{t("reason")}</span>
          <span>{t("rmaLink")}</span>
          <span>{t("status")}</span>
          <span>{t("date")}</span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : returns.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500 dark:text-gray-600">{t("noReturnsMatch")}</div>
        ) : (
          returns.map((r, i) => {
            const sc = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
            const isUpdating = updatingId === r._id;
            return (
              <div key={r._id}
                className={`grid px-6 py-4 items-center hover:bg-gray-50 dark:hover:bg-white/[0.02] transition ${i < returns.length - 1 ? "border-b border-gray-100 dark:border-white/[0.03]" : ""}`}
                style={{ gridTemplateColumns: "2fr 2fr 1fr 1.2fr 1fr 1.5fr 0.8fr" }}>

                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                    {initials(r.customer.name)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{r.customer.name}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-600">{r.returnNo} · {r.orderNo}</p>
                  </div>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 pr-4 truncate">{r.productSummary}</p>

                <p className="text-sm font-bold text-gray-900 dark:text-white">{fmtTND(r.amount)}</p>

                <p className="text-xs text-gray-500 dark:text-gray-400">{r.reason}</p>

                {/* RMA number + authorization verdict */}
                <div className="flex flex-col gap-1">
                  {r.commercialRmaNo ? (
                    <>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 w-fit">
                        <Link size={9} /> {r.commercialRmaNo}
                      </span>
                      {(() => {
                        const verdict =
                          r.status === "approved" || r.status === "refunded" ? "AUTHORIZED"
                          : r.status === "rejected" ? "NOT AUTHORIZED"
                          : "PENDING";
                        const vcls =
                          verdict === "AUTHORIZED" ? "bg-emerald-500/10 text-emerald-400"
                          : verdict === "NOT AUTHORIZED" ? "bg-red-500/10 text-red-400"
                          : "bg-amber-500/10 text-amber-400";
                        return (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold w-fit ${vcls}`}>
                            {verdict}
                          </span>
                        );
                      })()}
                    </>
                  ) : (
                    <span className="text-[10px] text-gray-400">—</span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${sc.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                    {sc.label}
                  </span>
                  {isUpdating ? (
                    <RefreshCw size={12} className="animate-spin text-gray-400" />
                  ) : r.status === "pending" ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleStatusChange(r._id, "approved")}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition">
                        {t("approve")}
                      </button>
                      <button
                        onClick={() => handleStatusChange(r._id, "rejected")}
                        className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 transition">
                        {t("reject")}
                      </button>
                    </div>
                  ) : r.status === "approved" ? (
                    <button
                      onClick={() => handleStatusChange(r._id, "refunded")}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#c8202f]/10 text-[#c8202f] hover:bg-[#c8202f]/20 transition">
                      {t("markRefunded")}
                    </button>
                  ) : null}
                </div>

                <p className="text-[10px] text-gray-400 dark:text-gray-600">{fmtDate(r.createdAt)}</p>
              </div>
            );
          })
        )}
      </div>
    </div>

      {/* ── NEW RETURN MODAL ── */}
      <AnimatePresence>
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">{t("newReturn")}</h3>
                <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition"><X size={18} /></button>
              </div>
              <div className="space-y-4">

                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-widest mb-1 block">Order (Completed)</label>
                  <select className="w-full px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition"
                    value={returnForm.orderId} onChange={e => handleOrderSelect(e.target.value)}>
                    <option value="">— Select a completed order —</option>
                    {orders.map(o => (
                      <option key={o._id} value={o._id}>{o.orderNo} · {o.customer.name}</option>
                    ))}
                  </select>
                  {orders.length === 0 && <p className="text-[10px] text-amber-400 mt-1">No completed orders yet.</p>}
                </div>

                {returnForm.orderId && (
                  <div className="p-3 rounded-xl bg-[#c8202f]/5 border border-[#c8202f]/20 space-y-1">
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{returnForm.customerName}</p>
                    <p className="text-[10px] text-gray-400">{returnForm.customerEmail}</p>
                    <p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{returnForm.productSummary}</p>
                  </div>
                )}

                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-widest mb-1 block">Product Summary</label>
                  <input className="w-full px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition"
                    placeholder="e.g. Serrure Haute Sécurité × 1"
                    value={returnForm.productSummary}
                    onChange={e => setReturnForm(f => ({ ...f, productSummary: e.target.value }))} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-widest mb-1 block">Reason</label>
                    <select className="w-full px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition"
                      value={returnForm.reason} onChange={e => setReturnForm(f => ({ ...f, reason: e.target.value as OnlineReturn["reason"] }))}>
                      {["Defective","Wrong item","Not as described","Changed mind","Other"].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-widest mb-1 block">Amount (TND)</label>
                    <input type="text" inputMode="decimal" className="w-full px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/60 transition"
                      value={returnForm.amount}
                      onChange={e => setReturnForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>

                {createError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{createError}</p>}

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white transition">Cancel</button>
                  <button onClick={handleCreateReturn} disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#c8202f] hover:bg-[#e02d3c] text-white font-bold text-xs transition disabled:opacity-60">
                    {submitting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                    {t("newReturn")}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}