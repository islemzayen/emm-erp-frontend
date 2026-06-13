"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useEffect, useMemo, useState } from "react";
import {
  purchaseInvoiceService,
  PurchaseInvoice,
} from "@/services/purchase/purchaseInvoiceService";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Receipt,
  Search,
  Wallet,
  XCircle,
  AlertTriangle,
  X,
  Clock,
  ShieldCheck,
} from "lucide-react";

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

function getErr(err: unknown, fallback = "Error"): string {
  if (err && typeof err === "object" && "response" in err) {
    const r = (err as { response: { data?: { message?: string } } }).response;
    if (typeof r.data?.message === "string") return r.data.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-TN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function fmtAmount(n?: number | null) {
  return Number(n || 0).toLocaleString("fr-TN", { minimumFractionDigits: 3 });
}

const STATUS_CLS: Record<string, string> = {
  PENDING_APPROVAL:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  APPROVED:
    "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  REJECTED:
    "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
  PARTIALLY_PAID:
    "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  PAID:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
};

export default function PurchaseInvoicesPage() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [rejectModal, setRejectModal] = useState<{
    invoice: PurchaseInvoice;
    reason: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError("");
      setInvoices(await purchaseInvoiceService.getAll());
    } catch (err) {
      setError(getErr(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const stats = useMemo(
    () => ({
      total: invoices.length,
      pending: invoices.filter((i) => i.status === "PENDING_APPROVAL").length,
      approved: invoices.filter((i) => i.status === "APPROVED").length,
      paid: invoices.filter((i) => i.status === "PAID").length,
      mismatch: invoices.filter((i) => i.matchingStatus === "MISMATCH").length,
    }),
    [invoices]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter((inv) => {
      const matchStatus =
        statusFilter === "ALL" || inv.status === statusFilter;
      const matchSearch =
        !q ||
        [
          inv.invoiceNo,
          inv.supplierInvoiceRef,
          inv.supplierId?.name,
          inv.purchaseOrderId?.orderNo,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      return matchStatus && matchSearch;
    });
  }, [invoices, search, statusFilter]);

  const handleApprove = async (inv: PurchaseInvoice) => {
    try {
      setActionLoading(inv._id + "_approve");
      setError("");
      await purchaseInvoiceService.updateStatus(inv._id, { status: "APPROVED" });
      await fetchAll();
    } catch (err) {
      setError(getErr(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    try {
      setActionLoading(rejectModal.invoice._id + "_reject");
      setError("");
      await purchaseInvoiceService.updateStatus(rejectModal.invoice._id, {
        status: "REJECTED",
        rejectionReason: rejectModal.reason || "Rejected during purchase review",
      });
      setRejectModal(null);
      await fetchAll();
    } catch (err) {
      setError(getErr(err));
    } finally {
      setActionLoading(null);
    }
  };

  const STATUS_FILTERS = [
    { key: "ALL", label: "All" },
    { key: "PENDING_APPROVAL", label: "Pending" },
    { key: "APPROVED", label: "Approved" },
    { key: "REJECTED", label: "Rejected" },
    { key: "PARTIALLY_PAID", label: "Part. Paid" },
    { key: "PAID", label: "Paid" },
  ];

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "PURCHASE_MANAGER"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Purchasing · ERP
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <Receipt size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  Supplier Invoices
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Auto-created on goods receipt · approve to forward to Finance
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600">
            {error}
            <button onClick={() => setError("")}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {[
            {
              label: "Total",
              value: stats.total,
              Icon: FileText,
              cls: "text-slate-600 dark:text-slate-300",
              bg: "bg-slate-100 dark:bg-slate-800",
            },
            {
              label: "Pending",
              value: stats.pending,
              Icon: Clock,
              cls: "text-amber-600 dark:text-amber-400",
              bg: "bg-amber-50 dark:bg-amber-950/30",
            },
            {
              label: "Approved",
              value: stats.approved,
              Icon: ShieldCheck,
              cls: "text-sky-600 dark:text-sky-400",
              bg: "bg-sky-50 dark:bg-sky-950/30",
            },
            {
              label: "Paid",
              value: stats.paid,
              Icon: Wallet,
              cls: "text-emerald-600 dark:text-emerald-400",
              bg: "bg-emerald-50 dark:bg-emerald-950/30",
            },
            {
              label: "Mismatch",
              value: stats.mismatch,
              Icon: AlertTriangle,
              cls: "text-rose-600 dark:text-rose-400",
              bg: "bg-rose-50 dark:bg-rose-950/30",
            },
          ].map(({ label, value, Icon, cls, bg }) => (
            <div
              key={label}
              className={`${surface} flex items-center gap-4 px-5 py-5`}
            >
              <div className={`rounded-2xl p-3 ${bg}`}>
                <Icon size={16} className={cls} />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  {label}
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className={`${surface} overflow-hidden`}>
          <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Invoice Register
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {filtered.length} invoice(s)
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Status filter */}
              <div className="flex flex-wrap gap-1.5">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                      statusFilter === f.key
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {/* Search */}
              <div className="relative w-72">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search invoice, supplier, PO…"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <Receipt size={20} className="text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">No invoices found</p>
              <p className="mt-1 text-xs text-slate-400">
                Invoices are auto-created when goods are received
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    <th className="px-6 py-3 font-medium">Invoice</th>
                    <th className="px-6 py-3 font-medium">Supplier</th>
                    <th className="px-6 py-3 font-medium">PO Ref</th>
                    <th className="px-6 py-3 font-medium">HT</th>
                    <th className="px-6 py-3 font-medium">TTC</th>
                    <th className="px-6 py-3 font-medium">3-Way Match</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Due Date</th>
                    <th className="px-6 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((inv) => (
                    <tr
                      key={inv._id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20"
                    >
                      {/* Invoice No + ref */}
                      <td className="px-6 py-4">
                        <p className="font-mono text-xs font-bold text-slate-950 dark:text-white">
                          {inv.invoiceNo}
                        </p>
                        <p className="text-xs text-slate-400">
                          {inv.supplierInvoiceRef}
                        </p>
                      </td>

                      {/* Supplier */}
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900 dark:text-white">
                          {inv.supplierId?.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {inv.supplierId?.supplierNo}
                        </p>
                      </td>

                      {/* PO */}
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {inv.purchaseOrderId?.orderNo ?? "—"}
                      </td>

                      {/* HT */}
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {fmtAmount(inv.subtotalHt)} TND
                      </td>

                      {/* TTC */}
                      <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                        {fmtAmount(inv.totalTtc)} TND
                      </td>

                      {/* 3-way match */}
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            inv.matchingStatus === "MATCHED"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                              : "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400"
                          }`}
                        >
                          {inv.matchingStatus === "MATCHED" ? (
                            <>
                              <CheckCircle2 size={10} /> Matched
                            </>
                          ) : (
                            <>
                              <AlertTriangle size={10} /> Mismatch
                            </>
                          )}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            STATUS_CLS[inv.status] ?? ""
                          }`}
                        >
                          {STATUS_LABEL[inv.status] ?? inv.status}
                        </span>
                      </td>

                      {/* Due date */}
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {fmtDate(inv.dueDate)}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        {inv.status === "PENDING_APPROVAL" && (
                          <div className="flex gap-2">
                            <button
                              disabled={!!actionLoading}
                              onClick={() => handleApprove(inv)}
                              className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                            >
                              {actionLoading === inv._id + "_approve" ? (
                                <Loader2 size={10} className="animate-spin" />
                              ) : (
                                <CheckCircle2 size={10} />
                              )}
                              Approve
                            </button>
                            <button
                              disabled={!!actionLoading}
                              onClick={() =>
                                setRejectModal({ invoice: inv, reason: "" })
                              }
                              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300"
                            >
                              <XCircle size={10} />
                              Reject
                            </button>
                          </div>
                        )}
                        {(inv.status === "APPROVED" ||
                          inv.status === "PARTIALLY_PAID") && (
                          <span className="text-xs text-slate-400">
                            Awaiting payment (Finance)
                          </span>
                        )}
                        {inv.status === "PAID" && (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={11} /> Settled
                          </span>
                        )}
                        {inv.status === "REJECTED" && inv.rejectionReason && (
                          <span className="text-xs text-rose-400" title={inv.rejectionReason}>
                            Rejected
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className={`${surface} w-full max-w-md p-6`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-slate-950 dark:text-white">
                Reject Invoice
              </h3>
              <button
                onClick={() => setRejectModal(null)}
                className="rounded-xl p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
              Invoice{" "}
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {rejectModal.invoice.invoiceNo}
              </span>{" "}
              will be rejected. Please provide a reason.
            </p>
            <textarea
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              rows={3}
              placeholder="Reason for rejection…"
              value={rejectModal.reason}
              onChange={(e) =>
                setRejectModal({ ...rejectModal, reason: e.target.value })
              }
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setRejectModal(null)}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                disabled={!!actionLoading}
                onClick={handleReject}
                className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {actionLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <XCircle size={14} />
                )}
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
