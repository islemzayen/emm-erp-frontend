"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Search,
  ShoppingCart,
  Clock,
  CheckCircle2,
  XCircle,
  PlayCircle,
  X,
  Truck,
  AlertCircle,
  Package,
  Tag,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { purchaseRequestService } from "@/services/purchase/purchaseRequestService";
import {
  supplementaryRequestService,
  SupplementaryRequest,
} from "@/services/purchase/supplementaryRequestService";
import {
  supplementaryCategoryService,
  SupplementaryCategory,
} from "@/services/purchase/supplementaryCategoryService";

interface PurchaseRequest {
  _id: string;
  requestNo: string;
  productId: { _id: string; sku: string; name: string };
  requestedQuantity: number;
  department: string;
  availableBudget?: number;
  reason: string;
  priority: "LOW" | "NORMAL" | "URGENT";
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  createdBy?: { _id: string; name: string; role: string } | null;
  handledBy?: { _id: string; name: string; role: string } | null;
  notes: string;
  completedAt?: string | null;
  createdAt: string;
}

function getErr(err: unknown, fallback = "Error"): string {
  if (err && typeof err === "object" && "response" in err) {
    const r = (err as { response: { data?: { message?: string } } }).response;
    if (typeof r.data?.message === "string") return r.data.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const STATUS_CLS: Record<string, string> = {
  DRAFT: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  SUBMITTED: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  APPROVED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  REJECTED: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
};

const PRIORITY_CLS: Record<string, string> = {
  URGENT: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  LOW: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  NORMAL: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
};

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.18 }}
        className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
            <X size={13} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </div>
  );
}

