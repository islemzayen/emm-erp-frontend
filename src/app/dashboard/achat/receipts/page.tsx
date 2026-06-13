"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import {
  purchaseReceiptService,
  PurchaseReceipt,
} from "@/services/purchase/purchaseReceiptService";
import { useEffect, useMemo, useState } from "react";
import {
  PackageCheck,
  Search,
  Loader2,
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
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

const QUALITY_CLS: Record<string, string> = {
  ACCEPTED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  WITH_RESERVATION: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  REJECTED: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
};

const QUALITY_LABEL: Record<string, string> = {
  ACCEPTED: "Accepted",
  WITH_RESERVATION: "With Reservation",
  REJECTED: "Rejected",
};

const STATUS_CLS: Record<string, string> = {
  FULL: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  PARTIAL: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  LITIGATION: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
};

export default function PurchaseReceiptsPage() {
  const [receipts, setReceipts] = useState<PurchaseReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setReceipts(await purchaseReceiptService.getAll());
      } catch (err) {
        setError(getErr(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return receipts.filter(
      (r) =>
        !q ||
        [r.receiptNo, r.supplierId.name, r.purchaseOrderId?.orderNo]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [receipts, search]);

  const stats = useMemo(
    () => ({
      total: receipts.length,
      full: receipts.filter((r) => r.receiptStatus === "FULL").length,
      litigation: receipts.filter((r) => r.receiptStatus === "LITIGATION").length,
    }),
    [receipts]
  );

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
                <PackageCheck size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  Goods Receipts
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  All received deliveries · stock auto-updated on receipt
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-between rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600">
            {error}
            <button onClick={() => setError("")}><X size={14} /></button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total GRs", value: stats.total, Icon: PackageCheck, cls: "text-slate-600", bg: "bg-slate-100 dark:bg-slate-800" },
            { label: "Full Receipt", value: stats.full, Icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
            { label: "Litigation", value: stats.litigation, Icon: AlertTriangle, cls: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-950/30" },
          ].map(({ label, value, Icon, cls, bg }) => (
            <div key={label} className={`${surface} flex items-center gap-4 px-5 py-5`}>
              <div className={`rounded-2xl p-3 ${bg}`}>
                <Icon size={16} className={cls} />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className={`${surface} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Receipt Log</h2>
              <p className="mt-0.5 text-sm text-slate-500">{filtered.length} receipt(s)</p>
            </div>
            <div className="relative w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search GR, supplier, PO..."
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <PackageCheck size={20} className="text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">No goods receipts yet</p>
              <p className="mt-1 text-xs text-slate-400">Created when a PO is received</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    <th className="px-6 py-3 font-medium">GR No</th>
                    <th className="px-6 py-3 font-medium">PO Ref</th>
                    <th className="px-6 py-3 font-medium">Supplier</th>
                    <th className="px-6 py-3 font-medium">Product</th>
                    <th className="px-6 py-3 font-medium">Qty Received</th>
                    <th className="px-6 py-3 font-medium">Quality</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Rating</th>
                    <th className="px-6 py-3 font-medium">Depot</th>
                    <th className="px-6 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((r) => {
                    const line = r.lines[0];
                    return (
                      <tr key={r._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20">
                        <td className="px-6 py-4 font-mono text-xs font-bold text-slate-950 dark:text-white">
                          {r.receiptNo}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {r.purchaseOrderId?.orderNo ?? "—"}
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-900 dark:text-white">{r.supplierId.name}</p>
                          <p className="text-xs text-slate-400">{r.supplierId.supplierNo}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                          {line?.productId?.name ?? "—"}
                        </td>
                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                          {line ? (
                            <span>
                              <span className="font-semibold">{line.acceptedQuantity}</span>
                              <span className="text-slate-400"> / {line.orderedQuantity}</span>
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-6 py-4">
                          {line ? (
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${QUALITY_CLS[line.qualityStatus] ?? ""}`}>
                              {QUALITY_LABEL[line.qualityStatus] ?? line.qualityStatus}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_CLS[r.receiptStatus] ?? ""}`}>
                            {r.receiptStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {r.supplierRating ? (
                            <span className="flex items-center gap-0.5 text-amber-500">
                              {"★".repeat(r.supplierRating)}
                              <span className="ml-1 text-xs font-semibold text-slate-500">{r.supplierRating}/5</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {r.depotId?.name ?? "—"}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">{fmtDate(r.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
