"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { financeService, AccountingAccount } from "@/services/finance/financeService";
import { useLanguage } from "@/context/LanguageContext";
import { useEffect, useState } from "react";
import { Landmark, Loader2, RefreshCw } from "lucide-react";

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

export default function FinanceAccountsPage() {
  const { t } = useLanguage();

  const entryTypeLabel: Record<string, string> = {
    INVOICE_ISSUED: t("fin_entryInvoiceIssued"),
    REGLEMENT_RECU: t("fin_entryPaymentReceived"),
    PAYABLE_RECORDED: t("fin_supplierDebt"),
    PAYABLE_PAYMENT: t("fin_entrySupplierPayment"),
    PAYABLE_CREDIT: t("fin_entryCreditNote"),
    MANUAL_ENTRY: t("fin_entryManual"),
  };

  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [globalTotals, setGlobalTotals] = useState<{ inflow: number; outflow: number; netFlow: number }>({ inflow: 0, outflow: 0, netFlow: 0 });
  const [selected, setSelected] = useState<AccountingAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resyncing, setResyncing] = useState(false);
  const [resyncMsg, setResyncMsg] = useState("");

  const currentYear = new Date().getFullYear();
  const [filterYear, setFilterYear]   = useState<number | "">(currentYear);
  const [filterMonth, setFilterMonth] = useState<number | "">("");

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError("");
      const filters: { year?: number; month?: number } = {};
      if (filterYear !== "") filters.year = Number(filterYear);
      if (filterMonth !== "") filters.month = Number(filterMonth);
      const data = await financeService.getAccounts(filters);
      setAccounts(data.accounts);
      setGlobalTotals(data.totals);
      setSelected((prev) => data.accounts.find((a) => a.accountCode === prev?.accountCode) || data.accounts[0] || null);
    } catch (err) {
      setError(getErrorMessage(err, t("fin_loadFailed")));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAccounts(); }, [filterYear, filterMonth]);

  const yearOptions  = Array.from({ length: 6 }, (_, i) => currentYear - i);
  const monthOptions = [
    { v: 1, l: "Janvier" }, { v: 2, l: "Février" }, { v: 3, l: "Mars" },
    { v: 4, l: "Avril" }, { v: 5, l: "Mai" }, { v: 6, l: "Juin" },
    { v: 7, l: "Juillet" }, { v: 8, l: "Août" }, { v: 9, l: "Septembre" },
    { v: 10, l: "Octobre" }, { v: 11, l: "Novembre" }, { v: 12, l: "Décembre" },
  ];

  const handleResync = async () => {
    try {
      setResyncing(true);
      setResyncMsg("");
      const result = await financeService.resyncFinanceEntries();
      setResyncMsg(
        `${t("fin_resyncDone")} — ${result.totalClientInvoices} ${t("fin_clientInvoices")}, ${result.totalPurchaseInvoices} ${t("fin_supplierInvoices")}.`
      );
      await loadAccounts();
    } catch {
      setResyncMsg(t("fin_resyncFailed"));
    } finally {
      setResyncing(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "FINANCE_MANAGER"]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <Landmark size={18} className="text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                {t("fin_accTitle")}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("fin_accSubtitle")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value === "" ? "" : Number(e.target.value))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-teal-950/30"
            >
              <option value="">Toutes années</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value === "" ? "" : Number(e.target.value))}
              disabled={filterYear === ""}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-teal-950/30"
            >
              <option value="">Toute l&apos;année</option>
              {monthOptions.map((m) => (
                <option key={m.v} value={m.v}>{m.l}</option>
              ))}
            </select>
            <button
              onClick={handleResync}
              disabled={resyncing}
              className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RefreshCw size={14} className={resyncing ? "animate-spin" : ""} />
              {resyncing ? t("fin_resyncing") : t("fin_resyncBtn")}
            </button>
          </div>
        </div>

        {resyncMsg && (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400">
            {resyncMsg}
          </div>
        )}

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-white py-16 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            {t("fin_loadingLedger")}
          </div>
        ) : !accounts.length ? (
          <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white py-16 text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500">
            {t("fin_noAccounts")}
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            {/* Account list */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <h2 className="font-semibold text-slate-950 dark:text-white">{t("fin_accountsPanel")}</h2>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {accounts.map((account) => (
                  <button
                    key={account.accountCode}
                    onClick={() => setSelected(account)}
                    className={`w-full px-5 py-4 text-left transition ${
                      selected?.accountCode === account.accountCode
                        ? "bg-slate-100 dark:bg-slate-800/70"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">
                          {account.accountCode} · {account.accountName}
                        </p>
                        <p className="mt-1 text-xs">
                          <span className="text-emerald-600 dark:text-emerald-400">+{account.inflow.toLocaleString("fr-TN", { minimumFractionDigits: 3 })}</span>
                          <span className="text-slate-400"> · </span>
                          <span className="text-rose-600 dark:text-rose-400">−{account.outflow.toLocaleString("fr-TN", { minimumFractionDigits: 3 })}</span>
                        </p>
                      </div>
                      <div className={`shrink-0 text-right text-sm font-semibold ${
                        account.netFlow > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : account.netFlow < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-slate-500 dark:text-slate-400"
                      }`}>
                        {account.netFlow > 0 ? "+" : ""}{account.netFlow.toLocaleString("fr-TN", { minimumFractionDigits: 3 })} {t("fin_tnd")}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Ledger detail column */}
            <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                <h2 className="font-semibold text-slate-950 dark:text-white">
                  {selected
                    ? `${selected.accountCode} · ${selected.accountName}`
                    : t("fin_selectAccount")}
                </h2>
                {selected ? (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Net{" "}
                    <span className={`font-semibold ${
                      selected.netFlow > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : selected.netFlow < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-slate-500 dark:text-slate-400"
                    }`}>
                      {selected.netFlow > 0 ? "+" : ""}{selected.netFlow.toLocaleString("fr-TN", { minimumFractionDigits: 3 })} {t("fin_tnd")}
                    </span>
                    <span className="text-slate-400"> · </span>
                    <span className="text-emerald-600 dark:text-emerald-400">+{selected.inflow.toLocaleString("fr-TN", { minimumFractionDigits: 3 })}</span>
                    <span className="text-slate-400"> entrant · </span>
                    <span className="text-rose-600 dark:text-rose-400">−{selected.outflow.toLocaleString("fr-TN", { minimumFractionDigits: 3 })}</span>
                    <span className="text-slate-400"> sortant</span>
                  </p>
                ) : null}
              </div>

              {selected && selected.entries.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
                    <thead className="bg-slate-50 dark:bg-slate-950/40">
                      <tr>
                        <th className="px-6 py-3 text-left font-medium text-slate-500">{t("fin_date")}</th>
                        <th className="px-6 py-3 text-left font-medium text-slate-500">{t("fin_reference")}</th>
                        <th className="px-6 py-3 text-left font-medium text-slate-500">{t("fin_type")}</th>
                        <th className="px-6 py-3 text-right font-medium text-slate-500">Mouvement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {selected.entries.map((entry) => {
                        const isInflow  = entry.direction === "INFLOW";
                        const isOutflow = entry.direction === "OUTFLOW";
                        const cellColor = isInflow
                          ? "text-emerald-600 dark:text-emerald-400"
                          : isOutflow
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-slate-500 dark:text-slate-400";
                        const sign  = isInflow ? "+" : isOutflow ? "−" : "";
                        return (
                          <tr key={`${selected.accountCode}-${entry.journalEntryId}-${entry.side}-${entry.amount}`}>
                            <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                              {new Date(entry.occurredAt).toLocaleDateString("fr-TN")}
                            </td>
                            <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">
                              {entry.reference || "—"}
                            </td>
                            <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                              {entryTypeLabel[entry.entryType] || entry.entryType}
                            </td>
                            <td className={`px-6 py-3 text-right font-semibold ${cellColor}`}>
                              {sign}{entry.amount.toLocaleString("fr-TN", { minimumFractionDigits: 3 })} {t("fin_tnd")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : selected ? (
                <div className="flex items-center justify-center py-16 text-sm text-slate-400 dark:text-slate-500">
                  {t("fin_noMovements")}
                </div>
              ) : null}
            </div>

            {/* Global totals — sum across the whole grand livre */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Totaux globaux</p>
                <h3 className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
                  Somme du grand livre (tous comptes)
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-3 dark:bg-slate-800">
                <div className="bg-white px-6 py-5 dark:bg-slate-900">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Entrant total</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    +{globalTotals.inflow.toLocaleString("fr-TN", { minimumFractionDigits: 3 })}
                    <span className="ml-1 text-sm font-medium text-slate-400">{t("fin_tnd")}</span>
                  </p>
                </div>
                <div className="bg-white px-6 py-5 dark:bg-slate-900">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-rose-600 dark:text-rose-400">Sortant total</p>
                  <p className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
                    −{globalTotals.outflow.toLocaleString("fr-TN", { minimumFractionDigits: 3 })}
                    <span className="ml-1 text-sm font-medium text-slate-400">{t("fin_tnd")}</span>
                  </p>
                </div>
                <div className="bg-white px-6 py-5 dark:bg-slate-900">
                  <p className={`text-[11px] font-semibold uppercase tracking-widest ${
                    globalTotals.netFlow > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : globalTotals.netFlow < 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-slate-500 dark:text-slate-400"
                  }`}>Net global</p>
                  <p className={`mt-2 text-2xl font-bold ${
                    globalTotals.netFlow > 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : globalTotals.netFlow < 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-slate-700 dark:text-slate-200"
                  }`}>
                    {globalTotals.netFlow > 0 ? "+" : ""}{globalTotals.netFlow.toLocaleString("fr-TN", { minimumFractionDigits: 3 })}
                    <span className="ml-1 text-sm font-medium text-slate-400">{t("fin_tnd")}</span>
                  </p>
                </div>
              </div>
            </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
