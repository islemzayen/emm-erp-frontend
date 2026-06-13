"use client";

import ProtectedRoute from "@/components/ProtectedRoute";
import { financeService, AccountingJournalEntry } from "@/services/finance/financeService";
import { useLanguage } from "@/context/LanguageContext";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2, Search } from "lucide-react";

function getErrorMessage(err: unknown) {
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
  return "Échec du chargement du journal";
}

const moduleLabel: Record<string, string> = {
  COMMERCIAL: "Commercial",
  PURCHASE: "Achat",
  FINANCE: "Finance",
};

export default function FinanceJournalPage() {
  const { t } = useLanguage();
  const [entries, setEntries] = useState<AccountingJournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const entryTypeLabel: Record<string, string> = {
    INVOICE_ISSUED: t("fin_entryInvoiceIssued"),
    REGLEMENT_RECU: t("fin_entryPaymentReceived"),
    PAYABLE_RECORDED: t("fin_entrySupplierInvoice"),
    PAYABLE_PAYMENT: t("fin_entrySupplierPayment"),
    PAYABLE_CREDIT: t("fin_entryCreditNote"),
    MANUAL_ENTRY: t("fin_entryManual"),
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError("");
        setEntries(await financeService.getJournal());
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      const typeLabel = (entryTypeLabel[e.entryType] || e.entryType).toLowerCase();
      const modLabel  = (moduleLabel[e.sourceModule] || e.sourceModule).toLowerCase();
      const dateStr   = new Date(e.occurredAt).toLocaleDateString("fr-TN").toLowerCase();
      const lineMatch = e.lines.some((l) =>
        String(l.accountCode).toLowerCase().includes(q) ||
        String(l.accountName).toLowerCase().includes(q)
      );
      return (
        (e.reference || "").toLowerCase().includes(q) ||
        (e.counterpartyName || "").toLowerCase().includes(q) ||
        typeLabel.includes(q) ||
        modLabel.includes(q) ||
        dateStr.includes(q) ||
        lineMatch
      );
    });
  }, [entries, search, entryTypeLabel]);

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "FINANCE_MANAGER"]}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
              <BookOpen size={18} className="text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                {t("fin_journalTitle")}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("fin_journalSubtitle")}
              </p>
            </div>
          </div>

          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher référence, compte, contrepartie..."
              className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:ring-teal-950/30"
            />
          </div>
        </div>

        {error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-400">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-white py-16 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <Loader2 size={16} className="animate-spin" />
            {t("fin_loadingJournal")}
          </div>
        ) : !filteredEntries.length ? (
          <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white py-16 text-sm text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500">
            {search ? "Aucune écriture ne correspond à la recherche" : t("fin_noJournalEntries")}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {filteredEntries.length} {filteredEntries.length !== 1 ? "écritures" : "écriture"}
              {search && entries.length !== filteredEntries.length ? ` sur ${entries.length}` : ""}
            </p>
            {filteredEntries.map((entry) => (
              <div
                key={entry._id}
                className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
                  <div>
                    <h2 className="font-semibold text-slate-950 dark:text-white">
                      {entry.reference || entry.sourceType}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {entryTypeLabel[entry.entryType] || entry.entryType}
                      {entry.counterpartyName ? ` · ${entry.counterpartyName}` : ""}
                      {" · "}
                      {new Date(entry.occurredAt).toLocaleDateString("fr-TN")}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {moduleLabel[entry.sourceModule] || entry.sourceModule}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-sm dark:divide-slate-800">
                    <thead className="bg-slate-50 dark:bg-slate-950/40">
                      <tr>
                        <th className="px-6 py-3 text-left font-medium text-slate-500">{t("fin_accountCol")}</th>
                        <th className="px-6 py-3 text-left font-medium text-slate-500">{t("fin_accountLabel")}</th>
                        <th className="px-6 py-3 text-right font-medium text-slate-500">{t("fin_debit")}</th>
                        <th className="px-6 py-3 text-right font-medium text-slate-500">{t("fin_credit")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {entry.lines.map((line, index) => (
                        <tr key={`${entry._id}-${line.accountCode}-${index}`}>
                          <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">
                            {line.accountCode}
                          </td>
                          <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                            {line.accountName}
                          </td>
                          <td className="px-6 py-3 text-right text-slate-900 dark:text-white">
                            {line.side === "DEBIT"
                              ? `${line.amount.toLocaleString("fr-TN", { minimumFractionDigits: 3 })} ${t("fin_tnd")}`
                              : "—"}
                          </td>
                          <td className="px-6 py-3 text-right text-slate-900 dark:text-white">
                            {line.side === "CREDIT"
                              ? `${line.amount.toLocaleString("fr-TN", { minimumFractionDigits: 3 })} ${t("fin_tnd")}`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
