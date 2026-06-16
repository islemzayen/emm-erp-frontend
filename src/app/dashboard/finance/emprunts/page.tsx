"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import {
  empruntService,
  type Emprunt,
  type EmpruntPayment, 
  type EmpruntPaymentMethod,
} from "@/services/finance/empruntService";
import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";

function tnd(v: number | undefined | null) {
  return `${(v ?? 0).toLocaleString("fr-TN", { minimumFractionDigits: 3 })} TND`;
}

function fmtDate(v?: string | null) {
  return v ? new Date(v).toLocaleDateString("fr-TN") : "—";
}

function getErrorMessage(err: unknown, fallback: string) {
  if (
    typeof err === "object" && err !== null &&
    "response" in err && typeof err.response === "object" && err.response !== null &&
    "data" in err.response && typeof err.response.data === "object" && err.response.data !== null &&
    "message" in err.response.data && typeof err.response.data.message === "string"
  ) return err.response.data.message;
  return fallback;
}

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";
const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 dark:border-slate-800 dark:bg-slate-950 dark:text-white";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400";

const METHOD_LABELS: Record<EmpruntPaymentMethod, string> = {
  ESPECE: "Espèces",
  CHEQUE: "Chèque",
  VIREMENT: "Virement",
  AUTRE: "Autre",
};

const emptyForm = () => ({
  lenderName: "",
  label: "",
  totalAmount: "",
  startDate: new Date().toISOString().slice(0, 10),
  notes: "",
});

const emptyPayment = () => ({
  amount: "",
  method: "VIREMENT" as EmpruntPaymentMethod,
  paidAt: new Date().toISOString().slice(0, 10),
  notes: "",
});

