"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { customerInvoiceService, type CustomerInvoice, type CustomerInvoicePayment } from "@/services/commercial/customerInvoiceService";
import { useLanguage } from "@/context/LanguageContext";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCheck, CreditCard, Loader2, Search, Wallet, X } from "lucide-react";

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

const inputClass =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

function getErrorMessage(err: unknown, fallback: string) {
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof err.response === "object" &&
    err.response !== null &&
    "data" in err.response &&
    typeof err.response.data === "object" &&
    err.response.data !== null &&
    "message" in err.response.data &&
    typeof err.response.data.message === "string"
  ) {
    return err.response.data.message;
  }
  return fallback;
}

function remainingAmount(invoice: CustomerInvoice) {
  return Math.max(0, Number(invoice.totalTtc || 0) - Number(invoice.amountPaid || 0));
}

function paymentStatusClass(status: CustomerInvoice["paymentStatus"]) {
  switch (status) {
    case "NON_PAYEE":
      return "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300";
    case "PARTIELLEMENT_PAYEE":
      return "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300";
    case "PENDING_CHEQUE":
      return "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300";
    default:
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300";
  }
}

function roundAmount(value: number) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export default function FinancePaymentsPage() {
  const { t } = useLanguage();

  function paymentStatusLabel(status: CustomerInvoice["paymentStatus"]) {
    switch (status) {
      case "NON_PAYEE": return t("fin_notPaid");
      case "PARTIELLEMENT_PAYEE": return t("fin_partialPaid");
      case "PENDING_CHEQUE": return t("fin_chequeSubmitted");
      case "PAYEE": return t("fin_paid");
      default: return status;
    }
  }

  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearingId, setClearingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [payOpen, setPayOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");

  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"ESPECE" | "CHEQUE" | "VIREMENT" | "KUMBIL">("ESPECE");
  const [payReference, setPayReference] = useState("");

  const [kambyalCount, setKambyalCount] = useState("3");
  const [kambyalInterval, setKambyalInterval] = useState("0");
  const [kambyalDates, setKambyalDates] = useState<string[]>([]);
  const [kambyalDepart, setKambyalDepart] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const addDaysToDate = (dateStr: string, days: number): string => {
    const d = new Date(dateStr + "T12:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const buildEcheancesFromDepart = (depart: string, n: number, intervalDays: number): string[] =>
    Array.from({ length: n }, (_, i) => addDaysToDate(depart, intervalDays * (i + 1)));

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await customerInvoiceService.getAll();
      const pending = data.filter(
        (invoice) =>
          ["NON_PAYEE", "PARTIELLEMENT_PAYEE", "PENDING_CHEQUE"].includes(invoice.paymentStatus) &&
          invoice.paymentMethod !== "KUMBIL"
      );
      setInvoices(pending);
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("fin_failed")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const unpaidInvoices = useMemo(
    () =>
      invoices.filter((inv) =>
        ["NON_PAYEE", "PARTIELLEMENT_PAYEE"].includes(inv.paymentStatus)
      ),
    [invoices]
  );

  const chequeInvoices = useMemo(
    () => invoices.filter((inv) => inv.paymentStatus === "PENDING_CHEQUE"),
    [invoices]
  );

  const filteredUnpaid = useMemo(() => {
    const query = search.toLowerCase();
    return unpaidInvoices.filter((invoice) =>
      [invoice.invoiceNo, invoice.customerName, invoice.salesOrderId?.orderNo || ""]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [unpaidInvoices, search]);

  const filteredCheques = useMemo(() => {
    const query = search.toLowerCase();
    return chequeInvoices.filter((invoice) =>
      [invoice.invoiceNo, invoice.customerName, invoice.salesOrderId?.orderNo || ""]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [chequeInvoices, search]);

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice._id === selectedInvoiceId) || null,
    [invoices, selectedInvoiceId]
  );

  const openPay = (invoice: CustomerInvoice) => {
    setSelectedInvoiceId(invoice._id);
    setPayAmount(String(remainingAmount(invoice)));
    setPayMethod("ESPECE");
    setPayReference("");
    setKambyalCount("3");
    setKambyalInterval("0");
    setKambyalDepart(today);
    setKambyalDates([today, today, today]);
    setPayOpen(true);
  };

  const handleKambyalCountChange = (val: string) => {
    setKambyalCount(val);
    const n = Math.max(1, Number(val || 1));
    const interval = Number(kambyalInterval) || 0;
    if (interval > 0) {
      setKambyalDates(buildEcheancesFromDepart(kambyalDepart || today, n, interval));
    } else {
      setKambyalDates((prev) => {
        if (n > prev.length) return [...prev, ...Array(n - prev.length).fill(today)];
        return prev.slice(0, n);
      });
    }
  };

  const handleKambyalIntervalChange = (val: string) => {
    setKambyalInterval(val);
    const interval = Number(val) || 0;
    const n = Math.max(1, Number(kambyalCount || 1));
    if (interval > 0) {
      setKambyalDates(buildEcheancesFromDepart(kambyalDepart || today, n, interval));
    }
  };

  const handleKambyalDepartChange = (val: string) => {
    setKambyalDepart(val);
    const interval = Number(kambyalInterval) || 0;
    const n = Math.max(1, Number(kambyalCount || 1));
    if (interval > 0) {
      setKambyalDates(buildEcheancesFromDepart(val, n, interval));
    }
  };

  const updateKambyalDate = (index: number, val: string) => {
    setKambyalDates((prev) => prev.map((d, i) => (i === index ? val : d)));
  };

  const savePay = async () => {
    if (!selectedInvoice) return;
    try {
      setSaving(true);
      setError("");

      if (payMethod === "KUMBIL") {
        const n = Math.max(1, Number(kambyalCount || 1));
        const remaining = remainingAmount(selectedInvoice);
        const base = roundAmount(remaining / n);
        const amounts = Array.from({ length: n }, (_, i) =>
          i === n - 1 ? roundAmount(remaining - base * (n - 1)) : base
        );
        await customerInvoiceService.configure(selectedInvoice._id, {
          paymentMethod: "KUMBIL",
          installmentPlan: {
            mode: "CUSTOM",
            dates: kambyalDates.slice(0, n).map((d) => new Date(d + "T12:00:00").toISOString()),
            amounts,
            remainingOnly: true,
          },
        });
      } else {
        const payload: Record<string, unknown> = {
          method: payMethod,
          amount: Number(payAmount),
        };
        if (payMethod !== "CHEQUE" && payReference.trim()) {
          payload.reference = payReference.trim();
        }
        await customerInvoiceService.registerPayment(selectedInvoice._id, payload);
      }

      setPayOpen(false);
      await load();
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("fin_failed")));
    } finally {
      setSaving(false);
    }
  };

  const encaisserCheque = async (invoice: CustomerInvoice, payment: CustomerInvoicePayment) => {
    const key = `${invoice._id}:${payment._id}`;
    try {
      setClearingId(key);
      setError("");
      await customerInvoiceService.clearCheque(invoice._id, payment._id);
      await load();
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("fin_failed")));
    } finally {
      setClearingId(null);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "FINANCE_MANAGER"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            {t("fin_paymentsTitle")}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t("fin_paymentsSubtitle")}
          </p>
        </div>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        ) : null}

        <div className={`${surface} flex items-center gap-3 px-5 py-3.5`}>
          <Search size={15} className="shrink-0 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("fin_kumbilSearch")}
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none dark:text-white"
          />
        </div>

        {loading ? (
          <div className={`${surface} flex items-center justify-center gap-2 py-16 text-sm text-slate-500 dark:text-slate-400`}>
            <Loader2 size={16} className="animate-spin" />
            {t("fin_loading")}
          </div>
        ) : (
          <>
            {/* Unpaid invoices */}
            <div className={`${surface} overflow-hidden`}>
              <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                  {t("fin_invoicesToSettle")}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {t("fin_unpaidInvoicesDesc")}
                </p>
              </div>

              {!filteredUnpaid.length ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <CreditCard size={32} className="mb-3 text-slate-300 dark:text-slate-700" />
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    {t("fin_noUnpaid")}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredUnpaid.map((invoice) => (
                    <div
                      key={invoice._id}
                      className="grid gap-4 px-6 py-4 md:grid-cols-[1.1fr_0.9fr_0.8fr_auto]"
                    >
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {invoice.invoiceNo}
                        </p>
                        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                          {invoice.salesOrderId?.orderNo || "-"} · {invoice.customerName}
                        </p>
                      </div>

                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        <p>
                          {t("fin_totalLabel")}{" "}
                          <span className="font-medium text-slate-900 dark:text-white">
                            {invoice.totalTtc.toLocaleString("fr-TN", {
                              minimumFractionDigits: 3,
                            })}{" "}
                            {t("fin_tnd")}
                          </span>
                        </p>
                        <p>
                          {t("fin_remainingLabel")}{" "}
                          <span className="font-medium text-slate-900 dark:text-white">
                            {remainingAmount(invoice).toLocaleString("fr-TN", {
                              minimumFractionDigits: 3,
                            })}{" "}
                            {t("fin_tnd")}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center md:justify-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${paymentStatusClass(
                            invoice.paymentStatus
                          )}`}
                        >
                          {paymentStatusLabel(invoice.paymentStatus)}
                        </span>
                      </div>

                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => openPay(invoice)}
                          className="inline-flex items-center gap-2 rounded-2xl bg-black px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-900"
                        >
                          <Wallet size={14} />
                          {t("fin_settle")}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pending cheques */}
            <div className={`${surface} overflow-hidden`}>
              <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                  {t("fin_pendingCheques")}
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {t("fin_pendingChequesDesc")}
                </p>
              </div>

              {!filteredCheques.length ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <CheckCheck size={32} className="mb-3 text-slate-300 dark:text-slate-700" />
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    {t("fin_noPendingCheques")}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCheques.map((invoice) => {
                    const pendingPayments = invoice.payments.filter(
                      (p) => p.method === "CHEQUE" && p.status === "PENDING"
                    );
                    return (
                      <div key={invoice._id} className="px-6 py-4">
                        <div className="mb-3">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {invoice.invoiceNo}
                          </p>
                          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                            {invoice.salesOrderId?.orderNo || "-"} · {invoice.customerName}
                          </p>
                        </div>
                        <div className="space-y-2">
                          {pendingPayments.map((payment) => {
                            const key = `${invoice._id}:${payment._id}`;
                            const dueDate = payment.dueDate ? new Date(payment.dueDate) : null;
                            const isCleared = dueDate ? dueDate <= new Date() : true;
                            return (
                              <div
                                key={payment._id}
                                className="flex items-center justify-between rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 dark:border-sky-900/30 dark:bg-sky-950/20"
                              >
                                <div className="text-sm">
                                  <p className="font-medium text-slate-900 dark:text-white">
                                    {payment.reference || "CHQ"} —{" "}
                                    {Number(payment.amount).toLocaleString("fr-TN", {
                                      minimumFractionDigits: 3,
                                    })}{" "}
                                    {t("fin_tnd")}
                                  </p>
                                  {dueDate ? (
                                    <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                                      {t("fin_encashableDate")}{" "}
                                      {dueDate.toLocaleDateString("fr-TN")}
                                      {!isCleared ? (
                                        <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">
                                          {t("fin_notDue")}
                                        </span>
                                      ) : null}
                                    </p>
                                  ) : null}
                                </div>
                                <button
                                  onClick={() => encaisserCheque(invoice, payment)}
                                  disabled={!isCleared || clearingId === key}
                                  className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:opacity-50"
                                >
                                  <CheckCheck size={14} />
                                  {clearingId === key ? "..." : t("fin_encash")}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {payOpen && selectedInvoice ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
            <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
                    {t("fin_recordClientPayment")}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {selectedInvoice.invoiceNo} · {selectedInvoice.customerName}
                  </p>
                </div>
                <button
                  onClick={() => setPayOpen(false)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                  <p>
                    {t("fin_remainingAmount")}{" "}
                    <strong className="text-slate-900 dark:text-white">
                      {remainingAmount(selectedInvoice).toLocaleString("fr-TN", {
                        minimumFractionDigits: 3,
                      })}{" "}
                      {t("fin_tnd")}
                    </strong>
                  </p>
                </div>

                <label className="block text-sm">
                  <span className="mb-1.5 block text-slate-600 dark:text-slate-300">
                    {t("fin_mode")}
                  </span>
                  <select
                    className={inputClass}
                    value={payMethod}
                    onChange={(e) =>
                      setPayMethod(e.target.value as "ESPECE" | "CHEQUE" | "VIREMENT" | "KUMBIL")
                    }
                  >
                    <option value="ESPECE">{t("fin_cash")}</option>
                    <option value="CHEQUE">{t("fin_cheque")}</option>
                    <option value="VIREMENT">{t("fin_bankTransfer")}</option>
                    <option value="KUMBIL">Kumbil ({t("fin_kumbilDrafts")})</option>
                  </select>
                </label>

                {payMethod === "KUMBIL" ? (
                  <>
                    <label className="block text-sm">
                      <span className="mb-1.5 block text-slate-600 dark:text-slate-300">
                        {t("fin_draftCount")}
                      </span>
                      <input
                        className={inputClass}
                        type="number"
                        min="1"
                        max="24"
                        value={kambyalCount}
                        onChange={(e) => handleKambyalCountChange(e.target.value)}
                      />
                    </label>

                    <label className="block text-sm">
                      <span className="mb-1.5 block text-slate-600 dark:text-slate-300">
                        {t("fin_periodicity")}
                      </span>
                      <select
                        className={inputClass}
                        value={kambyalInterval}
                        onChange={(e) => handleKambyalIntervalChange(e.target.value)}
                      >
                        <option value="0">{t("fin_custom")}</option>
                        <option value="30">{t("fin_30days")}</option>
                        <option value="60">{t("fin_60days")}</option>
                        <option value="90">{t("fin_90days")}</option>
                        <option value="180">{t("fin_180days")}</option>
                        <option value="360">{t("fin_360days")}</option>
                      </select>
                    </label>

                    {Number(kambyalInterval) > 0 ? (
                      <>
                        <label className="block text-sm">
                          <span className="mb-1.5 block text-slate-600 dark:text-slate-300">
                            {t("fin_firstDraftDate")}
                          </span>
                          <input
                            className={inputClass}
                            type="date"
                            value={kambyalDepart}
                            onChange={(e) => handleKambyalDepartChange(e.target.value)}
                          />
                        </label>
                        <div className="space-y-1.5">
                          {kambyalDates.slice(0, Math.max(1, Number(kambyalCount || 1))).map((echeance, i) => (
                            <div key={i} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950">
                              <span className="text-sm text-slate-500 dark:text-slate-400">
                                {t("fin_dueDate")} {i + 1}
                              </span>
                              <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                                {echeance
                                  ? new Date(echeance + "T12:00:00").toLocaleDateString("fr-TN", {
                                      day: "2-digit", month: "long", year: "numeric",
                                    })
                                  : "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      kambyalDates.slice(0, Math.max(1, Number(kambyalCount || 1))).map((date, i) => (
                        <label key={i} className="block text-sm">
                          <span className="mb-1.5 block text-slate-600 dark:text-slate-300">
                            {t("fin_dueDate")} {i + 1}
                          </span>
                          <input
                            className={inputClass}
                            type="date"
                            value={date}
                            onChange={(e) => updateKambyalDate(i, e.target.value)}
                          />
                        </label>
                      ))
                    )}
                  </>
                ) : (
                  <>
                    <label className="block text-sm">
                      <span className="mb-1.5 block text-slate-600 dark:text-slate-300">{t("fin_amount")}</span>
                      <input
                        className={inputClass}
                        type="number"
                        min="0"
                        step="0.001"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                      />
                    </label>

                    {payMethod === "CHEQUE" ? (
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                        {t("fin_chequeNote")}
                      </div>
                    ) : (
                      <label className="block text-sm">
                        <span className="mb-1.5 block text-slate-600 dark:text-slate-300">
                          {t("fin_reference")}
                        </span>
                        <input
                          className={inputClass}
                          value={payReference}
                          onChange={(e) => setPayReference(e.target.value)}
                        />
                      </label>
                    )}
                  </>
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setPayOpen(false)}
                  className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  {t("fin_cancel")}
                </button>
                <button
                  onClick={savePay}
                  disabled={saving || (payMethod !== "KUMBIL" && !payAmount)}
                  className="rounded-2xl bg-black px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? t("fin_saving") : t("fin_save")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </ProtectedRoute>
  );
}
