"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import {
  financeService,
  FinancePayable,
  FinanceReceivable,
} from "@/services/finance/financeService";
import { useLanguage } from "@/context/LanguageContext";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  FileText,
  Loader2,
  X,
} from "lucide-react";

/* ─── helpers ─── */
const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const inputCls =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-blue-500";

function tnd(v: number) {
  return v.toLocaleString("fr-TN", { minimumFractionDigits: 3 });
}

function getErr(e: unknown, fallback = "Erreur") {
  const msg =
    typeof e === "object" && e !== null &&
    "response" in e &&
    typeof (e as { response?: { data?: { message?: string } } }).response?.data?.message === "string"
      ? (e as { response: { data: { message: string } } }).response.data.message
      : null;
  return msg ?? fallback;
}

/* ─── constants ─── */
const PAY_STATUS_BADGE: Record<string, string> = {
  NON_PAYEE: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  PARTIELLEMENT_PAYEE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  PENDING_CHEQUE: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  PAYEE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const SUP_STATUS_BADGE: Record<string, string> = {
  PENDING_APPROVAL: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  APPROVED: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  REJECTED: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  PARTIALLY_PAID: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

/* ═══════════════════════════════════════════════════════════════ */
export default function FinancePayablesPage() {
  const { t } = useLanguage();

  const PAYMENT_METHODS = [
    { value: "BANK_TRANSFER", label: t("fin_bankTransfer") },
    { value: "CHECK", label: t("fin_cheque") },
    { value: "CASH", label: t("fin_cash") },
  ];

  const PAY_STATUS_LABEL: Record<string, string> = {
    NON_PAYEE: t("fin_notPaid"),
    PARTIELLEMENT_PAYEE: t("fin_partialPaid"),
    PENDING_CHEQUE: t("fin_chequeSubmitted"),
    PAYEE: t("fin_paid"),
  };

  const SUP_STATUS_LABEL: Record<string, string> = {
    PENDING_APPROVAL: "En attente",
    APPROVED: "Approuvée",
    REJECTED: "Rejetée",
    PARTIALLY_PAID: t("fin_partialPaid"),
    PAID: "Soldée",
  };

  const [receivables, setReceivables] = useState<FinanceReceivable[]>([]);
  const [payables, setPayables] = useState<FinancePayable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* pay modal */
  const [payTarget, setPayTarget] = useState<FinancePayable | null>(null);
  const [payMethod, setPayMethod] = useState("BANK_TRANSFER");
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [payNotes, setPayNotes] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  async function load() {
    try {
      setLoading(true);
      setError("");
      const [r, p] = await Promise.all([
        financeService.getReceivables(),
        financeService.getPayables(),
      ]);
      setReceivables(r);
      setPayables(p);
    } catch (e) {
      setError(getErr(e, "Erreur lors du chargement"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  /* ── summary numbers ── */
  const recSummary = useMemo(() => {
    const toCollect = receivables.reduce((s, r) => s + (r.amount ?? 0), 0);
    const collected = receivables.reduce((s, r) => s + (r.amountPaid ?? 0), 0);
    const pending = receivables.filter(
      (r) => r.paymentStatus === "NON_PAYEE" || r.paymentStatus === "PARTIELLEMENT_PAYEE"
    ).length;
    return { toCollect, collected, pending };
  }, [receivables]);

  const paySummary = useMemo(() => ({
    outstanding: payables.reduce((s, p) => s + p.outstanding, 0),
    paid: payables.reduce((s, p) => s + p.amountPaid, 0),
    overdue: payables.filter((p) => p.isOverdue).length,
  }), [payables]);

  const netPosition = recSummary.toCollect - paySummary.outstanding;

  /* ── pay modal helpers ── */
  function openPay(item: FinancePayable) {
    setPayTarget(item);
    setPayAmount(item.outstanding.toFixed(3));
    setPayDate(new Date().toISOString().split("T")[0]);
    setPayMethod("BANK_TRANSFER");
    setPayNotes("");
    setPayError("");
  }
  function closePay() { setPayTarget(null); setPayError(""); }

  async function submitPay(e: React.FormEvent) {
    e.preventDefault();
    if (!payTarget) return;
    const amount = parseFloat(payAmount.replace(",", "."));
    if (!amount || amount <= 0) { setPayError("Montant invalide."); return; }
    if (amount > payTarget.outstanding + 0.001) {
      setPayError(`Dépasse le restant dû (${tnd(payTarget.outstanding)} ${t("fin_tnd")}).`);
      return;
    }
    setPaying(true); setPayError("");
    try {
      await financeService.payPayable(payTarget._id, { method: payMethod, amount, paymentDate: payDate, notes: payNotes });
      await load();
      closePay();
    } catch (e) {
      setPayError(getErr(e, "Échec du paiement"));
    } finally {
      setPaying(false);
    }
  }

  const canPay = (p: FinancePayable) =>
    (p.status === "APPROVED" || p.status === "PARTIALLY_PAID") && p.outstanding > 0.001;

  /* ─── render ─── */
  return (
    <ProtectedRoute allowedRoles={["ADMIN", "FINANCE_MANAGER"]}>
      <div className="space-y-8">

        {/* Page title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{t("fin_payTitle")}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t("fin_paySubtitle")}
          </p>
        </div>

        {error && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className={`${surface} flex items-center justify-center gap-2 py-20 text-sm text-slate-500 dark:text-slate-400`}>
            <Loader2 size={16} className="animate-spin" />
            {t("fin_inProgress")}
          </div>
        ) : (
          <>
            {/* ── NET POSITION BANNER ── */}
            <div className={`${surface} flex flex-col items-center justify-center gap-1 py-6 text-center`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                {t("fin_netCashPosition")}
              </p>
              <p className={`mt-1 text-4xl font-extrabold tracking-tight ${netPosition >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {netPosition >= 0 ? "+" : ""}{tnd(netPosition)} {t("fin_tnd")}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {t("fin_expectedInflows")}&nbsp;
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">+{tnd(recSummary.toCollect)}</span>
                &nbsp;—&nbsp;{t("fin_dueDisbursements")}&nbsp;
                <span className="font-semibold text-rose-600 dark:text-rose-400">−{tnd(paySummary.outstanding)}</span>
              </p>
            </div>

            {/* ════════════════════════════════════════════
                SECTION 1 — ENCAISSEMENTS CLIENTS
            ════════════════════════════════════════════ */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30">
                  <ArrowDownLeft size={16} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{t("fin_clientInflows")}</h2>
                  <p className="text-xs text-slate-400">{t("fin_clientOwes")}</p>
                </div>
              </div>

              {/* Receivables KPIs */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className={`${surface} p-5`}>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t("fin_toCollectLabel")}</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    {tnd(recSummary.toCollect)} {t("fin_tnd")}
                  </p>
                </div>
                <div className={`${surface} p-5`}>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t("fin_alreadyCollected")}</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
                    {tnd(recSummary.collected)} {t("fin_tnd")}
                  </p>
                </div>
                <div className={`${surface} p-5`}>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t("fin_unpaidInvoices")}</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-amber-500">{recSummary.pending}</p>
                </div>
              </div>

              {/* Receivables table */}
              <div className={`${surface} overflow-hidden`}>
                <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                  <p className="font-medium text-slate-950 dark:text-white">
                    {t("fin_clientReceivablesTable")} ({receivables.length})
                  </p>
                </div>
                {receivables.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <FileText size={28} className="mb-2 text-slate-300 dark:text-slate-700" />
                    <p className="text-sm text-slate-400">{t("fin_noReceivables")}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/50">
                        <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                          <th className="px-6 py-3 font-medium">{t("fin_client")}</th>
                          <th className="px-6 py-3 font-medium">{t("fin_orderCol")}</th>
                          <th className="px-6 py-3 font-medium">{t("fin_invoiceCol")}</th>
                          <th className="px-6 py-3 font-medium">{t("fin_totalTtc")}</th>
                          <th className="px-6 py-3 font-medium">{t("fin_collected")}</th>
                          <th className="px-6 py-3 font-medium">{t("fin_remaining")}</th>
                          <th className="px-6 py-3 font-medium">{t("fin_status")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {receivables.map((r) => {
                          const outstanding = (r.totalTtc ?? 0) - (r.amountPaid ?? 0);
                          return (
                            <tr key={r._id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/30">
                              <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">{r.customerName}</td>
                              <td className="px-6 py-3 text-slate-600 dark:text-slate-300 font-mono text-xs">{r.orderNo}</td>
                              <td className="px-6 py-3 text-slate-500 dark:text-slate-400 text-xs">{r.invoiceNo ?? "—"}</td>
                              <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">
                                {tnd(r.totalTtc ?? 0)} {t("fin_tnd")}
                              </td>
                              <td className="px-6 py-3 text-emerald-600 dark:text-emerald-400">
                                {tnd(r.amountPaid ?? 0)} {t("fin_tnd")}
                              </td>
                              <td className={`px-6 py-3 font-semibold ${outstanding > 0.001 ? "text-rose-600 dark:text-rose-400" : "text-slate-400"}`}>
                                {outstanding > 0.001 ? `${tnd(outstanding)} ${t("fin_tnd")}` : "—"}
                              </td>
                              <td className="px-6 py-3">
                                {r.paymentStatus ? (
                                  <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${PAY_STATUS_BADGE[r.paymentStatus] ?? ""}`}>
                                    {PAY_STATUS_LABEL[r.paymentStatus] ?? r.paymentStatus}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
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

            {/* ════════════════════════════════════════════
                SECTION 2 — DÉCAISSEMENTS FOURNISSEURS
            ════════════════════════════════════════════ */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-900/30">
                  <ArrowUpRight size={16} className="text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{t("fin_supplierDisbursements")}</h2>
                  <p className="text-xs text-slate-400">{t("fin_pendingApproved")}</p>
                </div>
              </div>

              {/* Payables KPIs */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className={`${surface} p-5`}>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t("fin_remaining")}</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                    {tnd(paySummary.outstanding)} {t("fin_tnd")}
                  </p>
                </div>
                <div className={`${surface} p-5`}>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t("fin_alreadyPaid")}</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
                    {tnd(paySummary.paid)} {t("fin_tnd")}
                  </p>
                </div>
                <div className={`${surface} p-5`}>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t("fin_overdue")}</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-amber-500">{paySummary.overdue}</p>
                </div>
              </div>

              {/* Payables table */}
              <div className={`${surface} overflow-hidden`}>
                <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                  <p className="font-medium text-slate-950 dark:text-white">
                    {t("fin_supplierPayables")} ({payables.length})
                  </p>
                </div>
                {payables.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <FileText size={28} className="mb-2 text-slate-300 dark:text-slate-700" />
                    <p className="text-sm text-slate-400">{t("fin_noPayables")}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {payables.map((p) => (
                      <div key={p._id} className="flex items-center gap-3 px-6 py-4">
                        <div className="min-w-0 flex-1 grid gap-2 md:grid-cols-[1.4fr_0.9fr_0.9fr_0.9fr]">
                          {/* Invoice info */}
                          <div>
                            <p className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">{p.invoiceNo}</p>
                            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                              {p.supplierName} {p.supplierNo ? `(${p.supplierNo})` : ""}
                            </p>
                          </div>
                          {/* Status + overdue */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${SUP_STATUS_BADGE[p.status] ?? ""}`}>
                              {SUP_STATUS_LABEL[p.status] ?? p.status}
                            </span>
                            {p.isOverdue && (
                              <span className="inline-block rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-900/30 dark:text-rose-400">
                                {t("fin_overdue")}
                              </span>
                            )}
                          </div>
                          {/* Dates */}
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            <p>{t("fin_invoice")} : {p.invoiceDate ? new Date(p.invoiceDate).toLocaleDateString("fr-TN") : "—"}</p>
                            <p>{t("fin_dueDate")} : {p.dueDate ? new Date(p.dueDate).toLocaleDateString("fr-TN") : "—"}</p>
                          </div>
                          {/* Amounts */}
                          <div className="text-right text-sm">
                            <p className="font-bold text-slate-900 dark:text-white">{tnd(p.outstanding)} {t("fin_tnd")}</p>
                            <p className="text-slate-400 text-xs">{t("fin_paid")} : {tnd(p.amountPaid)} {t("fin_tnd")}</p>
                          </div>
                        </div>

                        {/* Payer button */}
                        {canPay(p) ? (
                          <button
                            type="button"
                            onClick={() => openPay(p)}
                            className="ml-3 shrink-0 inline-flex items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                          >
                            <CreditCard size={13} />
                            {t("fin_confirm")}
                          </button>
                        ) : (
                          <div className="ml-3 w-[84px]" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ─── Pay modal ─── */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closePay} />
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">

            {/* Modal header */}
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-950 dark:text-white">{t("fin_recordPayment")}</p>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {payTarget.invoiceNo} — {payTarget.supplierName}
                </p>
              </div>
              <button
                type="button"
                onClick={closePay}
                className="inline-flex h-8 w-8 items-center justify-center rounded-2xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={submitPay} className="space-y-4">

              {/* Summary strip */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 space-y-1.5 text-sm dark:border-slate-800 dark:bg-slate-800/50">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>{t("fin_totalTtc")}</span>
                  <span className="font-medium text-slate-900 dark:text-white">{tnd(payTarget.totalTtc)} {t("fin_tnd")}</span>
                </div>
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>{t("fin_alreadyPaid")}</span>
                  <span className="font-medium text-slate-900 dark:text-white">{tnd(payTarget.amountPaid)} {t("fin_tnd")}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold text-emerald-600 dark:border-slate-700 dark:text-emerald-400">
                  <span>{t("fin_remaining")}</span>
                  <span>{tnd(payTarget.outstanding)} {t("fin_tnd")}</span>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  {t("fin_amountField")}
                </label>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  required
                  className={inputCls}
                />
              </div>

              {/* Method */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  {t("fin_paymentMethod")}
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  required
                  className={inputCls}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  {t("fin_paymentDate")}
                </label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  required
                  className={inputCls}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                  {t("fin_notes")}
                </label>
                <textarea
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  rows={2}
                  className={inputCls + " resize-none"}
                />
              </div>

              {payError && (
                <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
                  <AlertTriangle size={13} />
                  {payError}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closePay}
                  className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {t("fin_cancel")}
                </button>
                <button
                  type="submit"
                  disabled={paying}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {paying ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                  {paying ? t("fin_inProgress") : t("fin_confirm")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