export default function FinanceEmpruntsPage() {
  const [emprunts, setEmprunts] = useState<Emprunt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm());

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payForm, setPayForm] = useState(emptyPayment());
  const [payingId, setPayingId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      setEmprunts(await empruntService.getAll());
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Échec du chargement"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const totals = useMemo(() => {
    const totalDebt = emprunts.reduce((s, e) => s + e.totalAmount, 0);
    const totalPaid = emprunts.reduce((s, e) => s + e.amountPaid, 0);
    const open = emprunts.filter((e) => e.status === "OPEN").length;
    return { totalDebt, totalPaid, remaining: totalDebt - totalPaid, open };
  }, [emprunts]);

  const handleCreate = async () => {
    if (!form.lenderName.trim()) { setError("Le prêteur (source) est obligatoire"); return; }
    if (!(Number(form.totalAmount) > 0)) { setError("Le montant total doit être supérieur à 0"); return; }
    try {
      setSubmitting(true);
      setError("");
      await empruntService.create({
        lenderName: form.lenderName.trim(),
        label: form.label.trim() || undefined,
        totalAmount: Number(form.totalAmount),
        startDate: form.startDate || undefined,
        notes: form.notes.trim() || undefined,
      });
      setForm(emptyForm());
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Échec de la création"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPayment = async (id: string) => {
    if (!(Number(payForm.amount) > 0)) { setError("Le montant du règlement doit être supérieur à 0"); return; }
    try {
      setPayingId(id);
      setError("");
      await empruntService.addPayment(id, {
        amount: Number(payForm.amount),
        method: payForm.method,
        paidAt: payForm.paidAt || undefined,
        notes: payForm.notes.trim() || undefined,
      });
      setPayForm(emptyPayment());
      await load();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Échec du règlement"));
    } finally {
      setPayingId(null);
    }
  };

  const handleDeletePayment = async (id: string, paymentId: string) => {
    try {
      setError("");
      await empruntService.deletePayment(id, paymentId);
      await load();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Échec de la suppression"));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setError("");
      await empruntService.remove(id);
      await load();
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Échec de la suppression"));
    }
  };

  const statCards = [
    { label: "Dette totale", value: tnd(totals.totalDebt) },
    { label: "Total remboursé", value: tnd(totals.totalPaid) },
    { label: "Restant dû", value: tnd(totals.remaining) },
    { label: "Emprunts en cours", value: String(totals.open) },
  ];

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "FINANCE_MANAGER"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <Banknote size={18} className="text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                Emprunts
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Suivez les dettes et enregistrez les règlements partiels jusqu&apos;à solde.
              </p>
            </div>
          </div>
          <button
            onClick={() => { setShowForm((v) => !v); setError(""); }}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            <Plus size={15} /> Nouvel emprunt
          </button>
        </div>

        {error && (
          <div className="flex items-start justify-between rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
            <button onClick={() => setError("")} className="ml-4 shrink-0 hover:opacity-70">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statCards.map((c) => (
            <div key={c.label} className={`${surface} px-6 py-5`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
                {c.label}
              </p>
              <p className="mt-2 text-xl font-bold text-slate-900 dark:text-white">{c.value}</p>
            </div>
          ))}
        </div>

        {/* Create form */}
        {showForm && (
          <div className={`${surface} p-6`}>
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              Nouvel emprunt
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass}>Prêteur / Source</label>
                <input
                  className={inputClass}
                  placeholder="Banque, associé, fournisseur…"
                  value={form.lenderName}
                  onChange={(e) => setForm((f) => ({ ...f, lenderName: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelClass}>Libellé (optionnel)</label>
                <input
                  className={inputClass}
                  placeholder="Crédit véhicule, avance…"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelClass}>Montant total (TND)</label>
                <input
                  className={inputClass}
                  type="number"
                  min="0"
                  step="0.001"
                  placeholder="0.000"
                  value={form.totalAmount}
                  onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelClass}>Date de début</label>
                <input
                  className={inputClass}
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Notes</label>
                <input
                  className={inputClass}
                  placeholder="Détails de l'emprunt…"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setShowForm(false); setError(""); }}
                className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Annuler
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950"
              >
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Créer l&apos;emprunt
              </button>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className={`${surface} flex items-center justify-center gap-2 py-20 text-sm text-slate-500`}>
            <Loader2 size={16} className="animate-spin" /> Chargement…
          </div>
        ) : emprunts.length === 0 ? (
          <div className={`${surface} flex flex-col items-center justify-center gap-2 py-20 text-sm text-slate-400`}>
            <Banknote size={32} className="opacity-30" />
            Aucun emprunt enregistré.
          </div>
        ) : (
          <div className="space-y-4">
            {emprunts.map((e) => {
              const pct = e.totalAmount > 0 ? Math.min(100, (e.amountPaid / e.totalAmount) * 100) : 0;
              const isOpen = expandedId === e._id;
              const settled = e.status === "SETTLED";
              return (
                <div key={e._id} className={`${surface} overflow-hidden`}>
                  <div className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-950 dark:text-white">{e.empruntNo}</span>
                          {settled ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <CheckCircle2 size={11} /> Soldé
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                              En cours
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                          {e.lenderName}{e.label ? ` — ${e.label}` : ""}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">Depuis le {fmtDate(e.startDate)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Restant dû</p>
                        <p className={`text-xl font-bold ${settled ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"}`}>
                          {tnd(e.remainingAmount)}
                        </p>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="mt-4">
                      <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>Remboursé : {tnd(e.amountPaid)}</span>
                        <span>Total : {tnd(e.totalAmount)}</span>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full transition-all ${settled ? "bg-emerald-500" : "bg-slate-900 dark:bg-white"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <button
                        onClick={() => { setExpandedId(isOpen ? null : e._id); setPayForm(emptyPayment()); setError(""); }}
                        className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800"
                      >
                        <ChevronDown size={13} className={`transition ${isOpen ? "rotate-180" : ""}`} />
                        Détails & règlements ({e.payments.length})
                      </button>
                      <button
                        onClick={() => handleDelete(e._id)}
                        className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-medium text-rose-500 transition hover:bg-rose-50 dark:border-slate-800 dark:hover:bg-rose-950/20"
                      >
                        <Trash2 size={13} /> Supprimer
                      </button>
                    </div>
                  </div>

                  {/* Expanded panel */}
                  {isOpen && (
                    <div className="border-t border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-950/40">
                      {/* Add payment */}
                      {!settled && (
                        <div className="mb-5 grid gap-3 sm:grid-cols-[120px_140px_140px_1fr_auto]">
                          <div>
                            <label className={labelClass}>Montant</label>
                            <input
                              className={inputClass}
                              type="number"
                              min="0"
                              step="0.001"
                              placeholder="0.000"
                              value={payForm.amount}
                              onChange={(ev) => setPayForm((p) => ({ ...p, amount: ev.target.value }))}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Mode</label>
                            <select
                              className={inputClass}
                              value={payForm.method}
                              onChange={(ev) => setPayForm((p) => ({ ...p, method: ev.target.value as EmpruntPaymentMethod }))}
                            >
                              {Object.entries(METHOD_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={labelClass}>Date</label>
                            <input
                              className={inputClass}
                              type="date"
                              value={payForm.paidAt}
                              onChange={(ev) => setPayForm((p) => ({ ...p, paidAt: ev.target.value }))}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Notes</label>
                            <input
                              className={inputClass}
                              placeholder="Référence, chèque n°…"
                              value={payForm.notes}
                              onChange={(ev) => setPayForm((p) => ({ ...p, notes: ev.target.value }))}
                            />
                          </div>
                          <div className="flex items-end">
                            <button
                              onClick={() => handleAddPayment(e._id)}
                              disabled={payingId === e._id}
                              className="inline-flex h-[42px] items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950"
                            >
                              {payingId === e._id ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                              Régler
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Payments list */}
                      {e.payments.length === 0 ? (
                        <p className="text-sm text-slate-400">Aucun règlement enregistré.</p>
                      ) : (
                        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-100 text-left text-[11px] uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              <tr>
                                <th className="px-4 py-2 font-semibold">Date</th>
                                <th className="px-4 py-2 font-semibold">Mode</th>
                                <th className="px-4 py-2 font-semibold">Notes</th>
                                <th className="px-4 py-2 text-right font-semibold">Montant</th>
                                <th className="px-4 py-2"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {e.payments.map((p: EmpruntPayment) => (
                                <tr key={p._id} className="bg-white dark:bg-slate-900">
                                  <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{fmtDate(p.paidAt)}</td>
                                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{METHOD_LABELS[p.method]}</td>
                                  <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{p.notes || "—"}</td>
                                  <td className="px-4 py-2 text-right font-semibold text-slate-900 dark:text-white">{tnd(p.amount)}</td>
                                  <td className="px-4 py-2 text-right">
                                    <button
                                      onClick={() => handleDeletePayment(e._id, p._id)}
                                      className="text-slate-400 transition hover:text-rose-500"
                                    >
                                      <Trash2 size={13} />
                                    </button>
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
              );
            })}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}