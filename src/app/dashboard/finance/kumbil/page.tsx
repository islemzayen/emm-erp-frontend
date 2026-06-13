"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import {
  customerInvoiceService,
  type CustomerInvoice,
} from "@/services/commercial/customerInvoiceService";
import { financeService, type CompanySettings } from "@/services/finance/financeService";
import { printKambialTemplate } from "@/lib/pdfExport";
import { useLanguage } from "@/context/LanguageContext";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  FileText,
  Loader2,
  Printer,
  Search,
  Trash2,
} from "lucide-react";

const surface =
  "rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";

function getErrorMessage(err: unknown, fallback: string) {
  if (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof (err as { response?: { data?: { message?: string } } }).response?.data?.message ===
      "string"
  ) {
    return (err as { response: { data: { message: string } } }).response.data.message;
  }
  return fallback;
}

type Tab = "installments" | "invoices";

export default function KumbilPage() {
  const { t } = useLanguage();
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("installments");
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [printingKey, setPrintingKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [inv, cfg] = await Promise.all([
        customerInvoiceService.getAllKumbil(),
        financeService.getSettings().catch(() => null),
      ]);
      setInvoices(inv);
      setSettings(cfg);
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("fin_kumbilLoadError")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return invoices.filter((inv) =>
      [inv.invoiceNo, inv.customerName, inv.salesOrderId?.orderNo || ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [invoices, search]);

  const withPending = useMemo(
    () => filtered.filter((inv) => inv.installments.some((i) => i.status !== "PAID")),
    [filtered]
  );

  const companyPayload = useMemo(
    () =>
      settings
        ? {
            name: settings.companyName,
            address: settings.address,
            phone: settings.phone,
            mf: settings.mf,
            rib: settings.rib,
            bank: settings.bank,
            agence: settings.agence,
          }
        : undefined,
    [settings]
  );

  // ── Tab 1: print one installment + mark as emitted ────────────────────────
  const handlePrint = async (invoice: CustomerInvoice, index: number) => {
    const installment = invoice.installments[index];
    const key = `${invoice._id}:${index}`;
    try {
      setPrintingKey(key);
      setError("");
      await printKambialTemplate(
        {
          installmentNumber: index + 1,
          totalInstallments: invoice.installments.length,
          amount: installment.plannedAmount,
          dueDate: installment.dueDate,
          issueDate: new Date().toISOString(),
          invoiceNo: invoice.invoiceNo,
          customerName: invoice.customerName,
          customerAddress: invoice.customerAddress,
          customerMf: invoice.customerMf,
          company: companyPayload,
        },
        `traite-${invoice.invoiceNo}-${index + 1}.pdf`
      );
      if (window.confirm("La traite a été générée. Marquer comme émise ?")) {
        await customerInvoiceService.registerPayment(invoice._id, {
          method: "KUMBIL",
          amount: installment.plannedAmount,
          dueDate: installment.dueDate,
          installmentIndex: index,
        });
        await load();
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erreur lors de la génération de la traite."));
    } finally {
      setPrintingKey(null);
    }
  };

  // ── Tab 2: print full-invoice kambial (single traite for total amount) ────
  const handlePrintInvoice = async (invoice: CustomerInvoice) => {
    const key = invoice._id;
    try {
      setPrintingKey(key);
      setError("");
      const firstPending = invoice.installments.find((i) => i.status !== "PAID");
      const fallbackDue = new Date(Date.now() + 30 * 86400000)
        .toISOString()
        .split("T")[0];
      const dueDate = firstPending?.dueDate ?? fallbackDue;
      await printKambialTemplate(
        {
          installmentNumber: 1,
          totalInstallments: 1,
          amount: invoice.totalTtc,
          dueDate,
          issueDate: new Date().toISOString(),
          invoiceNo: invoice.invoiceNo,
          customerName: invoice.customerName,
          customerAddress: invoice.customerAddress,
          customerMf: invoice.customerMf,
          company: companyPayload,
        },
        `traite-${invoice.invoiceNo}.pdf`
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erreur lors de la génération de la traite."));
    } finally {
      setPrintingKey(null);
    }
  };

  const handleCancel = async (invoice: CustomerInvoice, index: number) => {
    const key = `${invoice._id}:${index}`;
    if (!confirm("Supprimer cette traite ? Elle sera retirée du calendrier.")) return;
    try {
      setDeletingKey(key);
      setError("");
      await customerInvoiceService.cancelInstallment(invoice._id, index);
      await load();
    } catch (err: unknown) {
      setError(getErrorMessage(err, t("fin_kumbilDeleteError")));
    } finally {
      setDeletingKey(null);
    }
  };

  // ── Tab badge counts ──────────────────────────────────────────────────────
  const pendingCount = withPending.reduce(
    (acc, inv) => acc + inv.installments.filter((i) => i.status !== "PAID").length,
    0
  );

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "FINANCE_MANAGER"]}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            {t("fin_kumbilTitle")}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t("fin_kumbilSubtitle")}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900/60">
          <button
            onClick={() => setActiveTab("installments")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              activeTab === "installments"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <CalendarDays size={15} />
            Traites en attente
            {pendingCount > 0 && (
              <span className="ml-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("invoices")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              activeTab === "invoices"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            <FileText size={15} />
            Factures Kimbial
            {filtered.length > 0 && (
              <span className="ml-1 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                {filtered.length}
              </span>
            )}
          </button>
        </div>

        {/* Error */}
        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        ) : null}

        {/* Search */}
        <div className={`${surface} flex items-center gap-3 px-5 py-3.5`}>
          <Search size={15} className="shrink-0 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("fin_kumbilSearch")}
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none dark:text-white"
          />
        </div>

        {/* Loading */}
        {loading ? (
          <div className={`${surface} flex items-center justify-center gap-2 py-16 text-sm text-slate-500 dark:text-slate-400`}>
            <Loader2 size={16} className="animate-spin" />
            {t("fin_loading")}
          </div>
        ) : (
          <>
            {/* ── TAB 1: installment-level pending kambials ─────────────────── */}
            {activeTab === "installments" && (
              !withPending.length ? (
                <div className={`${surface} flex flex-col items-center justify-center py-16`}>
                  <CalendarDays size={32} className="mb-3 text-slate-300 dark:text-slate-700" />
                  <p className="text-sm text-slate-400 dark:text-slate-500">{t("fin_noKumbil")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {withPending.map((invoice) => {
                    const pending = invoice.installments.filter((i) => i.status !== "PAID");
                    return (
                      <div key={invoice._id} className={`${surface} overflow-hidden`}>
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {invoice.invoiceNo}
                            </p>
                            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                              {invoice.salesOrderId?.orderNo || "-"} · {invoice.customerName}
                            </p>
                          </div>
                          <div className="text-right text-sm">
                            <p className="font-medium text-slate-900 dark:text-white">
                              {invoice.totalTtc.toLocaleString("fr-TN", { minimumFractionDigits: 3 })} {t("fin_tnd")}
                            </p>
                            <p className="text-slate-400 dark:text-slate-500">
                              {pending.length} {pending.length !== 1 ? t("fin_kumbilDrafts") : t("fin_kumbilDraft")} {t("fin_kumbilPending")}
                            </p>
                          </div>
                        </div>

                        <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
                          {invoice.installments.map((installment, index) => {
                            if (installment.status === "PAID") return null;
                            const key = `${invoice._id}:${index}`;
                            const due = new Date(
                              installment.dueDate + (installment.dueDate.includes("T") ? "" : "T12:00:00")
                            );
                            return (
                              <div
                                key={installment._id}
                                className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
                              >
                                <div className="flex items-center gap-4">
                                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-violet-100 text-sm font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                                    {index + 1}
                                  </div>
                                  <div>
                                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                                      {installment.plannedAmount.toLocaleString("fr-TN", { minimumFractionDigits: 3 })}{" "}
                                      {t("fin_tnd")}
                                    </p>
                                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                      <CalendarDays size={11} />
                                      <span>{t("fin_kumbilDue")}</span>
                                      <span className="font-medium text-slate-700 dark:text-slate-200">
                                        {due.toLocaleDateString("fr-TN", {
                                          day: "2-digit",
                                          month: "long",
                                          year: "numeric",
                                        })}
                                      </span>
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handlePrint(invoice, index)}
                                    disabled={printingKey === key || deletingKey === key}
                                    className="inline-flex items-center gap-1.5 rounded-2xl border border-teal-300 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 transition hover:bg-teal-100 disabled:opacity-60 dark:border-teal-700 dark:bg-teal-950/20 dark:text-teal-300 dark:hover:bg-teal-950/40"
                                  >
                                    {printingKey === key ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                                    {printingKey === key ? "..." : "Imprimer la traite"}
                                  </button>
                                  <button
                                    onClick={() => handleCancel(invoice, index)}
                                    disabled={deletingKey === key || printingKey === key}
                                    className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-300 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/20"
                                  >
                                    <Trash2 size={14} />
                                    {deletingKey === key ? "..." : t("fin_delete")}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* ── TAB 2: flat invoice list, all KUMBIL invoices ─────────────── */}
            {activeTab === "invoices" && (
              !filtered.length ? (
                <div className={`${surface} flex flex-col items-center justify-center py-16`}>
                  <FileText size={32} className="mb-3 text-slate-300 dark:text-slate-700" />
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    Aucune facture Kimbial trouvée.
                  </p>
                </div>
              ) : (
                <div className={`${surface} overflow-hidden`}>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filtered.map((invoice) => {
                      const pendingCount = invoice.installments.filter((i) => i.status !== "PAID").length;
                      const totalCount = invoice.installments.length;
                      const isPrinting = printingKey === invoice._id;
                      return (
                        <div
                          key={invoice._id}
                          className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
                        >
                          {/* Left: invoice info */}
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-100 dark:bg-teal-950/40">
                              <FileText size={18} className="text-teal-600 dark:text-teal-400" />
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {invoice.invoiceNo}
                              </p>
                              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                                {invoice.customerName}
                                {invoice.salesOrderId?.orderNo
                                  ? ` · ${invoice.salesOrderId.orderNo}`
                                  : ""}
                              </p>
                            </div>
                          </div>

                          {/* Center: amount + installment badge */}
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                              {invoice.totalTtc.toLocaleString("fr-TN", { minimumFractionDigits: 3 })} TND
                            </span>
                            {totalCount > 0 && (
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  pendingCount > 0
                                    ? "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                }`}
                              >
                                {pendingCount > 0
                                  ? `${pendingCount}/${totalCount} en attente`
                                  : `${totalCount} réglée(s)`}
                              </span>
                            )}
                          </div>

                          {/* Right: print button */}
                          <button
                            onClick={() => handlePrintInvoice(invoice)}
                            disabled={isPrinting}
                            className="inline-flex items-center gap-1.5 rounded-2xl border border-teal-300 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700 transition hover:bg-teal-100 disabled:opacity-60 dark:border-teal-700 dark:bg-teal-950/20 dark:text-teal-300 dark:hover:bg-teal-950/40"
                          >
                            {isPrinting ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Printer size={14} />
                            )}
                            {isPrinting ? "..." : "Imprimer Kimbial"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </>
        )}
      </div>
    </ProtectedRoute>
  );
}
