"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import {
  supplementaryRequestService,
  SupplementaryRequest,
  SupplementaryRequestPriority,
} from "@/services/purchase/supplementaryRequestService";
import {
  supplementaryCategoryService,
  SupplementaryCategory,
} from "@/services/purchase/supplementaryCategoryService";
import { useEffect, useState } from "react";
import {
  ShoppingBag,
  Plus,
  Loader2,
  X,
  ChevronDown,
  Send,
  CheckCircle2,
  XCircle,
  Trash2,
  Clock,
} from "lucide-react";

// ─── helpers ─────────────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<SupplementaryRequestPriority, string> = {
  LOW: "Basse",
  NORMAL: "Normale",
  URGENT: "Urgent",
};

const PRIORITY_COLORS: Record<SupplementaryRequestPriority, string> = {
  LOW: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  NORMAL: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  URGENT: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

const STATUS_LABELS: Record<SupplementaryRequest["status"], string> = {
  DRAFT: "Brouillon",
  SUBMITTED: "Soumise",
  APPROVED: "Approuvée",
  REJECTED: "Rejetée",
};

const STATUS_COLORS: Record<SupplementaryRequest["status"], string> = {
  DRAFT: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  SUBMITTED: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  APPROVED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  REJECTED: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

const STATUS_ICONS: Record<SupplementaryRequest["status"], React.ReactNode> = {
  DRAFT: <Clock size={12} />,
  SUBMITTED: <Send size={12} />,
  APPROVED: <CheckCircle2 size={12} />,
  REJECTED: <XCircle size={12} />,
};

const COLOR_BADGE: Record<string, string> = {
  slate:   "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  blue:    "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  violet:  "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  amber:   "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  rose:    "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  cyan:    "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  orange:  "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

function CategoryBadge({ name, categories }: { name: string; categories: SupplementaryCategory[] }) {
  const cat = categories.find((c) => c.name === name);
  if (!cat) return <span className="text-xs text-slate-400">—</span>;
  const cls = COLOR_BADGE[cat.color] ?? COLOR_BADGE.slate;
  return (
    <span className={`inline-flex items-center rounded-xl px-2 py-0.5 text-xs font-medium ${cls}`}>
      {cat.label}
    </span>
  );
}

function getError(err: unknown): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
  ) {
    return (err as { response: { data: { message: string } } }).response.data.message;
  }
  return "Une erreur est survenue";
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <X size={13} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Create form ──────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  title: "",
  category: "",
  quantity: 1,
  unit: "pcs",
  estimatedCost: 0,
  department: "",
  reason: "",
  priority: "NORMAL" as SupplementaryRequestPriority,
  notes: "",
};

function CreateModal({
  categories,
  onClose,
  onCreated,
}: {
  categories: SupplementaryCategory[];
  onClose: () => void;
  onCreated: (r: SupplementaryRequest) => void;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (field: keyof typeof EMPTY_FORM, value: string | number) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await supplementaryRequestService.create({
        ...form,
        estimatedCost: Number(form.estimatedCost) || 0,
      });
      onCreated(result);
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-slate-500 dark:focus:bg-slate-800/80";

  return (
    <Modal title="Nouvelle demande d'achat" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="rounded-xl bg-rose-50 px-4 py-2 text-xs text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
            {error}
          </p>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Désignation <span className="text-rose-500">*</span>
          </label>
          <input
            required
            className={inputCls}
            placeholder="Ex: Cartouche imprimante HP, Chaise de bureau…"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Catégorie</label>
            <div className="relative">
              <select
                className={inputCls + " appearance-none pr-8"}
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
              >
                <option value="">— Aucune —</option>
                {categories
                  .filter((c) => c.isActive)
                  .map((c) => (
                    <option key={c._id} value={c.name}>{c.label}</option>
                  ))}
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-2.5 text-slate-400" />
            </div>
            {categories.filter((c) => c.isActive).length === 0 && (
              <p className="mt-1 text-xs text-amber-500">
                Aucune catégorie active —{" "}
                <a href="/dashboard/achat/categories" className="underline">
                  en créer une
                </a>
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Priorité</label>
            <div className="relative">
              <select
                className={inputCls + " appearance-none pr-8"}
                value={form.priority}
                onChange={(e) => set("priority", e.target.value as SupplementaryRequestPriority)}
              >
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-2.5 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Quantité <span className="text-rose-500">*</span>
            </label>
            <input
              required
              type="number"
              min={1}
              className={inputCls}
              value={form.quantity}
              onChange={(e) => set("quantity", Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Unité</label>
            <input
              className={inputCls}
              placeholder="pcs"
              value={form.unit}
              onChange={(e) => set("unit", e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Coût estimé (TND)</label>
            <input
              type="number"
              min={0}
              step="0.001"
              className={inputCls}
              value={form.estimatedCost}
              onChange={(e) => set("estimatedCost", e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Département <span className="text-rose-500">*</span>
          </label>
          <input
            required
            className={inputCls}
            placeholder="Ex: STOCK, IT, RH…"
            value={form.department}
            onChange={(e) => set("department", e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Motif / Justification <span className="text-rose-500">*</span>
          </label>
          <textarea
            required
            rows={3}
            className={inputCls + " resize-none"}
            placeholder="Expliquez pourquoi cet achat est nécessaire…"
            value={form.reason}
            onChange={(e) => set("reason", e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Notes</label>
          <input
            className={inputCls}
            placeholder="Informations complémentaires…"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            {saving ? "Création…" : "Créer la demande"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Reject modal ─────────────────────────────────────────────────────────────

function RejectModal({
  request,
  onClose,
  onDone,
}: {
  request: SupplementaryRequest;
  onClose: () => void;
  onDone: (r: SupplementaryRequest) => void;
}) {
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await supplementaryRequestService.updateStatus(request._id, "REJECTED", notes);
      onDone(result);
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Rejeter ${request.requestNo}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="rounded-xl bg-rose-50 px-4 py-2 text-xs text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
            {error}
          </p>
        )}
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Motif de rejet</label>
          <textarea
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            placeholder="Expliquez pourquoi la demande est rejetée…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
            {saving ? "Rejet…" : "Confirmer le rejet"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AchatPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "PURCHASE_MANAGER";

  const [requests, setRequests] = useState<SupplementaryRequest[]>([]);
  const [categories, setCategories] = useState<SupplementaryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<SupplementaryRequest | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [reqs, cats] = await Promise.all([
        supplementaryRequestService.getAll(),
        supplementaryCategoryService.getAll(),
      ]);
      setRequests(reqs);
      setCategories(cats);
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const replace = (updated: SupplementaryRequest) =>
    setRequests((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));

  const handleSubmit = async (request: SupplementaryRequest) => {
    setActionLoading(request._id);
    try {
      replace(await supplementaryRequestService.submit(request._id));
    } catch (err) {
      setError(getError(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (request: SupplementaryRequest) => {
    setActionLoading(request._id);
    try {
      replace(await supplementaryRequestService.updateStatus(request._id, "APPROVED"));
    } catch (err) {
      setError(getError(err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (request: SupplementaryRequest) => {
    if (!confirm(`Supprimer la demande ${request.requestNo} ?`)) return;
    setActionLoading(request._id);
    try {
      await supplementaryRequestService.delete(request._id);
      setRequests((prev) => prev.filter((r) => r._id !== request._id));
    } catch (err) {
      setError(getError(err));
    } finally {
      setActionLoading(null);
    }
  };

  const counts = {
    DRAFT: requests.filter((r) => r.status === "DRAFT").length,
    SUBMITTED: requests.filter((r) => r.status === "SUBMITTED").length,
    APPROVED: requests.filter((r) => r.status === "APPROVED").length,
    REJECTED: requests.filter((r) => r.status === "REJECTED").length,
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "STOCK_MANAGER", "PURCHASE_MANAGER"]}>
      {showCreate && (
        <CreateModal
          categories={categories}
          onClose={() => setShowCreate(false)}
          onCreated={(r) => {
            setRequests((prev) => [r, ...prev]);
            setShowCreate(false);
          }}
        />
      )}
      {rejectTarget && (
        <RejectModal
          request={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onDone={(r) => { replace(r); setRejectTarget(null); }}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <ShoppingBag size={18} className="text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                Demandes d&apos;achat
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Demandes d&apos;achat supplémentaires hors stock
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            <Plus size={14} />
            Nouvelle demande
          </button>
        </div>

        {/* Summary chips */}
        <div className="grid grid-cols-4 gap-3">
          {(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"] as const).map((s) => (
            <div
              key={s}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{STATUS_LABELS[s]}</p>
                <p className="mt-0.5 text-xl font-bold text-slate-900 dark:text-white">{counts[s]}</p>
              </div>
              <span className={`flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-medium ${STATUS_COLORS[s]}`}>
                {STATUS_ICONS[s]}
              </span>
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-3 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-white py-16 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            Chargement…
          </div>
        ) : !requests.length ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white py-20 dark:border-slate-800 dark:bg-slate-900">
            <ShoppingBag size={32} className="text-slate-300 dark:text-slate-700" />
            <p className="text-sm text-slate-400 dark:text-slate-500">Aucune demande pour le moment</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-1 flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <Plus size={12} />
              Créer la première demande
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950/40">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium text-slate-500">N°</th>
                    <th className="px-5 py-3 text-left font-medium text-slate-500">Désignation</th>
                    <th className="px-5 py-3 text-left font-medium text-slate-500">Catégorie</th>
                    <th className="px-5 py-3 text-left font-medium text-slate-500">Qté</th>
                    <th className="px-5 py-3 text-left font-medium text-slate-500">Coût estimé</th>
                    <th className="px-5 py-3 text-left font-medium text-slate-500">Dépt</th>
                    <th className="px-5 py-3 text-left font-medium text-slate-500">Priorité</th>
                    <th className="px-5 py-3 text-left font-medium text-slate-500">Statut</th>
                    <th className="px-5 py-3 text-left font-medium text-slate-500">Créé par</th>
                    <th className="px-5 py-3 text-right font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {requests.map((req) => {
                    const busy = actionLoading === req._id;
                    return (
                      <tr key={req._id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {req.requestNo}
                        </td>
                        <td className="max-w-[200px] px-5 py-3.5">
                          <p className="truncate font-medium text-slate-900 dark:text-white">{req.title}</p>
                          {req.reason && (
                            <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">
                              {req.reason}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {req.category
                            ? <CategoryBadge name={req.category} categories={categories} />
                            : <span className="text-xs text-slate-400">—</span>
                          }
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                          {req.quantity} {req.unit}
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                          {req.estimatedCost > 0
                            ? req.estimatedCost.toLocaleString("fr-TN", { minimumFractionDigits: 3 }) + " TND"
                            : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                          {req.department}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`rounded-xl px-2 py-1 text-xs font-medium ${PRIORITY_COLORS[req.priority]}`}>
                            {PRIORITY_LABELS[req.priority]}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`flex w-fit items-center gap-1 rounded-xl px-2 py-1 text-xs font-medium ${STATUS_COLORS[req.status]}`}>
                            {STATUS_ICONS[req.status]}
                            {STATUS_LABELS[req.status]}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400">
                          {req.createdBy?.name || "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {busy ? (
                              <Loader2 size={14} className="animate-spin text-slate-400" />
                            ) : (
                              <>
                                {req.status === "DRAFT" && (
                                  <>
                                    <button
                                      onClick={() => handleSubmit(req)}
                                      title="Soumettre"
                                      className="flex h-7 w-7 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-600 transition hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-400"
                                    >
                                      <Send size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleDelete(req)}
                                      title="Supprimer"
                                      className="flex h-7 w-7 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-500 transition hover:bg-rose-100 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-400"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </>
                                )}
                                {req.status === "SUBMITTED" && isAdmin && (
                                  <>
                                    <button
                                      onClick={() => handleApprove(req)}
                                      title="Approuver"
                                      className="flex h-7 w-7 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-400"
                                    >
                                      <CheckCircle2 size={12} />
                                    </button>
                                    <button
                                      onClick={() => setRejectTarget(req)}
                                      title="Rejeter"
                                      className="flex h-7 w-7 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-500 transition hover:bg-rose-100 dark:border-rose-800/40 dark:bg-rose-900/20 dark:text-rose-400"
                                    >
                                      <XCircle size={12} />
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