export default function PurchaseRequestsPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<"stock" | "supplementary">("stock");

  // ── Stock requests ──────────────────────────────────────────
  const [stockReqs, setStockReqs] = useState<PurchaseRequest[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockError, setStockError] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [stockStatus, setStockStatus] = useState<string>("ALL");

  // ── Supplementary requests ──────────────────────────────────
  const [suppReqs, setSuppReqs] = useState<SupplementaryRequest[]>([]);
  const [suppCats, setSuppCats] = useState<SupplementaryCategory[]>([]);
  const [suppLoading, setSuppLoading] = useState(true);
  const [suppError, setSuppError] = useState("");
  const [suppSearch, setSuppSearch] = useState("");
  const [suppStatus, setSuppStatus] = useState<string>("ALL");

  // ── Action modal ────────────────────────────────────────────
  const [actionReq, setActionReq] = useState<PurchaseRequest | null>(null);
  const [actionType, setActionType] = useState<"SUBMITTED" | "APPROVED" | "REJECTED" | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [actionSaving, setActionSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  const [suppActionReq, setSuppActionReq] = useState<SupplementaryRequest | null>(null);
  const [suppActionType, setSuppActionType] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [suppActionNotes, setSuppActionNotes] = useState("");
  const [suppActionSaving, setSuppActionSaving] = useState(false);
  const [suppActionError, setSuppActionError] = useState("");

  const inputClass =
    "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-white";

  const labelClass =
    "mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400";

  const fetchStock = async () => {
    try {
      setStockLoading(true);
      setStockError("");
      setStockReqs(await purchaseRequestService.getAll());
    } catch (err) {
      setStockError(getErr(err, "Failed to load stock requests"));
    } finally {
      setStockLoading(false);
    }
  };

  const fetchSupp = async () => {
    try {
      setSuppLoading(true);
      setSuppError("");
      const [reqs, cats] = await Promise.all([
        supplementaryRequestService.getAll(),
        supplementaryCategoryService.getActive(),
      ]);
      setSuppReqs(reqs);
      setSuppCats(cats);
    } catch (err) {
      setSuppError(getErr(err, "Failed to load supplementary requests"));
    } finally {
      setSuppLoading(false);
    }
  };

  useEffect(() => { fetchStock(); fetchSupp(); }, []);

  const filteredStock = useMemo(() => {
    const q = stockSearch.toLowerCase();
    return stockReqs.filter((r) => {
      const matchSearch = !q ||
        r.requestNo.toLowerCase().includes(q) ||
        r.productId?.name?.toLowerCase().includes(q) ||
        r.productId?.sku?.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q);
      return matchSearch && (stockStatus === "ALL" || r.status === stockStatus);
    });
  }, [stockReqs, stockSearch, stockStatus]);

  const filteredSupp = useMemo(() => {
    const q = suppSearch.toLowerCase();
    return suppReqs.filter((r) => {
      const matchSearch = !q ||
        r.requestNo.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q);
      return matchSearch && (suppStatus === "ALL" || r.status === suppStatus);
    });
  }, [suppReqs, suppSearch, suppStatus]);

  const stats = useMemo(() => ({
    stockPending: stockReqs.filter((r) => r.status === "SUBMITTED").length,
    suppPending: suppReqs.filter((r) => r.status === "SUBMITTED").length,
  }), [stockReqs, suppReqs]);

  const handleStockAction = async () => {
    if (!actionReq || !actionType) return;
    try {
      setActionSaving(true);
      setActionError("");
      await purchaseRequestService.updateStatus(actionReq._id, actionType, actionNotes);
      setActionReq(null);
      setActionType(null);
      await fetchStock();
    } catch (err) {
      setActionError(getErr(err));
    } finally {
      setActionSaving(false);
    }
  };

  const handleSuppAction = async () => {
    if (!suppActionReq || !suppActionType) return;
    try {
      setSuppActionSaving(true);
      setSuppActionError("");
      await supplementaryRequestService.updateStatus(suppActionReq._id, suppActionType, suppActionNotes);
      setSuppActionReq(null);
      setSuppActionType(null);
      await fetchSupp();
    } catch (err) {
      setSuppActionError(getErr(err));
    } finally {
      setSuppActionSaving(false);
    }
  };

  const STATUS_FILTERS = ["ALL", "DRAFT", "SUBMITTED", "APPROVED", "REJECTED"];

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "PURCHASE_MANAGER"]}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {t("purchaseModule")} · ERP
          </p>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <Truck size={18} className="text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                Purchase Requests
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Stock DAs and supplementary requests from all departments
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setTab("stock")}
            className={`flex items-center gap-2 border-b-2 px-4 pb-3 text-sm font-medium transition ${
              tab === "stock"
                ? "border-slate-950 text-slate-950 dark:border-white dark:text-white"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            <Package size={14} />
            Stock Requests
            {stats.stockPending > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                {stats.stockPending}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("supplementary")}
            className={`flex items-center gap-2 border-b-2 px-4 pb-3 text-sm font-medium transition ${
              tab === "supplementary"
                ? "border-slate-950 text-slate-950 dark:border-white dark:text-white"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
            }`}
          >
            <Tag size={14} />
            Supplementary
            {stats.suppPending > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                {stats.suppPending}
              </span>
            )}
          </button>
        </div>

        {/* ── STOCK TAB ─────────────────────────────────────── */}
        {tab === "stock" && (
          <div className={`${surface} overflow-hidden`}>
            <div className="flex flex-col justify-between gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Stock Purchase Requests</h2>
                <p className="mt-0.5 text-sm text-slate-500">{filteredStock.length} request(s)</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    placeholder="Search product, reason…"
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                  />
                </div>
                <select
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  value={stockStatus}
                  onChange={(e) => setStockStatus(e.target.value)}
                >
                  {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s === "ALL" ? "All Status" : s}</option>)}
                </select>
              </div>
            </div>

            {stockLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" /> Loading...
              </div>
            ) : stockError ? (
              <div className="flex items-center gap-2 px-6 py-10 text-sm text-rose-600">
                <AlertCircle size={14} /> {stockError}
              </div>
            ) : filteredStock.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                  <ShoppingCart size={20} className="text-slate-400" />
                </div>
                <p className="text-sm text-slate-500">No stock purchase requests</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      <th className="px-6 py-3 font-medium">Ref</th>
                      <th className="px-6 py-3 font-medium">Product</th>
                      <th className="px-6 py-3 font-medium">Qty</th>
                      <th className="px-6 py-3 font-medium">Priority</th>
                      <th className="px-6 py-3 font-medium">Department</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Requested By</th>
                      <th className="px-6 py-3 font-medium">Date</th>
                      <th className="px-6 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredStock.map((req) => (
                      <tr key={req._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20">
                        <td className="px-6 py-4 font-mono text-xs font-bold text-slate-950 dark:text-white">{req.requestNo}</td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-900 dark:text-white">{req.productId?.name || "—"}</p>
                          <p className="text-xs text-slate-400">{req.productId?.sku}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{req.requestedQuantity}</td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${PRIORITY_CLS[req.priority] ?? ""}`}>
                            {req.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{req.department}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_CLS[req.status] ?? ""}`}>
                            {req.status === "DRAFT" && <Clock size={10} />}
                            {req.status === "SUBMITTED" && <PlayCircle size={10} />}
                            {req.status === "APPROVED" && <CheckCircle2 size={10} />}
                            {req.status === "REJECTED" && <XCircle size={10} />}
                            {req.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {req.createdBy ? (
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">{req.createdBy.name}</p>
                              <p className="text-[10px] uppercase tracking-wide text-slate-400">{req.createdBy.role.replace(/_/g, " ")}</p>
                            </div>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">{fmtDate(req.createdAt)}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {req.status === "DRAFT" && (
                              <button
                                onClick={() => { setActionReq(req); setActionType("SUBMITTED"); setActionNotes(""); setActionError(""); }}
                                className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                              >
                                <PlayCircle size={11} /> Submit
                              </button>
                            )}
                            {req.status === "SUBMITTED" && (
                              <>
                                <button
                                  onClick={() => { setActionReq(req); setActionType("APPROVED"); setActionNotes(""); setActionError(""); }}
                                  className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                                >
                                  <CheckCircle2 size={11} /> Approve
                                </button>
                                <button
                                  onClick={() => { setActionReq(req); setActionType("REJECTED"); setActionNotes(""); setActionError(""); }}
                                  className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500"
                                >
                                  <XCircle size={11} /> Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── SUPPLEMENTARY TAB ──────────────────────────────── */}
        {tab === "supplementary" && (
          <div className={`${surface} overflow-hidden`}>
            <div className="flex flex-col justify-between gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Supplementary Requests</h2>
                <p className="mt-0.5 text-sm text-slate-500">{filteredSupp.length} request(s)</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    placeholder="Search title, category, dept…"
                    value={suppSearch}
                    onChange={(e) => setSuppSearch(e.target.value)}
                  />
                </div>
                <select
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  value={suppStatus}
                  onChange={(e) => setSuppStatus(e.target.value)}
                >
                  {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s === "ALL" ? "All Status" : s}</option>)}
                </select>
              </div>
            </div>

            {suppLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" /> Loading...
              </div>
            ) : suppError ? (
              <div className="flex items-center gap-2 px-6 py-10 text-sm text-rose-600">
                <AlertCircle size={14} /> {suppError}
              </div>
            ) : filteredSupp.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                  <Tag size={20} className="text-slate-400" />
                </div>
                <p className="text-sm text-slate-500">No supplementary requests</p>
                <p className="mt-1 text-xs text-slate-400">Stock and Commercial managers can submit requests</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                      <th className="px-6 py-3 font-medium">Ref</th>
                      <th className="px-6 py-3 font-medium">Title</th>
                      <th className="px-6 py-3 font-medium">Category</th>
                      <th className="px-6 py-3 font-medium">Qty</th>
                      <th className="px-6 py-3 font-medium">Department</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Requested By</th>
                      <th className="px-6 py-3 font-medium">Date</th>
                      <th className="px-6 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredSupp.map((req) => (
                      <tr key={req._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20">
                        <td className="px-6 py-4 font-mono text-xs font-bold text-slate-950 dark:text-white">{req.requestNo}</td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-900 dark:text-white">{req.title}</p>
                          {req.reason && <p className="text-xs text-slate-400">{req.reason}</p>}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                          {suppCats.find((c) => c.name === req.category)?.label ?? req.category ?? "—"}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                          {req.quantity} {req.unit}
                        </td>
                        <td className="px-6 py-4">
                          <span className="rounded-xl bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {req.department}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_CLS[req.status] ?? ""}`}>
                            {req.status === "SUBMITTED" && <Clock size={10} />}
                            {req.status === "APPROVED" && <CheckCircle2 size={10} />}
                            {req.status === "REJECTED" && <XCircle size={10} />}
                            {req.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {req.createdBy ? (
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">{req.createdBy.name}</p>
                              <p className="text-[10px] uppercase tracking-wide text-slate-400">{req.createdBy.role.replace(/_/g, " ")}</p>
                            </div>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">{fmtDate(req.createdAt)}</td>
                        <td className="px-6 py-4">
                          {req.status === "SUBMITTED" && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setSuppActionReq(req); setSuppActionType("APPROVED"); setSuppActionNotes(""); setSuppActionError(""); }}
                                className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                              >
                                <CheckCircle2 size={11} /> Approve
                              </button>
                              <button
                                onClick={() => { setSuppActionReq(req); setSuppActionType("REJECTED"); setSuppActionNotes(""); setSuppActionError(""); }}
                                className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500"
                              >
                                <XCircle size={11} /> Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stock action modal */}
      <AnimatePresence>
        {actionReq && actionType && (
          <Modal title={actionType === "APPROVED" ? "Approve Request" : actionType === "REJECTED" ? "Reject Request" : "Submit Request"} onClose={() => { setActionReq(null); setActionType(null); }}>
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
                <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">{actionReq.requestNo}</p>
                <p className="text-xs text-slate-500">{actionReq.productId?.name} · Qty: {actionReq.requestedQuantity}</p>
              </div>
              {actionError && <p className="rounded-2xl bg-rose-50 px-4 py-2 text-sm text-rose-600">{actionError}</p>}
              <div>
                <label className={labelClass}>Notes (optional)</label>
                <textarea className={`${inputClass} resize-none`} rows={3} value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleStockAction}
                  disabled={actionSaving}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${actionType === "APPROVED" ? "bg-emerald-600 hover:bg-emerald-500" : actionType === "REJECTED" ? "bg-rose-600 hover:bg-rose-500" : "bg-blue-600 hover:bg-blue-500"}`}
                >
                  {actionSaving ? <Loader2 size={14} className="animate-spin" /> : actionType === "APPROVED" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  Confirm
                </button>
                <button onClick={() => { setActionReq(null); setActionType(null); }} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">Cancel</button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Supplementary action modal */}
      <AnimatePresence>
        {suppActionReq && suppActionType && (
          <Modal title={suppActionType === "APPROVED" ? "Approve Request" : "Reject Request"} onClose={() => { setSuppActionReq(null); setSuppActionType(null); }}>
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
                <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">{suppActionReq.requestNo}</p>
                <p className="text-xs text-slate-500">{suppActionReq.title} · {suppActionReq.department}</p>
              </div>
              {suppActionError && <p className="rounded-2xl bg-rose-50 px-4 py-2 text-sm text-rose-600">{suppActionError}</p>}
              <div>
                <label className={labelClass}>Notes (optional)</label>
                <textarea className={`${inputClass} resize-none`} rows={3} value={suppActionNotes} onChange={(e) => setSuppActionNotes(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSuppAction}
                  disabled={suppActionSaving}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${suppActionType === "APPROVED" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-rose-600 hover:bg-rose-500"}`}
                >
                  {suppActionSaving ? <Loader2 size={14} className="animate-spin" /> : suppActionType === "APPROVED" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  Confirm
                </button>
                <button onClick={() => { setSuppActionReq(null); setSuppActionType(null); }} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">Cancel</button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </ProtectedRoute>
  );
}
