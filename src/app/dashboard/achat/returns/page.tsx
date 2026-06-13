"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { purchaseReturnService, PurchaseReturn } from "@/services/purchase/purchaseReturnService";
import { useEffect, useState } from "react";
import {
  Loader2,
  RotateCcw,
  Search,
  CheckCircle2,
  ChevronRight,
  Clock,
  Send,
  XCircle,
} from "lucide-react";

function fmt(n: number) {
  return n.toLocaleString("fr-TN", { minimumFractionDigits: 3 });
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

const statusConfig = {
  DRAFT: {
    label: "En attente",
    cls: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
    icon: Clock,
  },
  VALIDATED: {
    label: "Validé",
    cls: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
    icon: CheckCircle2,
  },
  SENT: {
    label: "Envoyé",
    cls: "bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400",
    icon: Send,
  },
  CLOSED: {
    label: "Clôturé",
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
    icon: XCircle,
  },
};

function ValidateButton({ ret, onDone }: { ret: PurchaseReturn; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handle = async () => {
    setLoading(true);
    setErr("");
    try {
      await purchaseReturnService.updateStatus(ret._id, "VALIDATED");
      onDone();
    } catch (e) {
      setErr(getError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handle}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? <Loader2 size={11} className="animate-spin" /> : <ChevronRight size={11} />}
        Valider
      </button>
      {err && <p className="mt-1 text-[10px] text-rose-500">{err}</p>}
    </div>
  );
}

export default function PurchaseReturnsPage() {
  const [returns, setReturns] = useState<PurchaseReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      setReturns(await purchaseReturnService.getAll());
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const q = search.toLowerCase();
  const filtered = returns.filter((r) =>
    [r.returnNo, r.supplierId?.name, r.purchaseReceiptId?.receiptNo, r.reason]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q))
  );

  const counts = {
    DRAFT: returns.filter((r) => r.status === "DRAFT").length,
    VALIDATED: returns.filter((r) => r.status === "VALIDATED").length,
    SENT: returns.filter((r) => r.status === "SENT").length,
    CLOSED: returns.filter((r) => r.status === "CLOSED").length,
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "PURCHASE_MANAGER"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
            <RotateCcw size={18} className="text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
              Bons de retour
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Validez les retours créés par les réceptionnaires
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(["DRAFT", "VALIDATED", "SENT", "CLOSED"] as const).map((s) => {
            const cfg = statusConfig[s];
            const Icon = cfg.icon;
            return (
              <div
                key={s}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${cfg.cls}`}>
                  <Icon size={14} />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{cfg.label}</p>
                  <p className="text-xl font-bold text-slate-950 dark:text-white">{counts[s]}</p>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-3 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {filtered.length} bon{filtered.length !== 1 ? "s" : ""} de retour
            </p>
            <div className="relative w-64">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" />
              Chargement…
            </div>
          ) : !filtered.length ? (
            <div className="py-16 text-center text-sm text-slate-400 dark:text-slate-500">
              Aucun bon de retour trouvé
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950/40">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">N° Retour</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">Fournisseur</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">Réception</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">Créé par</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">Motif</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-slate-500">Avoir TTC</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">Statut</th>
                    <th className="px-5 py-3 text-right text-xs font-medium text-slate-500">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((ret) => {
                    const cfg = statusConfig[ret.status];
                    const Icon = cfg.icon;
                    return (
                      <tr key={ret._id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-3.5 font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {ret.returnNo}
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-medium text-slate-900 dark:text-white">{ret.supplierId?.name}</p>
                          <p className="text-xs text-slate-400">{ret.supplierId?.supplierNo}</p>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs text-slate-500 dark:text-slate-400">
                          {ret.purchaseReceiptId?.receiptNo}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-300">
                          {ret.createdBy?.name ?? "—"}
                        </td>
                        <td className="px-5 py-3.5 max-w-[160px]">
                          <p className="truncate text-xs text-slate-600 dark:text-slate-300" title={ret.reason}>
                            {ret.reason}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-slate-900 dark:text-white">
                          {ret.totalTtc > 0 ? fmt(ret.totalTtc) : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-400">
                          {new Date(ret.createdAt).toLocaleDateString("fr-TN")}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-semibold ${cfg.cls}`}>
                            <Icon size={10} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {ret.status === "DRAFT" && (
                            <ValidateButton ret={ret} onDone={load} />
                          )}
                        </td>
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
