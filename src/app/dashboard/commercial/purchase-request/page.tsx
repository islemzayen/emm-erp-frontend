"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import {
  supplementaryRequestService,
  SupplementaryRequest,
} from "@/services/purchase/supplementaryRequestService";
import {
  supplementaryCategoryService,
  SupplementaryCategory,
} from "@/services/purchase/supplementaryCategoryService";
import { useEffect, useState } from "react";
import {
  ShoppingCart,
  Plus,
  Loader2,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
} from "lucide-react";

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const inputCls =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white";

const labelCls =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400";

function getErr(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const r = (err as { response: { data?: { message?: string } } }).response;
    if (typeof r.data?.message === "string") return r.data.message;
  }
  if (err instanceof Error) return err.message;
  return "An error occurred";
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-TN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const STATUS_CLS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  SUBMITTED: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  APPROVED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  REJECTED: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
};

const PRIORITY_CLS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  NORMAL: "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400",
  URGENT: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
};

const emptyForm = {
  title: "",
  category: "",
  quantity: 1,
  unit: "pcs",
  reason: "",
};

export default function CommercialPurchaseRequestPage() {
  const [requests, setRequests] = useState<SupplementaryRequest[]>([]);
  const [categories, setCategories] = useState<SupplementaryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const [all, cats] = await Promise.all([
        supplementaryRequestService.getAll(),
        supplementaryCategoryService.getActive(),
      ]);
      setRequests(all.filter((r) => r.department === "COMMERCIAL"));
      setCategories(cats);
    } catch (err) {
      setError(getErr(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.category || !form.reason.trim()) {
      setFormError("Title, category and reason are required.");
      return;
    }
    try {
      setSaving(true);
      setFormError("");
      const created = await supplementaryRequestService.create({
        ...form,
        department: "COMMERCIAL",
      });
      await supplementaryRequestService.submit(created._id);
      setShowForm(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setFormError(getErr(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "COMMERCIAL_MANAGER"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
              Commercial · Purchase
            </p>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <ShoppingCart size={18} className="text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                  Purchase Requests
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Request non-stock items · forwarded to Purchase team
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={() => { setShowForm(true); setFormError(""); }}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
          >
            <Plus size={15} /> New Request
          </button>
        </div>

        {error && (
          <div className="flex items-center justify-between rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600">
            {error}
            <button onClick={() => setError("")}><X size={14} /></button>
          </div>
        )}

        {/* List */}
        <div className={`${surface} overflow-hidden`}>
          <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">My Requests</h2>
            <p className="mt-0.5 text-sm text-slate-500">{requests.length} request(s)</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Loading...
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <ShoppingCart size={20} className="text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">No requests yet</p>
              <p className="mt-1 text-xs text-slate-400">Click "New Request" to get started</p>
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
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {requests.map((r) => (
                    <tr key={r._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20">
                      <td className="px-6 py-4 font-mono text-xs font-bold text-slate-950 dark:text-white">
                        {r.requestNo}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900 dark:text-white">{r.title}</p>
                        {r.reason && <p className="text-xs text-slate-400">{r.reason}</p>}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {categories.find((c) => c.name === r.category)?.label ?? r.category ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                        {r.quantity} {r.unit}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_CLS[r.status] ?? ""}`}>
                          {r.status === "SUBMITTED" && <Clock size={10} />}
                          {r.status === "APPROVED" && <CheckCircle2 size={10} />}
                          {r.status === "REJECTED" && <XCircle size={10} />}
                          {r.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">{fmtDate(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className={`${surface} w-full max-w-lg p-6`}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-semibold text-slate-950 dark:text-white">New Purchase Request</h3>
              <button
                onClick={() => { setShowForm(false); setForm(emptyForm); }}
                className="rounded-xl p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-950/20 dark:text-rose-400">
                  {formError}
                </p>
              )}

              <div>
                <label className={labelCls}>Item / Title *</label>
                <input
                  required
                  autoFocus
                  className={inputCls}
                  placeholder="What do you need?"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div>
                <label className={labelCls}>Category *</label>
                <select
                  required
                  className={inputCls}
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                >
                  <option value="">— Select category —</option>
                  {categories.map((c) => (
                    <option key={c._id} value={c.name}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Quantity *</label>
                  <input
                    required
                    type="number"
                    min={1}
                    className={inputCls}
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                  />
                </div>
                <div>
                  <label className={labelCls}>Unit</label>
                  <input
                    className={inputCls}
                    placeholder="pcs, kg, box…"
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  />
                </div>
              </div>


              <div>
                <label className={labelCls}>Reason *</label>
                <textarea
                  required
                  rows={3}
                  className={inputCls}
                  placeholder="Why do you need this?"
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setForm(emptyForm); }}
                  className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  {saving ? "Sending…" : "Send Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
